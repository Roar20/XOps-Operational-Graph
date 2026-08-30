import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioRiskPack,
  deriveXOpsContext,
  rankApps,
} from "@/lib/agent/insights/portfolio-risk";
import { aiApps, sectors } from "@/lib/data";
import type { Application } from "@/types";

describe("deriveXOpsContext", () => {
  it("maps /ai-ops to ai_ml_segment", () => {
    assert.deepEqual(deriveXOpsContext("/ai-ops", {}), { kind: "ai_ml_segment" });
  });
  it("maps /app/APP-001 to application with app_id", () => {
    assert.deepEqual(
      deriveXOpsContext("/app/APP-001", { app_id: "APP-001" }),
      { kind: "application", app_id: "APP-001" },
    );
  });
  it("falls back to portfolio for /sectors, / and /portfolio", () => {
    assert.deepEqual(deriveXOpsContext("/", {}), { kind: "portfolio" });
    assert.deepEqual(deriveXOpsContext("/portfolio", {}), { kind: "portfolio" });
    assert.deepEqual(deriveXOpsContext("/sectors", {}), { kind: "portfolio" });
  });
});

describe("rankApps", () => {
  const mk = (over: Partial<Application>): Application =>
    ({
      app_id: "X", name: "X", apm: "", category: "",
      is_ai_ml: false, scope_status: "", process: "", sector: "",
      program: "", archetype: "", criticality: "C-", criticality_raw: "",
      criticality_weight: 0, service_tier: "", support_window: "",
      user_base: "", financial_impact: "", dpm: "", dpm_l3: "",
      owner: "", tech_lead: "", sectors: [], sector_unrecognized: [],
      business_impact: {
        financial: null, financial_raw: null,
        user_base: null, user_base_raw: null,
        service_tier: null, support_window: null,
      },
      platforms: [], platform_evidence_tier: null, technology_raw: null,
      ags: [], ag_evidence_tier: null, ag_source_kind: null,
      declared_reports: null, tickets_2024: null,
      gates: { attributable: true, routable: true, owned: true, platform_known: true },
      has_quality: false,
      ...over,
    }) as Application;

  it("orders by criticality first", () => {
    const out = rankApps([
      mk({ app_id: "a", name: "a", criticality: "C3", criticality_weight: 1 }),
      mk({ app_id: "b", name: "b", criticality: "C1", criticality_weight: 5 }),
      mk({ app_id: "c", name: "c", criticality: "C2", criticality_weight: 3 }),
    ]);
    assert.deepEqual(out.map(a => a.app_id), ["b", "c", "a"]);
  });

  it("uses declared financial impact as second tiebreaker, null stays last", () => {
    const out = rankApps([
      mk({ app_id: "a", name: "a", criticality_weight: 3, business_impact: { financial: "Low",     financial_raw: null, user_base: null, user_base_raw: null, service_tier: null, support_window: null } }),
      mk({ app_id: "b", name: "b", criticality_weight: 3, business_impact: { financial: "Critical",financial_raw: null, user_base: null, user_base_raw: null, service_tier: null, support_window: null } }),
      mk({ app_id: "c", name: "c", criticality_weight: 3, business_impact: { financial: null,      financial_raw: null, user_base: null, user_base_raw: null, service_tier: null, support_window: null } }),
    ]);
    assert.deepEqual(out.map(a => a.app_id), ["b", "a", "c"]);
  });

  it("uses missing gates as third tiebreaker, higher first", () => {
    const out = rankApps([
      mk({ app_id: "a", name: "a", criticality_weight: 3, gates: { attributable: true, routable: true, owned: true, platform_known: true } }),
      mk({ app_id: "b", name: "b", criticality_weight: 3, gates: { attributable: false, routable: false, owned: true, platform_known: true } }),
      mk({ app_id: "c", name: "c", criticality_weight: 3, gates: { attributable: false, routable: false, owned: false, platform_known: false } }),
    ]);
    assert.deepEqual(out.map(a => a.app_id), ["c", "b", "a"]);
  });

  it("uses tickets_2024 only as tie-breaker (name last)", () => {
    const out = rankApps([
      mk({ app_id: "a", name: "alfa", criticality_weight: 3, tickets_2024: 10 }),
      mk({ app_id: "b", name: "beta", criticality_weight: 3, tickets_2024: 50 }),
      mk({ app_id: "c", name: "cetro", criticality_weight: 3, tickets_2024: 50 }),
    ]);
    // b (50, "beta") before c (50, "cetro") because same everything, name tiebreaker
    assert.deepEqual(out.map(a => a.app_id), ["b", "c", "a"]);
  });
});

describe("buildPortfolioRiskPack — scope filtering", () => {
  it("scope=ai_ml_segment: every returned app is AI/ML", () => {
    const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });
    assert.equal(pack.question_type, "portfolio_risk");
    assert.equal(pack.scope.kind, "ai_ml_segment");
    assert.equal(pack.metadata.scope_universe, aiApps.length);
    assert(pack.applications.length <= 10);
    for (const a of pack.applications) {
      assert.equal(a.is_ai_ml, true, `${a.app_id} should be AI/ML`);
    }
  });

  it("scope=sector: every returned app belongs to the sector; aggregate present", () => {
    const first = sectors[0];
    const pack = buildPortfolioRiskPack({
      kind: "sector",
      sector_id: first.sector_id,
    });
    assert.equal(pack.scope.kind, "sector");
    assert.equal(pack.metadata.scope_universe, first.apps);
    assert.ok(pack.aggregate);
    assert.equal(pack.aggregate!.sector_id, first.sector_id);
    const allowed = new Set(first.app_ids);
    for (const a of pack.applications) {
      assert.ok(
        allowed.has(a.app_id),
        `${a.app_id} should belong to sector ${first.sector_id}`,
      );
    }
  });

  it("scope=sector unknown: empty applications, null aggregate, no crash", () => {
    const pack = buildPortfolioRiskPack({
      kind: "sector",
      sector_id: "___does_not_exist___",
    });
    assert.equal(pack.applications.length, 0);
    assert.equal(pack.aggregate, null);
    assert.equal(pack.metadata.scope_universe, 0);
  });

  it("ranking metadata is deterministic_screening with the declared order", () => {
    const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });
    assert.equal(pack.metadata.ranking.kind, "deterministic_screening");
    assert.deepEqual(pack.metadata.ranking.order, [
      "criticality",
      "declared_financial_impact",
      "missing_operational_gates",
      "tickets_2024_tiebreaker",
    ]);
    assert.match(
      pack.metadata.ranking.disclaimer,
      /no canonical application-level risk ranking/i,
    );
  });
});
