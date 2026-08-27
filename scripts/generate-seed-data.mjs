/**
 * Generador del dataset semilla de XOps Operational Graph (POC v1).
 *
 * ATENCION: este script produce DATOS SINTETICOS que respetan el contrato de
 * la seccion 3 de la especificacion y reproducen exactamente los agregados
 * declarados al corte 2026-08-21. Sirve para que la aplicacion sea ejecutable
 * y verificable contra los criterios de aceptacion mientras no se disponga del
 * extracto real.
 *
 * Para usar el archivo real: reemplazar data/xops-operational-graph-data.json.
 * Ningun modulo de la app lee de este script en tiempo de ejecucion.
 *
 * Uso: npm run seed
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "xops-operational-graph-data.json");

const AS_OF = "2026-08-21";
const UNIVERSE = 504;

/* ---------------- PRNG determinista ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260821);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/* ---------------- Vocabularios ---------------- */
const PROCESSES = [
  "Order to Cash", "Source to Pay", "Plan to Deliver", "Record to Report",
  "Hire to Retire", "Make to Stock", "Demand & Forecast", "Trade & Revenue Management",
  "Commercial Analytics", "Supply Chain Visibility", "Finance Performance", "TBD",
];
const SECTORS = [
  "PBNA", "PFNA", "Europe", "LatAm", "APAC", "AMESA", "Global Functions", "Corporate", "TBD",
];
const CATEGORIES = ["BI Report", "BI Platform", "Data Product", "AI/ML Model", "Conversational AI", "Planning Tool", "Operational App"];
const SCOPE = ["In Scope", "Out of Scope", "Under Review", "Not Declared"];
const PROGRAMS = ["OneSource", "DPS", "Sales Intelligence", "GTM Analytics", "Finance Modernization", "Supply Chain Tower", "PepGenX"];

const FIRST = ["Ana", "Luis", "Priya", "Marco", "Chen", "Sofia", "Ravi", "Elena", "Tomas", "Nadia", "Ibrahim", "Grace", "Diego", "Yuki", "Omar", "Lucia", "Peter", "Sara", "Kofi", "Ingrid"];
const LAST = ["Alvarez", "Novak", "Sharma", "Duarte", "Wei", "Okafor", "Larsen", "Rossi", "Haddad", "Kim", "Moreau", "Silva", "Kowalski", "Nakamura", "Bennett", "Costa", "Ivanov", "Mbeki", "Tanaka", "Ferreira"];
const person = () => `${pick(FIRST)} ${pick(LAST)}`;

/* ---------------- Plataformas (38) ---------------- */
// Teradata y SAP BW comparten exactamente 8 aplicaciones: 28 + 23 = 51 directas,
// union real 43. Es el caso testigo de la regla R1.
const PLATFORM_DEFS = [
  { name: "Teradata", tier: "High", legacy: true, ai: false, target: 28 },
  { name: "SAP BW", tier: "High", legacy: true, ai: false, target: 23 },
  { name: "Azure Data Factory", tier: "High", legacy: false, ai: false, target: 21 },
  { name: "Power BI Service", tier: "High", legacy: false, ai: false, target: 19 },
  { name: "Snowflake", tier: "High", legacy: false, ai: false, target: 17 },
  { name: "Databricks", tier: "High", legacy: false, ai: true, target: 2 },
  { name: "Azure Synapse", tier: "Medium", legacy: false, ai: false, target: 13 },
  { name: "SAP HANA", tier: "High", legacy: false, ai: false, target: 12 },
  { name: "Informatica PowerCenter", tier: "Medium", legacy: true, ai: false, target: 11 },
  { name: "Tableau Server", tier: "Medium", legacy: false, ai: false, target: 10 },
  { name: "OneReach", tier: "Medium", legacy: false, ai: true, target: 10 },
  { name: "SQL Server", tier: "Medium", legacy: true, ai: false, target: 9 },
  { name: "Azure Data Lake", tier: "High", legacy: false, ai: false, target: 9 },
  { name: "Alteryx", tier: "Low", legacy: false, ai: false, target: 8 },
  { name: "SAP ECC", tier: "High", legacy: true, ai: false, target: 8 },
  { name: "Oracle EBS", tier: "Medium", legacy: true, ai: false, target: 7 },
  { name: "PepGenX", tier: "High", legacy: false, ai: true, target: 5 },
  { name: "Azure App Service", tier: "Medium", legacy: false, ai: false, target: 7 },
  { name: "Cognos", tier: "Low", legacy: true, ai: false, target: 6 },
  { name: "SAS", tier: "Low", legacy: true, ai: false, target: 6 },
  { name: "MicroStrategy", tier: "Low", legacy: true, ai: false, target: 5 },
  { name: "Qlik", tier: "Low", legacy: true, ai: false, target: 5 },
  { name: "Copilot Studio", tier: "Medium", legacy: false, ai: true, target: 3 },
  { name: "Cosmos DB", tier: "Medium", legacy: false, ai: true, target: 3 },
  { name: "Azure ML", tier: "Medium", legacy: false, ai: false, target: 4 },
  { name: "Kafka", tier: "Medium", legacy: false, ai: false, target: 4 },
  { name: "Talend", tier: "Low", legacy: true, ai: false, target: 4 },
  { name: "Hadoop", tier: "Low", legacy: true, ai: false, target: 3 },
  { name: "Arize", tier: "Low", legacy: false, ai: true, target: 2 },
  { name: "Flutter", tier: "Low", legacy: false, ai: false, target: 2 },
  { name: "SAP BPC", tier: "Medium", legacy: true, ai: false, target: 3 },
  { name: "Anaplan", tier: "Medium", legacy: false, ai: false, target: 3 },
  { name: "Salesforce CRMA", tier: "Medium", legacy: false, ai: false, target: 3 },
  { name: "Denodo", tier: "Low", legacy: false, ai: false, target: 2 },
  { name: "Blue Yonder", tier: "Medium", legacy: false, ai: false, target: 3 },
  { name: "Oracle Analytics", tier: "Low", legacy: true, ai: false, target: 2 },
  { name: "AWS S3", tier: "Low", legacy: false, ai: false, target: 2 },
  { name: "Excel / Access legacy", tier: "Low", legacy: true, ai: false, target: 3 },
];
if (PLATFORM_DEFS.length !== 38) throw new Error(`plataformas=${PLATFORM_DEFS.length}, se esperaban 38`);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ---------------- Reparto de compuertas ---------------- */
// Cifras declaradas del hueco: 339 sin AG, 221 sin DPM confirmado, 279 sin
// atribucion completa. Se construyen aqui para que la app las CALCULE, nunca
// las escriba a mano.
const N_ROUTABLE = 165;        // 504 - 339
const N_OWNED = 283;           // 504 - 221
const N_ATTRIBUTABLE = 225;    // 504 - 279
const N_WITH_PLATFORM = 240;   // = eslabon L1 resuelto
const N_AI = 142;
const AI_ROUTABLE = 52, AI_OWNED = 81, AI_WITH_PLATFORM = 32;
const N_C1 = 43, N_C3 = 32, N_CX = 279; // C- coincide con el conjunto no atribuible
const N_C2 = UNIVERSE - N_C1 - N_C3 - N_CX; // 150

// Barajado determinista de indices 0..503
const order = Array.from({ length: UNIVERSE }, (_, i) => i);
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}
// Los primeros N_AI del barajado son AI/ML.
const aiIdx = new Set(order.slice(0, N_AI));
const nonAi = order.slice(N_AI);

/** Reparte una compuerta respetando la cuota global y la cuota del subconjunto AI. */
function allocate(totalTrue, aiTrue) {
  const set = new Set();
  const aiList = order.slice(0, N_AI);
  for (let i = 0; i < aiTrue; i++) set.add(aiList[i]);
  const rest = totalTrue - aiTrue;
  for (let i = 0; i < rest; i++) set.add(nonAi[i]);
  if (set.size !== totalTrue) throw new Error("reparto de compuerta inconsistente");
  return set;
}
const routableSet = allocate(N_ROUTABLE, AI_ROUTABLE);
const ownedSet = allocate(N_OWNED, AI_OWNED);
const platformSet = allocate(N_WITH_PLATFORM, AI_WITH_PLATFORM);

// Atribuibles: se desplaza el offset para que no coincidan con las otras compuertas.
const attributableSet = new Set();
{
  const aiList = order.slice(0, N_AI);
  const aiAttr = 71;
  for (let i = 0; i < aiAttr; i++) attributableSet.add(aiList[(i + 23) % N_AI]);
  for (let i = 0; i < N_ATTRIBUTABLE - aiAttr; i++) attributableSet.add(nonAi[(i + 47) % nonAi.length]);
  if (attributableSet.size !== N_ATTRIBUTABLE) throw new Error("reparto de atribucion inconsistente");
}

// Criticidad: C- coincide exactamente con el complemento de attributableSet.
const criticalityOf = new Map();
// Se baraja antes de repartir las bandas: el orden de insercion del Set pone
// primero las aplicaciones AI/ML, y sin barajar C1 y C3 caerian todas en ese
// subconjunto. Los conteos (43 / 32 / 150) no cambian.
const attributableList = (() => {
  const arr = [...attributableSet];
  const r3 = mulberry32(915237);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r3() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();
for (let i = 0; i < UNIVERSE; i++) if (!attributableSet.has(i)) criticalityOf.set(i, "C-");
attributableList.forEach((idx, i) => {
  if (i < N_C1) criticalityOf.set(idx, "C1");
  else if (i < N_C1 + N_C3) criticalityOf.set(idx, "C3");
  else criticalityOf.set(idx, "C2");
});
if (N_C2 !== attributableList.length - N_C1 - N_C3) throw new Error("mezcla de criticidad inconsistente");

const WEIGHT = { C1: 5, C2: 3, C3: 1, "C-": 0 };
// Los dos vocabularios que siguen en circulacion (R: criticality_raw).
const RAW = {
  C1: ["BC1", "RP1"], C2: ["BC2", "RP2"], C3: ["BC3", "RP3"], "C-": ["", "Not classified", "N/A"],
};

/* ---------------- Aplicaciones ---------------- */
const APP_NOUNS = ["Dashboard", "Cockpit", "Tracker", "Planner", "Analyzer", "Monitor", "Scorecard", "Hub", "Console", "Engine", "Assistant", "Forecaster", "Reconciler", "Navigator"];
const APP_DOMAINS = ["Trade Spend", "Route Sales", "Inventory", "Freight", "Promo", "Vendor", "Cash Flow", "Headcount", "Production", "Shelf", "Pricing", "Demand", "Margin", "Service Level", "Rebate", "Tax", "Fleet", "Recipe", "Order Fill", "Labor"];

const applications = [];
for (let i = 0; i < UNIVERSE; i++) {
  const isAi = aiIdx.has(i);
  const crit = criticalityOf.get(i);
  const attributable = attributableSet.has(i);
  const owned = ownedSet.has(i);
  const routable = routableSet.has(i);
  const name = `${pick(APP_DOMAINS)} ${pick(APP_NOUNS)}${isAi ? " AI" : ""} ${String(i + 1).padStart(3, "0")}`;

  // R3: los C3 (menos criticos) concentran el volumen de tickets. Los C1 no.
  let tickets = null;
  const ticketRoll = rnd();
  if (ticketRoll > 0.14) {
    if (crit === "C3") tickets = int(380, 1240);
    else if (crit === "C2") tickets = int(60, 420);
    else if (crit === "C1") tickets = int(18, 155);
    else tickets = int(0, 90);
  }

  applications.push({
    app_id: `APP-${String(i + 1).padStart(4, "0")}`,
    name,
    apm: `APM${String(100000 + i * 7).slice(0, 6)}`,
    category: isAi ? pick(["AI/ML Model", "Conversational AI", "Data Product"]) : pick(CATEGORIES.slice(0, 3).concat(CATEGORIES.slice(5))),
    scope_status: attributable ? pick(["In Scope", "In Scope", "Under Review"]) : pick(SCOPE),
    process: attributable ? pick(PROCESSES.slice(0, 11)) : (rnd() > 0.45 ? "TBD" : pick(PROCESSES.slice(0, 11))),
    sector: attributable ? pick(SECTORS.slice(0, 8)) : (rnd() > 0.5 ? "TBD" : pick(SECTORS.slice(0, 8))),
    criticality: crit,
    criticality_raw: pick(RAW[crit]),
    criticality_weight: WEIGHT[crit],
    // R4: el DPM no confirmado se declara como TBD, nunca en blanco.
    dpm: owned ? person() : "TBD",
    dpm_l3: owned ? (rnd() > 0.22 ? person() : "TBD") : "TBD",
    owner: owned ? person() : (rnd() > 0.6 ? person() : "TBD"),
    tech_lead: rnd() > 0.35 ? person() : "TBD",
    platforms: [],
    ags: [],
    tickets_year: tickets,
    in_inventory: rnd() > 0.06,
    in_platform_scope: platformSet.has(i),
    gates: { attributable, routable, owned },
    is_ai_ml: isAi,
    technology_raw: null,
    platform_evidence: null,
  });
}

/* ---------------- Asignacion de plataformas ---------------- */
// 240 aplicaciones con plataforma. Teradata y SAP BW comparten 8.
const withPlatform = [...platformSet];
const aiWithPlatform = withPlatform.filter((i) => aiIdx.has(i));
const nonAiWithPlatform = withPlatform.filter((i) => !aiIdx.has(i));
if (aiWithPlatform.length !== AI_WITH_PLATFORM) throw new Error("cuota AI con plataforma inconsistente");

const platformApps = new Map(PLATFORM_DEFS.map((p) => [p.name, []]));
// Las plataformas AI solo reciben aplicaciones AI/ML, con los conteos declarados.
const AI_PLATFORM_ORDER = ["OneReach", "PepGenX", "Copilot Studio", "Databricks", "Cosmos DB", "Arize"];
let aiCursor = 0;
for (const pname of AI_PLATFORM_ORDER) {
  const def = PLATFORM_DEFS.find((p) => p.name === pname);
  for (let k = 0; k < def.target; k++) {
    platformApps.get(pname).push(aiWithPlatform[aiCursor % aiWithPlatform.length]);
    aiCursor++;
  }
}
// Azure y Flutter tambien aparecen en la pila AI/ML declarada.
platformApps.get("Azure App Service").push(...aiWithPlatform.slice(0, 4));
platformApps.get("Flutter").push(aiWithPlatform[5], aiWithPlatform[9]);

// Resto de plataformas sobre aplicaciones no-AI.
let cur = 0;
// Se baraja de forma independiente para que la asignacion de plataformas no
// quede correlacionada con el reparto de compuertas: en datos reales la
// criticidad de las apps de una plataforma no depende del orden de captura.
const nonAiPool = (() => {
  const arr = [...nonAiWithPlatform];
  const r2 = mulberry32(70431);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r2() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();
const teradata = [], sapbw = [];
for (let k = 0; k < 28; k++) teradata.push(nonAiPool[k]);
for (let k = 0; k < 23; k++) sapbw.push(k < 8 ? nonAiPool[20 + k] : nonAiPool[28 + (k - 8)]); // 8 compartidas
platformApps.set("Teradata", teradata);
platformApps.set("SAP BW", sapbw);
cur = 43; // 28 + 23 - 8 = 43 aplicaciones consumidas del pool no-AI

for (const def of PLATFORM_DEFS) {
  if (def.name === "Teradata" || def.name === "SAP BW") continue;
  if (AI_PLATFORM_ORDER.includes(def.name) || def.name === "Flutter") continue;
  const list = platformApps.get(def.name);
  const need = def.target - list.length;
  for (let k = 0; k < need; k++) {
    list.push(nonAiPool[cur % nonAiPool.length]);
    cur++;
  }
}
// Garantiza que las 240 aplicaciones del conjunto tengan al menos una plataforma.
const covered = new Set([...platformApps.values()].flat());
for (const idx of withPlatform) {
  if (!covered.has(idx)) {
    const def = PLATFORM_DEFS[int(0, PLATFORM_DEFS.length - 1)];
    const target = AI_PLATFORM_ORDER.includes(def.name) || def.name === "Flutter"
      ? (aiIdx.has(idx) ? def.name : "Power BI Service")
      : (aiIdx.has(idx) ? "Azure App Service" : def.name);
    platformApps.get(target).push(idx);
    covered.add(idx);
  }
}

const platformIdByName = new Map();
for (const def of PLATFORM_DEFS) platformIdByName.set(def.name, `PLT-${slug(def.name)}`);
for (const [pname, idxs] of platformApps) {
  const pid = platformIdByName.get(pname);
  for (const idx of new Set(idxs)) {
    if (!applications[idx].platforms.includes(pid)) applications[idx].platforms.push(pid);
  }
}

// R9: la derivacion no se disfraza de dato. 91 aplicaciones vienen del analisis
// de Tech Buckets (E2) y 189 de normalizar el texto libre Technology Stack (E3);
// 40 aparecen en ambos origenes, por lo que la union es 240 y no 280.
const L1_E2 = 91, L1_E3 = 189, L1_OVERLAP = 40;
const withPlatformSorted = [...covered].sort((a, b) => a - b);
const RAW_TECH = [
  "Teradata / SQL / Power BI", "SAP BW on HANA", "ADF + Synapse + PBI",
  "Databricks (PySpark), MLflow", "OneReach.ai conversational flows",
  "PepGenX GenAI platform", "Copilot Studio + Dataverse", "Cosmos DB + Azure Functions",
  "Informatica -> Teradata -> Cognos", "Alteryx workflow, Excel output",
  "Qlik Sense on SQL Server", "MicroStrategy (legacy)", "Arize monitoring, Azure ML",
  "Flutter mobile + Azure App Service", "SAS 9.4 batch", "Hadoop / Hive",
];
withPlatformSorted.forEach((idx, i) => {
  const inE2 = i < L1_E2;
  const inE3 = i >= L1_E2 - L1_OVERLAP;
  applications[idx].platform_evidence = inE2 && inE3 ? "E2" : inE2 ? "E2" : "E3";
  if (inE3) applications[idx].technology_raw = pick(RAW_TECH);
});

/* ---------------- Assignment Groups (268) ---------------- */
const AG_PREFIX = ["GBS", "IT", "XOPS", "DPS", "SCM", "FIN", "CMRC", "HR", "MFG"];
const AG_SUFFIX = ["L1 Support", "L2 Support", "L3 Engineering", "Data Ops", "Platform Ops", "BI Support", "Integration", "Access Mgmt", "Reporting", "AI Ops"];
const AG_TOTAL = 268;
const assignment_groups = [];
for (let i = 0; i < AG_TOTAL; i++) {
  const name = `${pick(AG_PREFIX)} ${pick(APP_DOMAINS)} ${pick(AG_SUFFIX)}`;
  assignment_groups.push({
    ag_id: `AG-${String(i + 1).padStart(4, "0")}`,
    name,
    ag_key: `${slug(name)}-${i + 1}`,
    has_quality: false,
    app_count: 0,
    app_ids: [],
    processes: [],
    dpms: [],
  });
}

// 165 aplicaciones ruteables; 113 con mas de un AG; una llega a 14.
const routableList = [...routableSet];
const multiAgTargets = new Set(routableList.slice(0, 113));
let agCursor = 0;
routableList.forEach((idx, n) => {
  let count = 1;
  if (n === 0) count = 14;
  else if (multiAgTargets.has(idx)) count = int(2, n < 10 ? 8 : 4);
  const app = applications[idx];
  for (let k = 0; k < count; k++) {
    const ag = assignment_groups[agCursor % AG_TOTAL];
    agCursor++;
    if (!app.ags.includes(ag.ag_id)) app.ags.push(ag.ag_id);
  }
});
// Verifica la cardinalidad declarada.
const multiAgCount = applications.filter((a) => a.ags.length > 1).length;
const maxAg = Math.max(...applications.map((a) => a.ags.length));

for (const app of applications) {
  for (const agId of app.ags) {
    const ag = assignment_groups[Number(agId.slice(3)) - 1];
    ag.app_ids.push(app.app_id);
    if (app.process !== "TBD" && !ag.processes.includes(app.process)) ag.processes.push(app.process);
    if (app.dpm !== "TBD" && !ag.dpms.includes(app.dpm)) ag.dpms.push(app.dpm);
  }
}
for (const ag of assignment_groups) ag.app_count = ag.app_ids.length;

// 140 grupos con al menos 100 incidentes en el corpus de calidad.
const qualityAgs = assignment_groups.filter((a) => a.app_count > 0).slice(0, 140);
const qualityFill = assignment_groups.filter((a) => !qualityAgs.includes(a));
while (qualityAgs.length < 140 && qualityFill.length) qualityAgs.push(qualityFill.shift());
for (const ag of qualityAgs) ag.has_quality = true;

/* ---------------- Plataformas: agregados ---------------- */
const byId = new Map(applications.map((a) => [a.app_id, a]));
const platforms = PLATFORM_DEFS.map((def) => {
  const pid = platformIdByName.get(def.name);
  const appIds = applications.filter((a) => a.platforms.includes(pid)).map((a) => a.app_id);
  const apps = appIds.map((id) => byId.get(id));
  const mix = {};
  for (const a of apps) mix[a.criticality] = (mix[a.criticality] || 0) + 1;
  const routable = apps.filter((a) => a.gates.routable).length;
  const ags = [...new Set(apps.flatMap((a) => a.ags))];
  const agKeys = ags.map((id) => assignment_groups[Number(id.slice(3)) - 1]).filter((g) => g.has_quality).map((g) => g.ag_key);
  return {
    platform_id: pid,
    name: def.name,
    tier: def.tier,
    is_legacy: def.legacy,
    is_ai_platform: def.ai,
    blast_radius_direct: apps.length,
    blast_radius_weighted: apps.reduce((s, a) => s + a.criticality_weight, 0),
    app_ids: appIds,
    processes_affected: [...new Set(apps.map((a) => a.process))].sort(),
    sectors_affected: [...new Set(apps.map((a) => a.sector))].sort(),
    programs_affected: [...new Set(apps.map((_, i) => PROGRAMS[(i + def.target) % PROGRAMS.length]))].sort(),
    ags_reachable: ags,
    dpms_reachable: [...new Set(apps.map((a) => a.dpm).filter((d) => d !== "TBD"))],
    criticality_mix: mix,
    declared_reports: Math.round(apps.length * (1.4 + rnd() * 2.6)),
    ai_ml_apps: apps.filter((a) => a.is_ai_ml).length,
    routable_apps: routable,
    routable_pct: apps.length ? round1((routable / apps.length) * 100) : 0,
    quality_ag_keys: agKeys,
    quality_incidents: agKeys.length * int(60, 900),
  };
});

/* ---------------- Cobertura (4 eslabones) ---------------- */
const cov = (id, link, resolved, tier, source, owner, breakdown) => ({
  id, link, resolved, universe: UNIVERSE,
  coverage_pct: round1((resolved / UNIVERSE) * 100),
  gap: UNIVERSE - resolved,
  evidence_tier: tier, source, owner,
  ...(breakdown ? { breakdown } : {}),
});

const coverage = [
  cov("L1", "Aplicacion -> Plataforma", 240, "E3",
    "Tech Buckets (E2) + normalizacion de Technology Stack (E3)",
    "Arquitectura de Datos / XOps",
    [
      { evidence_tier: "E2", resolved: L1_E2, source: "Analisis de Tech Buckets" },
      { evidence_tier: "E3", resolved: L1_E3, source: "Normalizacion del campo libre Technology Stack" },
    ]),
  cov("L2", "Aplicacion -> Proceso", 312, "E3", "Hoja de mapeo de procesos L1.5", "Process Owners"),
  cov("L3", "Aplicacion -> DPM", 383, "E3", "Hoja de asignacion DPM/DPM L3", "DPM Leads"),
  cov("L4", "Aplicacion -> Assignment Group", 373, "E1", "ServiceNow CMDB", "Service Management"),
];

/* ---------------- Modulo de calidad ---------------- */
const CORPUS_TOTAL = 277408, CORPUS_ELIGIBLE = 242706;

// R8: el quiebre de practica ocurre entre 2025Q2 (6.6%) y 2025Q3 (31.4%).
// La linea base arranca despues del quiebre: 2025-08-01.
const quarters = [
  { period: "2024Q3", diag: 4.1 }, { period: "2024Q4", diag: 5.2 },
  { period: "2025Q1", diag: 5.9 }, { period: "2025Q2", diag: 6.6 },
  { period: "2025Q3", diag: 31.4 }, { period: "2025Q4", diag: 34.8 },
  { period: "2026Q1", diag: 38.2 }, { period: "2026Q2", diag: 42.7 },
  { period: "2026Q3", diag: 45.1 },
];
const derive = (diag, jitter = 0) => ({
  diagnostic_rate: round1(diag),
  has_root_rate: round1(Math.min(99, diag * 0.86 + 4.2 + jitter)),
  has_res_rate: round1(Math.min(99, diag * 0.94 + 11.5 + jitter)),
  avg_score: round1(Math.min(100, 31 + diag * 0.72 + jitter)),
  poor_critical_rate: round1(Math.max(1.2, 44 - diag * 0.63 + jitter)),
  reopen_rate: round1(Math.max(0.6, 9.8 - diag * 0.11 + jitter * 0.3)),
});

const quarterSeries = quarters.map((q) => ({
  period: q.period, incidents: int(21000, 34000), ...derive(q.diag),
}));

const MONTHS = [];
{
  let d = new Date(Date.UTC(2024, 6, 1));
  const end = new Date(Date.UTC(2026, 7, 1));
  while (d <= end) {
    MONTHS.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
}
const monthDiag = (m) => {
  const [y, mo] = m.split("-").map(Number);
  const q = `${y}Q${Math.floor((mo - 1) / 3) + 1}`;
  const base = quarters.find((x) => x.period === q)?.diag ?? 40;
  return base + (rnd() - 0.5) * 2.4;
};
const monthSeries = MONTHS.map((m) => ({ period: m, incidents: int(6800, 12400), ...derive(monthDiag(m), (rnd() - 0.5) * 1.6) }));

const WEEKS = [];
{
  let d = new Date(Date.UTC(2025, 0, 6));
  const end = new Date(Date.UTC(2026, 7, 10));
  while (d <= end) {
    const y = d.getUTCFullYear();
    const jan1 = new Date(Date.UTC(y, 0, 1));
    const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
    WEEKS.push({ label: `${y}-W${String(wk).padStart(2, "0")}`, month: `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` });
    d = new Date(d.getTime() + 7 * 86400000);
  }
}
const weekSeries = WEEKS.map((w) => ({ period: w.label, incidents: int(1300, 2900), ...derive(monthDiag(w.month), (rnd() - 0.5) * 3.2) }));

const yearSeries = ["2024", "2025", "2026"].map((y, i) => ({
  period: y, incidents: [61000, 118400, 98008][i], ...derive([5.0, 19.6, 41.9][i]),
}));

// Linea base 2025-08-01..2026-01-31 contra actual 2026-02-01..2026-08-12.
const inWindow = (m, from, to) => m >= from.slice(0, 7) && m <= to.slice(0, 7);
const avgOf = (rows, key) => round1(rows.reduce((s, r) => s + r[key], 0) / rows.length);
const baseRows = monthSeries.filter((r) => inWindow(r.period, "2025-08-01", "2026-01-31"));
const currRows = monthSeries.filter((r) => inWindow(r.period, "2026-02-01", "2026-08-12"));

const METRIC_DEFS = [
  { key: "diagnostic_rate", label: "Tasa diagnostica", unit: "pp", direccion_deseada: "up" },
  { key: "has_root_rate", label: "Con causa raiz", unit: "pp", direccion_deseada: "up" },
  { key: "has_res_rate", label: "Con resolucion descrita", unit: "pp", direccion_deseada: "up" },
  { key: "avg_score", label: "Score promedio (QN v2.4.2)", unit: "pts", direccion_deseada: "up" },
  { key: "poor_critical_rate", label: "Poor en criticos", unit: "pp", direccion_deseada: "down" },
  { key: "reopen_rate", label: "Tasa de reapertura", unit: "pp", direccion_deseada: "down" },
];
const baseline_metrics = METRIC_DEFS.map((d) => {
  const baseline = avgOf(baseRows, d.key);
  const current = avgOf(currRows, d.key);
  return { ...d, baseline, current, delta: round1(current - baseline) };
});

const by_assignment_group = qualityAgs.map((ag) => {
  const diag = round1(8 + rnd() * 62);
  return {
    ag_key: ag.ag_key,
    name: ag.name,
    incidents: int(100, 6400),
    diagnostic_rate: diag,
    has_root_rate: round1(Math.max(2, diag * 0.83 + (rnd() - 0.5) * 8)),
    avg_score: round1(30 + diag * 0.66 + (rnd() - 0.5) * 9),
    poor_rate: round1(Math.max(1, 52 - diag * 0.66 + (rnd() - 0.5) * 9)),
  };
});

const PATTERN_TEMPLATES = [
  "Power BI refresh failure - {x}", "Access request - {x} workspace", "Data mismatch in {x} report",
  "Job {x} failed in scheduler", "Login/SSO issue - {x}", "Slow performance on {x} dashboard",
  "Missing data for {x} region", "Duplicate records in {x}", "Export to Excel fails - {x}",
  "Alert threshold breached - {x}", "Stale data warning - {x}", "Permission error - {x}",
  "Gateway timeout on {x}", "Reconciliation break in {x}", "Scheduled report not delivered - {x}",
];
const recurrent_patterns = Array.from({ length: 150 }, (_, i) => {
  const tpl = PATTERN_TEMPLATES[i % PATTERN_TEMPLATES.length];
  const dom = APP_DOMAINS[(i * 3) % APP_DOMAINS.length];
  const count = Math.max(38, Math.round(2400 / (1 + i * 0.34)) + int(-25, 60));
  return {
    pattern_id: `PAT-${String(i + 1).padStart(3, "0")}`,
    pattern: tpl.replace("{x}", dom),
    count,
    example: `${tpl.replace("{x}", dom)} — user reports issue after ${pick(["month-end close", "weekly refresh", "quarterly load", "daily sync"])}`,
    ag_count: int(1, 22),
    diagnostic_rate: round1(rnd() * 72),
    first_seen: pick(["2025-08-04", "2025-09-11", "2025-10-02", "2025-11-19", "2026-01-07", "2026-02-23"]),
    last_seen: pick(["2026-08-01", "2026-08-05", "2026-08-08", "2026-08-11", "2026-08-12"]),
  };
}).sort((a, b) => b.count - a.count);

const DECALOGO = [
  ["D01", "Acceso y permisos"], ["D02", "Calidad de datos"], ["D03", "Falla de refresco"],
  ["D04", "Desempeno / latencia"], ["D05", "Error funcional del reporte"], ["D06", "Integracion / interfaz"],
  ["D07", "Cambio no comunicado"], ["D08", "Infraestructura"], ["D09", "Solicitud de mejora"],
  ["D10", "Consulta / how-to"],
];
const decalogoClassified = Math.round(CORPUS_ELIGIBLE * 0.23);
let remaining = decalogoClassified;
const buckets = DECALOGO.map(([code, label], i) => {
  const share = [0.19, 0.16, 0.14, 0.11, 0.09, 0.08, 0.07, 0.06, 0.055, 0.045][i];
  const count = i === DECALOGO.length - 1 ? remaining : Math.round(decalogoClassified * share);
  remaining -= count;
  return { code, label, count };
});

const quality = {
  scorer: "QN v2.4.2",
  corpus_eligible: CORPUS_ELIGIBLE,
  corpus_total: CORPUS_TOTAL,
  eligibility_rule: {
    statement: "Solo incidentes en estado Closed o Resolved, excluyendo los close codes no resolutivos.",
    excluded_states: ["New", "In Progress", "On Hold", "Pending", "Canceled"],
    excluded_close_codes: ["Cancelled", "Incident Withdrawn", "Became a Request", "Not Solved"],
    effect_note: "Aplicar la regla mueve la banda Excellent de 36.6% a 41.8%. El denominador es parte de la metrica.",
  },
  baseline_window: { from: "2025-08-01", to: "2026-01-31" },
  current_window: { from: "2026-02-01", to: "2026-08-12" },
  break_note: "La tasa diagnostica pasa de 6.6% en 2025Q2 a 31.4% en 2025Q3 por un cambio de practica interno. Una base anterior al quiebre mediria ese cambio, no el desempeno del proveedor.",
  timeseries: { week: weekSeries, month: monthSeries, quarter: quarterSeries, year: yearSeries },
  baseline_metrics,
  by_assignment_group,
  ag_min_incidents: 100,
  recurrent_patterns,
  decalogo: {
    coverage_pct: 23.0,
    classified: decalogoClassified,
    universe: CORPUS_ELIGIBLE,
    buckets,
  },
  band_divergence: [
    { band: "Alta", qn_v242: 84.5, binary_xlsx: 88.5 },
    { band: "Media", qn_v242: 63.2, binary_xlsx: 44.3 },
    { band: "Baja", qn_v242: 40.7, binary_xlsx: 3.1 },
  ],
};

/* ---------------- Meta ---------------- */
const meta = {
  as_of: AS_OF,
  universe_apps: UNIVERSE,
  scope_note: "Alcance v1: impacto por proceso y por ruteo. No incluye impacto por audiencia de usuarios ni linaje de pipelines. El eslabon Dashboard -> Aplicacion no esta resuelto y se excluyo por decision de alcance, no por olvido.",
  data_provenance: "DATOS SINTETICOS DE DEMOSTRACION generados por scripts/generate-seed-data.mjs. Respetan el contrato y reproducen los agregados declarados al corte. Reemplazar por el extracto real conservando el mismo esquema.",
  out_of_scope: [
    "Dashboard -> Aplicacion (159 workspaces; 30 concentran 91.4% del consumo)",
    "Aplicacion -> Audiencia (838 dashboards activos con usuarios y vistas)",
    "RCA Intelligence, Agent Actions y escritura hacia ServiceNow",
  ],
  rules: [
    { id: "R1", title: "El blast radius no es aditivo",
      statement: "Al combinar plataformas se calcula la union deduplicada de app_ids, nunca la suma de blast_radius_direct.",
      consequence: "Ocho aplicaciones corren en Teradata y SAP BW simultaneamente: sumar da 51, la union real es 43." },
    { id: "R2", title: "Toda cifra se muestra con su denominador",
      statement: "Nunca '165 aplicaciones ruteables', siempre '165 de 504, 32.7%'.",
      consequence: "Un porcentaje sin universo no es verificable." },
    { id: "R3", title: "Los tickets son eje de costo, no de riesgo",
      statement: "tickets_year no se colorea con semaforo de riesgo ni se ordena junto a criticidad. Se etiqueta como Carga de soporte.",
      consequence: "Las 32 aplicaciones C3 concentran mas volumen que las 43 C1; usar tickets como senal de riesgo prioriza lo menos critico." },
    { id: "R4", title: "Lo no resuelto se declara, no se oculta",
      statement: "Una aplicacion sin AG aparece en la lista etiquetada como No ruteable y cuenta en el hueco. Un DPM con valor TBD se muestra como TBD, nunca en blanco.",
      consequence: "Filtrar el hueco lo vuelve invisible y no resuelto." },
    { id: "R5", title: "Cada dato lleva su nivel de evidencia",
      statement: "E1 es CMDB, E2 analisis derivado, E3 hoja de calculo. Los eslabones L2 y L3 son E3, de baja autoridad.",
      consequence: "El nivel de evidencia es un atributo del dato, no un disclaimer al pie." },
    { id: "R6", title: "Un solo instrumento",
      statement: "El scorer canonico es QN v2.4.2. La app no mezcla bandas de scorers distintos.",
      consequence: "La regla binaria de incidentes_clasificados.xlsx diverge en la banda baja (40.7 contra 3.1), justo donde se medira la mejora." },
    { id: "R7", title: "El denominador de elegibilidad es parte de la metrica",
      statement: "Se excluyen estados distintos de Closed y Resolved y los close codes Cancelled, Incident Withdrawn, Became a Request y Not Solved.",
      consequence: "Excluirlos mueve la banda Excellent de 36.6% a 41.8%, por lo tanto la regla se muestra junto a la cifra." },
    { id: "R8", title: "La linea base arranca despues del quiebre",
      statement: "La ventana base es 2025-08-01 a 2026-01-31, posterior al salto de tasa diagnostica de 6.6% a 31.4%.",
      consequence: "Una base anterior al quiebre mediria un cambio de practica interno y no el desempeno del proveedor." },
    { id: "R9", title: "La derivacion no se disfraza de dato",
      statement: "Las plataformas obtenidas normalizando el texto libre de Technology Stack exponen technology_raw.",
      consequence: "Quien dude puede ver la cadena original que produjo la clasificacion." },
  ],
  evidence_tiers: {
    E1: "CMDB. Sistema de registro, alta autoridad.",
    E2: "Analisis derivado. Autoridad media, trazable a un metodo.",
    E3: "Hoja de calculo. Baja autoridad, sujeta a normalizacion manual.",
  },
  criticality_scale: {
    C1: "Critica. Peso 5. Vocabularios de origen BC1 y RP1.",
    C2: "Alta. Peso 3. Vocabularios de origen BC2 y RP2.",
    C3: "Media. Peso 1. Vocabularios de origen BC3 y RP3.",
    "C-": "Sin criticidad declarada. Peso 0. Cuenta en el hueco de atribucion.",
  },
};

const out = { meta, applications, platforms, assignment_groups, coverage, quality };

/* ---------------- Verificacion de invariantes declarados ---------------- */
const checks = [
  ["applications", applications.length, 504],
  ["platforms", platforms.length, 38],
  ["assignment_groups", assignment_groups.length, 268],
  ["coverage links", coverage.length, 4],
  ["sin AG (hueco)", applications.filter((a) => a.ags.length === 0).length, 339],
  ["ruteables", applications.filter((a) => a.gates.routable).length, 165],
  ["sin DPM confirmado", applications.filter((a) => a.dpm === "TBD").length, 221],
  ["sin atribucion completa", applications.filter((a) => !a.gates.attributable).length, 279],
  ["con plataforma", applications.filter((a) => a.platforms.length > 0).length, 240],
  ["AI/ML", applications.filter((a) => a.is_ai_ml).length, 142],
  ["AI/ML ruteables", applications.filter((a) => a.is_ai_ml && a.gates.routable).length, 52],
  ["AI/ML con DPM", applications.filter((a) => a.is_ai_ml && a.gates.owned).length, 81],
  ["AI/ML con plataforma", applications.filter((a) => a.is_ai_ml && a.platforms.length > 0).length, 32],
  ["C1", applications.filter((a) => a.criticality === "C1").length, 43],
  ["C3", applications.filter((a) => a.criticality === "C3").length, 32],
  ["apps con >1 AG", multiAgCount, 113],
  ["max AGs en una app", maxAg, 14],
  ["AGs con corpus de calidad", assignment_groups.filter((a) => a.has_quality).length, 140],
  ["patrones recurrentes", recurrent_patterns.length, 150],
  ["plataformas AI", platforms.filter((p) => p.is_ai_platform).length, 6],
];
const aiC1 = applications.filter((a) => a.is_ai_ml && a.criticality === "C1").length;
console.log(`info  C1 en AI/ML: ${aiC1} de 43 (esperado ~12 si el reparto es proporcional)`);
if (aiC1 === 43 || aiC1 === 0) { console.error("FAIL  las bandas de criticidad estan correlacionadas con el segmento AI/ML"); process.exitCode = 1; }

const teradataP = platforms.find((p) => p.name === "Teradata");
const sapbwP = platforms.find((p) => p.name === "SAP BW");
const unionTS = new Set([...teradataP.app_ids, ...sapbwP.app_ids]).size;
checks.push(["Teradata directo", teradataP.blast_radius_direct, 28]);
checks.push(["SAP BW directo", sapbwP.blast_radius_direct, 23]);
checks.push(["union Teradata+SAP BW (R1)", unionTS, 43]);

let failed = 0;
for (const [label, got, want] of checks) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}: ${got}${ok ? "" : ` (esperado ${want})`}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(`\nEscrito ${OUT} (${kb} KB)`);
if (failed) { console.error(`\n${failed} invariante(s) incumplido(s).`); process.exit(1); }
