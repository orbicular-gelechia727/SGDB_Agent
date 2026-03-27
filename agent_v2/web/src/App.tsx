import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getStats, getDashboardStats } from './services/api';

function App() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  // Prefetch stats data on app mount (non-blocking, populates client cache)
  useEffect(() => {
    getStats().catch(() => {});
    getDashboardStats().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
        <TopNav />
        {/* Add spacer for fixed header on non-home pages */}
        {!isHomePage && <div className="h-16 shrink-0" />}
        <main className="flex flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
