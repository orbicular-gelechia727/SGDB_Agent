import { Code, GitBranch, Shield } from 'lucide-react';
import type { ProvenanceInfo, QualityReport } from '../types/api';

interface ProvenanceViewProps {
  provenance: ProvenanceInfo;
  quality: QualityReport;
}

export function ProvenanceView({ provenance, quality }: ProvenanceViewProps) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-3 space-y-3 text-xs">
      {/* SQL */}
      <div>
        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
          <Code size={12} />
          <span className="font-medium">SQL ({provenance.sql_method})</span>
        </div>
        <pre className="bg-gray-900 rounded p-2 overflow-x-auto text-gray-300 font-mono text-[11px] leading-relaxed">
          {provenance.sql_executed || 'N/A'}
        </pre>
      </div>

      {/* Ontology expansions */}
      {provenance.ontology_expansions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <GitBranch size={12} />
            <span className="font-medium">Ontology Expansion</span>
          </div>
          <div className="space-y-1">
            {provenance.ontology_expansions.map((exp, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-300">
                <span className="text-blue-400">{exp.original}</span>
                <span className="text-gray-600">&rarr;</span>
                <span className="text-green-400">{exp.ontology_id}</span>
                <span className="text-gray-500">({exp.label})</span>
                <span className="text-gray-500 ml-auto">
                  {exp.db_values_count} values, {exp.total_samples} samples
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fusion stats */}
      {provenance.fusion_stats.raw_count != null && (
        <div className="flex items-center gap-4 text-gray-400">
          <span>Raw: {provenance.fusion_stats.raw_count}</span>
          <span>&rarr;</span>
          <span>Fused: {provenance.fusion_stats.fused_count}</span>
          <span className="text-green-400">
            ({provenance.fusion_stats.dedup_rate}% dedup)
          </span>
        </div>
      )}

      {/* Quality */}
      {Object.keys(quality.field_completeness).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Shield size={12} />
            <span className="font-medium">Data Quality</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(quality.field_completeness).map(([field, pct]) => (
              <div key={field} className="flex items-center gap-1">
                <span className="text-gray-400">{field}:</span>
                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      pct >= 70 ? 'bg-green-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-gray-500">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timing */}
      <div className="text-gray-500">
        Time: {provenance.execution_time_ms.toFixed(0)}ms | Sources:{' '}
        {provenance.data_sources.join(', ') || 'none'}
      </div>
    </div>
  );
}
