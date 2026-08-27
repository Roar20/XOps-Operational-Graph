import raw from "@/data/xops-operational-graph-data.json";
import type {
  Application, AssignmentGroup, CoverageLink, Criticality, GraphData,
  Granularity, Platform, QualityAgRow, Workspace,
} from "@/types";

export const graph = raw as unknown as GraphData;

export const meta = graph.meta;
export const applications: Application[] = graph.applications;
export const platforms: Platform[] = graph.platforms;
export const assignmentGroups: AssignmentGroup[] = graph.assignment_groups;
export const coverage: CoverageLink[] = graph.coverage;
export const quality = graph.quality;
export const measures = graph.measures;
export const workspaces: Workspace[] = graph.workspaces;

/** Extension seccion 7. Ausente en v1; el codigo no asume su presencia. */
export const consumption = graph.consumption ?? null;
export const hasConsumption = Array.isArray(graph.consumption) && graph.consumption.length > 0;

export const UNIVERSE = meta.universe_apps;
export const AS_OF = meta.as_of;

export const TBD = "TBD";
export const isTbd = (v: string | null | undefined) =>
  !v || v.trim() === "" || v.trim().toUpperCase() === TBD;

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
