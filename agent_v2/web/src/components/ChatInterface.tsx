import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { ChatMessage } from '../types/api';
import { MessageBubble } from './MessageBubble';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onSuggestionClick: (query: string) => void;
  onExport?: (query: string, format: 'csv' | 'json' | 'bibtex') => void;
}

export function ChatInterface({ messages, loading, onSend, onSuggestionClick, onExport }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSuggestionClick={onSuggestionClick}
            onExport={onExport}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about single-cell datasets... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm
                       placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                       focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed
                       px-4 py-2.5 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
