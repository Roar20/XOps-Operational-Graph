import {
  generateObject,
  NoObjectGeneratedError,
  type LanguageModelUsage,
} from "ai";
import {
  evidencePackSchema,
  structuredAnswerSchema,
} from "./schema";
import { verifyProvenance } from "./provenance";
import { XOPS_INSIGHT_SYSTEM_PROMPT } from "./system-prompt";
import type { EvidencePack, StructuredAnswer } from "./types";

/**
 * The result of one model call. Usage is optional because some providers or
 * error paths do not expose it, and the frontend never sees it — it is logged
 * server-side only so we can correlate model latency with output token count.
 */
export type ModelResult = {
  answer: StructuredAnswer;
  usage?: LanguageModelUsage;
};

export type ModelCaller = (pack: EvidencePack) => Promise<ModelResult>;

/**
 * Elapsed milliseconds between two hrtime.bigint samples, rounded to 1 dp.
 * Kept inline because it is used only by the handler's instrumentation.
 */
function elapsedMs(from: bigint, to: bigint): number {
  return Math.round(Number(to - from) / 1e5) / 10;
}

/**
 * Sanitized error class name for logs. Never the message (could carry PII or
 * provider internals); never longer than 40 chars.
 */
function errorType(e: unknown): string {
  const name = e instanceof Error ? e.constructor.name : "Unknown";
  return name.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40);
}

/**
 * Diagnostic-only extras for NoObjectGeneratedError. Reports structural
 * metadata that lets a human classify the failure (truncation vs schema
 * violation vs parse error vs transport) without ever exposing model output.
 *
 * NEVER logs: error.text (only its length), error.cause.message (only the
 * cause class name), response.body, response.headers, prompts, evidence,
 * user data.
 *
 * Returns an empty string for any other error so the base log line is
 * unchanged for non-object-generation failures.
 */
function noObjectDiagnostics(e: unknown): string {
  if (!NoObjectGeneratedError.isInstance(e)) return "";
  const finish = e.finishReason ?? "unknown";
  const out = e.usage?.outputTokens ?? "unknown";
  const total = e.usage?.totalTokens ?? "unknown";
  const textLen =
    typeof e.text === "string" ? e.text.length : "unknown";
  const rawCause = (e as { cause?: unknown }).cause;
  const causeCls =
    rawCause instanceof Error ? rawCause.constructor.name : "unknown";
  const respModel = e.response?.modelId ?? "unknown";
  return ` finish_reason=${finish} output_tokens=${out} total_tokens=${total} text_len=${textLen} cause=${causeCls} response_model=${respModel}`;
}

/**
 * All defences live here so the endpoint stays a single gate no matter which
 * caller invokes the model. Extracted from route.ts because Next 15 only
 * allows specific exports from a route file.
 *
 * Server-side observability is intentional. Every log line carries a short
 * request id so a single production request can be reconstructed from Vercel
 * Logs. Log values are strictly operational: durations, byte sizes, universe
 * counts, output token counts, sanitized error class names. Never: pack
 * content, application names, app ids, prompts, model text output, provider
 * error messages, keys.
 */
export async function handleInsightRequest(
  body: unknown,
  callModel: ModelCaller = defaultCallModel,
): Promise<Response> {
  const reqId = Math.random().toString(36).slice(2, 10);
  const t0 = process.hrtime.bigint();

  const contextEnd = process.hrtime.bigint();
  console.log(
    `[XOps Insight] req=${reqId} stage=context ms=${elapsedMs(t0, contextEnd)}`,
  );

  const raw = (body as { evidence_pack?: unknown })?.evidence_pack;
  const parsedPack = evidencePackSchema.safeParse(raw);
  const packEnd = process.hrtime.bigint();
  if (!parsedPack.success) {
    console.log(
      `[XOps Insight] req=${reqId} stage=complete total_ms=${elapsedMs(t0, packEnd)} outcome=invalid_pack`,
    );
    return Response.json(
      { error: "invalid_evidence_pack", issues: parsedPack.error.issues },
      { status: 400 },
    );
  }
  const pack = parsedPack.data as unknown as EvidencePack;
  const packBytes = Buffer.byteLength(JSON.stringify(pack), "utf8");
  console.log(
    `[XOps Insight] req=${reqId} stage=pack ms=${elapsedMs(contextEnd, packEnd)} bytes=${packBytes} universe=${pack.metadata.scope_universe} sent=${pack.applications.length}`,
  );

  console.log(`[XOps Insight] req=${reqId} stage=model_start`);
  const modelStart = process.hrtime.bigint();
  let modelResult: ModelResult;
  try {
    modelResult = await callModel(pack);
  } catch (e: unknown) {
    const modelEnd = process.hrtime.bigint();
    const modelMs = elapsedMs(modelStart, modelEnd);
    console.log(
      `[XOps Insight] req=${reqId} stage=model_error model_ms=${modelMs} error_type=${errorType(e)}${noObjectDiagnostics(e)}`,
    );
    console.log(
      `[XOps Insight] req=${reqId} stage=complete total_ms=${elapsedMs(t0, modelEnd)} outcome=model_failed`,
    );
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: "model_call_failed", message },
      { status: 502 },
    );
  }
  const modelEnd = process.hrtime.bigint();
  const modelMs = elapsedMs(modelStart, modelEnd);
  const usage = modelResult.usage;
  console.log(
    `[XOps Insight] req=${reqId} stage=model_complete ms=${modelMs} input_tokens=${usage?.inputTokens ?? "unknown"} output_tokens=${usage?.outputTokens ?? "unknown"} total_tokens=${usage?.totalTokens ?? "unknown"}`,
  );

  const valStart = process.hrtime.bigint();
  const parsedAnswer = structuredAnswerSchema.safeParse(modelResult.answer);
  if (!parsedAnswer.success) {
    const valEnd = process.hrtime.bigint();
    console.log(
      `[XOps Insight] req=${reqId} stage=validation ms=${elapsedMs(valStart, valEnd)}`,
    );
    console.log(
      `[XOps Insight] req=${reqId} stage=complete total_ms=${elapsedMs(t0, valEnd)} outcome=invalid_output`,
    );
    return Response.json(
      { error: "invalid_llm_output", issues: parsedAnswer.error.issues },
      { status: 502 },
    );
  }
  const answer = parsedAnswer.data as unknown as StructuredAnswer;
  const violations = verifyProvenance(answer, pack);
  const valEnd = process.hrtime.bigint();
  console.log(
    `[XOps Insight] req=${reqId} stage=validation ms=${elapsedMs(valStart, valEnd)}`,
  );

  if (violations.length) {
    console.log(
      `[XOps Insight] req=${reqId} stage=complete total_ms=${elapsedMs(t0, valEnd)} outcome=hallucinated`,
    );
    return Response.json(
      { error: "hallucinated_ids", violations },
      { status: 502 },
    );
  }

  console.log(
    `[XOps Insight] req=${reqId} stage=complete total_ms=${elapsedMs(t0, valEnd)} outcome=ok`,
  );
  return Response.json({ answer });
}

async function defaultCallModel(pack: EvidencePack): Promise<ModelResult> {
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
  return {
    answer: result.object as unknown as StructuredAnswer,
    usage: result.usage,
  };
}
