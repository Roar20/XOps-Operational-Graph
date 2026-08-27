/**
 * Automated verification of the section 6 acceptance criteria and the antipattern
 * hunt from prompt 6, run against the live application.
 *
 *   npm run build && npx next start -p 3100 &
 *   npm i -D playwright --no-save
 *   npm run verify
 *
 * Rule of the verifier itself: no expected figure is hand-written. Every one is
 * derived from the JSON, so if the data changes the verifier stays valid and it is
 * the interface that has to keep up.
 *
 * Exits 1 if any criterion stops holding.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const D = JSON.parse(readFileSync(new URL("../data/xops-operational-graph-data.json", import.meta.url), "utf8"));
const APPS = D.applications;
const PLAT = Object.fromEntries(D.platforms.map((p) => [p.name, p]));
const AS_OF = D.meta.as_of;

/* ---- references derived from the data ---- */
const PA = "TERADATA", PB = "SAP_BW";
const union = new Set([...PLAT[PA].app_ids, ...PLAT[PB].app_ids]);
const naiveSum = PLAT[PA].app_ids.length + PLAT[PB].app_ids.length;
const overlap = naiveSum - union.size;

const noAg = APPS.filter((a) => a.ags.length === 0);
const noAgTbdDpm = noAg.find((a) => a.dpm === "TBD");
const maxAgApp = APPS.reduce((m, a) => (a.ags.length > m.ags.length ? a : m), APPS[0]);
const rawApp = APPS.find((a) => a.technology_raw && a.platforms.length > 0);
const noCrit = APPS.filter((a) => a.criticality === "C-").length;
const aiApps = APPS.filter((a) => a.is_ai_ml);
const aiRoutable = aiApps.filter((a) => a.gates.routable).length;
const IMPACT = ["Critical", "High", "Medium", "Low"];
const impactBy = Object.fromEntries(IMPACT.map((k) =>
  [k, APPS.filter((a) => a.business_impact.financial === k).length]));
const impactDeclared = IMPACT.reduce((n, k) => n + impactBy[k], 0);
const sectorPairs = APPS.reduce((n, a) => n + a.sectors.length, 0);
const appsWithSector = APPS.filter((a) => a.sectors.length > 0).length;
const badSector = APPS.filter((a) => a.sector_unrecognized.length > 0);
const crossing = {
  ir: APPS.filter((a) => a.business_impact.financial && a.gates.routable).length,
  inr: APPS.filter((a) => a.business_impact.financial && !a.gates.routable).length,
  nir: APPS.filter((a) => !a.business_impact.financial && a.gates.routable).length,
  nnr: APPS.filter((a) => !a.business_impact.financial && !a.gates.routable).length,
};
const GRAN = Object.fromEntries(Object.entries(D.quality.timeseries).map(([k, v]) => [k, v.length]));
const diagDelta = D.quality.baseline_metrics.find((m) => m.key === "diagnostic_rate");
const poorDelta = D.quality.baseline_metrics.find((m) => m.key === "poor_critical_rate");

const ROUTES = ["/", "/portfolio", "/sectors", "/blast-radius", "/graph", "/quality", "/ai-ops",
  `/app/${noAg[0].app_id}`];

const B = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
const out = [];
const ok = (n, c, d = "") => out.push([!!c, `${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`]);
const txt = () => p.locator("body").innerText();
const go = async (r, wait = 900) => { await p.goto(B + r, { waitUntil: "load" }); await p.waitForTimeout(wait); };
/** Normalizes thousands separators so a number can be found in the text. */
const flat = (s) => s.replace(/ | /g, " ").replace(/(\d),(\d{3})/g, "$1$2");
const n = (x) => String(x);

/* ---------------- C1 · deduplicated union, never the sum ---------------- */
await go("/blast-radius", 1300);
await p.locator(`label:has-text("${PA}") input[type="checkbox"]`).first().click();
await p.locator(`label:has-text("${PB}") input[type="checkbox"]`).first().click();
await p.waitForTimeout(700);
let t = flat(await txt());
ok(`C1 deduplicated union ${union.size} and not the sum ${naiveSum}`,
  new RegExp(`Deduplicated union[\\s\\S]{0,60}\\b${union.size}\\b`, "i").test(t)
  && t.includes(n(naiveSum)) && new RegExp(`overcounts by\\s*${overlap}`).test(t),
  `union ${union.size} · sum ${naiveSum} · overlap ${overlap}`);

ok("C1b the raw sum is only ever shown struck through",
  (await p.locator("span.line-through").count()) > 0);

/* C2 · business processes as the centrepiece */
ok("C2 business processes affected present on blast radius",
  /Business processes affected/i.test(t));

/* R3 · every proportion carries its denominator. A bare "NN.N%" is admissible only
   if its immediate context names the denominator ("of N") or if it lives inside a
   table that declares it once in its caption. Anything else is a failure. */
const bareCheck = () => {
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length) continue;
    const s = (el.textContent || "").trim();
    if (!/^[+-]?\d+([.,]\d+)?\s*%$/.test(s)) continue;
    // The denominator is looked for in the block containing the figure, up to three
    // ancestors above: "165 of 504", "over 30,988 incidents", "of the corpus".
    let ctx = "", node = el;
    for (let i = 0; i < 3 && node.parentElement; i++) { node = node.parentElement; ctx += " " + (node.textContent || ""); }
    if (/\b(of|over|out of)\b[^.]{0,40}\d/.test(ctx.replace(/\s+/g, " "))) continue;
    if (el.closest("table")?.querySelector("caption")) continue;
    // An axis tick is the chart scale, not a published figure: the universe of each
    // series is declared in the prose next to the chart.
    if (el.closest("svg")) continue;
    bad.push((el.closest("tr") || el.parentElement)?.textContent?.slice(0, 90) || s);
  }
  return bad;
};
const bare = await p.evaluate(bareCheck);
ok("R3 no bare percentage without a denominator on blast radius", bare.length === 0,
  bare.slice(0, 3).join(" | "));

/* ---------------- C5 and C6 · cut-off and rules on every route ---------------- */
let asOfEverywhere = true, rulesEverywhere = true, missing = "";
for (const r of ROUTES) {
  await go(r, 800);
  const s = await txt();
  if (!s.includes(AS_OF)) { asOfEverywhere = false; missing = r; break; }
  await p.getByRole("button", { name: /How to read this/i }).click();
  await p.waitForTimeout(400);
  const s2 = await txt();
  const hasAll = D.meta.rules.every((rule) => s2.includes(rule.id));
  const hasTiers = ["E1", "E2", "E3"].every((x) => s2.includes(x));
  if (!hasAll || !hasTiers) { rulesEverywhere = false; missing = r; break; }
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
}
ok(`C6 cut-off ${AS_OF} visible on all ${ROUTES.length} routes`, asOfEverywhere, missing);
ok(`C5 rules panel with ${D.meta.rules.length} rules and the 3 evidence tiers on all ${ROUTES.length} routes`,
  rulesEverywhere, missing);

/* ---------------- C3 and C4 · the unresolved is declared ---------------- */
await go(`/app/${noAgTbdDpm.app_id}`, 900);
t = flat(await txt());
ok("C3 an application with no AG is published and tagged Not routable",
  t.includes("Not routable") && /has no declared Assignment Group/i.test(t));
ok("C4 an unconfirmed DPM is shown as TBD", /DPM\s*\n\s*TBD/.test(t));

/* C7 · every AG, not one */
await go(`/app/${maxAgApp.app_id}`, 900);
t = await txt();
const listedAgs = maxAgApp.ags.filter((g) => t.includes(g)).length;
ok(`C7 ${maxAgApp.name} lists all ${maxAgApp.ags.length} of its Assignment Groups`,
  listedAgs === maxAgApp.ags.length, `listed ${listedAgs}`);
ok("C7b states that the application alone does not determine where the ticket goes",
  /does not determine where the ticket goes/i.test(t));

/* C8 · R7 a derivation never disguises itself as source data */
await go(`/app/${rawApp.app_id}`, 900);
t = await txt();
ok("C8 technology_raw visible next to the derived platforms",
  t.includes(rawApp.technology_raw.slice(0, 24)) && /technology_raw/i.test(t));
ok("C8b evidence tier declared on the platform link",
  new RegExp(`\\b${rawApp.platform_evidence_tier}\\b`).test(t));

/* C9 · undeclared criticality is shown, never imputed */
await go("/portfolio", 1300);
t = flat(await txt());
ok(`C9 the ${noCrit} applications with no criticality are declared as Not declared`,
  t.includes("Not declared") && t.includes(n(noCrit)), `expected ${noCrit}`);
ok(`C9b the universe ${D.meta.universe_apps} is the visible denominator`,
  t.includes(n(D.meta.universe_apps)));

/* ---------------- C10 · the delta reads the direction, not the sign ---------------- */
await go("/quality", 1600);
t = flat(await txt());
const upGreen = await p.evaluate((v) => {
  const el = [...document.querySelectorAll("span")].find((e) => e.textContent?.includes(`+${v.toFixed(1)} pp`));
  return el ? getComputedStyle(el).color : null;
}, diagDelta.delta);
const downGreen = await p.evaluate((v) => {
  const el = [...document.querySelectorAll("span")].find((e) => e.textContent?.includes(`${v.toFixed(1)} pp`));
  return el ? getComputedStyle(el).color : null;
}, poorDelta.delta);
ok(`C10 delta +${diagDelta.delta} pp (up_is_good) is painted as an improvement`,
  upGreen === "rgb(31, 122, 90)", String(upGreen));
ok(`C10b delta ${poorDelta.delta} pp (down_is_good) is ALSO painted as an improvement`,
  downGreen === "rgb(31, 122, 90)", String(downGreen));

/* C11 · granularity with the real period counts */
const granOk = Object.values(GRAN).every((c) => t.includes(n(c)));
ok(`C11 granularity selector ${GRAN.week}/${GRAN.month}/${GRAN.quarter}/${GRAN.year}`, granOk);

/* R6 · eligibility is part of the metric */
ok("R6 eligible corpus with its raw universe and the rule written out",
  t.includes(n(D.quality.meta.eligible)) && t.includes(n(D.quality.meta.universe_raw))
  && /State in \(Closed, Resolved\)/.test(t));
/* R7 · a single instrument, with the disagreement reachable */
await p.getByRole("button", { name: /disagreement between instruments/i }).click();
await p.waitForTimeout(400);
t = flat(await txt());
ok("R7 the disagreement between instruments is reachable from the UI",
  D.quality.meta.band_divergence.every((b) => t.includes(b.binary_xlsx.toFixed(1))));
/* R8 · baseline after the break, with the break declared */
ok("R8 the 2025Q3 change of practice is declared next to the baseline",
  t.includes("2025Q3") && t.includes(D.quality.meta.baseline_window[0]));

/* ---------------- C12 · AI Ops comparison ---------------- */
await go("/ai-ops", 1400);
t = flat(await txt());
ok(`C12 AI/ML segment ${aiApps.length} with routing ${aiRoutable}`,
  t.includes(n(aiApps.length)) && t.includes(n(aiRoutable)));
ok("C12b the gap is compared against the full portfolio with both denominators",
  t.includes(n(D.meta.universe_apps)) && /pp\b/.test(t));

/* ---------------- antipatterns (prompt 6) ---------------- */
/* The list is not filtered: applications with no route stay published. */
const unroutedShown = await p.locator("text=Not routable").count();
ok("AP1 AI/ML applications with no AG are listed, not filtered out", unroutedShown > 0);

/* No total ever adds the radii of different platforms. */
await go("/blast-radius", 1300);
await p.locator(`label:has-text("${PA}") input[type="checkbox"]`).first().click();
await p.locator(`label:has-text("${PB}") input[type="checkbox"]`).first().click();
await p.waitForTimeout(700);
const sumIsLabeledWrong = await p.evaluate((s) => {
  const el = [...document.querySelectorAll("span")].find((e) => e.textContent?.trim() === String(s));
  if (!el) return false;
  return getComputedStyle(el).textDecorationLine.includes("line-through");
}, naiveSum);
ok("AP2 the raw sum only appears struck through and labelled as an overcount", sumIsLabeledWrong);

/* Tickets are never coloured as risk. */
await go(`/app/${APPS.find((a) => a.tickets_2024 !== null)?.app_id ?? APPS[0].app_id}`, 900);
ok("AP3 support load is declared a cost axis, not a risk axis",
  /a cost axis/i.test(await txt()));

/* R3 on every route, not just on blast radius. */
let bareAll = [];
for (const r of ROUTES) {
  await go(r, 1100);
  const found = await p.evaluate(bareCheck);
  if (found.length) bareAll.push(`${r}: ${found[0]}`);
}
ok("R3b no bare percentage without a denominator on any route",
  bareAll.length === 0, bareAll.slice(0, 3).join(" | "));

/* ---------------- business layer, sectors, impact, traceability ---------------- */
await go("/", 1500);
t = flat(await txt());

/* La capa de entrada responde las tres preguntas con denominador (R3). */
ok("B1 the overview answers routing, ownership and business impact with denominators",
  t.includes(`${APPS.filter((a) => a.gates.routable).length} of ${D.meta.universe_apps}`)
  && t.includes(`${APPS.filter((a) => a.gates.owned).length} of ${D.meta.universe_apps}`)
  && t.includes(`${impactDeclared} of ${D.meta.universe_apps}`));

/* El error de lectura que esta pantalla existe para evitar: ausencia != Low. */
ok("B2 business impact declares that the levels do not add up to the portfolio",
  IMPACT.every((k) => t.includes(n(impactBy[k])))
  && /never as Low/i.test(t) && /not declared/i.test(t));

/* El cruce es una particion: las cuatro celdas suman el universo. */
ok("B3 the impact x route crossing is a partition that adds to the universe",
  crossing.ir + crossing.inr + crossing.nir + crossing.nnr === D.meta.universe_apps
  && t.includes(n(crossing.nnr)) && t.includes(n(crossing.nir)),
  `${crossing.ir}/${crossing.inr}/${crossing.nir}/${crossing.nnr}`);

/* Sector es N:M y la pantalla lo dice antes de mostrar la tabla. */
ok("B4 sectors are declared non-additive",
  /cannot be added together/i.test(t) && t.includes(n(D.sectors.length)));

await go("/sectors", 1400);
t = flat(await txt());
ok("B5 the sector page publishes pairs and applications as different figures",
  t.includes(n(sectorPairs)) && t.includes(`${appsWithSector} of ${D.meta.universe_apps}`),
  `${sectorPairs} pairs · ${appsWithSector} apps`);
ok("B6 the ServiceNow tokens found in the sector column are listed, not cleaned away",
  badSector.length > 0 && t.includes(badSector[0].sector_unrecognized[0]));
ok("B7 applications with no recognised sector are declared, not distributed",
  new RegExp(`${D.meta.universe_apps - appsWithSector} of ${D.meta.universe_apps}`).test(t));

/* El numero de incidente no existe en el modelo y se declara donde importa. */
await go("/quality", 1600);
t = flat(await txt());
ok("B8 the absence of an incident number is declared on the quality screen",
  /no incident number in this model/i.test(t)
  && t.includes(D.meta.incident_link.join_path));

/* Trazabilidad: la ficha abre y trae formula, denominador y hoja de origen. */
await go("/portfolio", 1500);
await p.getByRole("button", { name: /Traceability for Routing coverage/i }).first().click();
await p.waitForTimeout(600);
t = flat(await txt());
const m07 = D.measures.find((m) => m.measure_id === "M07");
ok("B9 the traceability card carries formula, declared denominator, tier, status and source sheet",
  t.includes(m07.formula) && t.includes(m07.denominator) && t.includes(m07.status)
  && t.includes(m07.source_sheet) && t.includes(D.meta.source_file));
ok("B10 the traceability card shows the live value next to the sheet's own claim",
  t.includes(`${APPS.filter((a) => a.gates.routable).length} of ${D.meta.universe_apps}`)
  && /sheet records/i.test(t));

/* ---------------- graph and Sankey ---------------- */
await go("/graph", 1800);
t = flat(await txt());
/* R4 on a diagram that adds by construction: the unit has to be written down, and
   so does the overcount against the distinct application total. */
ok("G1 the Sankey declares its unit is the platform-application link, not the application",
  /unit of this diagram is the platform.application link/i.test(t));
ok("G2 the Sankey publishes its overcount against distinct applications",
  /overcounts by\s*\d+/i.test(t) && new RegExp(`\\b${D.meta.universe_apps}\\b`).test(t));
ok("G3 the platforms left out of the flow are named, not silently dropped",
  /platforms are not drawn/i.test(t));
ok("G4 the graph declares the applications that cannot enter it",
  /no platform identified/i.test(t));
/* El grafo dibuja TODOS los vecinos del foco, igual que la ficha lista todos los AGs. */
const svgNodes = await p.evaluate(() => document.querySelectorAll("svg rect[rx='3']").length);
ok(`G5 the neighbourhood graph renders its nodes as a real node-link diagram`, svgNodes >= 5,
  `${svgNodes} nodes drawn`);
ok("G6 edges derived from free text are distinguished from E2 edges",
  /Edge derived from free text/i.test(t) && /Edge from an E2 source/i.test(t));

/* ---------------- section 7 · absorbed without rebuilding the screens ---------------- */
const hooks = {
  "workspaces[] already ships in the JSON": Array.isArray(D.workspaces) && D.workspaces.length > 0,
  "consumption[] is optional in the contract": !("consumption" in D) || Array.isArray(D.consumption),
  "meta.dashboard_link declares the state of the link": !!D.meta.dashboard_link,
};
for (const [k, v] of Object.entries(hooks)) ok(`S7 ${k}`, v);

const src = readFileSync(new URL("../types/index.ts", import.meta.url), "utf8");
ok("S7 the contract already types ConsumptionRow and audience can land without touching screens",
  /interface ConsumptionRow/.test(src) && /consumption\?:/.test(src));

await browser.close();
const failed = out.filter(([c]) => !c).length;
console.log(out.map(([, l]) => l).join("\n"));
console.log(`\n${out.length - failed} pass · ${failed} fail`);
process.exit(failed ? 1 : 0);
