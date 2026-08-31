/**
 * RCA Intelligence v1 — evidence-led investigation brief.
 *
 * Two rules the whole module follows:
 *
 *   R1. XOps has NO causal evidence today. This module never labels a
 *       pattern, an assignment group, an alert or a low-quality note as a
 *       cause. Language stays in the "investigation signal / evidence to
 *       review / candidate investigation area" register.
 *   R2. Every claim is anchored to an already-authorized deterministic
 *       aggregate that ships in the QN workbook (byDecalogue, dualAxis,
 *       compliance* banner sheets, and — when reused — the Operational
 *       Health analysis which itself only reads userByGroup and
 *       alertByGroup). No raw ticket rows.
 *
 * The output is small on purpose: 3-5 investigation signals plus one
 * evidence-quality observation, an optional alert-evidence hint, an
 * optional operational-context excerpt and a 3-step investigation
 * sequence. The drawer is the answer; /quality is the drill-down.
 */

import type { OperationalAnalysis } from "./operational-health";

/* --------------------------- input dataset shapes --------------------------- */

/** Row parsed from the By_Decalogue aggregate sheet. */
export interface DecalogueRow {
  Code?: unknown;
  Pattern?: unknown;
  Incidents?: unknown;
  [k: string]: unknown;
}

/** `facts.total` from Dual_Axis: labelled compliance-class counts and totals. */
export interface DualAxisTotals {
  DIAGNOSTICO?: number | string;
  SUSTANTIVO?: number | string;
  FORMAL_ONLY?: number | string;
  EMPTY?: number | string;
  Total?: number | string;
  [k: string]: number | string | undefined;
}

export interface RcaInput {
  corpus: {
    incidents: number | null;
    alerts: number | null;
    total: number | null;
  };
  decalogue: {
    present: boolean;
    rows: DecalogueRow[];
    /** By_Decalogue.facts.summary — carries classifiedIncidents / codeOccurrences / overcount. */
    summary: Record<string, number | string> | null;
  };
  dualAxis: {
    present: boolean;
    /** Dual_Axis.facts.total — carries the compliance-class totals. */
    total: DualAxisTotals | null;
  };
  compliance: {
    close_notes_present: boolean;
    alerts_present: boolean;
  };
  /** Reused analysis when Operational Health has been computed elsewhere. */
  operational: OperationalAnalysis | null;
}

/* --------------------------- output brief shapes --------------------------- */

export interface InvestigationSignal {
  /** Compact identifier of the pattern (e.g. "D05"). */
  code: string;
  /** Human-readable pattern label as declared in the corpus. */
  pattern: string;
  incidents: number;
  share_of_classified: number | null;
  source_dataset: "byDecalogue";
  why_review: string;
}

export interface EvidenceQualityObservation {
  low_diagnostic_count: number; // FORMAL_ONLY + EMPTY
  total_incidents: number; // Dual_Axis total row
  low_diagnostic_share: number; // 0..1
  source_dataset: "dualAxis";
  text: string;
  why_it_matters: string;
}

export interface AlertEvidenceHint {
  text: string;
  why_review: string;
  source_dataset: "complianceAlerts";
}

export interface OperationalContextItem {
  ag_name: string;
  rank_incidents: number | null;
  rank_alerts: number | null;
  incidents: number;
  alerts: number;
  why_review: string;
}

export interface RcaBrief {
  scope: "loaded_corpus";
  corpus: RcaInput["corpus"];
  signals: InvestigationSignal[];
  evidence_quality: EvidenceQualityObservation | null;
  alert_evidence: AlertEvidenceHint | null;
  operational_context: OperationalContextItem[];
  next_steps: string[];
  limitations: string[];
}

/* ------------------------------ helpers ------------------------------ */

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

/* ------------------------------ builder ------------------------------ */

const MAX_SIGNALS = 5;
const MIN_SIGNALS = 3;
const LOW_DIAG_SHARE_MIN = 0.1; // 10% before we surface an evidence-quality note

export function buildRcaInvestigationBrief(input: RcaInput): RcaBrief {
  const signals = buildInvestigationSignals(input);
  const evidence_quality = buildEvidenceQuality(input);
  const alert_evidence = buildAlertEvidenceHint(input);
  const operational_context = buildOperationalContext(input);

  return {
    scope: "loaded_corpus",
    corpus: input.corpus,
    signals,
    evidence_quality,
    alert_evidence,
    operational_context,
    next_steps: buildNextSteps({
      hasSignals: signals.length > 0,
      hasEvidenceQuality: evidence_quality !== null,
      hasOperationalContext: operational_context.length > 0,
      hasAlerts: alert_evidence !== null,
    }),
    limitations: [
      "Pattern occurrence does not establish causation.",
      "Alert correlation does not establish causation.",
      "Operational concentration does not establish root cause.",
      "Evidence quality may limit investigation confidence.",
      "Time-sequence reconstruction is not available in the current aggregate model.",
    ],
  };
}

function buildInvestigationSignals(input: RcaInput): InvestigationSignal[] {
  if (!input.decalogue.present || input.decalogue.rows.length === 0) return [];
  const classified = toNumber(input.decalogue.summary?.classifiedIncidents) ?? 0;

  const enriched = input.decalogue.rows
    .map((r) => {
      const code = asStr(r.Code);
      const pattern = asStr(r.Pattern);
      const incidents = toNumber(r.Incidents) ?? 0;
      return { code, pattern, incidents };
    })
    .filter((r) => r.code && r.incidents > 0)
    .sort(
      (a, b) => b.incidents - a.incidents || a.code.localeCompare(b.code),
    );

  const top = enriched.slice(0, MAX_SIGNALS);
  return top.map((r) => ({
    code: r.code,
    pattern: r.pattern || r.code,
    incidents: r.incidents,
    share_of_classified:
      classified > 0 ? r.incidents / classified : null,
    source_dataset: "byDecalogue",
    why_review:
      "This pattern appears in the classified incident evidence and is a candidate investigation area.",
  }));
}

function buildEvidenceQuality(
  input: RcaInput,
): EvidenceQualityObservation | null {
  if (!input.dualAxis.present || !input.dualAxis.total) return null;
  const formal = toNumber(input.dualAxis.total.FORMAL_ONLY) ?? 0;
  const empty = toNumber(input.dualAxis.total.EMPTY) ?? 0;
  const total = toNumber(input.dualAxis.total.Total) ?? 0;
  if (total <= 0) return null;
  const low = formal + empty;
  const share = low / total;
  if (share < LOW_DIAG_SHARE_MIN) return null;
  const pct = (share * 100).toFixed(1);
  return {
    low_diagnostic_count: low,
    total_incidents: total,
    low_diagnostic_share: share,
    source_dataset: "dualAxis",
    text: `${pct}% of classified incidents (${low.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}) fall in the Formal-only or Empty close-note classes.`,
    why_it_matters:
      "Lower-quality close notes may limit how confidently an investigator can reconstruct what happened.",
  };
}

function buildAlertEvidenceHint(input: RcaInput): AlertEvidenceHint | null {
  // Deliberately conservative: the compliance banner sheets carry KPIs whose
  // labels vary between workbooks. We surface the presence of alert
  // compliance evidence without fabricating a specific figure, and we leave
  // the numbers to the /quality drill-down.
  if (!input.compliance.alerts_present) return null;
  return {
    text: "Alert-side close-note compliance evidence is present in the loaded corpus.",
    why_review:
      "Alert evidence provides an additional operational signal, but does not by itself establish causation.",
    source_dataset: "complianceAlerts",
  };
}

function buildOperationalContext(input: RcaInput): OperationalContextItem[] {
  const oa = input.operational;
  if (!oa) return [];
  const cross = oa.findings.cross_signal.slice(0, 2);
  return cross.map((r) => ({
    ag_name: r.ag_name,
    rank_incidents: r.rank_incidents,
    rank_alerts: r.rank_alerts,
    incidents: r.incidents,
    alerts: r.alerts,
    why_review:
      "This Assignment Group has concentrated activity across both operational populations and may be a useful investigation starting point. It is not the root cause.",
  }));
}

function buildNextSteps(flags: {
  hasSignals: boolean;
  hasEvidenceQuality: boolean;
  hasOperationalContext: boolean;
  hasAlerts: boolean;
}): string[] {
  const steps: string[] = [];
  if (flags.hasSignals) {
    steps.push(
      "Review the strongest classified incident patterns and identify affected assignment groups.",
    );
  }
  if (flags.hasEvidenceQuality) {
    steps.push(
      "Review close-note quality for the affected operational evidence before forming a causal hypothesis.",
    );
  } else {
    steps.push(
      "Review close-note quality for the affected operational evidence before forming a causal hypothesis.",
    );
  }
  if (flags.hasOperationalContext || flags.hasAlerts) {
    steps.push(
      "Compare alert evidence and operational concentration to bound the investigation scope.",
    );
  } else {
    steps.push(
      "Confirm whether alert evidence and operational concentration data are available to bound the investigation scope.",
    );
  }
  return steps.slice(0, 3);
}
