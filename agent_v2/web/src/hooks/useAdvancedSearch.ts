/**
 * useAdvancedSearch — iterative hybrid search state management.
 *
 * Manages: conditions (ParsedCondition[]), results, facets, pagination, sorting.
 * Calls POST /api/v1/advanced-search on every state change.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ParsedCondition, AdvancedSearchResponse, ExploreRecord, FacetBucket,
} from '../types/api';
import { advancedSearch } from '../services/api';

interface AdvancedSearchState {
  conditions: ParsedCondition[];
  results: ExploreRecord[];
  totalCount: number;
  facets: Record<string, FacetBucket[]>;
  summary: string;
  provenance: AdvancedSearchResponse['provenance'] | null;
  suggestions: AdvancedSearchResponse['suggestions'];
  loading: boolean;
  error: string | null;
  page: number;
  sortBy: string;
  sortDir: string;
}

const LIMIT = 25;

/** Map URL search params → initial conditions */
function paramsToConditions(sp: URLSearchParams): ParsedCondition[] {
  const FIELDS: Record<string, string> = {
    tissue: 'Tissue', disease: 'Disease', organism: 'Organism',
    assay: 'Assay', cell_type: 'Cell Type', source_database: 'Database',
    sex: 'Sex', project_id: 'Project ID', sample_id: 'Sample ID',
  };
  const conds: ParsedCondition[] = [];
  for (const [field, label] of Object.entries(FIELDS)) {
    const raw = sp.get(field);
    if (raw) {
      const values = raw.split(',').filter(Boolean);
      if (values.length) {
        conds.push({
          field, operator: 'in', values,
          display_label: `${label}: ${values.join(', ')}`,
          source: 'facet_select', confidence: 1,
        });
      }
    }
  }
  const q = sp.get('q');
  if (q) {
    conds.push({
      field: 'text_search', operator: 'like', values: [q],
      display_label: `Text: ${q}`, source: 'nl_parse', confidence: 1,
    });
  }
  return conds;
}

export function useAdvancedSearch() {
  const [searchParams] = useSearchParams();
  const initialConditions = useRef(paramsToConditions(searchParams));

  const [state, setState] = useState<AdvancedSearchState>({
    conditions: initialConditions.current,
    results: [],
    totalCount: 0,
    facets: {},
    summary: '',
    provenance: null,
    suggestions: [],
    loading: false,
    error: null,
    page: 1,
    sortBy: 'n_cells',
    sortDir: 'desc',
  });

  const abortRef = useRef<AbortController | null>(null);

  /** Core search executor */
  const execute = useCallback(async (
    conditions: ParsedCondition[],
    nlQuery: string | undefined,
    page: number,
    sortBy: string,
    sortDir: string,
  ) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const resp = await advancedSearch({
        nl_query: nlQuery,
        conditions,
        session_id: 'default',
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      if (ac.signal.aborted) return;

      setState((s) => ({
        ...s,
        conditions: resp.conditions,
        results: resp.results as ExploreRecord[],
        totalCount: resp.total_count,
        facets: resp.facets as Record<string, FacetBucket[]>,
        summary: resp.summary,
        provenance: resp.provenance,
        suggestions: resp.suggestions,
        loading: false,
        error: resp.error || null,
        page,
        sortBy,
        sortDir,
      }));
    } catch (e) {
      if (ac.signal.aborted) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Search failed',
      }));
    }
  }, []);

  /** Send NL query — appends parsed conditions */
  const sendQuery = useCallback((nl: string) => {
    execute(state.conditions, nl, 1, state.sortBy, state.sortDir);
  }, [execute, state.conditions, state.sortBy, state.sortDir]);

  /** Remove a condition by index */
  const removeCondition = useCallback((index: number) => {
    const next = state.conditions.filter((_, i) => i !== index);
    setState((s) => ({ ...s, conditions: next }));
    execute(next, undefined, 1, state.sortBy, state.sortDir);
  }, [execute, state.conditions, state.sortBy, state.sortDir]);

  /** Add a facet condition (from sidebar click) */
  const addFacetCondition = useCallback((field: string, value: string) => {
    const LABELS: Record<string, string> = {
      tissue: 'Tissue', disease: 'Disease', organism: 'Organism',
      assay: 'Assay', cell_type: 'Cell Type', source_database: 'Database', sex: 'Sex',
    };
    const existing = state.conditions.find((c) => c.field === field);
    let next: ParsedCondition[];
    if (existing) {
      if (existing.values.includes(value)) {
        // Toggle off
        const newVals = existing.values.filter((v) => v !== value);
        if (newVals.length === 0) {
          next = state.conditions.filter((c) => c.field !== field);
        } else {
          next = state.conditions.map((c) =>
            c.field === field
              ? { ...c, values: newVals, display_label: `${LABELS[field] || field}: ${newVals.join(', ')}` }
              : c
          );
        }
      } else {
        const newVals = [...existing.values, value];
        next = state.conditions.map((c) =>
          c.field === field
            ? { ...c, values: newVals, display_label: `${LABELS[field] || field}: ${newVals.join(', ')}` }
            : c
        );
      }
    } else {
      next = [...state.conditions, {
        field, operator: 'in', values: [value],
        display_label: `${LABELS[field] || field}: ${value}`,
        source: 'facet_select' as const, confidence: 1,
      }];
    }
    setState((s) => ({ ...s, conditions: next }));
    execute(next, undefined, 1, state.sortBy, state.sortDir);
  }, [execute, state.conditions, state.sortBy, state.sortDir]);

  /** Clear all conditions */
  const clearAll = useCallback(() => {
    setState((s) => ({ ...s, conditions: [] }));
    execute([], undefined, 1, state.sortBy, state.sortDir);
  }, [execute, state.sortBy, state.sortDir]);

  /** Pagination */
  const setPage = useCallback((p: number) => {
    execute(state.conditions, undefined, p, state.sortBy, state.sortDir);
  }, [execute, state.conditions, state.sortBy, state.sortDir]);

  /** Sort */
  const setSort = useCallback((col: string) => {
    const dir = col === state.sortBy && state.sortDir === 'desc' ? 'asc' : 'desc';
    execute(state.conditions, undefined, 1, col, dir);
  }, [execute, state.conditions, state.sortBy, state.sortDir]);

  /** Initial load */
  useEffect(() => {
    execute(initialConditions.current, undefined, 1, 'n_cells', 'desc');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Convert conditions → activeFilters map for FacetSidebar */
  const activeFilters: Record<string, string[]> = {};
  for (const c of state.conditions) {
    // Map field names to the filterKey format FacetSidebar expects
    const keyMap: Record<string, string> = {
      tissue: 'tissues', disease: 'diseases', organism: 'organisms',
      assay: 'assays', cell_type: 'cell_types', source_database: 'source_databases',
      sex: 'sex',
    };
    const fk = keyMap[c.field];
    if (fk) activeFilters[fk] = c.values;
  }

  return {
    ...state,
    activeFilters,
    limit: LIMIT,
    sendQuery,
    removeCondition,
    addFacetCondition,
    clearAll,
    setPage,
    setSort,
  };
}
