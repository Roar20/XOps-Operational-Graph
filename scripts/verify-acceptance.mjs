/**
 * Verificacion automatizada de los criterios de aceptacion (seccion 6) y caceria
 * de antipatrones (prompt 6) contra la aplicacion corriendo.
 *
 *   npm run build && npx next start -p 3100 &
 *   npm i -D playwright --no-save
 *   npm run verify
 *
 * Regla del propio verificador: ninguna cifra esperada esta escrita a mano.
 * Todas se derivan del JSON, de modo que si el dato cambia el verificador sigue
 * siendo valido y es la interfaz la que tiene que seguirle el paso.
 *
 * Falla con codigo 1 si algun criterio deja de cumplirse.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const D = JSON.parse(readFileSync(new URL("../data/xops-operational-graph-data.json", import.meta.url), "utf8"));
const APPS = D.applications;
const PLAT = Object.fromEntries(D.platforms.map((p) => [p.name, p]));
const AS_OF = D.meta.as_of;

/* ---- referencias derivadas del dato ---- */
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
const GRAN = Object.fromEntries(Object.entries(D.quality.timeseries).map(([k, v]) => [k, v.length]));
const diagDelta = D.quality.baseline_metrics.find((m) => m.key === "diagnostic_rate");
const poorDelta = D.quality.baseline_metrics.find((m) => m.key === "poor_critical_rate");

const ROUTES = ["/", "/blast-radius", "/quality", "/ai-ops", `/app/${noAg[0].app_id}`];

const B = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
const out = [];
const ok = (n, c, d = "") => out.push([!!c, `${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`]);
const txt = () => p.locator("body").innerText();
const go = async (r, wait = 900) => { await p.goto(B + r, { waitUntil: "load" }); await p.waitForTimeout(wait); };
/** Normaliza separadores de miles para poder buscar un numero en el texto. */
const flat = (s) => s.replace(/ | /g, " ").replace(/(\d),(\d{3})/g, "$1$2");
const n = (x) => String(x);

/* ---------------- C1 · union deduplicada, jamas la suma ---------------- */
await go("/blast-radius", 1300);
await p.locator(`label:has-text("${PA}") input[type="checkbox"]`).first().click();
await p.locator(`label:has-text("${PB}") input[type="checkbox"]`).first().click();
await p.waitForTimeout(700);
let t = flat(await txt());
ok(`C1 union deduplicada ${union.size} y no la suma ${naiveSum}`,
  new RegExp(`Uni[oó]n deduplicada[\\s\\S]{0,60}\\b${union.size}\\b`, "i").test(t)
  && t.includes(n(naiveSum)) && new RegExp(`sobrecuenta en\\s*${overlap}`).test(t),
  `union ${union.size} · suma ${naiveSum} · traslape ${overlap}`);

ok("C1b la suma aparece tachada, nunca como total",
  (await p.locator("span.line-through").count()) > 0);

/* C2 · procesos de negocio como elemento central */
ok("C2 procesos de negocio afectados presente en blast radius",
  /Procesos de negocio afectados/i.test(t));

/* R3 · toda proporcion trae denominador. Un "NN.N%" solo es admisible si su
   contexto inmediato nombra el denominador ("de N") o si vive en una tabla que
   lo declara una vez en su caption. Cualquier otro porcentaje suelto es falla. */
const bareCheck = () => {
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length) continue;
    const s = (el.textContent || "").trim();
    if (!/^[+-]?\d+([.,]\d+)?\s*%$/.test(s)) continue;
    // El denominador se busca en el bloque que contiene la cifra, hasta tres
    // ancestros arriba: "165 de 504", "sobre 30 988 incidentes", "del corpus".
    let ctx = "", node = el;
    for (let i = 0; i < 3 && node.parentElement; i++) { node = node.parentElement; ctx += " " + (node.textContent || ""); }
    if (/\b(de|del|sobre)\b[^.]{0,40}\d/.test(ctx.replace(/\s+/g, " "))) continue;
    if (el.closest("table")?.querySelector("caption")) continue;
    // Una marca de eje es la escala del grafico, no una cifra publicada: el
    // universo de cada serie se declara en el texto que acompana a la grafica.
    if (el.closest("svg")) continue;
    bad.push((el.closest("tr") || el.parentElement)?.textContent?.slice(0, 90) || s);
  }
  return bad;
};
const bare = await p.evaluate(bareCheck);
ok("R3 no hay porcentaje suelto sin denominador en blast radius", bare.length === 0,
  bare.slice(0, 3).join(" | "));

/* ---------------- C5 y C6 · corte y reglas en toda ruta ---------------- */
let asOfEverywhere = true, rulesEverywhere = true, missing = "";
for (const r of ROUTES) {
  await go(r, 800);
  const s = await txt();
  if (!s.includes(AS_OF)) { asOfEverywhere = false; missing = r; break; }
  await p.getByRole("button", { name: /C[oó]mo leer esto/i }).click();
  await p.waitForTimeout(400);
  const s2 = await txt();
  const hasAll = D.meta.rules.every((rule) => s2.includes(rule.id));
  const hasTiers = ["E1", "E2", "E3"].every((x) => s2.includes(x));
  if (!hasAll || !hasTiers) { rulesEverywhere = false; missing = r; break; }
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
}
ok(`C6 corte ${AS_OF} visible en las 5 rutas`, asOfEverywhere, missing);
ok(`C5 panel de reglas con ${D.meta.rules.length} reglas y los 3 niveles de evidencia en las 5 rutas`,
  rulesEverywhere, missing);

/* ---------------- C3 y C4 · lo no resuelto se declara ---------------- */
await go(`/app/${noAgTbdDpm.app_id}`, 900);
t = flat(await txt());
ok("C3 aplicacion sin AG se publica y se etiqueta No ruteable",
  t.includes("No ruteable") && /no tiene Assignment Group declarado/i.test(t));
ok("C4 DPM no confirmado se muestra como TBD", /DPM\s*\n\s*TBD/.test(t));

/* C7 · todos los AGs, no uno */
await go(`/app/${maxAgApp.app_id}`, 900);
t = await txt();
const listedAgs = maxAgApp.ags.filter((g) => t.includes(g)).length;
ok(`C7 ${maxAgApp.name} lista sus ${maxAgApp.ags.length} Assignment Groups`,
  listedAgs === maxAgApp.ags.length, `listados ${listedAgs}`);
ok("C7b declara que la aplicacion por si sola no determina el destino del ticket",
  /no determina el destino del ticket/i.test(t));

/* C8 · R9 la derivacion no se disfraza de dato */
await go(`/app/${rawApp.app_id}`, 900);
t = await txt();
ok("C8 technology_raw visible junto a las plataformas derivadas",
  t.includes(rawApp.technology_raw.slice(0, 24)) && /technology_raw/i.test(t));
ok("C8b nivel de evidencia declarado en el eslabon de plataforma",
  new RegExp(`\\b${rawApp.platform_evidence_tier}\\b`).test(t));

/* C9 · criticidad no declarada se muestra, no se imputa */
await go("/", 1300);
t = flat(await txt());
ok(`C9 las ${noCrit} aplicaciones sin criticidad se declaran como No declarada`,
  t.includes("No declarada") && t.includes(n(noCrit)), `esperado ${noCrit}`);
ok(`C9b el universo ${D.meta.universe_apps} es el denominador visible`,
  t.includes(n(D.meta.universe_apps)));

/* ---------------- C10 · el delta lee la direccion, no el signo ---------------- */
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
ok(`C10 delta +${diagDelta.delta} pp (up_is_good) se pinta como mejora`,
  upGreen === "rgb(31, 122, 90)", String(upGreen));
ok(`C10b delta ${poorDelta.delta} pp (down_is_good) TAMBIEN se pinta como mejora`,
  downGreen === "rgb(31, 122, 90)", String(downGreen));

/* C11 · granularidad con el conteo real de periodos */
const granOk = Object.values(GRAN).every((c) => t.includes(n(c)));
ok(`C11 selector de granularidad ${GRAN.week}/${GRAN.month}/${GRAN.quarter}/${GRAN.year}`, granOk);

/* R6 · la elegibilidad es parte de la metrica */
ok("R6 corpus elegible con su universo crudo y la regla escrita",
  t.includes(n(D.quality.meta.eligible)) && t.includes(n(D.quality.meta.universe_raw))
  && /State en \(Closed, Resolved\)/.test(t));
/* R7 · un solo instrumento y el desacuerdo accesible */
await p.getByRole("button", { name: /desacuerdo entre instrumentos/i }).click();
await p.waitForTimeout(400);
t = flat(await txt());
ok("R7 desacuerdo entre instrumentos accesible desde la interfaz",
  D.quality.meta.band_divergence.every((b) => t.includes(b.binary_xlsx.toFixed(1))));
/* R8 · linea base posterior al quiebre, con el quiebre declarado */
ok("R8 quiebre de practica 2025Q3 declarado junto a la linea base",
  t.includes("2025Q3") && t.includes(D.quality.meta.baseline_window[0]));

/* ---------------- C12 · AI Ops comparativo ---------------- */
await go("/ai-ops", 1400);
t = flat(await txt());
ok(`C12 segmento AI/ML ${aiApps.length} con ruteo ${aiRoutable}`,
  t.includes(n(aiApps.length)) && t.includes(n(aiRoutable)));
ok("C12b la brecha se compara contra el portafolio completo con ambos denominadores",
  t.includes(n(D.meta.universe_apps)) && /pp\b/.test(t));

/* ---------------- antipatrones (prompt 6) ---------------- */
/* La lista no se filtra: las aplicaciones sin ruta siguen publicadas. */
const unroutedShown = await p.locator("text=No ruteable").count();
ok("AP1 las aplicaciones AI/ML sin AG se listan, no se filtran", unroutedShown > 0);

/* Ningun total suma radios de plataformas distintas. */
await go("/blast-radius", 1300);
await p.locator(`label:has-text("${PA}") input[type="checkbox"]`).first().click();
await p.locator(`label:has-text("${PB}") input[type="checkbox"]`).first().click();
await p.waitForTimeout(700);
const sumIsLabeledWrong = await p.evaluate((s) => {
  const el = [...document.querySelectorAll("span")].find((e) => e.textContent?.trim() === String(s));
  if (!el) return false;
  return getComputedStyle(el).textDecorationLine.includes("line-through");
}, naiveSum);
ok("AP2 la suma cruda solo aparece tachada y etiquetada como sobrecuenta", sumIsLabeledWrong);

/* Los tickets no se colorean como riesgo. */
await go(`/app/${APPS.find((a) => a.tickets_2024 !== null)?.app_id ?? APPS[0].app_id}`, 900);
ok("AP3 la carga de soporte se declara eje de costo, no de riesgo",
  /eje de costo/i.test(await txt()));

/* R3 en las cinco rutas, no solo en blast radius. */
let bareAll = [];
for (const r of ROUTES) {
  await go(r, 1100);
  const found = await p.evaluate(bareCheck);
  if (found.length) bareAll.push(`${r}: ${found[0]}`);
}
ok("R3b no hay porcentaje suelto sin denominador en ninguna de las 5 rutas",
  bareAll.length === 0, bareAll.slice(0, 3).join(" | "));

/* ---------------- seccion 7 · absorcion sin rehacer pantallas ---------------- */
const hooks = {
  "workspaces[] ya viaja en el JSON": Array.isArray(D.workspaces) && D.workspaces.length > 0,
  "consumption[] es opcional en el contrato": !("consumption" in D) || Array.isArray(D.consumption),
  "meta.dashboard_link declara el estado del eslabon": !!D.meta.dashboard_link,
};
for (const [k, v] of Object.entries(hooks)) ok(`S7 ${k}`, v);

const src = readFileSync(new URL("../types/index.ts", import.meta.url), "utf8");
ok("S7 el contrato ya tipa ConsumptionRow y audience puede entrar sin tocar pantallas",
  /interface ConsumptionRow/.test(src) && /consumption\?:/.test(src));

await browser.close();
const failed = out.filter(([c]) => !c).length;
console.log(out.map(([, l]) => l).join("\n"));
console.log(`\n${out.length - failed} pass · ${failed} fail`);
process.exit(failed ? 1 : 0);
