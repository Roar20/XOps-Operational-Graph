import { tool } from "ai";
import { z } from "zod";

/* La capa semantica si viaja en el build: es el inventario de aplicaciones y no
   depende de ningun libro subido. El corpus QN NO: vive en el navegador de
   quien lo carga, por lo tanto toda herramienta que lo lea se resuelve en el
   cliente. Asi no hay un JSON pregenerado que pueda quedar desincronizado con
   el libro que el usuario tiene enfrente. */
import graph from "@/data/xops-operational-graph-data.json";

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ------------------------------------------------------------------ */
/* Herramientas de servidor: solo la capa semantica del inventario     */
/* ------------------------------------------------------------------ */

export const serverTools = {
  application_context: tool({
    description:
      "Business context for an application from the semantic layer: sector, " +
      "process, platform, DPM, criticality, assignment groups. Evidence tier E1 " +
      "where CMDB-sourced. This does not depend on the loaded corpus.",
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

  semantic_layer_coverage: tool({
    description:
      "Declared gaps of the semantic layer: the four chain links with their " +
      "denominators, and the Assignment Group bridge coverage. Use this when the " +
      "user asks what is missing from the application model.",
    inputSchema: z.object({}),
    execute: async () => {
      const g = graph as any;
      return {
        as_of: g.meta.as_of,
        universe_apps: g.meta.universe_apps,
        chain_links: g.coverage,
        ag_bridge: g.quality?.meta?.join_coverage ?? null,
        incident_link: g.meta.incident_link,
        blocked_measures: [
          { id: "MTTR", reason: "no opened_at in the QN corpus, only Closed At" },
          { id: "REASSIGNMENT", reason: "field absent" },
          { id: "DECALOGUE_SERIES", reason: "classifier v1/v2 not calibrated" },
        ],
        excluded_by_decision: {
          per_agent_quality:
            "User_By_Agent is out of the projector. HR and Legal decision pending.",
        },
      };
    },
  }),
};

/* ------------------------------------------------------------------ */
/* Herramientas de cliente: sin execute, se resuelven en el navegador  */
/* contra el corpus cargado en IndexedDB.                              */
/* ------------------------------------------------------------------ */

export const clientTools = {
  corpus_status: tool({
    description:
      "Report whether a corpus is loaded in the browser, which cut-off it is, " +
      "whether the workbook passed validation, the declared population, and which " +
      "datasets are full corpus versus sample. Call this first when any other " +
      "corpus tool returns empty.",
    inputSchema: z.object({}),
  }),

  corpus_summary: tool({
    description:
      "Population, quality distribution, compliance KPI and the dual axis for the " +
      "loaded corpus, read from its aggregate sheets. Every figure comes back with " +
      "its source sheet and whether it describes the full corpus or a sample.",
    inputSchema: z.object({}),
  }),

  assignment_group_profile: tool({
    description:
      "Volume and quality profile for one assignment group, from the aggregate " +
      "sheets of the loaded corpus. Matches on a normalized key, so casing and " +
      "punctuation do not matter. These are population figures when User_By_Group " +
      "covers the corpus.",
    inputSchema: z.object({
      name: z.string().describe("Assignment group name, full or partial"),
      limit: z.number().int().min(1).max(25).default(10),
    }),
  }),

  decalogue_breakdown: tool({
    description:
      "Decalogue pattern counts for the loaded cut-off, plus the v1/v2 classifier " +
      "A/B validation. Returns two DIFFERENT measures: classified incidents and " +
      "code occurrences. Occurrences exceed incidents because one incident may " +
      "carry several codes. Never present occurrences as a population. Never build " +
      "a series across cut-offs from this.",
    inputSchema: z.object({}),
  }),

  lookup_ticket: tool({
    description:
      "Look up one incident by its number in the corpus loaded in the browser. " +
      "Returns quality scores, decalogue codes and the assignment group. Business " +
      "context must then be fetched with application_context and labelled derived.",
    inputSchema: z.object({
      number: z.string().describe("Incident number, INC followed by digits"),
    }),
  }),

  search_tickets: tool({
    description:
      "Search incidents in the loaded detail by assignment group, label, " +
      "compliance class, decalogue code, ops classification or a substring of the " +
      "short description. Detail may be a sample: the result declares its scope, " +
      "and a count over a sample is not a population figure.",
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
      "Top repeated short descriptions in the loaded detail, with volume and how " +
      "many assignment groups they touch. Computed over the rows loaded in this " +
      "browser: if the detail sheet is a sample, so is this ranking, and the " +
      "result says so.",
    inputSchema: z.object({
      grain: z.enum(["user", "alert"]).default("alert"),
      assignment_group: z.string().optional(),
      top: z.number().int().min(1).max(50).default(15),
    }),
  }),
};

export const allTools = { ...serverTools, ...clientTools };
