// Contrato de datos de xops-operational-graph-data.json (POC v1).
// Las colecciones opcionales al final son los ganchos de extension declarados
// en la seccion 7 de la especificacion: agregarlas no obliga a rehacer pantallas.

export type Criticality = "C1" | "C2" | "C3" | "C-";
export type CriticalityWeight = 5 | 3 | 1 | 0;
export type EvidenceTier = "E1" | "E2" | "E3";
export type PlatformTier = "High" | "Medium" | "Low";

export interface Gates {
  attributable: boolean;
  routable: boolean;
  owned: boolean;
}

export interface Application {
  app_id: string;
  name: string;
  apm: string;
  category: string;
  scope_status: string;
  process: string;
  sector: string;
  criticality: Criticality;
  criticality_raw: string;
  criticality_weight: CriticalityWeight;
  dpm: string;
  dpm_l3: string;
  owner: string;
  tech_lead: string;
  platforms: string[];
  ags: string[];
  tickets_year: number | null;
  in_inventory: boolean;
  in_platform_scope: boolean;
  gates: Gates;
  is_ai_ml?: boolean;
  technology_raw?: string | null;
  /** R9: origen de la clasificacion de plataforma. E2 = analisis derivado, E3 = normalizacion de texto libre. */
  platform_evidence?: EvidenceTier | null;
  /** Extension v2 (seccion 7). Ausente en v1. */
  audience?: Audience | null;
}

export interface Platform {
  platform_id: string;
  name: string;
  tier: PlatformTier;
  is_legacy: boolean;
  is_ai_platform: boolean;
  blast_radius_direct: number;
  blast_radius_weighted: number;
  app_ids: string[];
  processes_affected: string[];
  sectors_affected: string[];
  programs_affected: string[];
  ags_reachable: string[];
  dpms_reachable: string[];
  criticality_mix: Partial<Record<Criticality, number>>;
  declared_reports: number;
  ai_ml_apps: number;
  routable_apps: number;
  routable_pct: number;
  quality_ag_keys: string[];
  quality_incidents: number;
}

export interface AssignmentGroup {
  ag_id: string;
  name: string;
  ag_key: string;
  has_quality: boolean;
  app_count: number;
  app_ids: string[];
  processes: string[];
  dpms: string[];
}

export interface CoverageLink {
  id: string;
  link: string;
  resolved: number;
  universe: number;
  coverage_pct: number;
  gap: number;
  evidence_tier: EvidenceTier;
  source: string;
  owner: string;
  /** Desglose por autoridad de evidencia (L1 mezcla E2 y E3). */
  breakdown?: { evidence_tier: EvidenceTier; resolved: number; source: string }[];
}

export interface ModelRule {
  id: string;
  title: string;
  statement: string;
  consequence?: string;
}

export interface Meta {
  as_of: string;
  universe_apps: number;
  scope_note: string;
  rules: ModelRule[];
  evidence_tiers: Record<EvidenceTier, string>;
  criticality_scale: Record<string, string>;
  /** Declaracion de alcance: eslabones fuera de v1. */
  out_of_scope?: string[];
  data_provenance?: string;
}

/* ---------------- Modulo de calidad de work notes ---------------- */

export type Granularity = "week" | "month" | "quarter" | "year";

export interface QualityPoint {
  period: string;
  incidents: number;
  diagnostic_rate: number;
  has_root_rate: number;
  has_res_rate: number;
  avg_score: number;
  poor_critical_rate: number;
  reopen_rate: number;
}

export type QualityMetricKey =
  | "diagnostic_rate"
  | "has_root_rate"
  | "has_res_rate"
  | "avg_score"
  | "poor_critical_rate"
  | "reopen_rate";

export interface BaselineMetric {
  key: QualityMetricKey;
  label: string;
  baseline: number;
  current: number;
  delta: number;
  unit: "pp" | "pts";
  /** R-delta: el color depende de este campo, nunca del signo. */
  direccion_deseada: "up" | "down";
}

export interface QualityAgRow {
  ag_key: string;
  name: string;
  incidents: number;
  diagnostic_rate: number;
  has_root_rate: number;
  avg_score: number;
  poor_rate: number;
}

export interface RecurrentPattern {
  pattern_id: string;
  pattern: string;
  count: number;
  example: string;
  ag_count: number;
  diagnostic_rate: number;
  first_seen: string;
  last_seen: string;
}

export interface DecalogoBucket {
  code: string;
  label: string;
  count: number;
}

export interface QualityBlock {
  scorer: string;
  corpus_eligible: number;
  corpus_total: number;
  eligibility_rule: {
    statement: string;
    excluded_states: string[];
    excluded_close_codes: string[];
    effect_note: string;
  };
  baseline_window: { from: string; to: string };
  current_window: { from: string; to: string };
  break_note: string;
  timeseries: Record<Granularity, QualityPoint[]>;
  baseline_metrics: BaselineMetric[];
  by_assignment_group: QualityAgRow[];
  ag_min_incidents: number;
  recurrent_patterns: RecurrentPattern[];
  decalogo: {
    coverage_pct: number;
    classified: number;
    universe: number;
    buckets: DecalogoBucket[];
  };
  band_divergence?: { band: string; qn_v242: number; binary_xlsx: number }[];
}

/* ---------------- Extension v2 (seccion 7): aun no poblada ---------------- */

export interface Audience {
  users: number;
  views: number;
}

export interface Dashboard {
  dashboard_id: string;
  name: string;
  workspace: string;
  app_ids: string[];
  users: number;
  views: number;
  active: boolean;
}

export interface GraphData {
  meta: Meta;
  applications: Application[];
  platforms: Platform[];
  assignment_groups: AssignmentGroup[];
  coverage: CoverageLink[];
  quality: QualityBlock;
  /** Extension v2. Ausente en v1; el codigo la trata como opcional. */
  dashboards?: Dashboard[];
}
