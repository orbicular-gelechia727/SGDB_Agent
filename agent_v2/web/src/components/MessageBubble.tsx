import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, ChevronDown, ChevronUp, Download, Clock } from 'lucide-react';
import type { ChatMessage, PipelineStage } from '../types/api';
import { ResultTable } from './ResultTable';
import { ChartPanel } from './ChartPanel';
import { ProvenanceView } from './ProvenanceView';
import { SuggestionCards } from './SuggestionCards';

interface MessageBubbleProps {
  message: ChatMessage;
  onSuggestionClick: (query: string) => void;
  onExport?: (query: string, format: 'csv' | 'json' | 'bibtex') => void;
}

const STAGE_LABELS: Record<string, string> = {
  parsing: 'Parsing query...',
  ontology: 'Resolving ontology terms...',
  generating: 'Generating SQL...',
  executing: 'Searching databases...',
  fusing: 'Merging cross-database results...',
  synthesizing: 'Preparing response...',
};

function PipelineProgress({ stages }: { stages: PipelineStage[] }) {
  if (!stages || stages.length === 0) return null;
  const latest = stages[stages.length - 1];
  return (
    <div className="flex items-center gap-2 text-gray-400 text-sm">
      <div className="flex gap-1">
        {stages.map((_s, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-blue-400"
          />
        ))}
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse" />
      </div>
      <span>{STAGE_LABELS[latest.stage] || latest.message || 'Processing...'}</span>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, onSuggestionClick, onExport }: MessageBubbleProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const isAgent = message.role === 'agent';
  const resp = message.response;

  return (
    <div className={`flex gap-3 max-w-4xl mx-auto ${isAgent ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isAgent ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-700 text-gray-300'
        }`}
      >
        {isAgent ? <Bot size={16} /> : <User size={16} />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isAgent ? '' : 'text-right'}`}>
        <div
          className={`inline-block text-left rounded-lg px-4 py-3 text-sm leading-relaxed max-w-full ${
            isAgent
              ? 'bg-gray-800/80 text-gray-200'
              : 'bg-blue-600/20 text-blue-100 border border-blue-800/50'
          }`}
        >
          {message.loading ? (
            <PipelineProgress stages={message.stages || []} />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className={`text-[10px] text-gray-600 mt-0.5 ${isAgent ? '' : 'text-right'}`}>
          <Clock size={9} className="inline mr-0.5 -mt-0.5" />
          {formatTimestamp(message.timestamp)}
        </div>

        {/* Agent response details */}
        {isAgent && resp && !message.loading && (
          <div className="mt-2 space-y-2">
            {/* Quick stats bar + export */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>{resp.total_count} results</span>
              <span className="text-gray-700">|</span>
              <span>{resp.provenance.execution_time_ms.toFixed(0)}ms</span>
              <span className="text-gray-700">|</span>
              <span>{resp.provenance.sql_method}</span>
              {resp.provenance.data_sources.length > 0 && (
                <>
                  <span className="text-gray-700">|</span>
                  <span>{resp.provenance.data_sources.join(', ')}</span>
                </>
              )}

              {/* Export button */}
              {resp.results.length > 0 && onExport && (
                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                    aria-label="Export results"
                  >
                    <Download size={11} />
                    Export
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 py-1 min-w-24">
                      {(['csv', 'json', 'bibtex'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => {
                            onExport(resp.provenance.original_query, fmt);
                            setShowExportMenu(false);
                          }}
                          className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors"
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Charts */}
            {resp.charts.length > 0 && <ChartPanel charts={resp.charts} />}

            {/* Results table */}
            {resp.results.length > 0 && (
              <ResultTable results={resp.results} totalCount={resp.total_count} />
            )}

            {/* Suggestions */}
            {resp.suggestions.length > 0 && (
              <SuggestionCards suggestions={resp.suggestions} onClick={onSuggestionClick} />
            )}

            {/* Provenance toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Query details
            </button>

            {showDetails && (
              <ProvenanceView
                provenance={resp.provenance}
                quality={resp.quality_report}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
