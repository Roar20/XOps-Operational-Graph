/**
 * Operational Health — deterministic, aggregate-only analysis of the QN
 * corpus loaded in the browser.
 *
 * Scope of this module: given the userByGroup and alertByGroup aggregate
 * datasets and the corpus snapshot, produce an OperationalAnalysis that the
 * Ask XOps drawer can render as an Operational Brief. No LLM, no network,
 * no raw ticket rows.
 *
 * Two rules that everything else follows:
 *
 *   R1. Incidents and alerts are two distinct populations. Their sums are
 *       never added or averaged into a single score. Rankings and shares
 *       are computed independently per axis.
 *   R2. Assignment Groups that appear on only one axis are represented
 *       with zero / "not-present" on the other axis but are NEVER silently
 *       dropped from the analysis.
 *
 * The classification is the smallest useful method: per-axis rank plus a
 * fixed "top band". An AG in the top band on both axes is Cross-Signal; in
 * the top band on only one axis (or absent on the other) is Incident-Heavy
 * or Alert-Heavy. No arbitrary numeric thresholds. No additive score.
 */

/** Row shape parsed from the User_By_Group aggregate sheet. */
export interface UserByGroupRow {
  "Assignment Group"?: unknown;
  Incidents?: unknown;
  Poor?: unknown;
  Critical?: unknown;
  // Other columns exist but are not read by this analysis.
  [k: string]: unknown;
}

/** Row shape parsed from the Alert_By_Group aggregate sheet. */
export interface AlertByGroupRow {
  "Assignment Group"?: unknown;
  Alerts?: unknown;
  [k: string]: unknown;
}

/** Attribution evidence from the semantic-layer quality projection. */
export interface AttributionInput {
  ags_matched: number | null;
  ags_bridge: number | null;
  ags_quality: number | null;
  incident_coverage_pct: number | null;
}

export interface OperationalHealthInput {
  userRows: UserByGroupRow[];
  alertRows: AlertByGroupRow[];
  corpus: {
    incidents: number | null; // snapshot.population.user
    alerts: number | null; // snapshot.population.alert
    total: number | null; // snapshot.population.total
  };
  /** Optional. When absent, attribution surface renders as "not established". */
  attribution?: AttributionInput | null;
}

export interface OperationalSignalRow {
  ag_key: string;
  ag_name: string;
  incidents: number;
  alerts: number;
  has_incidents: boolean;
  has_alerts: boolean;
  share_incidents: number | null; // 0..1 or null when total unknown
  share_alerts: number | null;
  rank_incidents: number | null; // 1 = highest; null if not present on axis
  rank_alerts: number | null;
}

export interface OperationalQualityObservation {
  weighted_poor_critical_rate: number; // 0..1
  incidents_covered: number;
  text: string; // pre-formatted safe copy for the UI
}

export interface OperationalAttribution {
  kind: "verified" | "partial" | "incomplete";
  coverage_pct: number | null;
  ags_matched: number | null;
  ags_bridge: number | null;
  ags_quality: number | null;
  note: string;
}

export interface OperationalAnalysis {
  scope: "loaded_corpus";
  corpus: {
    incidents: number | null;
    alerts: number | null;
    total: number | null;
  };
  ags: {
    with_incidents_only: number;
    with_alerts_only: number;
    with_both: number;
    total_distinct: number;
  };
  method: {
    ranking: "per-axis descending by count";
    top_band: number; // fixed N for "top band" per axis
    classification: string[];
  };
  findings: {
    cross_signal: OperationalSignalRow[];
    incident_heavy: OperationalSignalRow[];
    alert_heavy: OperationalSignalRow[];
  };
  quality: OperationalQualityObservation | null;
  attribution: OperationalAttribution;
  limitations: string[];
}

/** Same normalizer as lib/relationships.ts::agKey — kept in sync. */
export function normalizeAssignmentGroup(s: unknown): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

interface AxisEntry {
  ag_key: string;
  ag_name: string;
  count: number;
}

function buildAxis(
  rows: Array<Record<string, unknown>>,
  countColumn: string,
): { entries: AxisEntry[]; total: number; byKey: Map<string, AxisEntry> } {
  const byKey = new Map<string, AxisEntry>();
  let total = 0;
  for (const r of rows) {
    const nameRaw = r["Assignment Group"];
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (!name) continue;
    const key = normalizeAssignmentGroup(name);
    if (!key) continue;
    const count = toNumber(r[countColumn]) ?? 0;
    // Aggregate defensively: if the sheet ever repeats an AG, sum rather than
    // silently take the last row. The QN10 invariant forbids repeats, but the
    // analysis must not depend on that being true at read time.
    const existing = byKey.get(key);
    if (existing) {
      existing.count += count;
    } else {
      byKey.set(key, { ag_key: key, ag_name: name, count });
    }
    total += count;
  }
  const entries = [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.ag_name.localeCompare(b.ag_name),
  );
  return { entries, total, byKey };
}

/**
 * Build the operational analysis. Pure function; no I/O, no random.
 *
 * @param input.userRows      rows from datasets.userByGroup.rows
 * @param input.alertRows     rows from datasets.alertByGroup.rows
 * @param input.corpus        snapshot.population fields, may be null
 * @param input.attribution   semantic-layer join_coverage, optional
 */
export function buildOperationalHealthAnalysis(
  input: OperationalHealthInput,
): OperationalAnalysis {
  const inc = buildAxis(input.userRows, "Incidents");
  const alt = buildAxis(input.alertRows, "Alerts");

  const incRankByKey = new Map<string, number>();
  inc.entries.forEach((e, i) => incRankByKey.set(e.ag_key, i + 1));
  const altRankByKey = new Map<string, number>();
  alt.entries.forEach((e, i) => altRankByKey.set(e.ag_key, i + 1));

  // Fixed top band N=10 per axis. Small, explainable, defensible for an
  // executive brief. If a corpus has fewer than 10 AGs on an axis, the band
  // shrinks to that size naturally.
  const TOP_BAND = 10;
  const topIncKeys = new Set(inc.entries.slice(0, TOP_BAND).map((e) => e.ag_key));
  const topAltKeys = new Set(alt.entries.slice(0, TOP_BAND).map((e) => e.ag_key));

  const allKeys = new Set<string>([...inc.byKey.keys(), ...alt.byKey.keys()]);

  let with_incidents_only = 0;
  let with_alerts_only = 0;
  let with_both = 0;
  for (const k of allKeys) {
    const hasI = inc.byKey.has(k);
    const hasA = alt.byKey.has(k);
    if (hasI && hasA) with_both++;
    else if (hasI) with_incidents_only++;
    else with_alerts_only++;
  }

  const rowFor = (key: string): OperationalSignalRow => {
    const iEntry = inc.byKey.get(key);
    const aEntry = alt.byKey.get(key);
    const name = iEntry?.ag_name ?? aEntry?.ag_name ?? key;
    const incidents = iEntry?.count ?? 0;
    const alerts = aEntry?.count ?? 0;
    return {
      ag_key: key,
      ag_name: name,
      incidents,
      alerts,
      has_incidents: !!iEntry,
      has_alerts: !!aEntry,
      share_incidents: inc.total > 0 ? incidents / inc.total : null,
      share_alerts: alt.total > 0 ? alerts / alt.total : null,
      rank_incidents: incRankByKey.get(key) ?? null,
      rank_alerts: altRankByKey.get(key) ?? null,
    };
  };

  // Cross-signal: in the top band on both axes.
  const crossKeys = [...topIncKeys].filter((k) => topAltKeys.has(k));
  const cross_signal = crossKeys
    .map(rowFor)
    .sort(
      (a, b) =>
        (a.rank_incidents ?? Infinity) +
        (a.rank_alerts ?? Infinity) -
        ((b.rank_incidents ?? Infinity) + (b.rank_alerts ?? Infinity)),
    )
    .slice(0, 3);

  const crossKeySet = new Set(cross_signal.map((r) => r.ag_key));

  // Incident-heavy: top band on incidents, not already surfaced as cross.
  // Explicitly includes AGs absent from the alert axis.
  const incident_heavy = inc.entries
    .filter((e) => topIncKeys.has(e.ag_key) && !crossKeySet.has(e.ag_key))
    .map((e) => rowFor(e.ag_key))
    .slice(0, 2);

  // Alert-heavy: symmetric.
  const alert_heavy = alt.entries
    .filter((e) => topAltKeys.has(e.ag_key) && !crossKeySet.has(e.ag_key))
    .map((e) => rowFor(e.ag_key))
    .slice(0, 2);

  const quality = buildQualityObservation(input.userRows);
  const attribution = buildAttribution(input.attribution ?? null);

  return {
    scope: "loaded_corpus",
    corpus: input.corpus,
    ags: {
      with_incidents_only,
      with_alerts_only,
      with_both,
      total_distinct: allKeys.size,
    },
    method: {
      ranking: "per-axis descending by count",
      top_band: TOP_BAND,
      classification: [
        "Cross-signal: top band on BOTH axes",
        "Incident-heavy: top band on incidents, not in cross-signal",
        "Alert-heavy: top band on alerts, not in cross-signal",
      ],
    },
    findings: { cross_signal, incident_heavy, alert_heavy },
    quality,
    attribution,
    limitations: [
      "Concentration does not imply anomaly.",
      "Volume does not establish business impact.",
      "Correlation does not establish root cause.",
      "Missing application attribution remains explicit.",
      "Incidents and alerts are two distinct populations and are never combined into a single score.",
    ],
  };
}

function buildQualityObservation(
  userRows: UserByGroupRow[],
): OperationalQualityObservation | null {
  let totalIncidents = 0;
  let poorPlusCritical = 0;
  for (const r of userRows) {
    const inc = toNumber(r.Incidents) ?? 0;
    const poor = toNumber(r.Poor) ?? 0;
    const crit = toNumber(r.Critical) ?? 0;
    totalIncidents += inc;
    poorPlusCritical += poor + crit;
  }
  if (totalIncidents <= 0) return null;
  const rate = poorPlusCritical / totalIncidents;
  // Only surface an observation when the population share is materially large.
  // Below 5% we do not force a claim.
  if (rate < 0.05) return null;
  const pct = (rate * 100).toFixed(1);
  return {
    weighted_poor_critical_rate: rate,
    incidents_covered: totalIncidents,
    text: `Work-note quality evidence shows a material Poor/Critical population (${pct}% of ${totalIncidents.toLocaleString(
      "en-US",
    )} incidents).`,
  };
}

function buildAttribution(
  input: AttributionInput | null,
): OperationalAttribution {
  if (!input) {
    return {
      kind: "incomplete",
      coverage_pct: null,
      ags_matched: null,
      ags_bridge: null,
      ags_quality: null,
      note: "Assignment Group to Application attribution is not established for this analysis.",
    };
  }
  const pct = input.incident_coverage_pct;
  if (typeof pct === "number" && Number.isFinite(pct)) {
    // Thresholds reflect the semantic-layer's own R6 caveat (bridge coverage,
    // not an authoritative link). We categorize, never invent a percentage.
    let kind: OperationalAttribution["kind"];
    if (pct >= 60) kind = "verified";
    else if (pct >= 20) kind = "partial";
    else kind = "incomplete";
    return {
      kind,
      coverage_pct: pct,
      ags_matched: input.ags_matched,
      ags_bridge: input.ags_bridge,
      ags_quality: input.ags_quality,
      note:
        kind === "verified"
          ? "Attribution reaches a majority of ticket volume through the Assignment Group bridge."
          : kind === "partial"
            ? "Attribution reaches a meaningful minority of ticket volume through the Assignment Group bridge."
            : "Attribution through the Assignment Group bridge covers a small share of ticket volume.",
    };
  }
  return {
    kind: "incomplete",
    coverage_pct: null,
    ags_matched: input.ags_matched,
    ags_bridge: input.ags_bridge,
    ags_quality: input.ags_quality,
    note: "Attribution coverage is not declared in the loaded evidence.",
  };
}
