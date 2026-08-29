/**
 * Prints the deterministic top 10 candidates for the AI/ML segment plus a
 * compact view of the resulting Evidence Pack. No LLM call.
 *   npx tsx scripts/demo-portfolio-risk.ts
 */
import { buildPortfolioRiskPack } from "@/lib/agent/insights/portfolio-risk";

const pack = buildPortfolioRiskPack({ kind: "ai_ml_segment" });

console.log("=== TOP 10 — AI/ML segment ===");
console.log(`scope_universe = ${pack.metadata.scope_universe} apps`);
console.log(`as_of          = ${pack.metadata.as_of}`);
console.log(`order          = ${pack.metadata.ranking.order.join(" > ")}`);
console.log("");
for (let i = 0; i < pack.applications.length; i++) {
  const a = pack.applications[i];
  const gaps = a.missing_gates.length ? a.missing_gates.join(",") : "-";
  const impact = a.business_impact_financial ?? "(not declared)";
  const tix = a.tickets_2024 ?? "-";
  console.log(
    `${String(i + 1).padStart(2)}. ${a.criticality}  impact=${impact.padEnd(16)}  missing_gates=[${gaps}]  tickets=${tix}  ${a.app_id}  ${a.name}`,
  );
}

console.log("\n=== EVIDENCE PACK (compact) ===");
console.log(
  JSON.stringify(
    {
      question_type: pack.question_type,
      scope: pack.scope,
      applications_shown: pack.applications.length,
      applications_head: pack.applications.slice(0, 2),
      aggregate: pack.aggregate,
      coverage_gaps: pack.coverage_gaps,
      quality: pack.quality,
      metadata: pack.metadata,
    },
    null,
    2,
  ),
);
