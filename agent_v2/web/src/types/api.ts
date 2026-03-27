/* API response types matching backend schemas */

export interface ResultRecord {
  data: Record<string, unknown>;
  sources: string[];
  source_count: number;
  quality_score: number;
}

export interface Suggestion {
  type: string;
  text: string;
  action_query: string;
  reason: string;
}

export interface ChartSpec {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: Record<string, number> | unknown[];
}

export interface ProvenanceInfo {
  original_query: string;
  parsed_intent: string;
  ontology_expansions: OntologyExpansion[];
  sql_executed: string;
  sql_method: string;
  strategy_level: string;
  fusion_stats: {
    raw_count?: number;
    fused_count?: number;
    dedup_rate?: number;
  };
  data_sources: string[];
  execution_time_ms: number;
}

export interface OntologyExpansion {
  original: string;
  ontology_id: string;
  label: string;
  db_values_count: number;
  total_samples: number;
}

export interface QualityReport {
  field_completeness: Record<string, number>;
  cross_validation_score: number;
  source_coverage: Record<string, number>;
}

export interface QueryResponse {
  summary: string;
  results: ResultRecord[];
  total_count: number;
  displayed_count: number;
  provenance: ProvenanceInfo;
  quality_report: QualityReport;
  suggestions: Suggestion[];
  charts: ChartSpec[];
  error: string | null;
}

export interface StatsResponse {
  total_projects: number;
  total_series: number;
  total_samples: number;
  total_celltypes: number;
  total_entity_links: number;
  source_databases: { name: string; project_count: number; sample_count: number }[];
  top_tissues: { value: string; count: number }[];
  top_diseases: { value: string; count: number }[];
}

export interface HealthResponse {
  status: string;
  components: Record<string, { status: string; [k: string]: unknown }>;
}

/* Chat message types */

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  response?: QueryResponse;
  loading?: boolean;
  stages?: PipelineStage[];
}

export interface PipelineStage {
  stage: string;
  message: string;
  timestamp: number;
  data?: unknown;
}

/* WebSocket message types */

export interface WSMessage {
  type: 'status' | 'result' | 'done' | 'error';
  data: Record<string, unknown>;
}

/* Explore API types */

export interface FacetBucket {
  value: string;
  count: number;
}

export interface ExploreRecord {
  sample_pk: number;
  sample_id: string;
  tissue: string | null;
  disease: string | null;
  cell_type: string | null;
  organism: string | null;
  sex: string | null;
  n_cells: number | null;
  assay: string | null;
  source_database: string;
  series_id: string | null;
  series_title: string | null;
  has_h5ad: boolean;
  project_id: string | null;
  project_title: string | null;
  pmid: string | null;
}

export interface ExploreResponse {
  results: ExploreRecord[];
  total_count: number;
  offset: number;
  limit: number;
  facets: Record<string, FacetBucket[]>;
}

/* Dataset detail types */

export interface DownloadOption {
  file_type: string;
  label: string;
  url: string | null;
  instructions: string;
  source: string;
}

export interface DatasetDetailResponse {
  entity_id: string;
  entity_type: string;
  title: string | null;
  description: string | null;
  organism: string | null;
  source_database: string;
  project: Record<string, unknown> | null;
  series: Record<string, unknown>[];
  samples: Record<string, unknown>[];
  sample_count: number;
  cross_links: { linked_id: string; linked_database: string; linked_title: string | null; relationship_type: string }[];
  downloads: DownloadOption[];
  pmid: string | null;
  doi: string | null;
}

/* Dashboard stats */

export interface DashboardStats {
  total_projects: number;
  total_series: number;
  total_samples: number;
  total_celltypes: number;
  total_cross_links: number;
  by_source: { name: string; projects: number; series: number; samples: number }[];
  by_tissue: { value: string; count: number }[];
  by_disease: { value: string; count: number }[];
  by_assay: { value: string; count: number }[];
  by_organism: { value: string; count: number }[];
  by_sex: { value: string; count: number }[];
  submissions_by_year: { year: string; count: number }[];
  h5ad_available: number;
  rds_available: number;
  with_pmid: number;
  with_doi: number;
}

/* Advanced Search types */

export interface ParsedCondition {
  field: string;
  operator: string;
  values: string[];
  display_label: string;
  source: 'nl_parse' | 'user_edit' | 'facet_select';
  confidence: number;
}

export interface AdvancedSearchRequest {
  nl_query?: string;
  conditions: ParsedCondition[];
  session_id: string;
  limit: number;
  offset: number;
  sort_by: string;
  sort_dir: string;
}

export interface AdvancedSearchResponse {
  conditions: ParsedCondition[];
  results: ExploreRecord[];
  total_count: number;
  offset: number;
  limit: number;
  facets: Record<string, FacetBucket[]>;
  summary: string;
  provenance: ProvenanceInfo;
  suggestions: Suggestion[];
  error: string | null;
}
