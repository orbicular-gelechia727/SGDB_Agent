import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Layers, Search, Link2, Database, Filter, Share2 } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    id: 'unified',
    icon: Layers,
    title: 'Unified Metadata Model',
    description: 'Standardizes heterogeneous metadata from different databases into a unified schema, eliminating data silos and enabling seamless cross-database retrieval.',
    highlights: ['Standardized Schema', 'Auto Mapping', 'Quality Check'],
  },
  {
    id: 'search',
    icon: Search,
    title: 'Advanced Search',
    description: 'Supports multi-dimensional combined filtering, natural language queries, and intelligent recommendations to quickly locate target datasets.',
    highlights: ['Facet Filtering', 'Natural Language', 'Smart Recommendations'],
  },
  {
    id: 'links',
    icon: Link2,
    title: 'Cross-Database Linking',
    description: 'Automatically identifies records of the same project across different databases, establishes linked connections, and provides a comprehensive data view.',
    highlights: ['Entity Recognition', 'Link Analysis', 'Deduplication'],
  },
  {
    id: 'integration',
    icon: Database,
    title: 'Data Integration',
    description: 'Integrates multi-level metadata such as sample information, experimental design, and cell type annotations to support deep data mining.',
    highlights: ['Multi-level Data', 'Version Control', 'Incremental Updates'],
  },
  {
    id: 'filter',
    icon: Filter,
    title: 'Flexible Filtering',
    description: 'Provides rich filtering conditions, supporting precise filtering by tissue, disease, cell type, assay method, and more.',
    highlights: ['Real-time Count', 'Hierarchical Filter', 'Save Conditions'],
  },
  {
    id: 'share',
    icon: Share2,
    title: 'Easy Sharing',
    description: 'Generate shareable search links, save filter conditions, and collaborate with team members on research.',
    highlights: ['Permanent Links', 'Collaboration', 'Export Reports'],
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        '.feat-title',
        { opacity: 0.9, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
          },
        }
      );

      // Feature cards animation
      gsap.fromTo(
        '.feat-card',
        { opacity: 0.9, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: '.feat-grid',
            start: 'top 90%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-16" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-[960px] mx-auto px-6">
        {/* Section Header */}
        <div className="feat-title text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4"
            style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <Layers className="w-4 h-4" />
            Core Features
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Built for Researchers
          </h2>
          <p className="max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
            From data discovery to download and analysis, providing full-process metadata service support.
          </p>
        </div>

        {/* Features Grid */}
        <div className="feat-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="feat-card group rounded-xl p-6 border transition-all duration-300 hover:-translate-y-1"
                style={{ 
                  background: 'var(--bg-card)', 
                  borderColor: 'var(--border)',
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
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'var(--accent-bg)' }}>
                  <Icon className="w-6 h-6 transition-colors" style={{ color: 'var(--accent)' }} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-2 transition-colors group-hover:text-[var(--accent)]"
                  style={{ color: 'var(--text-primary)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {feature.description}
                </p>

                {/* Highlights */}
                <div className="flex flex-wrap gap-2">
                  {feature.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="px-2 py-1 rounded-md text-xs"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
