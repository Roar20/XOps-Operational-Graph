import raw from "@/data/xops-operational-graph-data.json";
import type {
  Application, AssignmentGroup, CoverageLink, GraphData, Platform,
} from "./types";

export const graph = raw as unknown as GraphData;

export const meta = graph.meta;
export const applications: Application[] = graph.applications;
export const platforms: Platform[] = graph.platforms;
export const assignmentGroups: AssignmentGroup[] = graph.assignment_groups;
export const coverage: CoverageLink[] = graph.coverage;
export const quality = graph.quality;

/** Extension v2 (seccion 7): ausente en v1, el codigo no asume su presencia. */
export const dashboards = graph.dashboards ?? null;
export const hasDashboardLink = Array.isArray(graph.dashboards) && graph.dashboards.length > 0;
export const hasAudience = applications.some((a) => a.audience != null);

export const UNIVERSE = meta.universe_apps;

export const appById = new Map(applications.map((a) => [a.app_id, a]));
export const platformById = new Map(platforms.map((p) => [p.platform_id, p]));
export const agById = new Map(assignmentGroups.map((g) => [g.ag_id, g]));

export const TBD = "TBD";
export const isTbd = (v: string | null | undefined) => !v || v.trim() === "" || v.trim().toUpperCase() === "TBD";

/** R4: el valor no confirmado se muestra como TBD, nunca en blanco. */
export const showTbd = (v: string | null | undefined) => (isTbd(v) ? TBD : (v as string));
