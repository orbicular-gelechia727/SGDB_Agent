import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Star, ChevronLeft, ChevronRight, ExternalLink, Database, Beaker } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

const highlights = [
  {
    id: 'GSE123456',
    title: 'Human Brain Cortex Single-Cell Atlas',
    description: 'Single-cell RNA sequencing of the human brain cortex reveals the diversity of neurons and glial cells, providing important references for understanding brain function.',
    tissue: 'Brain',
    disease: 'Normal',
    cells: 89432,
    samples: 24,
    source: 'GEO',
    date: '2024-01-15',
    tags: ['Human', 'Cortex', 'Neuroscience'],
  },
  {
    id: 'GSE234567',
    title: 'Liver Cancer Microenvironment Single-Cell Analysis',
    description: 'Systematic analysis of immune cell composition in the hepatocellular carcinoma tumor microenvironment, discovering new therapeutic targets and prognostic markers.',
    tissue: 'Liver',
    disease: 'Hepatocellular Carcinoma',
    cells: 125643,
    samples: 36,
    source: 'CellXGene',
    date: '2024-01-10',
    tags: ['Human', 'Cancer', 'Immune'],
  },
  {
    id: 'GSE345678',
    title: 'Mouse Embryo Development Time Series',
    description: 'Tracking dynamic changes in gene expression during mouse embryo development from fertilized egg to blastocyst.',
    tissue: 'Embryo',
    disease: 'Normal',
    cells: 56789,
    samples: 18,
    source: 'SCEA',
    date: '2024-01-05',
    tags: ['Mouse', 'Development', 'Time-series'],
  },
  {
    id: 'GSE456789',
    title: 'COVID-19 Patient Lung Single-Cell Study',
    description: 'Analysis of single-cell transcriptomes from COVID-19 patient lung tissue, revealing the impact of viral infection on lung cells.',
    tissue: 'Lung',
    disease: 'COVID-19',
    cells: 234567,
    samples: 48,
    source: 'HCA',
    date: '2024-01-01',
    tags: ['Human', 'Infectious Disease', 'Lung'],
  },
  {
    id: 'GSE567890',
    title: 'Diabetes Islet Cell Heterogeneity',
    description: 'Study of islet cell heterogeneity changes in type 2 diabetes patients, discovering new disease mechanisms.',
    tissue: 'Pancreas',
    disease: 'Type 2 Diabetes',
    cells: 45678,
    samples: 20,
    source: 'GEO',
    date: '2023-12-28',
    tags: ['Human', 'Metabolic', 'Islet'],
  },
  {
    id: 'GSE678901',
    title: 'Skin Wound Healing Single-Cell Atlas',
    description: 'Constructing a single-cell atlas of the skin wound healing process, revealing cell-cell interaction mechanisms.',
    tissue: 'Skin',
    disease: 'Wound Healing',
    cells: 78901,
    samples: 30,
    source: 'HTAN',
    date: '2023-12-25',
    tags: ['Human', 'Wound', 'Fibroblast'],
  },
];

export function HighlightsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        '.hl-title',
        { opacity: 0.9, y: 15 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
          },
        }
      );

      // Cards animation
      gsap.fromTo(
        '.hl-card',
        { opacity: 0.9, x: 20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: trackRef.current,
            start: 'top 90%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const checkScrollButtons = () => {
    if (trackRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = trackRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (trackRef.current) {
      const scrollAmount = 400;
      trackRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScrollButtons, 300);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <section ref={sectionRef} className="py-16" style={{ background: 'var(--gray-50)' }}>
      <div className="max-w-[1120px] mx-auto">
        {/* Section Header */}
        <div className="hl-title flex items-end justify-between px-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4"
              style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
              <Star className="w-4 h-4" />
              Popular Datasets
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Latest Highlights
            </h2>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              Explore recently added and most popular single-cell datasets
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-2 rounded-lg border transition-all ${
                canScrollLeft
                  ? 'hover:bg-gray-100'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ borderColor: 'var(--border)' }}
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-2 rounded-lg border transition-all ${
                canScrollRight
                  ? 'hover:bg-gray-100'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ borderColor: 'var(--border)' }}
            >
              <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Track */}
        <div
          ref={trackRef}
          onScroll={checkScrollButtons}
          className="flex gap-5 overflow-x-auto pb-4 px-6 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {highlights.map((item) => (
            <div
              key={item.id}
              className="hl-card flex-shrink-0 w-[350px] rounded-xl border overflow-hidden group cursor-pointer snap-start transition-all duration-300 hover:-translate-y-1 relative"
              style={{ 
                background: 'var(--bg-card)', 
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-xs)'
              }}
              onMouseEnter={(e) => {
                setHoveredCard(item.id);
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                setHoveredCard(null);
                e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
              }}
              onClick={() => navigate(`/explore?q=${item.id}`)}
            >
              {/* Card Header */}
              <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md text-xs font-mono font-medium"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                      {item.id}
                    </span>
                    <span className="px-2 py-1 rounded-md text-xs"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                      {item.source}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.date}</span>
                </div>
                <h3 className="font-semibold line-clamp-2 group-hover:text-[var(--accent)] transition-colors"
                  style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <p className="text-sm line-clamp-3 mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {item.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-xs"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5">
                    <Beaker className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatNumber(item.cells)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>cells</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item.samples}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>samples</span>
                  </div>
                </div>
              </div>

              {/* Hover Overlay */}
              <div
                className={`absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-white via-white to-transparent transition-opacity duration-300 ${
                  hoveredCard === item.id ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{ background: 'var(--accent)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/explore?q=${item.id}`);
                  }}>
                  View Details
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <div className="text-center mt-8 px-6">
          <button
            onClick={() => navigate('/explore')}
            className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            View All Datasets
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
