import { Database, FlaskConical, Dna, Microscope } from 'lucide-react';
import type { StatsResponse } from '../../types/api';

interface Props { stats: StatsResponse | null; }

const ITEMS = [
  { key: 'total_samples', label: 'Samples', fallback: '756,579', color: '#1e6bb8', icon: Dna },
  { key: 'total_projects', label: 'Projects', fallback: '23,123', color: '#10b981', icon: FlaskConical },
  { key: 'databases', label: 'Databases', fallback: '12', color: '#f59e0b', icon: Database },
  { key: 'total_celltypes', label: 'Cell Types', fallback: '113K+', color: '#8b5cf6', icon: Microscope },
] as const;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function QuickStats({ stats }: Props) {
  const val = (key: string): string => {
    if (!stats) return ITEMS.find((i) => i.key === key)?.fallback || '—';
    if (key === 'databases') return String(stats.source_databases?.length || 12);
    const v = (stats as unknown as Record<string, unknown>)[key];
    return typeof v === 'number' ? fmt(v) : String(v || '—');
  };

  return (
    <section className="max-w-[960px] mx-auto px-6 -mt-7 relative z-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ITEMS.map(({ key, label, color, icon: Icon }) => (
          <div key={key} className="card px-5 py-4 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-lg" style={{ background: color }} />
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} style={{ color }} className="opacity-60" />
              <span className="text-[12px] text-[var(--gray-400)]">{label}</span>
            </div>
            <div className="text-[1.75rem] font-bold tracking-[-0.02em] text-[var(--gray-900)] tabular-nums leading-none">
              {stats ? val(key) : <span className="skeleton inline-block w-14 h-7" />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
