import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyProvenance } from "@/lib/agent/insights/provenance";
import type { EvidencePack, StructuredAnswer } from "@/lib/agent/insights/types";

const pack: EvidencePack = {
  question_type: "portfolio_risk",
  scope: { kind: "ai_ml_segment" },
  applications: [
    { app_id: "APP-1", name: "One" } as any,
    { app_id: "APP-2", name: "Two" } as any,
  ],
  aggregate: null,
  coverage_gaps: {} as any,
  quality: {} as any,
  metadata: {
    as_of: "2026-08-21",
    universe_apps: 504,
    scope_universe: 2,
    schema_version: "xops-insight.v1",
    ranking: {
      kind: "deterministic_screening",
      order: ["criticality"],
      disclaimer: "no canonical ranking",
      top_n: 10,
    },
    blocked_measures: [],
  },
};

const okAnswer: StructuredAnswer = {
  answer: "ok",
  findings: [
    {
      app_id: "APP-1",
      fact: "APP-1 is C1 without an AG.",
      evidence: ["APP-1", "APP-2"],
      signals_combined: ["criticality", "missing_gates.routable"],
    },
  ],
  insight: "ok",
  recommended_action: "ok",
  confidence: "medium",
  limitations: [],
};

describe("verifyProvenance", () => {
  it("returns no violations for an answer that cites only pack apps", () => {
    assert.deepEqual(verifyProvenance(okAnswer, pack), []);
  });

  it("flags a finding whose app_id is not in the pack", () => {
    const bad: StructuredAnswer = {
      ...okAnswer,
      findings: [{ ...okAnswer.findings[0], app_id: "APP-INVENTED" }],
    };
    const v = verifyProvenance(bad, pack);
    assert.equal(v.length, 1);
    assert.equal(v[0].kind, "unknown_finding_app_id");
    assert.equal((v[0] as any).app_id, "APP-INVENTED");
  });

  it("flags each hallucinated evidence app_id, keeping the finding index", () => {
    const bad: StructuredAnswer = {
      ...okAnswer,
      findings: [
        {
          ...okAnswer.findings[0],
          evidence: ["APP-1", "APP-X", "APP-Y"],
        },
      ],
    };
    const v = verifyProvenance(bad, pack);
    assert.equal(v.length, 2);
    for (const violation of v) {
      assert.equal(violation.kind, "unknown_evidence_app_id");
      assert.equal((violation as any).finding_index, 0);
    }
  });
});
