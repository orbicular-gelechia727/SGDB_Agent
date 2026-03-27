import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App';
import LandingPage from './pages/LandingPage';
import ExplorePage from './pages/ExplorePage';
import DatasetDetailPage from './pages/DatasetDetailPage';
import StatsPage from './pages/StatsPage';
import AdvancedSearchPage from './pages/AdvancedSearchPage';
import DownloadsPage from './pages/DownloadsPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/singledb">
      <Routes>
        <Route element={<App />}>
          <Route index element={<LandingPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="explore/:id" element={<DatasetDetailPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="search" element={<AdvancedSearchPage />} />
          <Route path="chat" element={<Navigate to="/search" replace />} />
          <Route path="downloads" element={<DownloadsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
