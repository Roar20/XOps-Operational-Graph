import {
  applications, appById, assignmentGroups, agById, platforms, platformById, isTbd, UNIVERSE,
} from "./data";
import type { Application, Criticality, Platform } from "./types";

/* ------------------------------------------------------------------ */
/* R1 — El blast radius no es aditivo.                                  */
/* La combinacion de plataformas SIEMPRE se resuelve como union         */
/* deduplicada de app_ids. La suma de blast_radius_direct se conserva    */
/* solo para poder MOSTRAR la diferencia, nunca como total.             */
/* ------------------------------------------------------------------ */
export interface BlastResult {
  selected: Platform[];
  appIds: string[];
  apps: Application[];
  /** Union deduplicada. Este es el total valido. */
  unionCount: number;
  /** Suma ingenua de blast_radius_direct. Solo para contraste didactico. */
  naiveSum: number;
  /** unionCount - naiveSum, negativo cuando hay traslape. */
  overlapCount: number;
  /** Aplicaciones alcanzadas por mas de una plataforma seleccionada. */
  sharedApps: { app: Application; platformIds: string[] }[];
  weighted: number;
  criticalityMix: Record<Criticality, number>;
  processes: { key: string; count: number }[];
  sectors: { key: string; count: number }[];
  agIds: string[];
  dpms: { name: string; appCount: number }[];
  routableApps: Application[];
  unroutableApps: Application[];
  routablePct: number;
}

const EMPTY_MIX: Record<Criticality, number> = { C1: 0, C2: 0, C3: 0, "C-": 0 };

export function computeBlast(platformIds: string[]): BlastResult {
  const selected = platformIds.map((id) => platformById.get(id)).filter(Boolean) as Platform[];

  // Union deduplicada — R1.
  const union = new Set<string>();
  const hitCount = new Map<string, string[]>();
  for (const p of selected) {
    for (const id of p.app_ids) {
      union.add(id);
      const prev = hitCount.get(id);
      if (prev) prev.push(p.platform_id);
      else hitCount.set(id, [p.platform_id]);
    }
  }
  const appIds = [...union];
  const apps = appIds.map((id) => appById.get(id)).filter(Boolean) as Application[];

  const naiveSum = selected.reduce((s, p) => s + p.blast_radius_direct, 0);
  const sharedApps = apps
    .map((app) => ({ app, platformIds: hitCount.get(app.app_id) ?? [] }))
    .filter((x) => x.platformIds.length > 1);

  const criticalityMix = { ...EMPTY_MIX };
  for (const a of apps) criticalityMix[a.criticality] += 1;

  const tally = (key: (a: Application) => string) => {
    const m = new Map<string, number>();
    for (const a of apps) {
      const k = key(a);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
  };

  const agIds = [...new Set(apps.flatMap((a) => a.ags))];
  const dpmMap = new Map<string, number>();
  for (const a of apps) {
    if (isTbd(a.dpm)) continue;
    dpmMap.set(a.dpm, (dpmMap.get(a.dpm) ?? 0) + 1);
  }

  const routableApps = apps.filter((a) => a.ags.length > 0);
  const unroutableApps = apps.filter((a) => a.ags.length === 0);

  return {
    selected,
    appIds,
    apps,
    unionCount: union.size,
    naiveSum,
    overlapCount: naiveSum - union.size,
    sharedApps,
    weighted: apps.reduce((s, a) => s + a.criticality_weight, 0),
    criticalityMix,
    processes: tally((a) => a.process || "TBD"),
    sectors: tally((a) => a.sector || "TBD"),
    agIds,
    dpms: [...dpmMap.entries()].map(([name, appCount]) => ({ name, appCount })).sort((a, b) => b.appCount - a.appCount),
    routableApps,
    unroutableApps,
    routablePct: apps.length ? (routableApps.length / apps.length) * 100 : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Hueco declarado — R4. Calculado siempre desde los datos.             */
/* ------------------------------------------------------------------ */
export interface GapSummary {
  universe: number;
  withoutAg: number;
  withoutDpm: number;
  withoutAttribution: number;
  withoutPlatform: number;
  routable: number;
  owned: number;
  attributable: number;
}

export function computeGaps(pool: Application[] = applications): GapSummary {
  return {
    universe: pool.length,
    withoutAg: pool.filter((a) => a.ags.length === 0).length,
    withoutDpm: pool.filter((a) => isTbd(a.dpm)).length,
    withoutAttribution: pool.filter((a) => !a.gates.attributable).length,
    withoutPlatform: pool.filter((a) => a.platforms.length === 0).length,
    routable: pool.filter((a) => a.gates.routable).length,
    owned: pool.filter((a) => a.gates.owned).length,
    attributable: pool.filter((a) => a.gates.attributable).length,
  };
}

/* ------------------------------------------------------------------ */
/* Cobertura recalculada sobre un subconjunto (usada por AI Ops).       */
/* ------------------------------------------------------------------ */
export interface SubsetCoverage {
  id: string;
  link: string;
  resolved: number;
  universe: number;
  coverage_pct: number;
}

export function subsetCoverage(pool: Application[]): SubsetCoverage[] {
  const u = pool.length;
  const mk = (id: string, link: string, resolved: number) => ({
    id, link, resolved, universe: u, coverage_pct: u ? (resolved / u) * 100 : 0,
  });
  return [
    mk("L1", "Aplicacion → Plataforma", pool.filter((a) => a.platforms.length > 0).length),
    mk("L2", "Aplicacion → Proceso", pool.filter((a) => !isTbd(a.process)).length),
    mk("L3", "Aplicacion → DPM", pool.filter((a) => !isTbd(a.dpm)).length),
    mk("L4", "Aplicacion → Assignment Group", pool.filter((a) => a.ags.length > 0).length),
  ];
}

/* ------------------------------------------------------------------ */
/* Filtros de portafolio                                                */
/* ------------------------------------------------------------------ */
export interface PortfolioFilters {
  q: string;
  process: string;
  sector: string;
  criticality: string;
  scope: string;
  platform: string;
  gate: string; // "" | "routable" | "not-routable" | "owned" | "not-owned" | "attributable" | "not-attributable"
  aiOnly: boolean;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  q: "", process: "", sector: "", criticality: "", scope: "", platform: "", gate: "", aiOnly: false,
};

export function filterApps(pool: Application[], f: PortfolioFilters): Application[] {
  const q = f.q.trim().toLowerCase();
  return pool.filter((a) => {
    if (q && !(a.name.toLowerCase().includes(q) || a.apm.toLowerCase().includes(q) || a.app_id.toLowerCase().includes(q))) return false;
    if (f.process && a.process !== f.process) return false;
    if (f.sector && a.sector !== f.sector) return false;
    if (f.criticality && a.criticality !== f.criticality) return false;
    if (f.scope && a.scope_status !== f.scope) return false;
    if (f.platform && !a.platforms.includes(f.platform)) return false;
    if (f.aiOnly && !a.is_ai_ml) return false;
    switch (f.gate) {
      case "routable": if (!a.gates.routable) return false; break;
      case "not-routable": if (a.gates.routable) return false; break;
      case "owned": if (!a.gates.owned) return false; break;
      case "not-owned": if (a.gates.owned) return false; break;
      case "attributable": if (!a.gates.attributable) return false; break;
      case "not-attributable": if (a.gates.attributable) return false; break;
    }
    return true;
  });
}

export const uniqueSorted = (vals: string[]) => [...new Set(vals)].filter(Boolean).sort();

export const PROCESS_OPTIONS = uniqueSorted(applications.map((a) => a.process));
export const SECTOR_OPTIONS = uniqueSorted(applications.map((a) => a.sector));
export const SCOPE_OPTIONS = uniqueSorted(applications.map((a) => a.scope_status));
export const CRITICALITY_OPTIONS: Criticality[] = ["C1", "C2", "C3", "C-"];
export const PLATFORM_OPTIONS = [...platforms].sort((a, b) => b.blast_radius_direct - a.blast_radius_direct);

/* ------------------------------------------------------------------ */
/* Busqueda global                                                      */
/* ------------------------------------------------------------------ */
export function searchApps(q: string, limit = 12): Application[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const starts: Application[] = [];
  const contains: Application[] = [];
  for (const a of applications) {
    const n = a.name.toLowerCase();
    const apm = a.apm.toLowerCase();
    if (n.startsWith(s) || apm.startsWith(s)) starts.push(a);
    else if (n.includes(s) || apm.includes(s) || a.app_id.toLowerCase().includes(s)) contains.push(a);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* AI Ops                                                               */
/* ------------------------------------------------------------------ */
/** Denominadores globales para R2: toda proporcion necesita su universo. */
export const TOTAL_AGS = assignmentGroups.length;
export const TOTAL_DPMS = new Set(applications.map((a) => a.dpm).filter((d) => !isTbd(d))).size;

export const aiApps = applications.filter((a) => a.is_ai_ml);
export const aiPlatforms = platforms.filter((p) => p.is_ai_platform);

/** Pila tecnologica del portafolio AI/ML: plataformas con al menos una app AI/ML. */
export function aiTechStack() {
  return platforms
    .map((p) => ({ platform: p, aiCount: p.app_ids.filter((id) => appById.get(id)?.is_ai_ml).length }))
    .filter((x) => x.aiCount > 0)
    .sort((a, b) => b.aiCount - a.aiCount);
}

/* ------------------------------------------------------------------ */
/* Assignment groups de una aplicacion                                  */
/* ------------------------------------------------------------------ */
export const agsOf = (app: Application) => app.ags.map((id) => agById.get(id)).filter(Boolean);
export const platformsOf = (app: Application) => app.platforms.map((id) => platformById.get(id)).filter(Boolean) as Platform[];

/** Cardinalidad 1:N del ruteo — el argumento de la pantalla 5.3. */
export const multiAgCount = applications.filter((a) => a.ags.length > 1).length;
export const maxAgCount = Math.max(...applications.map((a) => a.ags.length));
export { UNIVERSE, assignmentGroups };
