import type { Application } from "@/types";
import {
  aiApps,
  applications,
  computeGaps,
  meta,
  qualityOfAgs,
  sectors,
} from "@/lib/data";
import type {
  EvidencePack,
  PortfolioRiskScope,
  RankedApp,
  SectorAggregate,
  XOpsContext,
} from "./types";

/**
 * The screening returns at most this many applications. The number is
 * declared to the model in metadata.ranking.top_n so its answer can
 * reference it truthfully.
 */
const MAX_TOP = 10;

/**
 * Pure URL → XOpsContext translation. Kept small enough to test without a
 * React tree. The router is the only source of truth for where the user is;
 * v1 does not implement setOverride.
 */
export function deriveXOpsContext(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): XOpsContext {
  if (pathname === "/" || pathname.startsWith("/portfolio")) return { kind: "portfolio" };
  if (pathname.startsWith("/sectors")) return { kind: "portfolio" };
  if (pathname.startsWith("/ai-ops")) return { kind: "ai_ml_segment" };
  if (pathname.startsWith("/app/")) {
    const app_id = typeof params.app_id === "string" ? params.app_id : undefined;
    return app_id ? { kind: "application", app_id } : { kind: "other" };
  }
  return { kind: "other" };
}

/**
 * Deterministic lexicographic ordering. Uses only signals already declared in
 * the semantic layer; introduces no synthetic weight and no cross-signal
 * arithmetic. Tie-breaker is ticket volume, then name.
 *
 * Order:
 *   1. criticality_weight       (5, 3, 1, 0 → C1, C2, C3, C-)
 *   2. declared financial impact (Critical, High, Medium, Low, null)
 *   3. missing operational gates (higher first)
 *   4. tickets_2024              (higher first) — tie-breaker only
 *   5. name                      (alphabetical) — deterministic tail
 */
export function rankApps(apps: Application[]): Application[] {
  const impactOrder: Record<string, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };
  const missingGates = (x: Application) =>
    Number(!x.gates.attributable) +
    Number(!x.gates.routable) +
    Number(!x.gates.owned) +
    Number(!x.gates.platform_known);

  return [...apps].sort((a, b) => {
    if (b.criticality_weight !== a.criticality_weight) {
      return b.criticality_weight - a.criticality_weight;
    }
    const ai = a.business_impact.financial ? impactOrder[a.business_impact.financial] : 0;
    const bi = b.business_impact.financial ? impactOrder[b.business_impact.financial] : 0;
    if (bi !== ai) return bi - ai;

    const ag = missingGates(a);
    const bg = missingGates(b);
    if (bg !== ag) return bg - ag;

    const at = a.tickets_2024 ?? 0;
    const bt = b.tickets_2024 ?? 0;
    if (bt !== at) return bt - at;

    return a.name.localeCompare(b.name);
  });
}

function toRankedApp(a: Application): RankedApp {
  const missing: RankedApp["missing_gates"] = [];
  if (!a.gates.attributable) missing.push("attributable");
  if (!a.gates.routable) missing.push("routable");
  if (!a.gates.owned) missing.push("owned");
  if (!a.gates.platform_known) missing.push("platform_known");
  return {
    app_id: a.app_id,
    name: a.name,
    criticality: a.criticality,
    criticality_weight: a.criticality_weight,
    business_impact_financial: a.business_impact.financial,
    missing_gates: missing,
    tickets_2024: a.tickets_2024,
    sectors: a.sectors,
    ags: a.ags,
    ag_evidence_tier: a.ag_evidence_tier,
    platforms: a.platforms,
    platform_evidence_tier: a.platform_evidence_tier,
    dpm: a.dpm,
    owner: a.owner,
    has_quality: a.has_quality,
    is_ai_ml: a.is_ai_ml,
  };
}

function resolveScopeApps(scope: PortfolioRiskScope): Application[] {
  if (scope.kind === "ai_ml_segment") return aiApps;
  const sec = sectors.find((s) => s.sector_id === scope.sector_id);
  if (!sec) return [];
  const ids = new Set(sec.app_ids);
  return applications.filter((a) => ids.has(a.app_id));
}

/**
 * Materializes an EvidencePack for Portfolio Risk. Everything numeric comes
 * from an already-authorized function of the semantic layer; this file adds
 * no math of its own.
 */
export function buildPortfolioRiskPack(scope: PortfolioRiskScope): EvidencePack {
  const scopeApps = resolveScopeApps(scope);
  const ranked = rankApps(scopeApps);
  const top = ranked.slice(0, MAX_TOP);

  const gaps = computeGaps(scopeApps);
  const agNames = [...new Set(scopeApps.flatMap((a) => a.ags))];
  const q = qualityOfAgs(agNames);

  const aggregate: SectorAggregate | null =
    scope.kind === "sector"
      ? (() => {
          const s = sectors.find((x) => x.sector_id === scope.sector_id);
          if (!s) return null;
          return {
            sector_id: s.sector_id,
            name: s.name,
            apps: s.apps,
            routable: s.routable,
            owned: s.owned,
            platform_known: s.platform_known,
            attributable: s.attributable,
            ai_ml: s.ai_ml,
            criticality_mix: s.criticality_mix,
            weighted: s.weighted,
            tickets_2024: s.tickets_2024,
            impact_declared: s.impact_declared,
            impact_high: s.impact_high,
          };
        })()
      : null;

  return {
    question_type: "portfolio_risk",
    scope,
    applications: top.map(toRankedApp),
    aggregate,
    coverage_gaps: gaps,
    quality: {
      ags_matched: q.measured,
      ags_universe: q.total,
      weighted_diagnostic_rate: q.diagnostic_rate,
      weighted_has_root_rate: q.has_root_rate,
      weighted_poor_rate: q.poor_rate,
      incidents_covered: q.incidents,
      scope_note: "measured per AG, not per application",
    },
    metadata: {
      as_of: meta.as_of,
      universe_apps: meta.universe_apps,
      scope_universe: scopeApps.length,
      schema_version: "xops-insight.v1",
      ranking: {
        kind: "deterministic_screening",
        order: [
          "criticality",
          "declared_financial_impact",
          "missing_operational_gates",
          "tickets_2024_tiebreaker",
        ],
        disclaimer:
          "XOps has no canonical application-level risk ranking. Candidates are deterministically ordered using existing operational signals; ticket volume is used only as a tie-breaker.",
        top_n: MAX_TOP,
      },
      blocked_measures: [
        { id: "MTTR", reason: "no opened_at in the QN corpus" },
        { id: "REASSIGNMENT", reason: "field absent" },
        { id: "DECALOGUE_SERIES", reason: "classifier v1/v2 not calibrated" },
      ],
    },
  };
}
