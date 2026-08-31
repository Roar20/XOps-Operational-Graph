import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRcaInvestigationBrief } from "@/lib/agent/rca-intelligence";
import type { OperationalAnalysis } from "@/lib/agent/operational-health";

/* Small, self-contained fixtures. No real workbook needed. */

const DECALOGUE_ROWS = [
  { Code: "D01", Pattern: "Ambiguous ticket", Incidents: 1200 },
  { Code: "D05", Pattern: "Loss of trust in reporting", Incidents: 900 },
  { Code: "D09", Pattern: "Fragile monitoring infrastructure", Incidents: 800 },
  { Code: "D03", Pattern: "Manual reconciliation", Incidents: 400 },
  { Code: "D07", Pattern: "Repeated escalation", Incidents: 200 },
  { Code: "D02", Pattern: "Deferred remediation", Incidents: 100 },
  { Code: "", Pattern: "", Incidents: 0 }, // must be filtered out
];

const DUAL_AXIS_TOTAL = {
  DIAGNOSTICO: 6000,
  SUSTANTIVO: 3000,
  FORMAL_ONLY: 1500,
  EMPTY: 500,
  Total: 11000,
};

const OP_ANALYSIS: OperationalAnalysis = {
  scope: "loaded_corpus",
  corpus: { incidents: 25000, alerts: 34000, total: 59000 },
  ags: { with_incidents_only: 5, with_alerts_only: 3, with_both: 4, total_distinct: 12 },
  method: { ranking: "per-axis descending by count", top_band: 10, classification: [] },
  findings: {
    cross_signal: [
      {
        ag_key: "DATAFABRICOPERATIONS",
        ag_name: "DATA FABRIC OPERATIONS",
        incidents: 4200,
        alerts: 3800,
        has_incidents: true,
        has_alerts: true,
        share_incidents: 0.17,
        share_alerts: 0.11,
        rank_incidents: 2,
        rank_alerts: 2,
      },
      {
        ag_key: "APPSUPPORTBI",
        ag_name: "APP SUPPORT BI",
        incidents: 2800,
        alerts: 3100,
        has_incidents: true,
        has_alerts: true,
        share_incidents: 0.11,
        share_alerts: 0.09,
        rank_incidents: 3,
        rank_alerts: 3,
      },
      {
        ag_key: "OTHER",
        ag_name: "OTHER",
        incidents: 2000,
        alerts: 2000,
        has_incidents: true,
        has_alerts: true,
        share_incidents: 0.08,
        share_alerts: 0.06,
        rank_incidents: 4,
        rank_alerts: 5,
      },
    ],
    incident_heavy: [],
    alert_heavy: [],
  },
  quality: null,
  attribution: {
    kind: "incomplete",
    coverage_pct: null,
    ags_matched: null,
    ags_bridge: null,
    ags_quality: null,
    note: "not established",
  },
  limitations: [],
};

function baseInput() {
  return {
    corpus: { incidents: 25000, alerts: 34000, total: 59000 },
    decalogue: {
      present: true,
      rows: DECALOGUE_ROWS,
      summary: { classifiedIncidents: 3600 },
    },
    dualAxis: { present: true, total: DUAL_AXIS_TOTAL },
    compliance: { close_notes_present: true, alerts_present: true },
    operational: OP_ANALYSIS,
  };
}

describe("buildRcaInvestigationBrief — invariants", () => {
  it("scope is corpus-wide and result is deterministic across two calls", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    const b = buildRcaInvestigationBrief(baseInput());
    assert.equal(a.scope, "loaded_corpus");
    assert.deepEqual(a, b);
  });

  it("investigation signals come from byDecalogue rows only, sorted by Incidents desc, capped at 5", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    assert.ok(a.signals.length <= 5);
    assert.deepEqual(
      a.signals.map((s) => s.code),
      ["D01", "D05", "D09", "D03", "D07"],
    );
    for (const s of a.signals) {
      assert.equal(s.source_dataset, "byDecalogue");
      assert.ok(s.incidents > 0);
      assert.equal(typeof s.pattern, "string");
    }
  });

  it("signal 'why_review' language is investigative, never causal", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    const forbidden = /caused|because of|failure originated|is the root cause|root cause identified/i;
    for (const s of a.signals) {
      assert.doesNotMatch(s.why_review, forbidden);
      assert.match(s.why_review, /candidate investigation area|investigation/i);
    }
  });

  it("evidence_quality is truthfully derived from Dual_Axis totals (FORMAL_ONLY + EMPTY)", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    assert.ok(a.evidence_quality);
    assert.equal(a.evidence_quality!.source_dataset, "dualAxis");
    assert.equal(a.evidence_quality!.low_diagnostic_count, 2000); // 1500 + 500
    assert.equal(a.evidence_quality!.total_incidents, 11000);
    assert.ok(a.evidence_quality!.low_diagnostic_share > 0.1);
  });

  it("no root-cause / caused-by language appears anywhere in the brief", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    const joined = JSON.stringify(a).toLowerCase();
    for (const term of [
      "caused by",
      "root cause identified",
      "failure originated in",
      "anomaly caused",
    ]) {
      assert.equal(
        joined.includes(term),
        false,
        `brief contains forbidden term: ${term}`,
      );
    }
  });

  it("operational_context reuses OH cross-signal (never invents ranking), capped at 2, non-causal", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    assert.ok(a.operational_context.length <= 2);
    assert.equal(a.operational_context[0].ag_name, "DATA FABRIC OPERATIONS");
    assert.equal(a.operational_context[0].rank_incidents, 2);
    assert.equal(a.operational_context[0].rank_alerts, 2);
    for (const c of a.operational_context) {
      assert.match(
        c.why_review,
        /not the root cause|investigation starting point/i,
      );
    }
  });

  it("alert_evidence surfaces only when compliance_alerts_present is true; omitted otherwise", () => {
    const withAlerts = buildRcaInvestigationBrief(baseInput());
    assert.ok(withAlerts.alert_evidence);
    assert.equal(withAlerts.alert_evidence!.source_dataset, "complianceAlerts");

    const noAlerts = buildRcaInvestigationBrief({
      ...baseInput(),
      compliance: { close_notes_present: true, alerts_present: false },
    });
    assert.equal(noAlerts.alert_evidence, null);
  });

  it("limitations always enumerate the non-causal / no-time-sequence caveats", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    const joined = a.limitations.join(" ").toLowerCase();
    assert.match(joined, /pattern .* does not establish causation/);
    assert.match(joined, /alert correlation does not establish causation/);
    assert.match(joined, /operational concentration does not establish root cause/);
    assert.match(joined, /evidence quality/);
    assert.match(joined, /time-sequence/);
  });

  it("next_steps is evidence-led and bounded to 3", () => {
    const a = buildRcaInvestigationBrief(baseInput());
    assert.ok(a.next_steps.length <= 3);
    for (const s of a.next_steps) {
      assert.doesNotMatch(s, /remediate|apply fix|restart|patch/i);
    }
  });
});

describe("buildRcaInvestigationBrief — degenerate inputs", () => {
  it("no decalogue evidence → zero signals, no crash", () => {
    const a = buildRcaInvestigationBrief({
      ...baseInput(),
      decalogue: { present: false, rows: [], summary: null },
    });
    assert.equal(a.signals.length, 0);
  });

  it("no dual axis evidence → no evidence_quality observation", () => {
    const a = buildRcaInvestigationBrief({
      ...baseInput(),
      dualAxis: { present: false, total: null },
    });
    assert.equal(a.evidence_quality, null);
  });

  it("dual axis with a small low-diagnostic share → no forced observation", () => {
    const a = buildRcaInvestigationBrief({
      ...baseInput(),
      dualAxis: {
        present: true,
        total: {
          DIAGNOSTICO: 9500,
          SUSTANTIVO: 400,
          FORMAL_ONLY: 80,
          EMPTY: 20,
          Total: 10000,
        },
      },
    });
    assert.equal(a.evidence_quality, null);
  });

  it("no operational analysis → empty operational_context, no crash", () => {
    const a = buildRcaInvestigationBrief({ ...baseInput(), operational: null });
    assert.deepEqual(a.operational_context, []);
  });
});
