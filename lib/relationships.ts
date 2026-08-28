/**
 * Modelo de relaciones del grafo operativo. Capa analitica, sin interfaz.
 *
 * Dos capas separadas a proposito:
 *
 *   1. RUTEO DE RELACIONES   computable hoy desde el grafo de aplicaciones.
 *                            Responde si la relacion de soporte declarada
 *                            produce una ruta unica, compartida, o ninguna.
 *
 *   2. ATRIBUCION DE INCIDENTES   exige evidencia incidente-a-aplicacion que el
 *                            modelo cargado NO tiene. Se declara no disponible
 *                            con la lista de lo que falta. No se sustituye con
 *                            la capa 1.
 *
 * La cifra del business case vive aparte, etiquetada como baseline, y no se
 * mezcla nunca con lo medido sobre el corpus cargado.
 */
import { applications, assignmentGroups, platforms, UNIVERSE } from "./data";
import type {
  ApplicationRelationshipState, EvidenceItem, GroupTopology,
  IncidentAttributionLayer, Measured, PlatformTopology, ReconciliationItem,
  RelationshipCoverage, RelationshipType, SignalInventoryRow, SupportRouteState,
} from "@/types/relationships";

/** Normalizador canonico de Assignment Group. El mismo del proyector y del worker. */
export const agKey = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const isSet = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim().toUpperCase() !== "TBD";

/* ================================================================== */
/* Topologia de grupos de soporte                                     */
/* ================================================================== */

/** Indice clave-canonica -> aplicaciones servidas, construido desde las apps. */
const groupIndex: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const a of applications) {
    for (const g of a.ags) {
      const k = agKey(g);
      if (!k) continue;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(a.app_id);
    }
  }
  return m;
})();

/** Nombre legible por clave: el primero que aparece en el modelo. */
const groupName: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const a of applications) for (const g of a.ags) if (!m.has(agKey(g))) m.set(agKey(g), g);
  for (const g of assignmentGroups) if (!m.has(g.ag_key)) m.set(g.ag_key, g.name);
  return m;
})();

export const groupTopology: GroupTopology[] = [...groupIndex.entries()]
  .map(([key, ids]) => ({
    key,
    name: groupName.get(key) ?? key,
    appIds: [...ids],
    appCount: ids.size,
    isShared: ids.size > 1,
  }))
  .sort((a, b) => b.appCount - a.appCount);

/* ================================================================== */
/* Estado de relacion por aplicacion                                  */
/* ================================================================== */

function routeState(exclusive: string[], keys: string[]): SupportRouteState {
  if (keys.length === 0) return "no_declared_support_route";
  return exclusive.length > 0 ? "unique_support_route" : "shared_support_route";
}

export const applicationStates: ApplicationRelationshipState[] = applications.map((a) => {
  const keys = a.ags.map(agKey).filter(Boolean);
  const exclusive = keys.filter((k) => (groupIndex.get(k)?.size ?? 0) === 1);
  const maxContenders = keys.length
    ? Math.max(...keys.map((k) => groupIndex.get(k)?.size ?? 0))
    : 0;

  const missing: RelationshipType[] = [];
  if (a.platforms.length === 0) missing.push("application->platform");
  if (keys.length === 0) missing.push("application->support_group");
  if (!isSet(a.process)) missing.push("application->business_process");
  if (!isSet(a.dpm) && !isSet(a.owner) && !isSet(a.tech_lead)) missing.push("application->owner");

  const provenance: EvidenceItem[] = [];
  if (a.platforms.length) {
    provenance.push({
      source: "semantic layer · applications[].platforms",
      method: "declared",
      strength: a.platform_evidence_tier === "E2" ? "strong" : "moderate",
      detail: `evidence tier ${a.platform_evidence_tier ?? "not declared"}`,
    });
  }
  if (keys.length) {
    provenance.push({
      source: "semantic layer · applications[].ags",
      method: `declared via ${a.ag_source_kind ?? "unknown source"}`,
      strength: a.ag_evidence_tier === "E2" ? "strong" : "moderate",
      detail: `evidence tier ${a.ag_evidence_tier ?? "not declared"}`,
    });
  }

  return {
    appId: a.app_id,
    name: a.name,
    apm: isSet(a.apm) ? a.apm : null,
    platforms: a.platforms,
    supportGroups: a.ags,
    supportGroupKeys: keys,
    supportRoute: routeState(exclusive, keys),
    exclusiveGroups: exclusive.map((k) => groupName.get(k) ?? k),
    maxContenders,
    missingRelationshipTypes: missing,
    declaredOwners: {
      dpm: isSet(a.dpm) ? a.dpm : null,
      owner: isSet(a.owner) ? a.owner : null,
      techLead: isSet(a.tech_lead) ? a.tech_lead : null,
    },
    provenance,
  };
});

const countRoute = (s: SupportRouteState) =>
  applicationStates.filter((x) => x.supportRoute === s).length;

/**
 * Particion del portafolio por estado de ruta de soporte declarada.
 *
 * Se llama supportRoutePartition y no "determinismo de atribucion" a proposito.
 * Lo que prueba es: si la relacion de soporte declarada, por si sola, alcanza
 * para identificar una aplicacion. No prueba que un incidente concreto no pueda
 * atribuirse por otra via.
 */
export const supportRoutePartition: {
  unique: Measured<number>;
  shared: Measured<number>;
  none: Measured<number>;
} = {
  unique: {
    value: countRoute("unique_support_route"),
    origin: "measured",
    source: "semantic layer · applications[].ags",
    denominator: UNIVERSE,
    calculation: "applications holding at least one support group served by no other application",
  },
  shared: {
    value: countRoute("shared_support_route"),
    origin: "measured",
    source: "semantic layer · applications[].ags",
    denominator: UNIVERSE,
    calculation: "applications whose every support group is also served by another application",
  },
  none: {
    value: countRoute("no_declared_support_route"),
    origin: "measured",
    source: "semantic layer · applications[].ags",
    denominator: UNIVERSE,
    calculation: "applications declaring no support group",
  },
};

/* ================================================================== */
/* Topologia de plataforma · exposicion directa y de segundo orden    */
/* ================================================================== */

const TRAVERSAL =
  "platform -> applications declaring it -> the support groups those applications declare -> " +
  "every application those groups serve. One hop through shared responders. Unweighted, " +
  "undirected, no transitive closure beyond the single hop.";

export const platformTopology: PlatformTopology[] = platforms
  .map((p) => {
    const direct = new Set(p.app_ids);
    const bridging = new Set<string>();
    for (const a of applications) {
      if (!direct.has(a.app_id)) continue;
      for (const g of a.ags) if (agKey(g)) bridging.add(agKey(g));
    }
    const reachable = new Set<string>();
    for (const k of bridging) for (const id of groupIndex.get(k) ?? []) reachable.add(id);
    const second = [...reachable].filter((id) => !direct.has(id));
    return {
      name: p.name,
      directAppIds: [...direct],
      bridgingGroupKeys: [...bridging],
      secondOrderAppIds: second,
      traversal: TRAVERSAL,
    };
  })
  .sort((a, b) => b.directAppIds.length - a.directAppIds.length);

export const platformByName = new Map(platformTopology.map((p) => [p.name, p]));

/* ================================================================== */
/* Cobertura por tipo de relacion                                     */
/* ================================================================== */

export const relationshipCoverage: RelationshipCoverage[] = [
  {
    type: "application->platform",
    known: applications.filter((a) => a.platforms.length > 0).length,
    missing: applications.filter((a) => a.platforms.length === 0).length,
    derived: 0,
    universe: UNIVERSE,
    blocks: ["blast radius", "second-order exposure", "technology consolidation"],
  },
  {
    type: "application->support_group",
    known: applications.filter((a) => a.ags.length > 0).length,
    missing: applications.filter((a) => a.ags.length === 0).length,
    derived: 0,
    universe: UNIVERSE,
    blocks: ["routing", "incident attribution through the bridge", "responder exposure"],
  },
  {
    type: "application->business_process",
    known: applications.filter((a) => isSet(a.process)).length,
    missing: applications.filter((a) => !isSet(a.process)).length,
    derived: 0,
    universe: UNIVERSE,
    blocks: ["business impact of a platform failure", "process exposure"],
  },
  {
    type: "application->owner",
    known: applications.filter((a) => isSet(a.dpm) || isSet(a.owner) || isSet(a.tech_lead)).length,
    missing: applications.filter((a) => !isSet(a.dpm) && !isSet(a.owner) && !isSet(a.tech_lead)).length,
    derived: 0,
    universe: UNIVERSE,
    blocks: ["who confirms a missing relationship", "escalation"],
  },
];

/* ================================================================== */
/* Capa 2 · atribucion de incidentes: NO disponible                   */
/* ================================================================== */

export const incidentAttribution: IncidentAttributionLayer = {
  available: false,
  ambiguousShare: {
    value: null,
    origin: "unavailable",
    source: "—",
    calculation: "requires one row per incident carrying its Business Application attribution",
    missingEvidence: ["Incident -> Business Application attribution at incident grain"],
  },
  medianTimeToResolve: {
    value: null,
    origin: "unavailable",
    source: "—",
    calculation: "not derived from Closed At under any circumstance (invariant QN13)",
    missingEvidence: ["opened_at", "resolved_at", "priority at incident grain", "channel"],
  },
  missingEvidence: [
    "Incident -> Business Application attribution source",
    "opened_at",
    "resolved_at / closed_at pair",
    "priority at incident grain",
    "channel",
    "Configuration Item relationship",
  ],
  unlocks: [
    "How often is Business Application attribution ambiguous in practice",
    "Whether ambiguous attribution is associated with slower resolution, controlling for priority and channel",
    "Which evidence produced each attribution",
    "Per-application incident history",
  ],
};

/* ================================================================== */
/* Baseline del business case · NUNCA se mezcla con lo medido         */
/* ================================================================== */

export const businessCaseBaseline: Record<string, Measured<number>> = {
  applications: { value: 504, origin: "business_case_baseline", source: "business case" },
  multiPlatform: { value: 156, origin: "business_case_baseline", source: "business case" },
  multiSupportGroup: { value: 123, origin: "business_case_baseline", source: "business case" },
  noDeclaredRelationship: { value: 187, origin: "business_case_baseline", source: "business case" },
  incidents: { value: 59963, origin: "business_case_baseline", source: "business case · 1.88 years" },
  ambiguousAttributionPct: { value: 33.7, origin: "business_case_baseline", source: "business case" },
  mttrSingleHours: { value: 15.9, origin: "business_case_baseline", source: "business case · dominant priority tier" },
  mttrAmbiguousHours: { value: 32.5, origin: "business_case_baseline", source: "business case · dominant priority tier" },
  teradataDirect: { value: 30, origin: "business_case_baseline", source: "business case" },
  teradataExposed: { value: 186, origin: "business_case_baseline", source: "business case" },
  powerBiDirect: { value: 129, origin: "business_case_baseline", source: "business case" },
  powerBiExposed: { value: 242, origin: "business_case_baseline", source: "business case" },
  databricksDirect: { value: 18, origin: "business_case_baseline", source: "business case" },
  databricksExposed: { value: 148, origin: "business_case_baseline", source: "business case" },
};

/* ================================================================== */
/* Reconciliacion · se preserva el desacuerdo, no se elige ganador    */
/* ================================================================== */

const multiPlatform = applications.filter((a) => a.platforms.length > 1).length;
const multiGroup = applications.filter((a) => new Set(a.ags.map(agKey)).size > 1).length;
const noRelationship = applications.filter((a) => a.platforms.length === 0 && a.ags.length === 0).length;

function exposure(name: string) {
  const t = platformByName.get(name);
  return t ? { direct: t.directAppIds.length, second: t.secondOrderAppIds.length } : null;
}

export const reconciliation: ReconciliationItem[] = [
  {
    claim: "Applications in the portfolio",
    businessCase: 504, measured: UNIVERSE,
    state: UNIVERSE === 504 ? "matches" : "diverges",
    note: "Same universe and same cut-off.",
  },
  {
    claim: "Applications on more than one platform",
    businessCase: 156, measured: multiPlatform,
    state: multiPlatform === 156 ? "matches" : "diverges",
    note: "Counted over applications[].platforms.",
  },
  {
    claim: "Applications with no declared relationship",
    businessCase: 187, measured: noRelationship,
    state: noRelationship === 187 ? "matches" : "diverges",
    note: "Definition recovered from the match: neither platform nor support group declared.",
  },
  {
    claim: "Applications with more than one support group",
    businessCase: 123, measured: multiGroup,
    state: multiGroup === 123 ? "matches" : "diverges",
    note:
      "Unreconciled. The model yields 113 from the Application -> Assignment Group bridge, all " +
      "from source kind 'bridge', with no collapse under canonical normalization (113 raw = 113 " +
      "canonical). The 10-application difference is not explained by normalization, filtering or " +
      "denominator. Candidate causes not testable here: a different extract date, or a support " +
      "relationship the semantic layer does not carry (for example an inventory column capped at " +
      "10 entries). Both figures are preserved with provenance; neither is treated as correct.",
  },
  ...(["TERADATA", "POWER_BI", "DATABRICKS"] as const).flatMap((n) => {
    const e = exposure(n);
    const bc: Record<string, [number, number]> = {
      TERADATA: [30, 186], POWER_BI: [129, 242], DATABRICKS: [18, 148],
    };
    if (!e) return [];
    return [
      {
        claim: `${n} · direct exposure`,
        businessCase: bc[n][0], measured: e.direct,
        state: (e.direct === bc[n][0] ? "matches" : "diverges") as ReconciliationItem["state"],
        note: "Applications declaring the platform. Declared relationship, no traversal.",
      },
      {
        /* Se compara alcance TOTAL contra la cifra 'exposed' del business case,
           que es la lectura like-for-like: el segundo orden solo (sin las
           directas) no es lo mismo que la exposicion total y compararlos seria
           un error de denominador. */
        claim: `${n} · total reach (direct + second-order)`,
        businessCase: bc[n][1], measured: e.direct + e.second,
        state: "diverges" as ReconciliationItem["state"],
        note:
          `Measured ${e.direct + e.second} (${e.direct} direct + ${e.second} second-order) against ` +
          `${bc[n][1]}. The residual is exactly ${bc[n][1] - (e.direct + e.second)} here, and it is ` +
          "the same constant across all three platforms the business case documents. A constant " +
          "offset points at a definitional difference — most likely two applications the " +
          "business-case traversal reaches through a relationship this model does not carry — " +
          "not at a broken traversal. Until that definition is documented this is NOT reported as " +
          "reconciled. Measured value uses: " + TRAVERSAL,
      },
    ];
  }),
  {
    claim: "Incidents in the measured population",
    businessCase: 59963, measured: null,
    state: "not_computable",
    note:
      "The semantic layer carries tickets_2024 for 83 applications summing to 31,193. Different " +
      "population, different window. Not comparable.",
  },
  {
    claim: "Ambiguous Business Application attribution",
    businessCase: 33.7, measured: null,
    state: "not_computable",
    note:
      "meta.incident_link.available = false. No incident reaches the model carrying an application " +
      "attribution. The support-route partition is NOT a substitute for this measure.",
  },
  {
    claim: "Median time to resolve, by attribution state",
    businessCase: 16.6, measured: null,
    state: "not_computable",
    note:
      "No opened_at exists in any sheet of any loaded dataset. Invariant QN13 blocks derivation " +
      "from Closed At. Requires an incident-grain extract.",
  },
];

/* ================================================================== */
/* Inventario de senales para descubrimiento de relaciones            */
/* ================================================================== */

/**
 * Matriz del paso 25. Lo que aparece aqui esta verificado contra los datos
 * cargados; las coberturas medidas viven en scripts/relationship-report.mjs.
 */
export const signalInventory: SignalInventoryRow[] = [
  {
    relationship: "application->platform",
    availableSignals: ["applications[].platforms (declared)", "technology_raw free text", "platform_evidence_tier"],
    deterministicPath: "declared on the application record",
    alternativePaths: ["technology_raw -> keyword normalization (this is how E3 links were produced)"],
    aiMethod: "entity resolution over technology_raw variants; embedding similarity against platform names",
    strength: "authoritative",
    validatableToday: true,
    missingData: ["CMDB CI -> platform for the 264 applications with no declared platform"],
  },
  {
    relationship: "application->support_group",
    availableSignals: ["applications[].ags (declared, bridge)", "assignment_groups[].app_ids", "ag_source_kind", "QN corpus Assignment Group at ticket grain"],
    deterministicPath: "Application -> Assignment Group bridge",
    alternativePaths: [
      "operational history: which group actually resolves tickets naming the application",
      "process + sector neighbourhood: applications sharing both often share responders",
    ],
    aiMethod: "historical co-occurrence frequency; graph neighbourhood similarity",
    strength: "strong",
    validatableToday: true,
    missingData: ["ticket -> application attribution, which is what would let history confirm the link"],
  },
  {
    relationship: "incident->application",
    availableSignals: ["Assignment Group (100% populated)", "Service Offering (100% populated)", "Short Description", "Category"],
    deterministicPath: null,
    alternativePaths: [
      "Incident -> Assignment Group -> supported applications (73.4% of sampled tickets join; 61.3% of those reach exactly one application)",
      "Incident -> Service Offering -> application by exact name after stripping the ' - SO' suffix (6.4% of sampled tickets, unique whenever it fires)",
      "Incident -> Short Description -> application name tokens (74.2% produce a token, but 90% of those are multi-candidate)",
    ],
    aiMethod: "entity extraction over Short Description; retrieval against confirmed cases; classifier trained on tickets whose group resolves uniquely",
    strength: "moderate",
    validatableToday: false,
    missingData: ["Business Application on the ticket", "Configuration Item", "opened_at"],
  },
  {
    relationship: "application->business_process",
    availableSignals: ["applications[].process (97.4% populated, 9 distinct values)", "assignment_groups[].processes"],
    deterministicPath: "declared on the application record",
    alternativePaths: ["Application -> support group -> the processes that group serves"],
    aiMethod: "not warranted: coverage is already 97.4% and the vocabulary is 9 values",
    strength: "authoritative",
    validatableToday: true,
    missingData: [],
  },
  {
    relationship: "application->owner",
    availableSignals: ["dpm (76.0%)", "dpm_l3 (56.5%)", "owner (47.2%)", "tech_lead (54.4%)", "assignment_groups[].dpms"],
    deterministicPath: "declared on the application record",
    alternativePaths: ["Application -> support group -> the DPMs that group reports"],
    aiMethod: "none. Inferring a named accountable person from behaviour is not acceptable here.",
    strength: "authoritative",
    validatableToday: true,
    missingData: ["an owner for the applications declaring none of the four fields"],
  },
  {
    relationship: "platform->application",
    availableSignals: ["platforms[].app_ids (declared)", "the support-group bridge for second-order reach"],
    deterministicPath: "declared, inverse of application -> platform",
    alternativePaths: ["one-hop traversal through shared support groups for second-order exposure"],
    aiMethod: "none needed; the traversal is deterministic",
    strength: "authoritative",
    validatableToday: true,
    missingData: ["documented traversal semantics behind the business-case second-order figures"],
  },
];
