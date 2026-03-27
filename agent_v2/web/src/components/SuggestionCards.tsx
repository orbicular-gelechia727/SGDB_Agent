import { Lightbulb, Search, Download, ArrowRightLeft, Maximize2 } from 'lucide-react';
import type { Suggestion } from '../types/api';

interface SuggestionCardsProps {
  suggestions: Suggestion[];
  onClick: (query: string) => void;
}

const ICON_MAP: Record<string, typeof Search> = {
  refine: Search,
  expand: Maximize2,
  download: Download,
  compare: ArrowRightLeft,
};

export function SuggestionCards({ suggestions, onClick }: SuggestionCardsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s, i) => {
        const Icon = ICON_MAP[s.type] || Lightbulb;
        return (
          <button
            key={i}
            onClick={() => onClick(s.action_query)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                       bg-gray-800 border border-gray-700 text-gray-300
                       hover:bg-gray-700 hover:text-gray-100 hover:border-gray-600
                       transition-all cursor-pointer"
            title={s.reason}
          >
            <Icon size={12} className="text-blue-400" />
            {s.text}
          </button>
        );
      })}
    </div>
  );
}
