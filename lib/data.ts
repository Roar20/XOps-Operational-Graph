import raw from "@/data/xops-operational-graph-data.json";
import type {
  Application, AssignmentGroup, CoverageLink, Criticality, GraphData,
  Granularity, Platform, QualityAgRow, Workspace, EvidenceTier, Sector, Measure,
} from "@/types";

export const graph = raw as unknown as GraphData;

export const meta = graph.meta;
export const applications: Application[] = graph.applications;
export const platforms: Platform[] = graph.platforms;
export const assignmentGroups: AssignmentGroup[] = graph.assignment_groups;
export const coverage: CoverageLink[] = graph.coverage;
export const quality = graph.quality;
export const workspaces: Workspace[] = graph.workspaces;
export const sectors: Sector[] = graph.sectors;
export const measures: Measure[] = graph.measures;

/** Extension seccion 7. Ausente en v1; el codigo no asume su presencia. */
export const consumption = graph.consumption ?? null;
export const hasConsumption = Array.isArray(graph.consumption) && graph.consumption.length > 0;

export const UNIVERSE = meta.universe_apps;
export const AS_OF = meta.as_of;

export const TBD = "TBD";
/* La hoja escribe el mismo no-valor de tres maneras: TBD, "Por confirmar" y
   "not stated". Las tres se reconocen como no resuelto para que no se presenten
   como si fueran un proceso o un sector declarado. Ver DQ3: la compuerta
   Atribuible NO se reescribe, se conserva como la declara la hoja. */
const TBD_FORMS = new Set(["TBD", "POR CONFIRMAR", "NOT STATED"]);
export const isTbd = (v: string | null | undefined) =>
  !v || v.trim() === "" || TBD_FORMS.has(v.trim().toUpperCase());

const byId = new Map(applications.map((a) => [a.app_id, a]));
const platByName = new Map(platforms.map((p) => [p.name, p]));
const agByName = new Map(assignmentGroups.map((g) => [g.name, g]));

export const getApp = (id: string) => byId.get(id);
export const getPlatform = (name: string) => platByName.get(name);
export const getAg = (name: string) => agByName.get(name);

export const platformsOf = (a: Application) =>
  a.platforms.map(getPlatform).filter(Boolean) as Platform[];
export const agsOf = (a: Application) =>
  a.ags.map(getAg).filter(Boolean) as AssignmentGroup[];

/* ------------------------------------------------------------------ */
/* R4 · El blast radius no es aditivo entre plataformas.                */
/* La combinacion se resuelve SIEMPRE como union deduplicada de         */
/* app_ids. La suma de blast_radius_direct se conserva unicamente para  */
/* poder mostrar la diferencia, jamas como total.                       */
/* ------------------------------------------------------------------ */
export interface BlastResult {
  selected: Platform[];
  apps: Application[];
  /** Union deduplicada. Este es el unico total valido. */
  unionCount: number;
  /** Suma ingenua de radios directos. Solo para contraste. */
  naiveSum: number;
  /** Cuanto sobrecuenta la suma. */
  overcount: number;
  /** Aplicaciones alcanzadas por mas de una plataforma seleccionada. */
  shared: { app: Application; platforms: string[] }[];
  weighted: number;
  criticalityMix: Record<Criticality, number>;
  processes: Tally[];
  sectors: Tally[];
  ags: AssignmentGroup[];
  dpms: { name: string; appCount: number }[];
  routable: Application[];
  unroutable: Application[];
  qualityRows: QualityAgRow[];
  qualityIncidents: number;
}

export interface Tally { key: string; count: number }

const EMPTY_MIX: Record<Criticality, number> = { C1: 0, C2: 0, C3: 0, "C-": 0 };

const qualityByKey = new Map(quality.by_assignment_group.map((r) => [r.ag_key, r]));

export function computeBlast(platformNames: string[]): BlastResult {
  const selected = platformNames.map(getPlatform).filter(Boolean) as Platform[];

  // Union deduplicada, y de paso cuantas plataformas tocan cada aplicacion.
  const hits = new Map<string, string[]>();
  for (const p of selected) {
    for (const id of p.app_ids) {
      const prev = hits.get(id);
      if (prev) prev.push(p.name);
      else hits.set(id, [p.name]);
    }
  }
  const apps = [...hits.keys()].map((id) => byId.get(id)).filter(Boolean) as Application[];

  const naiveSum = selected.reduce((s, p) => s + p.blast_radius_direct, 0);
  const mix = { ...EMPTY_MIX };
  for (const a of apps) mix[a.criticality] += 1;

  const tally = (pick: (a: Application) => string): Tally[] => {
    const m = new Map<string, number>();
    for (const a of apps) m.set(pick(a), (m.get(pick(a)) ?? 0) + 1);
    return [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((x, y) => y.count - x.count || x.key.localeCompare(y.key));
  };

  const agNames = [...new Set(apps.flatMap((a) => a.ags))].sort();
  const ags = agNames.map(getAg).filter(Boolean) as AssignmentGroup[];

  const dpmMap = new Map<string, number>();
  for (const a of apps) {
    if (isTbd(a.dpm)) continue;
    dpmMap.set(a.dpm, (dpmMap.get(a.dpm) ?? 0) + 1);
  }

  const qualityRows = ags
    .map((g) => qualityByKey.get(g.ag_key))
    .filter(Boolean) as QualityAgRow[];

  return {
    selected,
    apps,
    unionCount: apps.length,
    naiveSum,
    overcount: naiveSum - apps.length,
    shared: apps
      .map((app) => ({ app, platforms: hits.get(app.app_id) ?? [] }))
      .filter((x) => x.platforms.length > 1),
    weighted: apps.reduce((s, a) => s + a.criticality_weight, 0),
    criticalityMix: mix,
    processes: tally((a) => a.process),
    sectors: tally((a) => a.sector),
    ags,
    dpms: [...dpmMap.entries()]
      .map(([name, appCount]) => ({ name, appCount }))
      .sort((x, y) => y.appCount - x.appCount),
    routable: apps.filter((a) => a.gates.routable),
    unroutable: apps.filter((a) => !a.gates.routable),
    qualityRows,
    qualityIncidents: qualityRows.reduce((s, r) => s + r.incidents, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Hueco declarado. Siempre calculado desde las filas (R3).             */
/* ------------------------------------------------------------------ */
export interface Gaps {
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

export function computeGaps(pool: Application[] = applications): Gaps {
  const n = (f: (a: Application) => boolean) => pool.filter(f).length;
  return {
    universe: pool.length,
    withoutPlatform: n((a) => !a.gates.platform_known),
    withoutAg: n((a) => !a.gates.routable),
    withoutDpm: n((a) => !a.gates.owned),
    withoutAttribution: n((a) => !a.gates.attributable),
    withoutCriticality: n((a) => a.criticality === "C-"),
    routable: n((a) => a.gates.routable),
    owned: n((a) => a.gates.owned),
    attributable: n((a) => a.gates.attributable),
    platformKnown: n((a) => a.gates.platform_known),
  };
}

/** Cobertura de los cuatro eslabones recalculada sobre cualquier subconjunto. */
export interface SubsetCoverage {
  id: string; link: string; resolved: number; universe: number; coverage_pct: number;
}

export function subsetCoverage(pool: Application[]): SubsetCoverage[] {
  const u = pool.length;
  const mk = (id: string, link: string, resolved: number) => ({
    id, link, resolved, universe: u, coverage_pct: u ? (resolved / u) * 100 : 0,
  });
  return [
    mk("L1", "Plataforma → Aplicación", pool.filter((a) => a.gates.platform_known).length),
    mk("L2", "Aplicación → Assignment Group", pool.filter((a) => a.gates.routable).length),
    mk("L3", "Aplicación → DPM sin TBD", pool.filter((a) => a.gates.owned).length),
    mk("L4", "Aplicación → Proceso y Sector", pool.filter((a) => a.gates.attributable).length),
  ];
}

/** Calidad de un conjunto de AGs. Se mide por grupo, nunca por aplicacion. */
export function qualityOfAgs(agNames: string[]) {
  const rows = agNames
    .map((n) => getAg(n))
    .filter(Boolean)
    .map((g) => qualityByKey.get((g as AssignmentGroup).ag_key))
    .filter(Boolean) as QualityAgRow[];
  const incidents = rows.reduce((s, r) => s + r.incidents, 0);
  const wavg = (pick: (r: QualityAgRow) => number) =>
    incidents ? rows.reduce((s, r) => s + pick(r) * r.incidents, 0) / incidents : null;
  return {
    rows,
    measured: rows.length,
    total: agNames.length,
    incidents,
    diagnostic_rate: wavg((r) => r.diagnostic_rate),
    has_root_rate: wavg((r) => r.has_root_rate),
    avg_score: wavg((r) => r.avg_score),
    poor_rate: wavg((r) => r.poor_rate),
  };
}

/* ------------------------------------------------------------------ */
/* Filtros, busqueda y catalogos                                        */
/* ------------------------------------------------------------------ */
export interface Filters {
  q: string; process: string; sector: string; criticality: string;
  scope: string; platform: string; gate: string; aiOnly: boolean;
}
export const EMPTY_FILTERS: Filters = {
  q: "", process: "", sector: "", criticality: "", scope: "", platform: "", gate: "", aiOnly: false,
};

export function filterApps(pool: Application[], f: Filters): Application[] {
  const q = f.q.trim().toLowerCase();
  return pool.filter((a) => {
    if (q && !(a.name.toLowerCase().includes(q) || a.apm.toLowerCase().includes(q) ||
               a.app_id.toLowerCase().includes(q))) return false;
    if (f.process && a.process !== f.process) return false;
    if (f.sector && a.sector !== f.sector) return false;
    if (f.criticality && a.criticality !== f.criticality) return false;
    if (f.scope && a.scope_status !== f.scope) return false;
    if (f.platform && !a.platforms.includes(f.platform)) return false;
    if (f.aiOnly && !a.is_ai_ml) return false;
    switch (f.gate) {
      case "routable": return a.gates.routable;
      case "not-routable": return !a.gates.routable;
      case "owned": return a.gates.owned;
      case "not-owned": return !a.gates.owned;
      case "attributable": return a.gates.attributable;
      case "not-attributable": return !a.gates.attributable;
      case "platform": return a.gates.platform_known;
      case "not-platform": return !a.gates.platform_known;
      default: return true;
    }
  });
}

const uniq = (v: string[]) => [...new Set(v)].filter(Boolean).sort();
export const PROCESS_OPTIONS = uniq(applications.map((a) => a.process));
export const SECTOR_OPTIONS = uniq(applications.map((a) => a.sector));
export const SCOPE_OPTIONS = uniq(applications.map((a) => a.scope_status));
export const CRITICALITY_OPTIONS: Criticality[] = ["C1", "C2", "C3", "C-"];
export const PLATFORM_OPTIONS = [...platforms].sort(
  (a, b) => b.blast_radius_direct - a.blast_radius_direct || a.name.localeCompare(b.name));

export function searchApps(term: string, limit = 12): Application[] {
  const s = term.trim().toLowerCase();
  if (s.length < 2) return [];
  const starts: Application[] = [], contains: Application[] = [];
  for (const a of applications) {
    const n = a.name.toLowerCase(), apm = a.apm.toLowerCase();
    if (n.startsWith(s) || apm.startsWith(s)) starts.push(a);
    else if (n.includes(s) || apm.includes(s) || a.app_id.toLowerCase().includes(s)) contains.push(a);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* AI Ops y cardinalidad de ruteo                                       */
/* ------------------------------------------------------------------ */
export const aiApps = applications.filter((a) => a.is_ai_ml);
export const aiPlatforms = platforms.filter((p) => p.is_ai_platform);

/** Pila tecnologica del segmento: plataformas con al menos una app AI/ML. */
export const aiTechStack = platforms
  .map((p) => ({ platform: p, aiCount: p.ai_ml_apps }))
  .filter((x) => x.aiCount > 0)
  .sort((a, b) => b.aiCount - a.aiCount);

export const multiAgApps = applications.filter((a) => a.ags.length > 1).length;
export const maxAgCount = Math.max(...applications.map((a) => a.ags.length));
export const TOTAL_AGS = assignmentGroups.length;
export const TOTAL_DPMS = new Set(
  applications.map((a) => a.dpm).filter((d) => !isTbd(d))).size;

/** Granularidades disponibles, con su conteo real de periodos. */
export const GRANULARITIES: { key: Granularity; label: string; periods: number }[] = [
  { key: "week", label: "Semana", periods: quality.timeseries.week.length },
  { key: "month", label: "Mes", periods: quality.timeseries.month.length },
  { key: "quarter", label: "Trimestre", periods: quality.timeseries.quarter.length },
  { key: "year", label: "Año", periods: quality.timeseries.year.length },
];

/* ------------------------------------------------------------------ */
/* Sankey · Plataforma → Proceso de negocio → Ruta de respuesta        */
/*                                                                     */
/* R4 sigue vigente: un Sankey suma por construccion, asi que la       */
/* unidad de flujo NO es la aplicacion sino el enlace                  */
/* plataforma-aplicacion. Una aplicacion que corre en dos plataformas  */
/* aporta dos enlaces, y eso se declara junto al total en lugar de     */
/* presentar la suma como si fuera un conteo de aplicaciones.          */
/* El flujo se conserva de extremo a extremo porque cada aplicacion    */
/* tiene exactamente un proceso y exactamente un estado de ruta.       */
/* ------------------------------------------------------------------ */
export interface SankeyNode { name: string; kind: "platform" | "process" | "route" }
export interface SankeyLink { source: number; target: number; value: number }
export interface SankeyResult {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** Enlaces plataforma-aplicacion dibujados. Es la unidad del diagrama. */
  linkTotal: number;
  /** Aplicaciones distintas detras de esos enlaces. Siempre <= linkTotal. */
  appTotal: number;
  /** Cuanto sobrecuenta el flujo respecto de las aplicaciones distintas. */
  overcount: number;
  /** Plataformas dejadas fuera por el tope, declaradas nunca omitidas. */
  excludedPlatforms: { name: string; apps: number }[];
  /** Aplicaciones sin plataforma: no pueden entrar al diagrama. */
  appsWithoutPlatform: number;
}

/** Estado de ruta: 2x2 entre tener AG y tener DPM. Cada app cae en uno solo. */
export function routeBucket(a: Application): string {
  const r = a.gates.routable ? "Routed" : "No AG";
  const o = a.gates.owned ? "DPM known" : "DPM TBD";
  return `${r} · ${o}`;
}
const ROUTE_ORDER = ["Routed · DPM known", "Routed · DPM TBD", "No AG · DPM known", "No AG · DPM TBD"];

export function computeSankey(
  platformNames: string[],
  { maxProcesses = 12 }: { maxProcesses?: number } = {},
): SankeyResult {
  const selected = platformNames.map(getPlatform).filter(Boolean) as Platform[];

  // Enlaces plataforma-aplicacion. Esta es la unidad, y se dice cual es.
  const pairs: { platform: string; app: Application }[] = [];
  for (const p of selected) {
    for (const id of p.app_ids) {
      const a = byId.get(id);
      if (a) pairs.push({ platform: p.name, app: a });
    }
  }

  // Los procesos se recortan por volumen de enlaces, y el resto se agrupa en
  // una categoria visible en lugar de desaparecer del diagrama.
  const procCount = new Map<string, number>();
  for (const { app } of pairs) {
    const k = isTbd(app.process) ? "Process TBD" : app.process;
    procCount.set(k, (procCount.get(k) ?? 0) + 1);
  }
  const ranked = [...procCount.entries()].sort((a, b) => b[1] - a[1]);
  const keep = new Set(ranked.slice(0, maxProcesses).map(([k]) => k));
  const otherLabel = ranked.length > maxProcesses
    ? `Other processes (${ranked.length - maxProcesses})`
    : null;
  const procOf = (a: Application) => {
    const k = isTbd(a.process) ? "Process TBD" : a.process;
    return keep.has(k) ? k : (otherLabel ?? k);
  };

  const platNames = selected.map((p) => p.name);
  const procNames = [...new Set(pairs.map(({ app }) => procOf(app)))]
    .sort((a, b) => (procCount.get(b) ?? 0) - (procCount.get(a) ?? 0) || a.localeCompare(b));
  const routeNames = ROUTE_ORDER.filter((r) => pairs.some(({ app }) => routeBucket(app) === r));

  const nodes: SankeyNode[] = [
    ...platNames.map((name) => ({ name, kind: "platform" as const })),
    ...procNames.map((name) => ({ name, kind: "process" as const })),
    ...routeNames.map((name) => ({ name, kind: "route" as const })),
  ];
  const idx = new Map(nodes.map((n, i) => [`${n.kind}:${n.name}`, i]));

  const acc = new Map<string, number>();
  const bump = (s: number, t: number) => acc.set(`${s}>${t}`, (acc.get(`${s}>${t}`) ?? 0) + 1);
  for (const { platform, app } of pairs) {
    const p = idx.get(`platform:${platform}`)!;
    const q = idx.get(`process:${procOf(app)}`)!;
    const r = idx.get(`route:${routeBucket(app)}`)!;
    bump(p, q);
    bump(q, r);
  }
  const links: SankeyLink[] = [...acc.entries()].map(([k, value]) => {
    const [source, target] = k.split(">").map(Number);
    return { source, target, value };
  });

  const distinct = new Set(pairs.map(({ app }) => app.app_id));
  const excluded = platforms
    .filter((p) => !platformNames.includes(p.name))
    .map((p) => ({ name: p.name, apps: p.blast_radius_direct }))
    .sort((a, b) => b.apps - a.apps);

  return {
    nodes,
    links,
    linkTotal: pairs.length,
    appTotal: distinct.size,
    overcount: pairs.length - distinct.size,
    excludedPlatforms: excluded,
    appsWithoutPlatform: applications.filter((a) => !a.gates.platform_known).length,
  };
}

/* ------------------------------------------------------------------ */
/* Grafo de vecindad · Plataforma — Aplicacion — Assignment Group      */
/*                                                                     */
/* Un nodo focal y sus vecinos directos, en tres columnas. Cuando un   */
/* lado excede el tope se declara cuantos no se dibujaron: la lista    */
/* nunca se recorta en silencio.                                       */
/* ------------------------------------------------------------------ */
export type FocusKind = "application" | "platform" | "assignment_group";
export interface GraphNode {
  id: string;
  label: string;
  kind: "platform" | "application" | "assignment_group";
  column: 0 | 1 | 2;
  /** Grado total en el modelo completo, no solo en lo dibujado. */
  degree: number;
  focus?: boolean;
  href?: string;
  meta?: string;
}
export interface GraphEdge { from: string; to: string; evidence: EvidenceTier | null }
export interface Neighbourhood {
  focus: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: { kind: GraphNode["kind"]; shown: number; total: number }[];
  note: string;
}

const CAP = 24;

function appNode(a: Application, column: 0 | 1 | 2, focus = false): GraphNode {
  return {
    id: `app:${a.app_id}`,
    label: a.name,
    kind: "application",
    column,
    degree: a.platforms.length + a.ags.length,
    focus,
    href: `/app/${a.app_id}`,
    meta: `${a.criticality === "C-" ? "C·—" : a.criticality} · ${a.platforms.length}p · ${a.ags.length}g`,
  };
}

export function neighbourhood(kind: FocusKind, key: string): Neighbourhood | null {
  const truncated: Neighbourhood["truncated"] = [];
  const take = <T,>(arr: T[], kind: GraphNode["kind"]) => {
    if (arr.length > CAP) truncated.push({ kind, shown: CAP, total: arr.length });
    return arr.slice(0, CAP);
  };

  if (kind === "application") {
    const a = byId.get(key);
    if (!a) return null;
    const focus = appNode(a, 1, true);
    const plats = platformsOf(a);
    const ags = agsOf(a);
    const nodes: GraphNode[] = [
      ...plats.map((p) => ({
        id: `plat:${p.name}`, label: p.name, kind: "platform" as const, column: 0 as const,
        degree: p.blast_radius_direct, meta: `${p.blast_radius_direct} app${p.blast_radius_direct === 1 ? "" : "s"} · ${p.tier}`,
      })),
      focus,
      ...ags.map((g) => ({
        id: `ag:${g.ag_id}`, label: g.name, kind: "assignment_group" as const, column: 2 as const,
        degree: g.app_count, meta: `${g.app_count} app${g.app_count === 1 ? "" : "s"}${g.has_quality ? " · Q" : ""}`,
      })),
    ];
    const edges: GraphEdge[] = [
      ...plats.map((p) => ({ from: `plat:${p.name}`, to: focus.id, evidence: a.platform_evidence_tier })),
      ...ags.map((g) => ({ from: focus.id, to: `ag:${g.ag_id}`, evidence: a.ag_evidence_tier })),
    ];
    return {
      focus, nodes, edges, truncated,
      note: plats.length === 0
        ? "This application has no identified platform, so the left-hand column is empty. That is a declared gap, not a rendering error."
        : ags.length === 0
          ? "This application has no Assignment Group, so the right-hand column is empty: an incident on it finds no destination."
          : "Both links are N:M. Neither column is a lookup and neither can be collapsed into a single value.",
    };
  }

  if (kind === "platform") {
    const p = getPlatform(key);
    if (!p) return null;
    const focus: GraphNode = {
      id: `plat:${p.name}`, label: p.name, kind: "platform", column: 1, focus: true,
      degree: p.blast_radius_direct, meta: `${p.blast_radius_direct} app${p.blast_radius_direct === 1 ? "" : "s"} · ${p.tier}`,
    };
    const apps = (p.app_ids.map((id) => byId.get(id)).filter(Boolean) as Application[])
      .sort((a, b) => b.ags.length - a.ags.length || a.name.localeCompare(b.name));
    const shownApps = take(apps, "application");
    const agNames = [...new Set(shownApps.flatMap((a) => a.ags))];
    const ags = (agNames.map(getAg).filter(Boolean) as AssignmentGroup[])
      .sort((a, b) => b.app_count - a.app_count);
    const shownAgs = take(ags, "assignment_group");
    const shownAgIds = new Set(shownAgs.map((g) => g.name));
    return {
      focus,
      nodes: [...shownApps.map((a) => appNode(a, 0)), focus,
        ...shownAgs.map((g) => ({
          id: `ag:${g.ag_id}`, label: g.name, kind: "assignment_group" as const, column: 2 as const,
          degree: g.app_count, meta: `${g.app_count} app${g.app_count === 1 ? "" : "s"}${g.has_quality ? " · Q" : ""}`,
        }))],
      edges: [
        ...shownApps.map((a) => ({ from: `app:${a.app_id}`, to: focus.id, evidence: a.platform_evidence_tier })),
        ...shownApps.flatMap((a) => a.ags.filter((n) => shownAgIds.has(n)).map((n) => ({
          from: focus.id, to: `ag:${getAg(n)!.ag_id}`, evidence: a.ag_evidence_tier,
        }))),
      ],
      truncated,
      note: "Applications are ranked by number of Assignment Groups. The Assignment Group column only covers the applications actually drawn.",
    };
  }

  const g = agByName.get(key) ?? assignmentGroups.find((x) => x.ag_id === key);
  if (!g) return null;
  const focus: GraphNode = {
    id: `ag:${g.ag_id}`, label: g.name, kind: "assignment_group", column: 1, focus: true,
    degree: g.app_count, meta: `${g.app_count} app${g.app_count === 1 ? "" : "s"}${g.has_quality ? " · Q" : ""}`,
  };
  const apps = (g.app_ids.map((id) => byId.get(id)).filter(Boolean) as Application[])
    .sort((a, b) => b.platforms.length - a.platforms.length || a.name.localeCompare(b.name));
  const shownApps = take(apps, "application");
  const platNames = [...new Set(shownApps.flatMap((a) => a.platforms))];
  const plats = (platNames.map(getPlatform).filter(Boolean) as Platform[])
    .sort((a, b) => b.blast_radius_direct - a.blast_radius_direct);
  const shownPlats = take(plats, "platform");
  const shownPlatNames = new Set(shownPlats.map((p) => p.name));
  return {
    focus,
    nodes: [
      ...shownPlats.map((p) => ({
        id: `plat:${p.name}`, label: p.name, kind: "platform" as const, column: 0 as const,
        degree: p.blast_radius_direct, meta: `${p.blast_radius_direct} app${p.blast_radius_direct === 1 ? "" : "s"} · ${p.tier}`,
      })),
      focus,
      ...shownApps.map((a) => appNode(a, 2)),
    ],
    edges: [
      ...shownApps.flatMap((a) => a.platforms.filter((n) => shownPlatNames.has(n)).map((n) => ({
        from: `plat:${n}`, to: focus.id, evidence: a.platform_evidence_tier,
      }))),
      ...shownApps.map((a) => ({ from: focus.id, to: `app:${a.app_id}`, evidence: a.ag_evidence_tier })),
    ],
    truncated,
    note: "One Assignment Group serves many applications: this is why quality measured on the group is not attributable to any single application.",
  };
}

/** Catalogos para el selector del explorador. */
export const AG_OPTIONS = [...assignmentGroups]
  .sort((a, b) => b.app_count - a.app_count || a.name.localeCompare(b.name));

/* ------------------------------------------------------------------ */
/* Sector · dimension de negocio, N:M igual que plataforma y AG        */
/* ------------------------------------------------------------------ */
export const getSector = (name: string) => sectorByName.get(name);
const sectorByName = new Map(sectors.map((x) => [x.name, x]));

/** Aplicaciones sin ningun sector reconocido. No se reparten ni se imputan. */
export const appsWithoutSector = applications.filter((a) => a.sectors.length === 0);
/** Aplicaciones cuya columna de sector traia un ID de servicio de ServiceNow. */
export const appsWithBadSectorToken = applications.filter((a) => a.sector_unrecognized.length > 0);
export const multiSectorApps = applications.filter((a) => a.sectors.length > 1).length;

/** Union deduplicada de aplicaciones para un conjunto de sectores.
 *  R4 vale igual aqui: 118 aplicaciones estan en mas de un sector, asi que
 *  sumar los conteos por sector cuenta esas aplicaciones varias veces. */
export function computeSectorReach(sectorNames: string[]) {
  const selected = sectorNames.map(getSector).filter(Boolean) as Sector[];
  const ids = new Set<string>();
  for (const x of selected) for (const id of x.app_ids) ids.add(id);
  const apps = [...ids].map((id) => byId.get(id)).filter(Boolean) as Application[];
  const naiveSum = selected.reduce((n, x) => n + x.apps, 0);
  return {
    selected,
    apps,
    unionCount: apps.length,
    naiveSum,
    overcount: naiveSum - apps.length,
    routable: apps.filter((a) => a.gates.routable).length,
    owned: apps.filter((a) => a.gates.owned).length,
    platformKnown: apps.filter((a) => a.gates.platform_known).length,
    impactDeclared: apps.filter((a) => a.business_impact.financial !== null).length,
  };
}

/* ------------------------------------------------------------------ */
/* Impacto de negocio · solo lo declarado, nunca imputado              */
/* ------------------------------------------------------------------ */
export const IMPACT_ORDER = ["Critical", "High", "Medium", "Low"] as const;
export type ImpactLevel = (typeof IMPACT_ORDER)[number];

export interface ImpactProfile {
  universe: number;
  /** Conteo por nivel declarado. La suma NUNCA es el universo. */
  byLevel: Record<ImpactLevel, number>;
  declared: number;
  notDeclared: number;
  /** Aplicaciones con marcador de la hoja ("TBD, ARA Not Started", "Empty"). */
  placeholder: number;
  userBaseDeclared: number;
  serviceTierDeclared: number;
  supportWindowDeclared: number;
  /** Apps con impacto alto o critico Y sin ruta de respuesta. El cruce que importa. */
  highImpactNoRoute: Application[];
  highImpactNoOwner: Application[];
}

export function impactProfile(pool: Application[] = applications): ImpactProfile {
  const byLevel = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<ImpactLevel, number>;
  let declared = 0, placeholder = 0;
  for (const a of pool) {
    const lvl = a.business_impact.financial;
    if (lvl) { byLevel[lvl] += 1; declared += 1; }
    else if (a.business_impact.financial_raw) placeholder += 1;
  }
  const high = pool.filter((a) => a.business_impact.financial === "High"
    || a.business_impact.financial === "Critical");
  return {
    universe: pool.length,
    byLevel,
    declared,
    notDeclared: pool.length - declared,
    placeholder,
    userBaseDeclared: pool.filter((a) => a.business_impact.user_base).length,
    serviceTierDeclared: pool.filter((a) => a.business_impact.service_tier).length,
    supportWindowDeclared: pool.filter((a) => a.business_impact.support_window).length,
    highImpactNoRoute: high.filter((a) => !a.gates.routable),
    highImpactNoOwner: high.filter((a) => !a.gates.owned),
  };
}

/** Bandas de tamano de audiencia, en el orden de la hoja. ">100" se conserva
 *  aparte porque se solapa con otras bandas y mapearla seria inventar. */
export const USER_BANDS = ["0-5", "6-49", "50-99", "100-499", "500-999", "1000+", ">100"];

/* ------------------------------------------------------------------ */
/* Trazabilidad · cada cifra publicada apunta a su ficha de metrica    */
/*                                                                     */
/* El valor vivo lo calcula esta aplicacion; la hoja escribio el suyo  */
/* en la nota de 08_MEASURES. Cuando difieren se muestran los dos y se */
/* marca la divergencia, porque reconciliarlos en silencio borraria    */
/* justamente la trazabilidad que la ficha existe para dar.            */
/* ------------------------------------------------------------------ */
export const measureById = new Map(measures.map((m) => [m.measure_id, m]));

export interface LiveValue {
  label: string;
  resolved: number;
  universe: number;
  /** Cifra que la hoja escribio en su nota, si la escribio. */
  sheetClaim?: string;
}

const gaps0 = computeGaps();

/** Valor que ESTA aplicacion calcula para cada binding del registro. */
export const LIVE: Record<string, LiveValue> = {
  "gate.attributable": {
    label: "Applications with a declared process and sector",
    resolved: gaps0.attributable, universe: gaps0.universe, sheetClaim: "0.0%",
  },
  "gate.routable": {
    label: "Applications with at least one Assignment Group",
    resolved: gaps0.routable, universe: gaps0.universe, sheetClaim: "0.0%",
  },
  "gap.metadata": {
    label: "Applications with no platform or no Assignment Group",
    resolved: applications.filter((a) => !a.gates.platform_known || !a.gates.routable).length,
    universe: gaps0.universe, sheetClaim: "0 signals",
  },
  "platform.blast_radius_direct": {
    label: "Application–platform pairs in the bridge",
    resolved: applications.reduce((n, a) => n + a.platforms.length, 0),
    universe: platforms.reduce((n, p) => n + p.blast_radius_direct, 0),
    sheetClaim: "141 pairs · 91 apps",
  },
  "dashboard.confirmed": {
    label: "Workspaces with a confirmed application",
    resolved: meta.dashboard_link.confirmed, universe: meta.dashboard_link.workspaces,
    sheetClaim: "0.0% workspaces confirmed",
  },
  "quality.diagnostic_rate": {
    label: "Eligible incidents behind the diagnostic rate",
    resolved: quality.meta.eligible, universe: quality.meta.universe_raw,
    sheetClaim: "Baseline 51.6% · current 68.4%",
  },
};

export function liveFor(measureId: string): LiveValue | null {
  const m = measureById.get(measureId);
  return m?.binding ? LIVE[m.binding] ?? null : null;
}

/** Cruce impacto declarado x ruta declarada. Es la pregunta de negocio del
 *  tablero: cuanto del hueco de ruteo se puede cuantificar. Se calcula como
 *  particion completa, de modo que las cuatro celdas suman el universo. */
export interface ImpactRouteCrossing {
  universe: number;
  impactAndRoute: Application[];
  impactNoRoute: Application[];
  noImpactWithRoute: Application[];
  noImpactNoRoute: Application[];
  /** Suma de las cuatro celdas. Debe ser igual al universo. */
  total: number;
}

export function impactRouteCrossing(pool: Application[] = applications): ImpactRouteCrossing {
  const has = (a: Application) => a.business_impact.financial !== null;
  const cells = {
    impactAndRoute: pool.filter((a) => has(a) && a.gates.routable),
    impactNoRoute: pool.filter((a) => has(a) && !a.gates.routable),
    noImpactWithRoute: pool.filter((a) => !has(a) && a.gates.routable),
    noImpactNoRoute: pool.filter((a) => !has(a) && !a.gates.routable),
  };
  return {
    universe: pool.length,
    ...cells,
    total: Object.values(cells).reduce((n, c) => n + c.length, 0),
  };
}
