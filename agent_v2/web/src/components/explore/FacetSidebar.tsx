import { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Microscope, Bug, FlaskConical, Dna, Database, Shapes, Users, SlidersHorizontal } from 'lucide-react';
import type { FacetBucket } from '../../types/api';

interface FacetSidebarProps {
  facets: Record<string, FacetBucket[]>;
  activeFilters: Record<string, string[]>;
  onFilterChange: (field: string, values: string[]) => void;
  loading: boolean;
}

const FACETS = [
  { key: 'tissue', label: 'Tissue', filterKey: 'tissues', icon: Microscope },
  { key: 'disease', label: 'Disease', filterKey: 'diseases', icon: Bug },
  { key: 'assay', label: 'Assay', filterKey: 'assays', icon: FlaskConical },
  { key: 'organism', label: 'Organism', filterKey: 'organisms', icon: Dna },
  { key: 'source_database', label: 'Database', filterKey: 'source_databases', icon: Database },
  { key: 'cell_type', label: 'Cell Type', filterKey: 'cell_types', icon: Shapes },
  { key: 'sex', label: 'Sex', filterKey: 'sex', icon: Users },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function Group({ label, icon: Icon, buckets, selected, onChange }: {
  label: string; icon: React.ElementType; buckets: FacetBucket[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = search ? buckets.filter((b) => b.value.toLowerCase().includes(search.toLowerCase())) : buckets;
  const shown = showAll ? filtered : filtered.slice(0, 10);

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  return (
    <div className="py-3 border-b border-[var(--border-light)]">
      <button onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[13px] font-medium text-[var(--gray-700)] hover:text-[var(--gray-900)] transition-colors">
        <span className="flex items-center gap-1.5">
          <Icon size={13} className="text-[var(--gray-400)]" />
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          {selected.length > 0 && (
            <span className="text-[10px] font-semibold bg-[var(--accent-bg)] text-[var(--accent)] px-1.5 py-px rounded">{selected.length}</span>
          )}
          {open ? <ChevronDown size={13} className="text-[var(--gray-400)]" /> : <ChevronRight size={13} className="text-[var(--gray-400)]" />}
        </span>
      </button>
      {open && (
        <div className="mt-2">
          {buckets.length > 8 && (
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Filter...`}
                className="w-full pl-7 pr-2 py-1.5 text-[12px] bg-white border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--accent)]" />
            </div>
          )}
          <div className="space-y-0 max-h-[240px] overflow-y-auto">
            {shown.map((b) => (
              <label key={b.value}
                className="flex items-center gap-2 text-[12px] text-[var(--gray-600)] hover:text-[var(--gray-900)] cursor-pointer py-[5px] px-1 rounded hover:bg-[var(--gray-50)] transition-colors">
                <input type="checkbox" checked={selected.includes(b.value)} onChange={() => toggle(b.value)}
                  className="rounded border-[var(--gray-300)] text-[var(--accent)] focus:ring-blue-200 h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{b.value}</span>
                <span className="text-[var(--gray-400)] tabular-nums text-[11px] shrink-0">{fmt(b.count)}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="text-[12px] text-[var(--gray-400)] py-2 px-1">No matches</p>}
          </div>
          {filtered.length > 10 && (
            <button onClick={() => setShowAll(!showAll)}
              className="text-[12px] text-[var(--accent)] hover:underline mt-1 px-1">
              {showAll ? 'Show less' : `Show all ${filtered.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function FacetSidebar({ facets, activeFilters, onFilterChange, loading }: FacetSidebarProps) {
  const totalActive = Object.values(activeFilters).reduce((s, v) => s + (v?.length || 0), 0);

  const resetAll = () => {
    for (const { filterKey } of FACETS) {
      if (activeFilters[filterKey]?.length) onFilterChange(filterKey, []);
    }
  };

  return (
    <aside className={`w-[240px] shrink-0 bg-white border-r border-[var(--border)] px-4 py-3 overflow-y-auto transition-opacity ${loading ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-[var(--gray-400)]" />
          <span className="section-label">Filters</span>
          {totalActive > 0 && (
            <span className="text-[10px] font-semibold bg-[var(--accent-bg)] text-[var(--accent)] px-1.5 py-px rounded">{totalActive}</span>
          )}
        </div>
        {totalActive > 0 && (
          <button onClick={resetAll} className="text-[11px] text-[var(--accent)] hover:underline">Reset</button>
        )}
      </div>
      {FACETS.map(({ key, label, filterKey, icon }) => {
        const buckets = facets[key] || [];
        if (!buckets.length && !(activeFilters[filterKey]?.length > 0)) return null;
        return <Group key={key} label={label} icon={icon} buckets={buckets}
          selected={activeFilters[filterKey] || []} onChange={(v) => onFilterChange(filterKey, v)} />;
      })}
    </aside>
  );
}
