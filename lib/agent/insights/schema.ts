import { z } from "zod";

/**
 * Shared zod schemas. Used by /api/insight to validate the incoming pack, by
 * generateObject to force the LLM output shape, and by tests as a single
 * source of truth. Kept flexible on the pack side (server-authored, low risk)
 * and strict on the answer side (LLM-authored, hard-guarded).
 */

const portfolioRiskScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ai_ml_segment") }),
  z.object({ kind: z.literal("sector"), sector_id: z.string().min(1) }),
]);

const rankedAppSchema = z
  .object({
    app_id: z.string().min(1),
    name: z.string(),
  })
  .passthrough();

export const evidencePackSchema = z.object({
  question_type: z.literal("portfolio_risk"),
  scope: portfolioRiskScopeSchema,
  applications: z.array(rankedAppSchema).max(50),
  aggregate: z.any().nullable(),
  coverage_gaps: z.any(),
  quality: z.any(),
  metadata: z.object({
    as_of: z.string(),
    universe_apps: z.number().int().nonnegative(),
    scope_universe: z.number().int().nonnegative(),
    schema_version: z.literal("xops-insight.v1"),
    ranking: z.object({
      kind: z.literal("deterministic_screening"),
      order: z.array(z.string()).min(1),
      disclaimer: z.string().min(1),
      top_n: z.number().int().nonnegative(),
    }),
    blocked_measures: z.array(
      z.object({ id: z.string(), reason: z.string() }),
    ),
  }),
});

export const findingSchema = z.object({
  app_id: z.string().min(1),
  fact: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1)).min(1).max(8),
  // R5: two-signals rule, enforced at the schema boundary. The prompt asks for
  // it; this makes it non-negotiable.
  signals_combined: z.array(z.string().min(1)).min(2).max(6),
});

export const structuredAnswerSchema = z.object({
  answer: z.string().min(1).max(1200),
  findings: z.array(findingSchema).min(1).max(10),
  insight: z.string().min(1).max(500),
  recommended_action: z.string().min(1).max(400),
  confidence: z.enum(["high", "medium", "low"]),
  limitations: z.array(z.string()).max(6),
});
