import { useState, useEffect } from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { QuickStats } from '../components/landing/QuickStats';
import { DatabaseCards } from '../components/landing/DatabaseCards';
import { RecentHighlights } from '../components/landing/RecentHighlights';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HighlightsSection } from '../components/landing/HighlightsSection';
import { CTASection } from '../components/landing/CTASection';
import { getStats } from '../services/api';
import type { StatsResponse } from '../types/api';

export default function LandingPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  
  useEffect(() => { 
    getStats().then(setStats).catch(console.error); 
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <HeroSection />
      <QuickStats stats={stats} />
      <DatabaseCards stats={stats} />
      <FeaturesSection />
      <HighlightsSection />
      <RecentHighlights />
      <CTASection />
      
      {/* Footer */}
      <footer className="border-t py-8" style={{ 
        background: 'var(--nav-bg)', 
        borderColor: 'rgba(255,255,255,0.1)' 
      }}>
        <div className="max-w-[960px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
                <path d="M8 4C8 4 14 10 14 16C14 22 8 28 8 28" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                <path d="M24 4C24 4 18 10 18 16C18 22 24 28 24 28" stroke="#1e6bb8" strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="8" r="2" fill="#38bdf8" />
                <circle cx="22" cy="8" r="2" fill="#1e6bb8" />
              </svg>
              <span className="text-sm font-semibold text-white">SCeQTL Portal</span>
              <span className="text-xs text-white/40">v2.0</span>
            </div>
            <div className="flex items-center gap-6 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span>Unified single-cell RNA-seq metadata retrieval</span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">Powered by SCeQTL-Agent</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-xs" 
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
            © 2024 SCeQTL Portal. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
