import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evidencePackSchema,
  structuredAnswerSchema,
} from "@/lib/agent/insights/schema";

const validPack = {
  question_type: "portfolio_risk",
  scope: { kind: "ai_ml_segment" },
  applications: [{ app_id: "APP-1", name: "One" }],
  aggregate: null,
  coverage_gaps: {},
  quality: {},
  metadata: {
    as_of: "2026-08-21",
    universe_apps: 504,
    scope_universe: 1,
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

const validAnswer = {
  answer: "One application flagged.",
  findings: [
    {
      app_id: "APP-1",
      fact: "APP-1 is missing an Assignment Group and is declared C1.",
      evidence: ["APP-1"],
      signals_combined: ["criticality", "missing_gates.routable"],
    },
  ],
  insight: "The AI/ML segment concentrates unrouted incidents in one owner.",
  recommended_action: "Assign a routing group to APP-1.",
  confidence: "medium",
  limitations: [],
};

describe("evidencePackSchema", () => {
  it("accepts a well-formed pack", () => {
    const r = evidencePackSchema.safeParse(validPack);
    assert.equal(r.success, true);
  });

  it("rejects wrong question_type", () => {
    const r = evidencePackSchema.safeParse({
      ...validPack,
      question_type: "blast_radius",
    });
    assert.equal(r.success, false);
  });

  it("rejects a pack whose metadata.ranking.kind is not deterministic_screening", () => {
    const r = evidencePackSchema.safeParse({
      ...validPack,
      metadata: {
        ...validPack.metadata,
        ranking: { ...validPack.metadata.ranking, kind: "heuristic" },
      },
    });
    assert.equal(r.success, false);
  });
});

describe("structuredAnswerSchema", () => {
  it("accepts a valid answer", () => {
    const r = structuredAnswerSchema.safeParse(validAnswer);
    assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
  });

  it("rejects a finding with only ONE signal (two-signals rule)", () => {
    const bad = {
      ...validAnswer,
      findings: [
        { ...validAnswer.findings[0], signals_combined: ["criticality"] },
      ],
    };
    const r = structuredAnswerSchema.safeParse(bad);
    assert.equal(r.success, false);
  });

  it("rejects a finding with no evidence", () => {
    const bad = {
      ...validAnswer,
      findings: [{ ...validAnswer.findings[0], evidence: [] }],
    };
    const r = structuredAnswerSchema.safeParse(bad);
    assert.equal(r.success, false);
  });

  it("rejects unknown confidence values", () => {
    const bad = { ...validAnswer, confidence: "very_high" };
    const r = structuredAnswerSchema.safeParse(bad);
    assert.equal(r.success, false);
  });
});
