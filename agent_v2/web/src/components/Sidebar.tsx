import { useEffect } from 'react';
import {
  X,
  History,
  BarChart3,
  Database,
  Search,
} from 'lucide-react';
import type { ChatMessage, StatsResponse } from '../types/api';

interface SidebarProps {
  messages: ChatMessage[];
  stats: StatsResponse | null;
  onLoadStats: () => void;
  onClose: () => void;
  onQueryClick: (query: string) => void;
}

export function Sidebar({ messages, stats, onLoadStats, onClose, onQueryClick }: SidebarProps) {
  useEffect(() => {
    onLoadStats();
  }, [onLoadStats]);

  const userQueries = messages.filter((m) => m.role === 'user');

  return (
    <div className="w-72 lg:w-72 border-r border-gray-800 bg-gray-900/80 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-300">Panel</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-800 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={14} className="text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Database overview */}
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            <Database size={12} />
            Database Overview
          </h3>
          {stats ? (
            <div className="space-y-1.5 text-xs">
              <StatRow label="Projects" value={stats.total_projects.toLocaleString()} />
              <StatRow label="Series" value={stats.total_series.toLocaleString()} />
              <StatRow label="Samples" value={stats.total_samples.toLocaleString()} />
              <StatRow label="Cell Types" value={stats.total_celltypes.toLocaleString()} />
              <StatRow label="Cross-links" value={stats.total_entity_links.toLocaleString()} />
            </div>
          ) : (
            <div className="text-xs text-gray-500">Loading...</div>
          )}
        </section>

        {/* Source databases */}
        {stats && stats.source_databases.length > 0 && (
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              <BarChart3 size={12} />
              Data Sources
            </h3>
            <div className="space-y-1">
              {stats.source_databases.map((db) => (
                <div
                  key={db.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-300 truncate">{db.name}</span>
                  <span className="text-gray-500 ml-2 flex-shrink-0">
                    {db.sample_count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top tissues */}
        {stats && stats.top_tissues.length > 0 && (
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Top Tissues
            </h3>
            <div className="space-y-1">
              {stats.top_tissues.slice(0, 8).map((t) => (
                <button
                  key={t.value}
                  onClick={() => onQueryClick(`find ${t.value} datasets`)}
                  className="flex items-center justify-between text-xs w-full hover:bg-gray-800 rounded px-1 py-0.5 transition-colors"
                >
                  <span className="text-gray-300 truncate">{t.value}</span>
                  <span className="text-gray-500 ml-2 flex-shrink-0">
                    {t.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Query history */}
        {userQueries.length > 0 && (
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              <History size={12} />
              Query History
            </h3>
            <div className="space-y-1">
              {userQueries.map((q) => (
                <button
                  key={q.id}
                  onClick={() => onQueryClick(q.content)}
                  className="flex items-center gap-1.5 w-full text-left text-xs text-gray-400
                             hover:text-gray-200 hover:bg-gray-800 rounded px-2 py-1 transition-colors truncate"
                >
                  <Search size={10} className="flex-shrink-0" />
                  <span className="truncate">{q.content}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Quick queries */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Quick Queries
          </h3>
          <div className="space-y-1">
            {[
              'Find liver cancer datasets',
              'Brain Alzheimer 10x data',
              'Statistics by database',
              'GSE149614',
              'T cell blood datasets',
            ].map((q) => (
              <button
                key={q}
                onClick={() => onQueryClick(q)}
                className="w-full text-left text-xs text-gray-500 hover:text-gray-200
                           hover:bg-gray-800 rounded px-2 py-1 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
}
