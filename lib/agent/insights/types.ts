import type {
  Application,
  BusinessImpact,
  Criticality,
  EvidenceTier,
  Sector,
} from "@/types";

/**
 * Where the user is in XOps, derived from the URL. Navigation state, never
 * evidence. The insight builders read this to decide defaults; they materialize
 * evidence separately.
 */
export type XOpsContext =
  | { kind: "portfolio" }
  | { kind: "sector"; sector_id: Sector["sector_id"] }
  | { kind: "ai_ml_segment" }
  | { kind: "application"; app_id: Application["app_id"] }
  | { kind: "other" };

/**
 * v1 only. When a second question type ships, extend the union here; do not
 * anticipate it now.
 */
export type QuestionType = "portfolio_risk";

/** Scope selected inside the Ask XOps drawer for the Portfolio Risk question. */
export type PortfolioRiskScope =
  | { kind: "ai_ml_segment" }
  | { kind: "sector"; sector_id: string };

/**
 * Projection of Application shipped to the model. Deliberately narrower than
 * Application: raw fields, internal weights and unrecognized tokens stay out
 * so the LLM cannot reason over them.
 */
export interface RankedApp {
  app_id: string;
  name: string;
  criticality: Criticality;
  criticality_weight: 0 | 1 | 3 | 5;
  business_impact_financial: BusinessImpact["financial"];
  missing_gates: Array<"attributable" | "routable" | "owned" | "platform_known">;
  tickets_2024: number | null;
  sectors: string[];
  ags: string[];
  ag_evidence_tier: EvidenceTier | null;
  platforms: string[];
  platform_evidence_tier: Exclude<EvidenceTier, "E2/E3"> | null;
  dpm: string;
  owner: string;
  has_quality: boolean;
  is_ai_ml: boolean;
}

export interface SectorAggregate {
  sector_id: string;
  name: string;
  apps: number;
  routable: number;
  owned: number;
  platform_known: number;
  attributable: number;
  ai_ml: number;
  criticality_mix: Record<Criticality, number>;
  weighted: number;
  tickets_2024: number;
  impact_declared: number;
  impact_high: number;
}

/** Mirrors lib/data.ts::Gaps so the LLM sees the same shape the UI sees. */
export interface CoverageGapSlice {
  universe: number;
  withoutPlatform: number;
  withoutAg: number;
  withoutDpm: number;
  withoutAttribution: number;
  withoutCriticality: number;
  routable: number;
  owned: number;
  attributable: number;
  platformKnown: number;
}

export interface QualitySlice {
  ags_matched: number;
  ags_universe: number;
  weighted_diagnostic_rate: number | null;
  weighted_has_root_rate: number | null;
  weighted_poor_rate: number | null;
  incidents_covered: number;
  scope_note: string;
}

export interface EvidencePack {
  question_type: QuestionType;
  scope: PortfolioRiskScope;
  applications: RankedApp[];
  aggregate: SectorAggregate | null;
  coverage_gaps: CoverageGapSlice;
  quality: QualitySlice;
  metadata: {
    as_of: string;
    universe_apps: number;
    scope_universe: number;
    schema_version: "xops-insight.v1";
    ranking: {
      kind: "deterministic_screening";
      order: string[];
      disclaimer: string;
      top_n: number;
    };
    blocked_measures: Array<{ id: string; reason: string }>;
  };
}

/**
 * v1: every subject and every evidence reference is an app_id. When we start
 * citing sectors, platforms or AGs as first-class subjects, generalize to a
 * discriminated union.
 */
export interface Finding {
  app_id: string;
  fact: string;
  evidence: string[];
  signals_combined: string[];
}

export interface StructuredAnswer {
  answer: string;
  findings: Finding[];
  insight: string;
  recommended_action: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
}
