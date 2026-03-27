import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, SlidersHorizontal } from 'lucide-react';

interface Props {
  textSearch: string; nlQuery: string;
  onTextSearchChange: (t: string) => void; onNlQueryChange: (t: string) => void;
}

export function SearchBar({ textSearch, nlQuery, onTextSearchChange, onNlQueryChange }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'keyword' | 'nl'>(nlQuery ? 'nl' : 'keyword');
  const [val, setVal] = useState(mode === 'nl' ? nlQuery : textSearch);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'nl' && val.trim()) navigate(`/search?q=${encodeURIComponent(val.trim())}`);
    else onTextSearchChange(val.trim());
  };

  const switchMode = (m: 'keyword' | 'nl') => {
    setMode(m); setVal('');
    m === 'keyword' ? onNlQueryChange('') : onTextSearchChange('');
  };

  return (
    <form onSubmit={submit} className="flex gap-2 mb-3">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)] pointer-events-none" />
        <input type="text" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={mode === 'nl' ? 'Ask in natural language...' : 'Search by keyword...'}
          className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-bg)]" />
      </div>
      <button type="submit" className="btn btn-primary text-[13px]">Search</button>
      <div className="flex border border-[var(--border)] rounded-md overflow-hidden bg-white">
        <button type="button" onClick={() => switchMode('keyword')} title="Keyword"
          className={`px-2.5 py-2 transition-colors ${mode === 'keyword' ? 'bg-[var(--gray-100)] text-[var(--gray-700)]' : 'text-[var(--gray-400)] hover:text-[var(--gray-600)]'}`}>
          <SlidersHorizontal size={14} />
        </button>
        <div className="w-px bg-[var(--border)]" />
        <button type="button" onClick={() => switchMode('nl')} title="AI"
          className={`px-2.5 py-2 transition-colors ${mode === 'nl' ? 'bg-[var(--gray-100)] text-[var(--gray-700)]' : 'text-[var(--gray-400)] hover:text-[var(--gray-600)]'}`}>
          <MessageSquare size={14} />
        </button>
      </div>
    </form>
  );
}
