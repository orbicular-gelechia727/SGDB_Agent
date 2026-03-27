import { useNavigate } from 'react-router-dom';
import { useFacetedSearch } from '../hooks/useFacetedSearch';
import { FacetSidebar } from '../components/explore/FacetSidebar';
import { ActiveFilters } from '../components/explore/ActiveFilters';
import { SearchBar } from '../components/explore/SearchBar';
import { ResultsTable } from '../components/explore/ResultsTable';
import { Pagination } from '../components/explore/Pagination';
import { DEFAULT_FILTERS } from '../types/filters';
import { Loader2, SearchCode } from 'lucide-react';

export default function ExplorePage() {
  const navigate = useNavigate();
  const { filters, setFilters, results, totalCount, facets, loading, page, setPage, sortBy, sortDir, setSort, limit } = useFacetedSearch();

  const active: Record<string, string[]> = {
    tissues: filters.tissues, diseases: filters.diseases, organisms: filters.organisms,
    assays: filters.assays, cell_types: filters.cell_types, source_databases: filters.source_databases,
  };

  const remove = (f: string, v: string) => {
    const cur = (filters as unknown as Record<string, unknown>)[f];
    if (Array.isArray(cur)) setFilters({ ...filters, [f]: cur.filter((x: string) => x !== v) });
  };

  /** Navigate to Advanced Search carrying current filters */
  const goToSearch = () => {
    const params = new URLSearchParams();
    const map: Record<string, string> = {
      tissues: 'tissue', diseases: 'disease', organisms: 'organism',
      assays: 'assay', cell_types: 'cell_type', source_databases: 'source_database',
    };
    for (const [fk, field] of Object.entries(map)) {
      const vals = active[fk];
      if (vals?.length) params.set(field, vals.join(','));
    }
    if (filters.sex) params.set('sex', filters.sex);
    if (filters.text_search) params.set('q', filters.text_search);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="flex flex-1 min-h-0">
      <FacetSidebar facets={facets} activeFilters={active} onFilterChange={(f, v) => setFilters({ ...filters, [f]: v })} loading={loading} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[15px] font-semibold text-[var(--gray-900)]">Explore Datasets</h1>
            <div className="flex items-center gap-2">
              <button onClick={goToSearch}
                className="btn-ghost text-[12px] inline-flex items-center gap-1 px-2 py-1">
                <SearchCode size={13} /> Advanced Search
              </button>
              {loading && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
              <span className="text-[12px] text-[var(--gray-400)] tabular-nums">{totalCount.toLocaleString()} results</span>
            </div>
          </div>
          <SearchBar textSearch={filters.text_search} nlQuery={filters.nl_query}
            onTextSearchChange={(t) => setFilters({ ...filters, text_search: t })}
            onNlQueryChange={(t) => setFilters({ ...filters, nl_query: t })} />
          <ActiveFilters filters={active} onRemove={remove} onClearAll={() => setFilters({ ...DEFAULT_FILTERS })} />
        </div>
        <div className="flex-1 overflow-y-auto px-5">
          <ResultsTable results={results} totalCount={totalCount} sortBy={sortBy} sortDir={sortDir} onSort={setSort} loading={loading} />
        </div>
        <div className="px-5"><Pagination page={page} totalCount={totalCount} limit={limit} onPageChange={setPage} /></div>
      </div>
    </div>
  );
}
