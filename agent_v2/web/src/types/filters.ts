import type { ExploreRecord, FacetBucket } from './api';

export interface ExploreFilters {
  tissues: string[];
  diseases: string[];
  organisms: string[];
  assays: string[];
  cell_types: string[];
  source_databases: string[];
  sex: string | null;
  min_cells: number | null;
  has_h5ad: boolean | null;
  text_search: string;
  nl_query: string;
}

export interface ExploreState {
  filters: ExploreFilters;
  results: ExploreRecord[];
  total_count: number;
  offset: number;
  limit: number;
  sort_by: string;
  sort_dir: string;
  facets: Record<string, FacetBucket[]>;
  loading: boolean;
}

export const DEFAULT_FILTERS: ExploreFilters = {
  tissues: [],
  diseases: [],
  organisms: [],
  assays: [],
  cell_types: [],
  source_databases: [],
  sex: null,
  min_cells: null,
  has_h5ad: null,
  text_search: '',
  nl_query: '',
};
