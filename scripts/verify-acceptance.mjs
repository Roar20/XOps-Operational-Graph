/**
 * Verificacion automatizada de los criterios de aceptacion (seccion 6) contra la
 * aplicacion corriendo. No forma parte del bundle ni del build.
 *
 *   npm run build && npx next start -p 3100 &
 *   npm i -D playwright --no-save
 *   npm run verify
 *
 * Falla con codigo 1 si algun criterio deja de cumplirse.
 */
import { chromium } from "playwright";
const B = "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1500, height: 1200 } });
const out = [];
const ok = (n, c, d = "") => out.push(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
const txt = () => p.locator("body").innerText();

// C1: dos plataformas -> union deduplicada + traslape, nunca la suma
await p.goto(B + "/blast-radius", { waitUntil: "load" }); await p.waitForTimeout(1200);
await p.locator('label:has-text("Teradata") input[type="checkbox"]').first().click();
await p.locator('label:has-text("SAP BW") input[type="checkbox"]').first().click();
await p.waitForTimeout(600);
let t = await txt();
ok("C1 union deduplicada 43 (no la suma 51)",
   /UNION DEDUPLICADA[\s\S]{0,40}43/i.test(t) && /51/.test(t) && /sobrecuenta en\s*8/.test(t),
   "43 union / 51 suma tachada / traslape 8");

// C6: fecha de corte visible de forma permanente (en toda ruta)
let asOfEverywhere = true;
for (const r of ["/", "/blast-radius", "/quality", "/ai-ops", "/app/APP-0069"]) {
  await p.goto(B + r, { waitUntil: "load" }); await p.waitForTimeout(600);
  const s = await txt();
  if (!s.includes("2026-08-21")) { asOfEverywhere = false; break; }
}
ok("C6 corte 2026-08-21 visible en las 5 rutas", asOfEverywhere);

// C5: panel de reglas accesible desde toda la app
let rulesEverywhere = true;
for (const r of ["/", "/blast-radius", "/quality", "/ai-ops", "/app/APP-0069"]) {
  await p.goto(B + r, { waitUntil: "load" }); await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Como leer esto/ }).click();
  await p.waitForTimeout(400);
  const s = await txt();
  const hasAll = ["R1","R2","R3","R4","R5","R6","R7","R8","R9"].every(x => s.includes(x));
  if (!hasAll) { rulesEverywhere = false; break; }
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
}
ok("C5 panel de reglas con R1..R9 accesible en las 5 rutas", rulesEverywhere);

// C3 + C4: app sin AG visible, etiquetada No ruteable, DPM como TBD
await p.goto(B + "/app/APP-0001", { waitUntil: "load" }); await p.waitForTimeout(800);
t = await txt();
ok("C3 aplicacion sin AG etiquetada No ruteable (no filtrada)",
   t.includes("No ruteable") && t.includes("no tiene Assignment Group declarado"));
ok("C4 DPM no confirmado se muestra como TBD", /DPM\s*\n?\s*TBD/.test(t));

// C3b: el filtro "no ruteable" del portafolio devuelve las 339
await p.goto(B + "/", { waitUntil: "load" }); await p.waitForTimeout(1200);
t = await txt();
ok("C3b panel de hueco calculado: 339 / 221 / 279",
   /339\s*de\s*504/.test(t) && /221\s*de\s*504/.test(t) && /279\s*de\s*504/.test(t));
ok("C7 eslabones E3 marcados como baja autoridad", (t.match(/baja autoridad/g) || []).length >= 3);
ok("C2 cobertura publicada con denominador", /240\s*de\s*504/.test(t) && /47\.6%/.test(t));

// C11: el selector de granularidad conmuta las 4 series sin recargar
await p.goto(B + "/quality", { waitUntil: "load" }); await p.waitForTimeout(1500);
const nav0 = await p.evaluate(() => performance.getEntriesByType("navigation").length);
const counts = {};
for (const g of ["Semana", "Mes", "Trimestre", "Ano"]) {
  await p.getByRole("button", { name: g, exact: true }).click();
  await p.waitForTimeout(500);
  const s = await txt();
  counts[g] = (s.match(/GRANULARIDAD · (\d+) PERIODOS/i) || s.match(/(\d+) PERIODOS/i) || [])[1];
}
const nav1 = await p.evaluate(() => performance.getEntriesByType("navigation").length);
const distinct = new Set(Object.values(counts)).size;
ok("C11 las 4 granularidades conmutan sin recargar la pagina",
   distinct === 4 && nav0 === nav1, JSON.stringify(counts));

// C9: el color del delta responde a direccion_deseada
const poor = p.locator('div.card:has-text("Poor en criticos")').first();
const badge = poor.locator('span:has-text("pp")').first();
const cls = await badge.getAttribute("class");
const poorTxt = await poor.innerText();
ok("C9 caida de poor_critical_rate pintada como mejora (verde)",
   /-\d/.test(poorTxt) && /emerald/.test(cls || "") && poorTxt.includes("mejora"),
   poorTxt.replace(/\n/g, " | ").slice(0, 70));

// C10: corpus y regla de elegibilidad visibles junto a las cifras de calidad
t = await txt();
const stamps = (t.match(/242,706\s*de\s*277,408/g) || []).length;
ok("C10 corpus 242.706 de 277.408 repetido junto a las cifras", stamps >= 3, `${stamps} apariciones`);
ok("C10b regla de elegibilidad visible", t.includes("Not Solved") && t.includes("36.6%") && t.includes("41.8%"));

// C12: patron de volumen alto y tasa diagnostica baja marcado como SOP
ok("C12 candidatos a SOP senalados", /Candidato a SOP/.test(t) && /candidato a automatizacion o a SOP/i.test(t));

// C8: tickets_year sin semaforo — un solo color en toda la columna
await p.goto(B + "/", { waitUntil: "load" }); await p.waitForTimeout(1200);
const ticketClasses = await p.evaluate(() => {
  const rows = [...document.querySelectorAll("tbody tr")];
  return [...new Set(rows.map(r => r.children[8]?.querySelector("span")?.className).filter(Boolean))];
});
ok("C8 tickets_year sin semaforo de riesgo (un solo estilo)", ticketClasses.length === 1,
   `${ticketClasses.length} estilo(s) distintos en la columna`);

console.log(out.join("\n"));
const passed = out.filter((x) => x.startsWith("PASS")).length;
console.log(`\n${passed}/${out.length} criterios verificados`);
await b.close();
if (passed !== out.length) process.exit(1);
