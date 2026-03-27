import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import type { ResultRecord } from '../types/api';

interface ResultTableProps {
  results: ResultRecord[];
  totalCount: number;
}

const DISPLAY_FIELDS = [
  'project_id',
  'sample_id',
  'tissue',
  'disease',
  'cell_type',
  'assay',
  'organism',
  'sex',
  'n_cells',
  'source_database',
  'project_title',
];

const FIELD_LABELS: Record<string, string> = {
  project_id: 'Project',
  sample_id: 'Sample',
  tissue: 'Tissue',
  disease: 'Disease',
  cell_type: 'Cell Type',
  assay: 'Assay',
  organism: 'Organism',
  sex: 'Sex',
  n_cells: 'Cells',
  source_database: 'Source',
  project_title: 'Title',
};

export function ResultTable({ results, totalCount }: ResultTableProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Determine which columns have data
  const columns = useMemo(() => {
    const cols = DISPLAY_FIELDS.filter((f) =>
      results.some((r) => r.data[f] != null && r.data[f] !== ''),
    );
    return cols;
  }, [results]);

  // Sort results
  const sortedResults = useMemo(() => {
    if (!sortField) return results;
    return [...results].sort((a, b) => {
      const va = String(a.data[sortField] ?? '');
      const vb = String(b.data[sortField] ?? '');
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [results, sortField, sortDir]);

  const displayResults = expanded ? sortedResults : sortedResults.slice(0, 5);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="rounded-lg border border-gray-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="px-2 py-2 text-left text-gray-400 font-medium w-8">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-2 py-2 text-left text-gray-400 font-medium cursor-pointer hover:text-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {FIELD_LABELS[col] || col}
                    {sortField === col && <ArrowUpDown size={10} />}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-left text-gray-400 font-medium">Sources</th>
              <th className="px-2 py-2 text-left text-gray-400 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((r, i) => (
              <tr
                key={i}
                className="border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1.5 max-w-48 truncate" title={String(r.data[col] ?? '')}>
                    {col === 'project_title'
                      ? truncate(String(r.data[col] ?? ''), 50)
                      : String(r.data[col] ?? '-')}
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    {r.sources.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <ScoreBadge score={r.quality_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand/collapse */}
      {results.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800/30
                     flex items-center justify-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Show all {totalCount} results
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'text-green-400 bg-green-900/30'
      : score >= 40
        ? 'text-yellow-400 bg-yellow-900/30'
        : 'text-gray-400 bg-gray-800';

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {score.toFixed(0)}
    </span>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
