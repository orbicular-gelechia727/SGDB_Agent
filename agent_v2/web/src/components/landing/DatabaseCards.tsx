import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { StatsResponse } from '../../types/api';

interface Props { stats: StatsResponse | null; }

interface DBInfo {
  name: string;
  fullName: string;
  hex: string;
  bgColor: string;
  icon: string;
  desc: string;
}

const DB: Record<string, DBInfo> = {
  geo: {
    name: 'GEO',
    fullName: 'Gene Expression Omnibus',
    hex: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    icon: '/singledb/icons/db-geo.svg',
    desc: 'NCBI gene expression database storing high-throughput gene expression data.'
  },
  ncbi: {
    name: 'NCBI/SRA',
    fullName: 'Sequence Read Archive',
    hex: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    icon: '/singledb/icons/db-ncbi.svg',
    desc: 'Raw high-throughput sequencing data including RNA-Seq and single-cell data.'
  },
  ebi: {
    name: 'EBI',
    fullName: 'European Bioinformatics Institute',
    hex: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    icon: '/singledb/icons/db-ebi.svg',
    desc: 'European Bioinformatics Institute providing diverse omics data resources.'
  },
  cellxgene: {
    name: 'CellXGene',
    fullName: 'Cell by Gene',
    hex: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    icon: '/singledb/icons/db-cellxgene.svg',
    desc: 'CZ Science single-cell data visualization and exploration platform.'
  },
  hca: {
    name: 'HCA',
    fullName: 'Human Cell Atlas',
    hex: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
    icon: '/singledb/icons/db-hca.svg',
    desc: 'Human Cell Atlas project mapping all cell types in the human body.'
  },
  htan: {
    name: 'HTAN',
    fullName: 'Human Tumor Atlas Network',
    hex: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    icon: '/singledb/icons/db-htan.svg',
    desc: 'Human Tumor Atlas Network studying cancer initiation and progression.'
  },
  panglao: {
    name: 'PanglaoDB',
    fullName: 'Panglao Database',
    hex: '#14b8a6',
    bgColor: 'rgba(20, 184, 166, 0.1)',
    icon: '/singledb/icons/db-panglao.svg',
    desc: 'Single-cell RNA sequencing database focused on mouse and human cell types.'
  },
  scea: {
    name: 'SCEA',
    fullName: 'Single Cell Expression Atlas',
    hex: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    icon: '/singledb/icons/db-scea.svg',
    desc: 'EBI single-cell gene expression atlas providing cross-species analysis.'
  },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function DatabaseCards({ stats }: Props) {
  const sources = stats?.source_databases || [];

  return (
    <section className="py-14" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-[960px] mx-auto px-6">
        {/* Section Header */}
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-3"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5V19A9 3 0 0 0 21 19V5" />
                <path d="M3 12A9 3 0 0 0 21 12" />
              </svg>
              Data Sources
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Integrated Databases
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Aggregate data from leading single-cell databases worldwide for unified search and access.
            </p>
          </div>
          <Link to="/explore" 
            className="hidden sm:flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}>
            Browse all <ArrowRight size={14} />
          </Link>
        </div>

        {sources.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[140px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sources.map((src) => {
              const info = DB[src.name] || {
                name: src.name,
                fullName: src.name,
                hex: '#94a3b8',
                bgColor: 'rgba(148, 163, 184, 0.1)',
                icon: '',
                desc: 'Database source'
              };
              return (
                <Link
                  key={src.name}
                  to={`/explore?source_database=${encodeURIComponent(src.name)}`}
                  className="group relative rounded-xl p-5 border transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                    borderLeftWidth: '4px',
                    borderLeftColor: info.hex,
                    boxShadow: 'var(--shadow-xs)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.borderColor = 'var(--gray-300)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    {info.icon && (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: info.bgColor }}
                      >
                        <img
                          src={info.icon}
                          alt={info.name}
                          className="w-6 h-6"
                          style={{ filter: `drop-shadow(0 0 4px ${info.hex}40)` }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm group-hover:text-[var(--accent)] transition-colors"
                        style={{ color: 'var(--text-primary)' }}>
                        {info.name}
                      </h3>
                      <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {info.fullName}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {info.desc}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {fmt(src.sample_count)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>samples</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {fmt(src.project_count)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>projects</p>
                    </div>
                  </div>

                  {/* Hover Link */}
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="flex items-center justify-center gap-1 text-xs font-medium"
                      style={{ color: info.hex }}>
                      Explore {info.name}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
