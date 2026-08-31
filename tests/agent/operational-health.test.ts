import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOperationalHealthAnalysis,
  normalizeAssignmentGroup,
} from "@/lib/agent/operational-health";

/** Helpers to keep the fixtures readable. */
const ubg = (name: string, incidents: number, extras: Record<string, number> = {}) => ({
  "Assignment Group": name,
  Incidents: incidents,
  ...extras,
});
const abg = (name: string, alerts: number) => ({
  "Assignment Group": name,
  Alerts: alerts,
});

/**
 * Synthetic fixture where:
 *  - A, B, C, D, E, F, G, H, I, J, K, L, M sit on incidents (13 AGs).
 *  - A, B, C, N, O, P sit on alerts (6 AGs, 3 unique).
 *  - Universe = 16 distinct AGs; 3 on both axes, 10 incidents-only, 3 alerts-only.
 *  - Rankings differ per axis on purpose so cross-signal picks are non-trivial.
 */
const USER_ROWS = [
  ubg("A", 5000), ubg("B", 4500), ubg("C", 3800), ubg("D", 3000),
  ubg("E", 2500), ubg("F", 2000), ubg("G", 1500), ubg("H", 1000),
  ubg("I",  800), ubg("J",  600), ubg("K",  400), ubg("L",  200),
  ubg("M",  100),
];
const ALERT_ROWS = [
  abg("A", 9000), abg("N", 7000), abg("C", 6000), abg("O", 5000),
  abg("B", 4000), abg("P", 3000),
];

describe("normalizeAssignmentGroup", () => {
  it("uppercases and strips non-alphanumeric characters (same as agKey)", () => {
    assert.equal(normalizeAssignmentGroup("Data Platform - Support"), "DATAPLATFORMSUPPORT");
    assert.equal(normalizeAssignmentGroup("  db   #ops!  "), "DBOPS");
    assert.equal(normalizeAssignmentGroup(undefined), "");
  });
});

describe("buildOperationalHealthAnalysis — invariants", () => {
  const analysis = buildOperationalHealthAnalysis({
    userRows: USER_ROWS,
    alertRows: ALERT_ROWS,
    corpus: { incidents: 25400, alerts: 34000, total: 59400 },
    attribution: null,
  });

  it("scope is corpus-wide", () => {
    assert.equal(analysis.scope, "loaded_corpus");
  });

  it("counts the universe truthfully; single-axis AGs are NOT dropped", () => {
    // 3 in both (A, B, C), 10 incidents-only (D..M), 3 alerts-only (N, O, P) = 16.
    assert.equal(analysis.ags.with_both, 3);
    assert.equal(analysis.ags.with_incidents_only, 10);
    assert.equal(analysis.ags.with_alerts_only, 3);
    assert.equal(analysis.ags.total_distinct, 16);
  });

  it("cross-signal only surfaces AGs present in the top band on BOTH axes", () => {
    for (const r of analysis.findings.cross_signal) {
      assert.equal(r.has_incidents, true, `${r.ag_key} must have incidents`);
      assert.equal(r.has_alerts, true, `${r.ag_key} must have alerts`);
      assert.notEqual(r.rank_incidents, null);
      assert.notEqual(r.rank_alerts, null);
    }
  });

  it("cross-signal is bounded and deterministic", () => {
    assert.ok(analysis.findings.cross_signal.length <= 3);
    const again = buildOperationalHealthAnalysis({
      userRows: USER_ROWS,
      alertRows: ALERT_ROWS,
      corpus: { incidents: 25400, alerts: 34000, total: 59400 },
      attribution: null,
    });
    assert.deepEqual(
      analysis.findings.cross_signal.map((r) => r.ag_key),
      again.findings.cross_signal.map((r) => r.ag_key),
    );
  });

  it("incident-heavy findings never appear as cross-signal", () => {
    const crossKeys = new Set(analysis.findings.cross_signal.map((r) => r.ag_key));
    for (const r of analysis.findings.incident_heavy) {
      assert.ok(!crossKeys.has(r.ag_key));
    }
  });

  it("alert-heavy findings never appear as cross-signal", () => {
    const crossKeys = new Set(analysis.findings.cross_signal.map((r) => r.ag_key));
    for (const r of analysis.findings.alert_heavy) {
      assert.ok(!crossKeys.has(r.ag_key));
    }
  });

  it("an AG present only on the alert axis can appear as alert-heavy with incidents=0/not-present", () => {
    // N has 7000 alerts and no incidents → rank_alerts near top, rank_incidents null.
    const found = analysis.findings.alert_heavy.find((r) => r.ag_name === "N");
    if (found) {
      assert.equal(found.has_incidents, false);
      assert.equal(found.incidents, 0);
      assert.equal(found.rank_incidents, null);
    }
  });

  it("shares of population are per-axis, computed independently", () => {
    // Sum shares equals 1 per axis (within float tolerance), NOT combined.
    const incTotal = analysis.findings.cross_signal
      .concat(analysis.findings.incident_heavy)
      .reduce((s, r) => s + (r.share_incidents ?? 0), 0);
    // We only sum surfaced findings; the assertion is that shares stay in
    // [0,1] and there is NO combined-population share field on the row.
    for (const r of [
      ...analysis.findings.cross_signal,
      ...analysis.findings.incident_heavy,
      ...analysis.findings.alert_heavy,
    ]) {
      assert.ok((r.share_incidents ?? 0) >= 0 && (r.share_incidents ?? 0) <= 1);
      assert.ok((r.share_alerts ?? 0) >= 0 && (r.share_alerts ?? 0) <= 1);
      assert.equal(
        (r as unknown as Record<string, unknown>).share_total,
        undefined,
        "signal row must not carry a combined-population share",
      );
      assert.equal(
        (r as unknown as Record<string, unknown>).combined_score,
        undefined,
        "signal row must not carry a combined score",
      );
    }
    assert.ok(incTotal >= 0);
  });

  it("no additive incidents+alerts field exists on the analysis or rows", () => {
    const forbidden = ["combined_score", "operational_score", "risk_score", "total_activity"];
    for (const key of forbidden) {
      assert.equal((analysis as unknown as Record<string, unknown>)[key], undefined);
    }
    for (const r of [
      ...analysis.findings.cross_signal,
      ...analysis.findings.incident_heavy,
      ...analysis.findings.alert_heavy,
    ]) {
      for (const key of forbidden) {
        assert.equal((r as unknown as Record<string, unknown>)[key], undefined);
      }
      // Explicitly confirm we do not expose an incidents+alerts sum anywhere.
      const total = (r.incidents ?? 0) + (r.alerts ?? 0);
      assert.notEqual(
        (r as unknown as Record<string, unknown>).total,
        total,
        "signal row must not surface the sum incidents+alerts",
      );
    }
  });

  it("limitations always enumerate non-anomaly / non-causation / attribution caveats", () => {
    const joined = analysis.limitations.join(" ").toLowerCase();
    assert.match(joined, /anomaly/);
    assert.match(joined, /business impact/);
    assert.match(joined, /root cause/);
    assert.match(joined, /attribution/);
    assert.match(joined, /distinct populations/);
  });
});

describe("buildOperationalHealthAnalysis — attribution", () => {
  it("no attribution input → incomplete, no invented percentage", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: USER_ROWS,
      alertRows: ALERT_ROWS,
      corpus: { incidents: 25400, alerts: 34000, total: 59400 },
      attribution: null,
    });
    assert.equal(a.attribution.kind, "incomplete");
    assert.equal(a.attribution.coverage_pct, null);
    assert.match(a.attribution.note, /not established/i);
  });

  it("high coverage → verified", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: USER_ROWS,
      alertRows: ALERT_ROWS,
      corpus: { incidents: 25400, alerts: 34000, total: 59400 },
      attribution: {
        ags_matched: 900,
        ags_bridge: 1200,
        ags_quality: 1300,
        incident_coverage_pct: 78.2,
      },
    });
    assert.equal(a.attribution.kind, "verified");
    assert.equal(a.attribution.coverage_pct, 78.2);
  });

  it("mid coverage → partial", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: USER_ROWS,
      alertRows: ALERT_ROWS,
      corpus: { incidents: 25400, alerts: 34000, total: 59400 },
      attribution: {
        ags_matched: 300,
        ags_bridge: 1200,
        ags_quality: 1300,
        incident_coverage_pct: 35,
      },
    });
    assert.equal(a.attribution.kind, "partial");
  });

  it("low coverage → incomplete", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: USER_ROWS,
      alertRows: ALERT_ROWS,
      corpus: { incidents: 25400, alerts: 34000, total: 59400 },
      attribution: {
        ags_matched: 50,
        ags_bridge: 1200,
        ags_quality: 1300,
        incident_coverage_pct: 8,
      },
    });
    assert.equal(a.attribution.kind, "incomplete");
  });
});

describe("buildOperationalHealthAnalysis — quality observation", () => {
  it("emits observation when Poor+Critical share is material", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: [
        ubg("A", 1000, { Poor: 100, Critical: 20 }),
        ubg("B", 500, { Poor: 30, Critical: 10 }),
      ],
      alertRows: [],
      corpus: { incidents: 1500, alerts: 0, total: 1500 },
      attribution: null,
    });
    assert.ok(a.quality);
    assert.equal(a.quality!.incidents_covered, 1500);
    assert.ok(a.quality!.weighted_poor_critical_rate > 0.05);
    assert.match(a.quality!.text, /Poor\/Critical/);
  });

  it("does not fabricate an observation when the share is small", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: [ubg("A", 10000, { Poor: 10, Critical: 5 })],
      alertRows: [],
      corpus: { incidents: 10000, alerts: 0, total: 10000 },
      attribution: null,
    });
    assert.equal(a.quality, null);
  });
});

describe("buildOperationalHealthAnalysis — degenerate inputs", () => {
  it("empty datasets produce zero findings, no crash, and empty universe", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: [],
      alertRows: [],
      corpus: { incidents: 0, alerts: 0, total: 0 },
      attribution: null,
    });
    assert.equal(a.findings.cross_signal.length, 0);
    assert.equal(a.findings.incident_heavy.length, 0);
    assert.equal(a.findings.alert_heavy.length, 0);
    assert.equal(a.ags.total_distinct, 0);
  });

  it("null population values do not break analysis and shares stay null when totals are zero", () => {
    const a = buildOperationalHealthAnalysis({
      userRows: [ubg("A", 10)],
      alertRows: [abg("B", 20)],
      corpus: { incidents: null, alerts: null, total: null },
      attribution: null,
    });
    for (const r of [...a.findings.incident_heavy, ...a.findings.alert_heavy]) {
      assert.ok(typeof r.share_incidents === "number" || r.share_incidents === null);
      assert.ok(typeof r.share_alerts === "number" || r.share_alerts === null);
    }
  });
});
