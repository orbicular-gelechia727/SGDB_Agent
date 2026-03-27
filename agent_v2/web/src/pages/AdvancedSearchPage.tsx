import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, ArrowRight } from 'lucide-react';
import { useAdvancedSearch } from '../hooks/useAdvancedSearch';
import { FacetSidebar } from '../components/explore/FacetSidebar';
import { ResultsTable } from '../components/explore/ResultsTable';
import { Pagination } from '../components/explore/Pagination';
import { ConditionCards } from '../components/search/ConditionCards';
import { SqlPreview } from '../components/search/SqlPreview';
import { downloadMetadata, downloadBlob } from '../services/api';

export default function AdvancedSearchPage() {
  const navigate = useNavigate();
  const [nlInput, setNlInput] = useState('');

  const {
    conditions, results, totalCount, facets, summary, provenance,
    suggestions, loading, error, page, sortBy, sortDir,
    activeFilters, limit,
    sendQuery, removeCondition, addFacetCondition, clearAll, setPage, setSort,
  } = useAdvancedSearch();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = nlInput.trim();
    if (!q) return;
    sendQuery(q);
    setNlInput('');
  }, [nlInput, sendQuery]);

  const handleFacetChange = useCallback((filterKey: string, values: string[]) => {
    // Map filterKey back to field name
    const keyMap: Record<string, string> = {
      tissues: 'tissue', diseases: 'disease', organisms: 'organism',
      assays: 'assay', cell_types: 'cell_type', source_databases: 'source_database',
      sex: 'sex',
    };
    const field = keyMap[filterKey] || filterKey;

    // Find current values for this field
    const current = conditions.find((c) => c.field === field);
    const currentVals = current?.values || [];

    // Determine added/removed
    const added = values.filter((v) => !currentVals.includes(v));
    const removed = currentVals.filter((v) => !values.includes(v));

    for (const v of added) addFacetCondition(field, v);
    for (const v of removed) addFacetCondition(field, v); // toggle off
  }, [conditions, addFacetCondition]);

  const handleMetadataDownload = useCallback(async (format: 'csv' | 'json') => {
    try {
      const pks = results.map((r) => r.sample_pk);
      const blob = await downloadMetadata(pks, format);
      downloadBlob(blob, `sceqtl_metadata.${format}`);
    } catch (e) {
      console.error('Metadata download failed:', e);
    }
  }, [results]);

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      {/* Facet Sidebar */}
      <FacetSidebar
        facets={facets}
        activeFilters={activeFilters}
        onFilterChange={handleFacetChange}
        loading={loading}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        <div className="px-5 py-4 space-y-3">
          {/* NL Query Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)] pointer-events-none" />
              <input
                type="text"
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                placeholder="Describe what you're looking for... e.g. &quot;human liver cancer 10x datasets&quot;"
                className="w-full pl-10 pr-3 py-2.5 text-[14px] bg-white border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-bg)]"
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading || !nlInput.trim()}
              className="btn btn-primary px-5 py-2.5 text-[13px] shrink-0">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Condition Cards */}
          <ConditionCards
            conditions={conditions}
            onRemove={removeCondition}
            onClearAll={clearAll}
          />

          {/* Summary */}
          {summary && (
            <div className="text-[13px] text-[var(--gray-600)] bg-blue-50/50 rounded-lg px-3 py-2">
              {summary}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-[13px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setNlInput(s.text || ''); }}
                  className="text-[12px] text-[var(--accent)] bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition-colors">
                  {s.text}
                </button>
              ))}
            </div>
          )}

          {/* Results count + actions */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--gray-500)]">
              {totalCount > 0 ? `${totalCount.toLocaleString()} samples` : ''}
            </span>
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleMetadataDownload('csv')}
                  className="btn-ghost text-[12px] inline-flex items-center gap-1 px-2 py-1">
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => handleMetadataDownload('json')}
                  className="btn-ghost text-[12px] inline-flex items-center gap-1 px-2 py-1">
                  <Download size={12} /> JSON
                </button>
                <button onClick={() => {
                  const ids = results.map((r) => r.project_id || r.sample_id).filter(Boolean);
                  navigate(`/downloads?ids=${ids.join(',')}`);
                }}
                  className="btn-ghost text-[12px] inline-flex items-center gap-1 px-2 py-1">
                  <ArrowRight size={12} /> Downloads
                </button>
              </div>
            )}
          </div>

          {/* Results Table */}
          <ResultsTable
            results={results}
            totalCount={totalCount}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={setSort}
            loading={loading}
          />

          {/* Pagination */}
          {totalCount > limit && (
            <Pagination
              page={page}
              totalCount={totalCount}
              limit={limit}
              onPageChange={setPage}
            />
          )}

          {/* SQL Preview */}
          <SqlPreview provenance={provenance} summary={summary} />
        </div>
      </div>
    </div>
  );
}
