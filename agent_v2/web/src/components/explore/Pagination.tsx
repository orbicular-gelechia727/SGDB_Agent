import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props { page: number; totalCount: number; limit: number; onPageChange: (p: number) => void; }

export function Pagination({ page, totalCount, limit, onPageChange }: Props) {
  const pages = Math.max(1, Math.ceil(totalCount / limit));
  if (totalCount === 0) return null;

  const btns: (number | string)[] = [];
  if (pages <= 7) { for (let i = 1; i <= pages; i++) btns.push(i); }
  else {
    btns.push(1);
    if (page > 3) btns.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) btns.push(i);
    if (page < pages - 2) btns.push('...');
    btns.push(pages);
  }

  return (
    <div className="flex items-center justify-between py-3 border-t border-[var(--border)]">
      <span className="text-[12px] text-[var(--gray-400)] tabular-nums">
        {((page - 1) * limit + 1).toLocaleString()}–{Math.min(page * limit, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
      </span>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="btn-ghost p-1 disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronLeft size={16} className="text-[var(--gray-500)]" />
        </button>
        {btns.map((p, i) => typeof p === 'string'
          ? <span key={`e${i}`} className="px-1 text-[var(--gray-400)] text-[12px]">...</span>
          : <button key={p} onClick={() => onPageChange(p)}
              className={`min-w-[26px] h-[26px] text-[12px] rounded font-medium transition-colors ${
                p === page ? 'bg-[var(--gray-900)] text-white' : 'text-[var(--gray-500)] hover:bg-[var(--gray-100)]'
              }`}>{p}</button>
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
          className="btn-ghost p-1 disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronRight size={16} className="text-[var(--gray-500)]" />
        </button>
      </div>
    </div>
  );
}
