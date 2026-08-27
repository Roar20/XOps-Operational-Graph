/**
 * Contrato de datos de xops-operational-graph-data.json.
 * Se deriva de la capa semantica XOps_Operational_Graph_Semantic_Layer_v3.xlsx
 * mediante scripts/build_data.py. Si el JSON cambia de forma, el compilador
 * falla aqui y no en runtime.
 */

export type EvidenceTier = "E1" | "E2" | "E3" | "E2/E3";
export type Criticality = "C1" | "C2" | "C3" | "C-";
export type PlatformTier = "High" | "Medium" | "Low";
/** Direccion deseada de una metrica. El color del delta la lee a ella, no al signo. */
export type Direction = "up_is_good" | "down_is_good";

export interface Gates {
  attributable: boolean;
  routable: boolean;
  owned: boolean;
  platform_known: boolean;
}

export interface Application {
  app_id: string;
  name: string;
  apm: string;
  category: string;
  is_ai_ml: boolean;
  scope_status: string;
  process: string;
  sector: string;
  program: string;
  archetype: string;
  criticality: Criticality;
  criticality_raw: string;
  criticality_weight: 0 | 1 | 3 | 5;
  service_tier: string;
  support_window: string;
  user_base: string;
  financial_impact: string;
  dpm: string;
  dpm_l3: string;
  owner: string;
  tech_lead: string;
  /** Nombres de plataforma. La relacion es N:M y se resuelve por puente. */
  platforms: string[];
  platform_evidence_tier: Exclude<EvidenceTier, "E2/E3"> | null;
  technology_raw: string | null;
  /** Nombres de Assignment Group. 113 aplicaciones tienen mas de uno; una llega a 14. */
  ags: string[];
  ag_evidence_tier: Exclude<EvidenceTier, "E2/E3"> | null;
  ag_source_kind: "bridge" | "inventory" | null;
  declared_reports: number | null;
  tickets_2024: number | null;
  gates: Gates;
  has_quality: boolean;
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
  ai_ml_apps: number;
  processes_affected: string[];
  sectors_affected: string[];
  ags_reachable: string[];
  dpms_reachable: string[];
  criticality_mix: Record<Criticality, number>;
  routable_apps: number;
  routable_pct: number;
  declared_reports: number | null;
  quality_incidents: number | null;
  sheet_blast_radius_direct: number | null;
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
  owner: string;
  source: string;
  /** Solo L1: mezcla dos autoridades y se desglosa en lugar de promediarse. */
  breakdown?: { evidence_tier: EvidenceTier; resolved: number; source: string }[];
}

export interface Measure {
  measure_id: string;
  name: string;
  layer: string;
  grain: string;
  formula: string;
  denominator: string;
  coverage: string;
  evidence_tier: string;
  status: string;
  note: string;
}

/* ------------------------------- calidad de work notes ------------------------------- */

export type Granularity = "week" | "month" | "quarter" | "year";

export interface QualityPoint {
  period: string;
  incidents: number | null;
  diagnostic_rate: number | null;
  empty_rate: number | null;
  has_root_rate: number | null;
  has_res_rate: number | null;
  avg_score: number | null;
  poor_critical_rate: number | null;
  rca_marker_rate: number | null;
  reopen_rate: number | null;
}

export type QualityMetricKey = Exclude<keyof QualityPoint, "period">;

export interface BaselineMetric {
  key: string;
  baseline: number;
  current: number;
  delta: number;
  direccion_deseada: Direction;
  unit: "pp" | "pts";
}

export interface QualityAgRow {
  name: string;
  ag_key: string;
  incidents: number;
  diagnostic_rate: number;
  has_root_rate: number;
  avg_score: number;
  poor_rate: number;
}

export interface DecalogueRow {
  dcode: string;
  incidents: number;
  avg_score: number;
  diagnostic_rate: number;
  ags: number;
}

export interface RecurringPattern {
  sig: string;
  incidents: number;
  example: string;
  ags: number;
  top_ag: string;
  diagnostic_rate: number;
  avg_score: number;
  first_seen: string;
  last_seen: string;
}

export interface QualityBlock {
  meta: {
    corpus: string;
    as_of: string;
    universe_raw: number;
    eligible: number;
    eligible_pct: number;
    eligibility_rule: string;
    eligibility_effect: string;
    instrument: string;
    instrument_warning: string;
    band_divergence: { band: string; qn_v242: number; binary_xlsx: number }[];
    quality_rule: string;
    break_note: string;
    decalogue_coverage_pct: number;
    join_note: string;
    baseline_window: [string, string];
    current_window: [string, string];
    join_coverage: {
      ags_matched: number;
      ags_bridge: number;
      ags_quality: number;
      incident_coverage_pct: number;
      apps_reached: number;
      apps_universe: number;
      platforms_reached: number;
      platforms_universe: number;
    };
  };
  baseline_metrics: BaselineMetric[];
  timeseries: Record<Granularity, QualityPoint[]>;
  by_assignment_group: QualityAgRow[];
  by_decalogue: DecalogueRow[];
  recurring_patterns: RecurringPattern[];
}

/* ---------------------- extension seccion 7: aun sin capturar ---------------------- */

export interface Workspace {
  priority_rank: number | null;
  workspace_name: string;
  platform: string;
  dashboards_active: number | null;
  sector: string;
  function_l1: string;
  views_6m: number | null;
  l5_manager: string;
  candidate_suggested: string;
  match_score: number | null;
  match_method: string;
  subset_risk: boolean;
  views_share_pct: number | null;
  cum_share_pct: number | null;
  wave: string;
  /** Unico input manual del modelo. null = no capturado. */
  application_name_confirmed: string | null;
}

/** Colección que aparece cuando la hoja de captura se llena. Ausente en v1. */
export interface ConsumptionRow {
  platform: string;
  report_id: string;
  report_name: string;
  workspace_name: string;
  function_l1: string;
  sector: string;
  l4_manager: string;
  l5_manager: string;
  refresh_frequency: string;
  views_6m: number | null;
  total_users: number | null;
  app_id_confirmed: string | null;
}

export interface ModelRule {
  id: string;
  title: string;
  statement: string;
  consequence?: string;
}

export interface DataQualityNote {
  id: string;
  title: string;
  detail: string;
  items?: { ag_key: string; names: string[] }[];
}

export interface Meta {
  product: string;
  short_name: string;
  version: string;
  as_of: string;
  universe_apps: number;
  scope_note: string;
  source_file: string;
  rules: ModelRule[];
  evidence_tiers: Record<string, string>;
  criticality_scale: Record<string, string>;
  derivation_warning: string;
  out_of_scope: string[];
  dashboard_link: {
    workspaces: number;
    dashboards_active: number;
    confirmed: number;
    top30_views_share_pct: number;
    note: string;
  };
  link_sources: {
    platform: Record<string, string>;
    assignment_group: Record<string, string>;
  };
  data_quality_notes: DataQualityNote[];
  ai_ops: { note: string };
}

export interface GraphData {
  meta: Meta;
  coverage: CoverageLink[];
  applications: Application[];
  platforms: Platform[];
  assignment_groups: AssignmentGroup[];
  measures: Measure[];
  quality: QualityBlock;
  workspaces: Workspace[];
  /** Aparece cuando se captura el eslabon Dashboard -> Aplicacion. */
  consumption?: ConsumptionRow[];
}
