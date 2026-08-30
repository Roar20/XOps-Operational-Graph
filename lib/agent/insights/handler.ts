import { generateObject } from "ai";
import {
  evidencePackSchema,
  structuredAnswerSchema,
} from "./schema";
import { verifyProvenance } from "./provenance";
import { XOPS_INSIGHT_SYSTEM_PROMPT } from "./system-prompt";
import type { EvidencePack, StructuredAnswer } from "./types";

export type ModelCaller = (pack: EvidencePack) => Promise<StructuredAnswer>;

/**
 * All defences live here so the endpoint stays a single gate no matter which
 * caller invokes the model. Extracted from route.ts because Next 15 only
 * allows specific exports from a route file.
 */
export async function handleInsightRequest(
  body: unknown,
  callModel: ModelCaller = defaultCallModel,
): Promise<Response> {
  const raw = (body as { evidence_pack?: unknown })?.evidence_pack;
  const parsedPack = evidencePackSchema.safeParse(raw);
  if (!parsedPack.success) {
    return Response.json(
      { error: "invalid_evidence_pack", issues: parsedPack.error.issues },
      { status: 400 },
    );
  }
  const pack = parsedPack.data as unknown as EvidencePack;

  let candidate: unknown;
  try {
    candidate = await callModel(pack);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: "model_call_failed", message },
      { status: 502 },
    );
  }

  const parsedAnswer = structuredAnswerSchema.safeParse(candidate);
  if (!parsedAnswer.success) {
    return Response.json(
      { error: "invalid_llm_output", issues: parsedAnswer.error.issues },
      { status: 502 },
    );
  }
  const answer = parsedAnswer.data as unknown as StructuredAnswer;
  const violations = verifyProvenance(answer, pack);
  if (violations.length) {
    return Response.json(
      { error: "hallucinated_ids", violations },
      { status: 502 },
    );
  }

  return Response.json({ answer });
}

async function defaultCallModel(pack: EvidencePack): Promise<StructuredAnswer> {
  // Execution-config only. The grounding contract lives in the prompt and the
  // schema; nothing here weakens it. Adaptive thinking, effort and retries are
  // switched off for this endpoint because the timeout occurs during the
  // model-call stage — all three can increase latency and none are required
  // for a single-turn Portfolio Risk synthesis over a bounded Evidence Pack.
  // The Anthropic model, its fallback chain, the schema and the system prompt
  // are unchanged.
  const result = await generateObject({
    // Same AI Gateway as /api/chat: no new env, no extra key.
    model: "anthropic/claude-sonnet-4.6",
    maxRetries: 0,
    system: XOPS_INSIGHT_SYSTEM_PROMPT,
    schema: structuredAnswerSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `EVIDENCE_PACK:\n${JSON.stringify(pack)}` },
        ],
      },
    ],
    providerOptions: {
      anthropic: { thinking: { type: "disabled" } },
      gateway: {
        models: ["anthropic/claude-sonnet-5", "anthropic/claude-opus-5"],
      },
    },
  });
  return result.object as unknown as StructuredAnswer;
}
