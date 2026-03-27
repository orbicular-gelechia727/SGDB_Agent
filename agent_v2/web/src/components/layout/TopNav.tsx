import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, Home, Compass, BarChart3, Sparkles, Download } from 'lucide-react';

interface NavItem {
  id: string;
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', to: '/', label: 'Home', icon: Home, end: true },
  { id: 'explore', to: '/explore', label: 'Explore', icon: Compass, end: false },
  { id: 'stats', to: '/stats', label: 'Statistics', icon: BarChart3, end: false },
  { id: 'search', to: '/search', label: 'Advanced', icon: Sparkles, end: false },
  { id: 'downloads', to: '/downloads', label: 'Downloads', icon: Download, end: false },
];

export function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/explore?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const isHomePage = location.pathname === '/';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isHomePage && !isScrolled
            ? 'bg-transparent'
            : 'bg-[var(--nav-bg)]/95 backdrop-blur-xl shadow-sm'
        }`}
      >
        <div className="max-w-[1120px] mx-auto px-6">
          <nav className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
                  <path
                    d="M8 4C8 4 14 10 14 16C14 22 8 28 8 28"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M24 4C24 4 18 10 18 16C18 22 24 28 24 28"
                    stroke="#1e6bb8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line x1="10" y1="8" x2="22" y2="8" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="13" y1="13" x2="19" y2="13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="13" y1="19" x2="19" y2="19" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="10" y1="24" x2="22" y2="24" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="10" cy="8" r="2" fill="#38bdf8" />
                  <circle cx="22" cy="8" r="2" fill="#1e6bb8" />
                  <circle cx="13" cy="13" r="1.5" fill="#38bdf8" />
                  <circle cx="19" cy="13" r="1.5" fill="#1e6bb8" />
                  <circle cx="13" cy="19" r="1.5" fill="#1e6bb8" />
                  <circle cx="19" cy="19" r="1.5" fill="#38bdf8" />
                  <circle cx="10" cy="24" r="2" fill="#1e6bb8" />
                  <circle cx="22" cy="24" r="2" fill="#38bdf8" />
                </svg>
              </div>
              <span className={`text-lg font-bold tracking-tight transition-colors ${
                isHomePage && !isScrolled ? 'text-white' : 'text-white'
              }`}>
                SCeQTL
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isHomePage && !isScrolled
                  ? 'bg-white/20 text-white/90'
                  : 'bg-[var(--accent)]/20 text-[var(--nav-accent)]'
              }`}>
                v2.0
              </span>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.end}
                    className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                      isHomePage && !isScrolled
                        ? isActive
                          ? 'text-white bg-white/20'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                        : isActive
                        ? 'text-white bg-white/10'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>

            <div className="flex-1" />

            {/* Search */}
            <form onSubmit={handleSearch} className="hidden sm:block w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search datasets..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-white/10 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-[var(--nav-accent)]/40 transition-all"
                />
              </div>
            </form>

            {/* Meta Stats */}
            <div className="hidden lg:flex items-center text-xs text-white/40 gap-2 shrink-0">
              <span className="text-[var(--nav-accent)] font-medium">756K</span> samples
              <span className="text-white/20">|</span>
              <span className="text-[var(--nav-accent)] font-medium">12</span> databases
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isHomePage && !isScrolled
                  ? 'text-white hover:bg-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Menu */}
      <div
        className={`md:hidden fixed top-16 left-0 right-0 bg-[var(--nav-bg)] border-b border-white/10 shadow-lg transition-all duration-300 z-40 ${
          mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        <div className="px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
          {/* Mobile Search */}
          <div className="pt-3 mt-3 border-t border-white/10">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search datasets..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15"
              />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
