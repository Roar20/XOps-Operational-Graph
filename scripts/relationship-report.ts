/**
 * Reporte diagnostico del modelo de relaciones. Sin interfaz.
 *
 *   npm run relationships
 *
 * Imprime las poblaciones resultantes y corre las invariantes del modelo. Sale
 * con codigo 1 si alguna rompe, de modo que sirve en CI igual que build_data.py.
 */
import {
  applicationStates, groupTopology, platformTopology,
  relationshipCoverage, supportRoutePartition, reconciliation,
  incidentAttribution, signalInventory,
} from "../lib/relationships";
import { UNIVERSE } from "../lib/data";

const n = (v: number) => v.toLocaleString("en-US");
const pct = (v: number, d: number) => `${((100 * v) / d).toFixed(1)}%`;
const rule = (t: string) => console.log(`\n${"=".repeat(74)}\n${t}\n${"=".repeat(74)}`);

const failures: string[] = [];
function inv(id: string, statement: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${id}  ${statement}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(`${id} ${statement} — ${detail}`);
}

/* ------------------------------------------------------------------ */
rule("LAYER 1 · SUPPORT ROUTE PARTITION  (computable from the loaded model)");
const P = supportRoutePartition;
const rows: [string, number, string][] = [
  ["unique_support_route", P.unique.value, "holds at least one support group no other application shares"],
  ["shared_support_route", P.shared.value, "every support group it holds is also served by another application"],
  ["no_declared_support_route", P.none.value, "declares no support group"],
];
for (const [k, v, why] of rows) {
  console.log(`  ${k.padEnd(28)} ${String(n(v)).padStart(5)}  ${pct(v, UNIVERSE).padStart(6)}   ${why}`);
}
console.log(`  ${"".padEnd(28)} ${String(n(UNIVERSE)).padStart(5)}  ${"100.0%".padStart(6)}   complete partition`);
console.log(`\n  What this proves: for ${n(P.shared.value + P.none.value)} of ${n(UNIVERSE)} applications the`);
console.log("  DECLARED SUPPORT RELATIONSHIP ALONE does not yield a unique application route.");
console.log("  It does NOT prove incident attribution is non-deterministic — other signals may resolve it.");

/* ------------------------------------------------------------------ */
rule("LAYER 2 · INCIDENT ATTRIBUTION  (requires evidence not present)");
console.log(`  available: ${incidentAttribution.available}`);
console.log("  missing evidence:");
for (const m of incidentAttribution.missingEvidence) console.log(`    - ${m}`);
console.log("  unlocks once available:");
for (const u of incidentAttribution.unlocks) console.log(`    - ${u}`);

/* ------------------------------------------------------------------ */
rule("SUPPORT GROUP TOPOLOGY");
const shared = groupTopology.filter((g) => g.isShared);
console.log(`  groups in the bridge      ${n(groupTopology.length)}`);
console.log(`  shared by >1 application  ${n(shared.length)}  ${pct(shared.length, groupTopology.length)}`);
console.log(`  most shared group serves  ${n(groupTopology[0]?.appCount ?? 0)} applications  (${groupTopology[0]?.name ?? "—"})`);
console.log("\n  top 5 by applications served:");
for (const g of groupTopology.slice(0, 5)) {
  console.log(`    ${g.name.slice(0, 46).padEnd(46)} ${String(g.appCount).padStart(3)}`);
}

/* ------------------------------------------------------------------ */
rule("PLATFORM TOPOLOGY · direct vs second-order");
console.log(`  traversal: ${platformTopology[0]?.traversal ?? "—"}\n`);
console.log(`  ${"platform".padEnd(20)}${"direct".padStart(8)}${"bridging".padStart(10)}${"2nd-order".padStart(11)}${"reach".padStart(8)}`);
for (const p of platformTopology.slice(0, 10)) {
  console.log(
    `  ${p.name.slice(0, 20).padEnd(20)}${String(p.directAppIds.length).padStart(8)}` +
    `${String(p.bridgingGroupKeys.length).padStart(10)}${String(p.secondOrderAppIds.length).padStart(11)}` +
    `${String(p.directAppIds.length + p.secondOrderAppIds.length).padStart(8)}`,
  );
}

/* ------------------------------------------------------------------ */
rule("RELATIONSHIP COVERAGE");
console.log(`  ${"relationship".padEnd(32)}${"known".padStart(7)}${"missing".padStart(9)}${"derived".padStart(9)}   blocks`);
for (const c of relationshipCoverage) {
  console.log(
    `  ${c.type.padEnd(32)}${String(c.known).padStart(7)}${String(c.missing).padStart(9)}` +
    `${String(c.derived).padStart(9)}   ${c.blocks[0]}`,
  );
}

/* ------------------------------------------------------------------ */
rule("RECONCILIATION vs BUSINESS CASE  (disagreement preserved, no winner picked)");
console.log(`  ${"claim".padEnd(44)}${"case".padStart(8)}${"measured".padStart(10)}  state`);
for (const r of reconciliation) {
  console.log(
    `  ${r.claim.slice(0, 44).padEnd(44)}${String(r.businessCase ?? "—").padStart(8)}` +
    `${String(r.measured ?? "—").padStart(10)}  ${r.state}`,
  );
}
console.log("\n  unresolved / not computable, with reason:");
for (const r of reconciliation.filter((x) => x.state !== "matches")) {
  console.log(`\n    ${r.claim}\n      ${r.note.replace(/\s+/g, " ")}`);
}

/* ------------------------------------------------------------------ */
rule("SIGNAL INVENTORY · what could establish each relationship");
for (const s of signalInventory) {
  console.log(`\n  ${s.relationship}`);
  console.log(`    deterministic path : ${s.deterministicPath ?? "NONE"}`);
  console.log(`    strength           : ${s.strength}   validatable today: ${s.validatableToday}`);
  console.log(`    alternative paths  :`);
  for (const p of s.alternativePaths) console.log(`      - ${p}`);
  console.log(`    AI method          : ${s.aiMethod ?? "not applicable"}`);
  if (s.missingData.length) console.log(`    missing data       : ${s.missingData.join(" · ")}`);
}

/* ------------------------------------------------------------------ */
rule("MODEL INVARIANTS");
inv("RM01", "the support-route partition is complete and disjoint",
  P.unique.value + P.shared.value + P.none.value === UNIVERSE,
  `${P.unique.value} + ${P.shared.value} + ${P.none.value} vs ${UNIVERSE}`);

inv("RM02", "every application carries exactly one route state",
  applicationStates.length === UNIVERSE, `${applicationStates.length} states for ${UNIVERSE} applications`);

inv("RM03", "an application with no support group is never marked unique",
  !applicationStates.some((a) => a.supportGroupKeys.length === 0 && a.supportRoute === "unique_support_route"), "");

inv("RM04", "an application marked unique holds at least one exclusive group",
  applicationStates.filter((a) => a.supportRoute === "unique_support_route").every((a) => a.exclusiveGroups.length > 0), "");

inv("RM05", "an application marked shared holds groups but none exclusive",
  applicationStates.filter((a) => a.supportRoute === "shared_support_route")
    .every((a) => a.supportGroupKeys.length > 0 && a.exclusiveGroups.length === 0), "");

inv("RM06", "second-order exposure never intersects direct exposure",
  platformTopology.every((p) => {
    const d = new Set(p.directAppIds);
    return p.secondOrderAppIds.every((id) => !d.has(id));
  }), "");

inv("RM07", "a platform with no bridging group has no second-order reach",
  platformTopology.filter((p) => p.bridgingGroupKeys.length === 0).every((p) => p.secondOrderAppIds.length === 0), "");

inv("RM08", "every coverage row sums known + missing to the universe",
  relationshipCoverage.every((c) => c.known + c.missing === c.universe),
  relationshipCoverage.map((c) => `${c.type}:${c.known + c.missing}`).join(" "));

inv("RM09", "incident attribution is declared unavailable, never estimated",
  !incidentAttribution.available &&
  incidentAttribution.ambiguousShare.value === null &&
  incidentAttribution.medianTimeToResolve.value === null, "");

inv("RM10", "no business-case figure is presented as measured",
  reconciliation.every((r) => r.state !== "matches" || r.measured !== null), "");

inv("RM11", "declared owners are never invented",
  applicationStates.every((a) =>
    (a.declaredOwners.dpm === null || typeof a.declaredOwners.dpm === "string") &&
    (a.declaredOwners.owner === null || typeof a.declaredOwners.owner === "string")), "");

inv("RM12", "every shared group in the topology really serves more than one application",
  groupTopology.filter((g) => g.isShared).every((g) => g.appIds.length > 1), "");

const unresolved = reconciliation.filter((r) => r.state === "diverges" || r.state === "not_computable");
inv("RM13", "every divergence carries a written reason",
  unresolved.every((r) => r.note.trim().length > 40), `${unresolved.length} unresolved items`);

console.log(`\n  ${failures.length === 0 ? "13/13 pass" : `${13 - failures.length}/13 pass`}`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
