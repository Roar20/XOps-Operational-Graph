import { tool } from "ai";
import { z } from "zod";

// Agregados verificados en build. Viven en el repo, por lo tanto el servidor
// los puede leer y el modelo los recibe ya filtrados.
import aggregates from "@/data/QN_v242_aggregates.json";
import graph from "@/data/xops-operational-graph-data.json";

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const AS_OF = "2026-08-12";
const INSTRUMENT = "QN Work Notes Quality Analyzer v2.4.2";

/* ------------------------------------------------------------------ */
/* Herramientas de servidor: leen agregados del repo                   */
/* ------------------------------------------------------------------ */

export const serverTools = {
  corpus_summary: tool({
    description:
      "Population, quality distribution, compliance KPIs and alert classification " +
      "for the whole corpus. Use this before any question about totals.",
    inputSchema: z.object({}),
    execute: async () => ({
      as_of: AS_OF,
      instrument: INSTRUMENT,
      overview: aggregates.overview,
      dual_axis: aggregates.dual_axis,
      blocked: ["MTTR", "SLA attainment", "backlog age", "reassignment count"],
    }),
  }),

  assignment_group_profile: tool({
    description:
      "Volume and quality profile for one assignment group, from the aggregate " +
      "sheets. Matches on a normalized key, so casing and punctuation do not matter.",
    inputSchema: z.object({
      name: z.string().describe("Assignment group name, full or partial"),
    }),
    execute: async ({ name }) => {
      const k = norm(name);
      const pick = <T extends { [x: string]: any }>(rows: T[], col: string) =>
        rows.filter((r) => norm(String(r[col] ?? "")).includes(k));

      const user = pick(aggregates.user_by_group as any[], "Assignment Group");
      const alert = pick(aggregates.alert_by_group as any[], "Assignment Group");
      const deca = pick(aggregates.decalogue_by_group as any[], "Assignment Group");

      if (!user.length && !alert.length) {
        return { found: false, query: name, note: "No assignment group matches this key." };
      }
      return {
        found: true,
        as_of: AS_OF,
        evidence_tier: "E2",
        user_incidents: user,
        alerts: alert,
        decalogue: deca.slice(0, 20),
        in_semantic_model: (graph as any).assignment_groups.some(
          (g: any) => g.ag_key === norm(user[0]?.["Assignment Group"] ?? name)
        ),
      };
    },
  }),

  decalogue_breakdown: tool({
    description:
      "Decalogue pattern counts for a single cut-off, plus the v1/v2 classifier " +
      "A/B validation. Never use this to build a series across cut-offs.",
    inputSchema: z.object({}),
    execute: async () => ({
      as_of: AS_OF,
      classifier_versions_present: ["v1", "v2"],
      cross_cut_comparability: "BLOCKED",
      comparability_reason:
        "v1 and v2 agree on the primary code in 6.5% of incidents. D01 +640.2%, D05 -49.0%.",
      by_decalogue: aggregates.by_decalogue,
      validation: aggregates.decalogue_validation,
    }),
  }),

  application_context: tool({
    description:
      "Business context for an application from the semantic layer: sector, " +
      "process, platform, DPM, criticality, assignment groups. Evidence tier E1 " +
      "where CMDB-sourced.",
    inputSchema: z.object({
      query: z.string().describe("Application name, APM id or app_id"),
    }),
    execute: async ({ query }) => {
      const k = norm(query);
      const hits = (graph as any).applications
        .filter(
          (a: any) =>
            norm(a.name).includes(k) ||
            norm(a.apm ?? "").includes(k) ||
            norm(a.app_id ?? "").includes(k)
        )
        .slice(0, 8);
      return hits.length
        ? { found: true, evidence_tier: "E1", count: hits.length, applications: hits }
        : { found: false, query, note: "No application matches. Do not guess one." };
    },
  }),

  coverage_and_gaps: tool({
    description:
      "Declared gaps: bridge coverage, DPM TBD, applications without criticality, " +
      "and the blocked-measure register. Use this whenever the user asks what is missing.",
    inputSchema: z.object({}),
    execute: async () => ({
      as_of: AS_OF,
      ag_bridge_coverage: {
        model_canonical_keys: 265,
        user_detail: { keys: 987, matched: 223, matched_pct: 22.6, volume_pct: 61.8 },
        alert_detail: { keys: 315, matched: 152, matched_pct: 48.3, volume_pct: 84.7 },
        note:
          "987 raw names produce 987 canonical keys in User_Detail, so the normalizer " +
          "collapses nothing and 22.6% is not understated.",
      },
      service_offering_link: {
        distinct_user: 3356,
        exact_match_to_application_pct: 4.7,
        exact_match_to_apm_pct: 0,
        verdict: "does not resolve incident -> application",
      },
      blocked_measures: [
        { id: "MTTR", reason: "no opened_at in the corpus, only Closed At" },
        { id: "REASSIGNMENT", reason: "field absent" },
        { id: "DECALOGUE_SERIES", reason: "classifier v1/v2 not calibrated" },
      ],
      excluded_by_decision: {
        per_agent_quality:
          "User_By_Agent is absent from the projector. HR and Legal decision pending.",
      },
      coverage: (graph as any).coverage ?? null,
    }),
  }),
};

/* ------------------------------------------------------------------ */
/* Herramientas de cliente: sin execute, se resuelven en el navegador  */
/* contra IndexedDB. Es la única forma de tocar las 719,946 filas.     */
/* ------------------------------------------------------------------ */

export const clientTools = {
  lookup_ticket: tool({
    description:
      "Look up one incident by its number, for example INC08178653, in the corpus " +
      "loaded in the user's browser. Returns quality scores, decalogue codes and " +
      "the assignment group. Business context must then be fetched with " +
      "application_context, and labelled as derived.",
    inputSchema: z.object({
      number: z.string().describe("Incident number, INC followed by digits"),
    }),
    // sin execute: se ejecuta en el cliente
  }),

  search_tickets: tool({
    description:
      "Search incidents in the loaded corpus by assignment group, label, " +
      "compliance class, decalogue code, ops classification or a substring of the " +
      "short description. Returns a capped sample plus the true match count, so " +
      "the count is the figure you report and the sample is only illustration.",
    inputSchema: z.object({
      assignment_group: z.string().optional(),
      label: z.enum(["Excellent", "Good", "Poor", "Critical"]).optional(),
      compliance_class: z
        .enum(["DIAGNOSTICO", "SUSTANTIVO", "FORMAL_ONLY", "EMPTY"])
        .optional(),
      ops_classification: z.string().optional(),
      decalogue_code: z.string().optional(),
      text_contains: z.string().optional(),
      grain: z.enum(["user", "alert", "both"]).default("both"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
  }),

  recurring_signatures: tool({
    description:
      "Top repeated short descriptions in the loaded corpus, with volume, first " +
      "and last occurrence and how many assignment groups they touch. A signature " +
      "confined to one group and alive over twelve months is a suppression " +
      "candidate, not an incident.",
    inputSchema: z.object({
      grain: z.enum(["user", "alert"]).default("alert"),
      assignment_group: z.string().optional(),
      top: z.number().int().min(1).max(50).default(15),
    }),
  }),

  corpus_status: tool({
    description:
      "Report whether a corpus is loaded in the browser, which cut-off it is, " +
      "whether it passed manifest validation, and how many rows are indexed. " +
      "Call this first when any client tool returns empty.",
    inputSchema: z.object({}),
  }),
};

export const allTools = { ...serverTools, ...clientTools };
