import { X } from 'lucide-react';
import type { ParsedCondition } from '../../types/api';

interface Props {
  conditions: ParsedCondition[];
  onRemove: (index: number) => void;
  onClearAll: () => void;
}

const FIELD_STYLE: Record<string, { label: string; cls: string }> = {
  tissue: { label: 'Tissue', cls: 'badge-green' },
  disease: { label: 'Disease', cls: 'badge-red' },
  assay: { label: 'Assay', cls: 'badge-purple' },
  organism: { label: 'Organism', cls: 'badge-blue' },
  source_database: { label: 'DB', cls: 'badge-amber' },
  cell_type: { label: 'Cell', cls: 'badge-teal' },
  sex: { label: 'Sex', cls: 'badge-pink' },
  min_cells: { label: 'Min Cells', cls: 'badge-orange' },
  has_h5ad: { label: 'H5AD', cls: 'badge-green' },
  text_search: { label: 'Text', cls: 'badge-gray' },
  project_id: { label: 'Project', cls: 'badge-blue' },
  sample_id: { label: 'Sample', cls: 'badge-blue' },
  pmid: { label: 'PMID', cls: 'badge-amber' },
};

function conditionLabel(c: ParsedCondition): string {
  if (c.values.length <= 3) return c.values.join(', ');
  return `${c.values.slice(0, 2).join(', ')} +${c.values.length - 2}`;
}

export function ConditionCards({ conditions, onRemove, onClearAll }: Props) {
  if (!conditions.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {conditions.map((c, i) => {
        const style = FIELD_STYLE[c.field] || { label: c.field, cls: 'badge-gray' };
        return (
          <span key={`${c.field}-${i}`}
            className={`badge ${style.cls} inline-flex items-center gap-1 max-w-[280px]`}
            title={c.display_label || c.values.join(', ')}>
            <span className="opacity-60 text-[10px]">{style.label}:</span>
            <span className="truncate">{conditionLabel(c)}</span>
            {c.source === 'nl_parse' && c.confidence < 0.8 && (
              <span className="opacity-40 text-[9px]">?</span>
            )}
            <button onClick={() => onRemove(i)}
              className="opacity-40 hover:opacity-100 -mr-0.5 shrink-0"
              aria-label={`Remove ${style.label} filter`}>
              <X size={11} />
            </button>
          </span>
        );
      })}
      <button onClick={onClearAll}
        className="text-[12px] text-[var(--accent)] hover:underline ml-1">
        Clear all
      </button>
    </div>
  );
}
