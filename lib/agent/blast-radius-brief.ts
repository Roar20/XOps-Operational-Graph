/**
 * Blast Radius v1 — deterministic Relationship Brief for a selected
 * application. Reads only the semantic layer already shipped in the build;
 * no LLM, no network, no cross-application inference beyond what shared
 * platforms and shared support groups already imply.
 *
 * Two rules everything else follows:
 *
 *   R1. Only fields that the semantic layer actually declares are surfaced.
 *       When a field is empty or marked "TBD", the brief reports it as
 *       "Not declared". Missing evidence never disappears.
 *   R2. Related applications reached via a shared Assignment Group or a
 *       shared Platform are labeled DERIVED — never presented as a
 *       dependency or as an impact claim. The current graph does not
 *       contain explicit dependency edges.
 */

import type { Application, Platform, AssignmentGroup } from "@/types";
import {
  applications,
  assignmentGroups,
  getApp,
  platforms,
  isTbd,
} from "@/lib/data";

/** How we describe a relationship's evidence level in the UI. */
export type RelationshipEvidence = "declared" | "derived" | "not_declared";

/** A responsibility field with either a real declared value or a truthful gap. */
export type Field<T = string> =
  | { present: true; value: T; evidence: "declared" }
  | { present: false; note: "not_declared" | "tbd"; evidence: "not_declared" };

export interface OperationalConnection {
  id: string; // canonical id (ag_id or platform_id) — secondary
  name: string; // human-readable label — primary
  meta?: string; // e.g. "3 apps" or platform tier
  evidence: RelationshipEvidence; // always "declared" for AGs and platforms in the semantic layer
}

/**
 * A related application reached indirectly through a shared support group or
 * a shared platform. Never labeled "dependency" or "impact".
 */
export interface RelatedApplication {
  app_id: string;
  name: string;
  reason: {
    kind: "shared_assignment_group" | "shared_platform";
    /** Human-readable name of the shared entity. */
    shared: string;
  };
  evidence: "derived";
}

export interface BlastRadiusBrief {
  application: {
    app_id: string;
    name: string;
    apm: string | null;
    criticality: Application["criticality"];
  };
  business: {
    sectors: string[];
    program: Field;
    process: Field;
  };
  responsibility: {
    business_owner: Field;
    technical_owner: Field;
    dpm: Field;
    dpm_l3: Field;
  };
  operational: {
    assignment_groups: OperationalConnection[];
    platforms: OperationalConnection[];
    assignment_groups_total: number;
    platforms_total: number;
  };
  related_applications: {
    /** Bounded set of derived-connection candidates. */
    items: RelatedApplication[];
    /** Total distinct derived connections identified before capping. */
    total: number;
    /** Sources actually used to derive the set. */
    derived_from: Array<"shared_assignment_group" | "shared_platform">;
  };
  limitations: string[];
  routes: {
    /** Canonical route to the full application record. */
    view_application: string;
    /** Canonical route to the application-centered relationship graph. */
    view_relationship_graph: string;
  };
}

const AG_CAP = 8;
const PLATFORM_CAP = 6;
const RELATED_CAP = 6;

function fieldFrom(value: string | null | undefined): Field {
  if (value == null) return { present: false, note: "not_declared", evidence: "not_declared" };
  const t = value.trim();
  if (!t) return { present: false, note: "not_declared", evidence: "not_declared" };
  if (isTbd(t)) return { present: false, note: "tbd", evidence: "not_declared" };
  return { present: true, value: t, evidence: "declared" };
}

/** Same canonical normalizer used by the rest of the repo. */
export function agKey(s: unknown): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function findAgByName(name: string): AssignmentGroup | undefined {
  const key = agKey(name);
  return assignmentGroups.find((g) => g.ag_key === key);
}

function findPlatformByName(name: string): Platform | undefined {
  return platforms.find((p) => p.name === name);
}

/**
 * Build the Relationship Brief for a given app_id. Returns null when the
 * application is not in the semantic layer — the caller renders an empty /
 * select-an-application state.
 */
export function buildBlastRadiusBrief(appId: string): BlastRadiusBrief | null {
  const app = getApp(appId);
  if (!app) return null;

  // Operational connections — Assignment Groups.
  const ags = app.ags
    .map((name) => {
      const g = findAgByName(name);
      return {
        id: g?.ag_id ?? agKey(name),
        name,
        meta: g ? `${g.app_count} app${g.app_count === 1 ? "" : "s"}${g.has_quality ? " · Q" : ""}` : undefined,
        evidence: "declared" as const,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Operational connections — Platforms.
  const plats = app.platforms
    .map((name) => {
      const p = findPlatformByName(name);
      return {
        id: p?.platform_id ?? name,
        name,
        meta: p ? `${p.blast_radius_direct} app${p.blast_radius_direct === 1 ? "" : "s"} · ${p.tier}` : undefined,
        evidence: "declared" as const,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Related applications via shared Assignment Group or shared Platform.
  // Deduplicate by app_id; when the same app appears via multiple sources,
  // keep the first source encountered (AG > platform, alphabetical within).
  const related = new Map<string, RelatedApplication>();

  for (const g of assignmentGroups.filter((x) => app.ags.some((n) => agKey(n) === x.ag_key))) {
    for (const otherId of g.app_ids) {
      if (otherId === app.app_id) continue;
      if (related.has(otherId)) continue;
      const other = getApp(otherId);
      if (!other) continue;
      related.set(otherId, {
        app_id: other.app_id,
        name: other.name,
        reason: { kind: "shared_assignment_group", shared: g.name },
        evidence: "derived",
      });
    }
  }

  for (const p of platforms.filter((x) => app.platforms.includes(x.name))) {
    for (const otherId of p.app_ids) {
      if (otherId === app.app_id) continue;
      if (related.has(otherId)) continue;
      const other = getApp(otherId);
      if (!other) continue;
      related.set(otherId, {
        app_id: other.app_id,
        name: other.name,
        reason: { kind: "shared_platform", shared: p.name },
        evidence: "derived",
      });
    }
  }

  const derived_from: Array<"shared_assignment_group" | "shared_platform"> = [];
  if (app.ags.length > 0) derived_from.push("shared_assignment_group");
  if (app.platforms.length > 0) derived_from.push("shared_platform");

  const relatedSorted = [...related.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    application: {
      app_id: app.app_id,
      name: app.name,
      apm: app.apm ?? null,
      criticality: app.criticality,
    },
    business: {
      sectors: app.sectors,
      program: fieldFrom(app.program),
      process: fieldFrom(app.process),
    },
    responsibility: {
      business_owner: fieldFrom(app.owner),
      technical_owner: fieldFrom(app.tech_lead),
      dpm: fieldFrom(app.dpm),
      dpm_l3: fieldFrom(app.dpm_l3),
    },
    operational: {
      assignment_groups: ags.slice(0, AG_CAP),
      platforms: plats.slice(0, PLATFORM_CAP),
      assignment_groups_total: ags.length,
      platforms_total: plats.length,
    },
    related_applications: {
      items: relatedSorted.slice(0, RELATED_CAP),
      total: relatedSorted.length,
      derived_from,
    },
    limitations: [
      "A shared support group or a shared platform is a connection, not a dependency.",
      "This brief lists known connections, not impact.",
      "The Operational Graph does not currently contain explicit application-to-application dependency edges.",
      "Business impact is not established solely from operational connections.",
    ],
    routes: {
      view_application: `/app/${app.app_id}`,
      view_relationship_graph: `/app/${app.app_id}#relationship-graph`,
    },
  };
}

/** Helper for the "no application selected" state to point users somewhere useful. */
export function browseApplicationsHref(): string {
  return "/portfolio";
}

/** All application id/name pairs, useful for a small search inside the drawer. */
export interface AppOption {
  app_id: string;
  name: string;
}
export function listApplications(): AppOption[] {
  return applications
    .map((a) => ({ app_id: a.app_id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
