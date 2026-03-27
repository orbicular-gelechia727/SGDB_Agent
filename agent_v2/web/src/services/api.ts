/* API client service — with stale-while-revalidate cache for stats */

import type {
  QueryResponse, StatsResponse, HealthResponse,
  ExploreResponse, DatasetDetailResponse, DashboardStats,
  AdvancedSearchRequest, AdvancedSearchResponse,
} from '../types/api';
import type { ExploreFilters } from '../types/filters';

const BASE_URL = import.meta.env.DEV 
  ? '/singledb/scdbAPI' 
  : 'https://biobigdata.nju.edu.cn/scdbAPI';

// ── Client-side cache (stale-while-revalidate) ──

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const _cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  _cache.set(key, { data, timestamp: Date.now() });
}

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) {
    // Revalidate in background (fire-and-forget)
    fetcher().then((fresh) => setCache(key, fresh)).catch(() => {});
    return cached;
  }
  const data = await fetcher();
  setCache(key, data);
  return data;
}

// ── Core fetch ──

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function query(
  queryText: string,
  sessionId = 'default',
  limit = 20,
): Promise<QueryResponse> {
  return fetchJSON<QueryResponse>(`${BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText, session_id: sessionId, limit }),
  });
}

export async function getStats(): Promise<StatsResponse> {
  return fetchWithCache('stats', () =>
    fetchJSON<StatsResponse>(`${BASE_URL}/stats`)
  );
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchJSON<HealthResponse>(`${BASE_URL}/health`);
}

export async function autocomplete(
  field: string,
  prefix: string,
  limit = 10,
): Promise<{ field: string; prefix: string; values: { value: string; count: number }[] }> {
  const params = new URLSearchParams({ field, prefix, limit: String(limit) });
  return fetchJSON(`${BASE_URL}/autocomplete?${params}`);
}

export async function exportData(
  queryText: string,
  format: 'csv' | 'json' | 'bibtex' = 'csv',
  sessionId = 'default',
  limit = 200,
): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText, session_id: sessionId, format, limit }),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Explore API ──

export async function explore(
  filters: ExploreFilters,
  offset = 0,
  limit = 25,
  sort_by = 'n_cells',
  sort_dir = 'desc',
): Promise<ExploreResponse> {
  return fetchJSON<ExploreResponse>(`${BASE_URL}/explore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...filters,
      sex: filters.sex || undefined,
      min_cells: filters.min_cells || undefined,
      has_h5ad: filters.has_h5ad || undefined,
      text_search: filters.text_search || undefined,
      nl_query: filters.nl_query || undefined,
      offset,
      limit,
      sort_by,
      sort_dir,
    }),
  });
}

// ── Dataset Detail API ──

export async function getDatasetDetail(id: string): Promise<DatasetDetailResponse> {
  return fetchJSON<DatasetDetailResponse>(`${BASE_URL}/dataset/${encodeURIComponent(id)}`);
}

// ── Dashboard Stats API (cached) ──

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchWithCache('dashboard', () =>
    fetchJSON<DashboardStats>(`${BASE_URL}/stats/dashboard`)
  );
}

// ── Downloads API ──

export async function getDownloads(id: string): Promise<{ downloads: { file_type: string; label: string; url: string | null; instructions: string; source: string }[] }> {
  return fetchJSON(`${BASE_URL}/downloads/${encodeURIComponent(id)}`);
}

export async function generateManifest(
  entityIds: string[],
  fileTypes: string[] = ['fastq'],
  format: string = 'tsv',
): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/downloads/manifest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_ids: entityIds, file_types: fileTypes, format }),
  });
  if (!res.ok) throw new Error(`Manifest generation failed: ${res.status}`);
  return res.blob();
}

// ── Advanced Search API ──

export async function advancedSearch(
  req: AdvancedSearchRequest,
): Promise<AdvancedSearchResponse> {
  return fetchJSON<AdvancedSearchResponse>(`${BASE_URL}/advanced-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

// ── Metadata Download ──

export async function downloadMetadata(
  samplePks: number[],
  format: 'csv' | 'json' = 'csv',
  limit = 1000,
): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/downloads/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample_pks: samplePks, format, limit }),
  });
  if (!res.ok) throw new Error(`Metadata download failed: ${res.status}`);
  return res.blob();
}
