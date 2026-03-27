import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

export function CTASection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-content',
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 relative overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 107, 184, 0.05) 0%, transparent 50%, rgba(6, 182, 212, 0.05) 100%)'
        }} />

      {/* Content */}
      <div className="cta-content relative z-10 max-w-[960px] mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
          <Sparkles className="w-4 h-4" />
          Start Exploring Now
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Ready to Accelerate Your Research?
        </h2>

        <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
          Join thousands of researchers worldwide using SCeQTL Portal to discover, analyze, and download single-cell data.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => navigate('/explore')}
            className="group relative px-8 py-4 rounded-xl font-medium text-base text-white transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#185a9a';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(30, 107, 184, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span className="flex items-center gap-2">
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          <button 
            onClick={() => navigate('/search')}
            className="px-8 py-4 rounded-xl font-medium text-base border transition-all duration-300"
            style={{ 
              background: 'var(--bg-card)', 
              borderColor: 'var(--border)',
              color: 'var(--text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
            }}
          >
            Advanced Search
          </button>
        </div>

        {/* Stats */}
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>750K+</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Samples</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>50K+</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Projects</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>12</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Databases</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
