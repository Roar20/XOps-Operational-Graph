import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleInsightRequest } from "@/lib/agent/insights/handler";
import { buildPortfolioRiskPack } from "@/lib/agent/insights/portfolio-risk";
import type { StructuredAnswer } from "@/lib/agent/insights/types";

async function readJson(res: Response) {
  return (await res.json()) as any;
}

describe("handleInsightRequest — contract", () => {
  it("400 when the evidence_pack is missing", async () => {
    const res = await handleInsightRequest({}, async () => ({} as StructuredAnswer));
    assert.equal(res.status, 400);
    const body = await readJson(res);
    assert.equal(body.error, "invalid_evidence_pack");
  });

  it("200 when the model returns an answer whose IDs exist in the pack", async () => {
    const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });
    const firstId = pack.applications[0]?.app_id;
    assert.ok(firstId, "AI/ML segment should not be empty");
    const answer: StructuredAnswer = {
      answer: "Two AI/ML apps combine C1 criticality with declared High impact.",
      findings: [
        {
          app_id: firstId,
          fact: `${firstId} is declared C1 with unresolved gates.`,
          evidence: [firstId],
          signals_combined: ["criticality", "missing_operational_gates"],
        },
      ],
      insight: "The screening surfaces criticality-plus-gap combinations.",
      recommended_action: "Assign a routing group to the flagged application.",
      confidence: "medium",
      limitations: [],
    };
    const res = await handleInsightRequest(
      { evidence_pack: pack },
      async () => answer,
    );
    assert.equal(res.status, 200);
    const body = await readJson(res);
    assert.equal(body.answer.findings[0].app_id, firstId);
  });

  it("502 hallucinated_ids when the model returns an app_id not in the pack", async () => {
    const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });
    const firstId = pack.applications[0]?.app_id;
    assert.ok(firstId);
    const badAnswer: StructuredAnswer = {
      answer: "one",
      findings: [
        {
          app_id: "APP-INVENTED-42",
          fact: "Invented.",
          evidence: [firstId],
          signals_combined: ["a", "b"],
        },
      ],
      insight: "x",
      recommended_action: "x",
      confidence: "low",
      limitations: [],
    };
    const res = await handleInsightRequest(
      { evidence_pack: pack },
      async () => badAnswer,
    );
    assert.equal(res.status, 502);
    const body = await readJson(res);
    assert.equal(body.error, "hallucinated_ids");
  });

  it("502 invalid_llm_output when the model returns an answer with only one signal", async () => {
    const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });
    const firstId = pack.applications[0]?.app_id;
    assert.ok(firstId);
    const badAnswer = {
      answer: "one",
      findings: [
        {
          app_id: firstId,
          fact: "x",
          evidence: [firstId],
          signals_combined: ["only_one"],
        },
      ],
      insight: "x",
      recommended_action: "x",
      confidence: "low",
      limitations: [],
    } as unknown as StructuredAnswer;
    const res = await handleInsightRequest(
      { evidence_pack: pack },
      async () => badAnswer,
    );
    assert.equal(res.status, 502);
    const body = await readJson(res);
    assert.equal(body.error, "invalid_llm_output");
  });

  it("502 model_call_failed when the model throws", async () => {
    const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });
    const res = await handleInsightRequest(
      { evidence_pack: pack },
      async () => {
        throw new Error("network timeout");
      },
    );
    assert.equal(res.status, 502);
    const body = await readJson(res);
    assert.equal(body.error, "model_call_failed");
    assert.match(body.message, /timeout/);
  });
});
