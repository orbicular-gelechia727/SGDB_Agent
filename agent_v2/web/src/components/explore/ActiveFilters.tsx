import { X } from 'lucide-react';

interface Props {
  filters: Record<string, string[]>;
  onRemove: (f: string, v: string) => void;
  onClearAll: () => void;
}

const CFG: Record<string, { label: string; cls: string }> = {
  tissues: { label: 'Tissue', cls: 'badge-green' },
  diseases: { label: 'Disease', cls: 'badge-red' },
  assays: { label: 'Assay', cls: 'badge-purple' },
  organisms: { label: 'Organism', cls: 'badge-blue' },
  source_databases: { label: 'DB', cls: 'badge-amber' },
  cell_types: { label: 'Cell', cls: 'badge-teal' },
};

export function ActiveFilters({ filters, onRemove, onClearAll }: Props) {
  const tags: { f: string; v: string }[] = [];
  for (const [f, vs] of Object.entries(filters)) for (const v of vs) tags.push({ f, v });
  if (!tags.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {tags.map(({ f, v }) => {
        const c = CFG[f] || { label: f, cls: 'badge-gray' };
        return (
          <span key={`${f}-${v}`} className={`badge ${c.cls} inline-flex items-center gap-1`}>
            <span className="opacity-60 text-[10px]">{c.label}:</span>{v}
            <button onClick={() => onRemove(f, v)} className="opacity-40 hover:opacity-100 -mr-0.5"><X size={11} /></button>
          </span>
        );
      })}
      <button onClick={onClearAll} className="text-[12px] text-[var(--accent)] hover:underline ml-1">Clear all</button>
    </div>
  );
}
