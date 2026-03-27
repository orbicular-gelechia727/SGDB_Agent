import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ExploreRecord } from '../../types/api';

interface Props {
  results: ExploreRecord[]; totalCount: number;
  sortBy: string; sortDir: string; onSort: (c: string) => void; loading: boolean;
}

const COLS = [
  { key: 'sample_id', label: 'Sample ID', sort: true, mono: true },
  { key: 'tissue', label: 'Tissue', sort: true },
  { key: 'disease', label: 'Disease', sort: true },
  { key: 'cell_type', label: 'Cell Type', sort: false },
  { key: 'assay', label: 'Assay', sort: true },
  { key: 'organism', label: 'Organism', sort: true },
  { key: 'n_cells', label: 'Cells', sort: true, right: true },
  { key: 'source_database', label: 'Source', sort: true },
  { key: 'project_id', label: 'Project', sort: false, mono: true },
];

const SRC_BADGE: Record<string, string> = {
  geo: 'badge-blue', ncbi: 'badge-green', ebi: 'badge-orange', cellxgene: 'badge-purple',
  hca: 'badge-pink', htan: 'badge-red', panglao: 'badge-teal', scea: 'badge-amber',
};

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (col !== sortBy) return <ArrowUpDown size={11} className="text-[var(--gray-300)] opacity-0 group-hover:opacity-100 transition-opacity" />;
  return sortDir === 'asc' ? <ArrowUp size={11} className="text-[var(--accent)]" /> : <ArrowDown size={11} className="text-[var(--accent)]" />;
}

export function ResultsTable({ results, sortBy, sortDir, onSort, loading }: Props) {
  const navigate = useNavigate();
  const [sel, setSel] = useState<Set<number>>(new Set());

  const fmt = (col: string, row: ExploreRecord): string => {
    const v = row[col as keyof ExploreRecord];
    if (v == null) return '—';
    if (col === 'n_cells' && typeof v === 'number') return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toLocaleString();
    return String(v);
  };

  if (!results.length && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--gray-400)]">
        <img src="/singledb/icons/empty-state.svg" alt="" className="w-[160px] h-[128px] mb-4 opacity-80" />
        <p className="text-[14px] font-medium text-[var(--gray-500)] mb-1">No results found</p>
        <p className="text-[13px]">Try adjusting your filters or search terms</p>
      </div>
    );
  }

  if (loading && !results.length) {
    return <div className="space-y-1.5 py-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton h-9 w-full" />)}</div>;
  }

  return (
    <div className={`transition-opacity ${loading ? 'opacity-40' : ''}`}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="thead-row">
            <th className="px-3 py-2.5 w-9 text-left">
              <input type="checkbox"
                checked={sel.size === results.length && results.length > 0}
                onChange={() => sel.size === results.length ? setSel(new Set()) : setSel(new Set(results.map((r) => r.sample_pk)))}
                className="rounded border-[var(--gray-300)] h-3.5 w-3.5" />
            </th>
            {COLS.map((c) => (
              <th key={c.key}
                className={`px-3 py-2.5 text-left text-[11px] font-semibold text-[var(--gray-500)] uppercase tracking-[0.04em] group select-none ${
                  c.sort ? 'cursor-pointer hover:text-[var(--gray-700)]' : ''} ${c.right ? 'text-right' : ''}`}
                onClick={() => c.sort && onSort(c.key)}>
                <span className="inline-flex items-center gap-1">{c.label}{c.sort && <SortIcon col={c.key} sortBy={sortBy} sortDir={sortDir} />}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, i) => (
            <tr key={row.sample_pk}
              className={`border-b border-[var(--border-light)] hover:bg-blue-50/40 cursor-pointer transition-all hover:shadow-[inset_3px_0_0_var(--accent)] ${i % 2 ? 'bg-[var(--gray-50)]/50' : ''}`}
              onClick={() => navigate(`/explore/${row.project_id || row.sample_id}`)}>
              <td className="px-3 py-[7px]" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={sel.has(row.sample_pk)}
                  onChange={() => { const n = new Set(sel); n.has(row.sample_pk) ? n.delete(row.sample_pk) : n.add(row.sample_pk); setSel(n); }}
                  className="rounded border-[var(--gray-300)] h-3.5 w-3.5" />
              </td>
              {COLS.map((c) => (
                <td key={c.key} className={`px-3 py-[7px] truncate max-w-[160px] ${c.mono ? 'font-mono text-[12px]' : ''} ${c.right ? 'text-right tabular-nums' : ''}`}>
                  {c.key === 'source_database' ? <span className={`badge ${SRC_BADGE[row.source_database] || 'badge-gray'}`}>{row.source_database}</span>
                    : c.key === 'sample_id' ? <span className="text-[var(--accent)]">{row.sample_id}</span>
                    : <span className="text-[var(--gray-600)]">{fmt(c.key, row)}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sel.size > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-[var(--border)] px-4 py-2.5 flex items-center gap-4 shadow-md animate-fade-in">
          <span className="text-[12px] text-[var(--gray-500)]">{sel.size} selected</span>
          <button className="btn btn-primary text-[12px] py-1 px-3">Download Selected</button>
          <button onClick={() => setSel(new Set())} className="text-[12px] text-[var(--gray-400)] hover:text-[var(--gray-600)]">Clear</button>
        </div>
      )}
    </div>
  );
}
