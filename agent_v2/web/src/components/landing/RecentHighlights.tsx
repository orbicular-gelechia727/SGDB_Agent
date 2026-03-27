import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const ITEMS = [
  { id: 'GSE149614', title: 'COVID-19 Lung & PBMC Atlas', tissue: 'Lung, PBMC', disease: 'COVID-19', source: 'GEO' },
  { id: 'GSE138852', title: 'Alzheimer Brain Single-Cell Atlas', tissue: 'Brain', disease: "Alzheimer's disease", source: 'GEO' },
  { id: 'GSE136103', title: 'Human Liver Cell Atlas', tissue: 'Liver', disease: 'Cirrhosis', source: 'GEO' },
  { id: 'GSE131685', title: 'Kidney Tumor Microenvironment', tissue: 'Kidney', disease: 'Renal cell carcinoma', source: 'GEO' },
];

export function RecentHighlights() {
  return (
    <section className="max-w-[960px] mx-auto px-6 pb-12">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-[1.125rem] font-semibold tracking-[-0.01em] text-[var(--gray-900)]">Featured Datasets</h2>
        <Link to="/explore" className="text-[13px] text-[var(--gray-400)] hover:text-[var(--accent)] transition-colors flex items-center gap-1">
          View all <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ITEMS.map((ds) => (
          <Link key={ds.id} to={`/explore/${ds.id}`} className="card card-hover group px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="badge badge-sky font-mono text-[11px]">{ds.id}</span>
              <span className="text-[11px] text-[var(--gray-400)]">{ds.source}</span>
            </div>
            <h3 className="text-[14px] font-medium text-[var(--gray-800)] group-hover:text-[var(--accent)] transition-colors mb-2 leading-snug">
              {ds.title}
            </h3>
            <div className="flex gap-1.5">
              <span className="badge badge-gray">{ds.tissue}</span>
              <span className="badge badge-gray">{ds.disease}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
