import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Brain, Heart, Activity, Bone, Microscope } from 'lucide-react';
import { gsap } from 'gsap';

const CATEGORIES = [
  { label: 'Brain', param: 'tissue', value: 'brain', icon: Brain },
  { label: 'Heart', param: 'tissue', value: 'heart', icon: Heart },
  { label: 'Liver', param: 'tissue', value: 'liver', icon: Activity },
  { label: 'Bone', param: 'tissue', value: 'bone', icon: Bone },
  { label: 'Tumor', param: 'disease', value: 'cancer', icon: Microscope },
];

const STATS = [
  { label: 'Samples', value: '756K+', color: '#3b82f6' },
  { label: 'Projects', value: '50K+', color: '#06b6d4' },
  { label: 'Databases', value: '12', color: '#8b5cf6' },
  { label: 'Cell Types', value: '100+', color: '#10b981' },
];

export function HeroSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        titleRef.current,
        { opacity: 0.9, y: 15 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.1 }
      );

      // Subtitle animation
      gsap.fromTo(
        subtitleRef.current,
        { opacity: 0.9, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.2 }
      );

      // Search bar animation
      gsap.fromTo(
        searchRef.current,
        { opacity: 0.9, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.3 }
      );

      // Stats cards animation
      gsap.fromTo(
        '.hero-stat-card',
        { opacity: 0.9, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.08,
          delay: 0.4,
        }
      );

      // Tags animation
      gsap.fromTo(
        '.hero-tag',
        { opacity: 0.9, scale: 0.95 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.3,
          ease: 'power2.out',
          stagger: 0.05,
          delay: 0.5,
        }
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/explore?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <section ref={heroRef} className="relative overflow-hidden min-h-[580px] flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      {/* Background pattern with animation */}
      <div className="absolute inset-0 opacity-40"
        style={{ 
          backgroundImage: 'url(/singledb/hero-pattern.svg)', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center' 
        }} />
      
      {/* Animated floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-2 h-2 rounded-full bg-blue-400/30 animate-float" style={{ top: '20%', left: '10%', animationDelay: '0s' }} />
        <div className="absolute w-3 h-3 rounded-full bg-cyan-400/20 animate-float" style={{ top: '30%', left: '80%', animationDelay: '1s' }} />
        <div className="absolute w-2 h-2 rounded-full bg-blue-400/30 animate-float" style={{ top: '60%', left: '15%', animationDelay: '2s' }} />
        <div className="absolute w-3 h-3 rounded-full bg-cyan-400/20 animate-float" style={{ top: '70%', left: '75%', animationDelay: '1.5s' }} />
        <div className="absolute w-2 h-2 rounded-full bg-purple-400/20 animate-float" style={{ top: '40%', left: '90%', animationDelay: '0.5s' }} />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/50" />

      <div className="relative z-10 max-w-[960px] mx-auto px-6 pt-20 pb-16 text-center">
        {/* Version badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-white/80">v2.0 Now Available</span>
        </div>

        {/* Title */}
        <h1 ref={titleRef} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
          Single-Cell RNA Sequencing
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Metadata Portal
          </span>
        </h1>

        {/* Subtitle */}
        <p ref={subtitleRef} className="text-lg text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
          Unified search across diverse databases, powering genomic discoveries. 
          Explore metadata from over 750,000 single-cell samples.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} ref={searchRef} className="max-w-2xl mx-auto mb-8">
          <div 
            className="relative flex items-center bg-white rounded-2xl shadow-2xl transition-all duration-300"
            style={{
              boxShadow: searchFocused 
                ? '0 0 0 4px rgba(30, 107, 184, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <Search className="absolute left-5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "human brain Alzheimer" or "GSE149614"'
              className="w-full py-4 pl-14 pr-32 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none text-base"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <button 
              type="submit"
              className="absolute right-2 px-6 py-2.5 text-white rounded-xl font-medium text-sm transition-all duration-200 hover:opacity-90 flex items-center gap-2"
              style={{ background: 'var(--accent)' }}
            >
              Search <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Quick Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          <span className="text-sm text-white/50 mr-2">Popular:</span>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => navigate(`/explore?${cat.param}=${encodeURIComponent(cat.value)}`)}
                className="hero-tag flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm hover:bg-white/20 transition-all duration-200 hover:scale-105"
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="hero-stat-card rounded-xl p-4 text-left transition-all duration-200 hover:-translate-y-1"
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                backdropFilter: 'blur(10px)',
                borderLeft: `4px solid ${stat.color}`
              }}
            >
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-page)] to-transparent" />
    </section>
  );
}
