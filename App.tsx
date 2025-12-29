
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { TradeProvider } from './contexts/TradeContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard/index';
import { Journal } from './pages/Journal';
import { Reports } from './pages/Reports/index'; // Explicitly point to index to avoid conflict with Reports.tsx
import { Trades } from './pages/Trades';
import { StrategyPage } from './pages/Strategy/index';
import { StrategyDetails } from './pages/Strategy/StrategyDetails'; 
import { TradeInfoModal } from './components/TradeModal'; 
import { TagManagementModal } from './components/TagManagementModal';
import { UserSettingsModal } from './components/Dashboard/UserSettings';

const App: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);

  // --- Auto-Zoom Logic for High DPI Screens (Pixel Perfect Fix) ---
  useEffect(() => {
    const handleResize = () => {
      // Check if the browser supports the non-standard 'zoom' property (Chrome/Edge)
      if ('zoom' in document.body.style) {
        const dpr = window.devicePixelRatio;
        
        // Only apply correction if scaling is active (>1) and not extreme (e.g. mobile > 2)
        // Typically targets 1.1, 1.25, 1.5, 1.75 scaling
        if (dpr > 1 && dpr <= 2) {
          const zoomLevel = 1 / dpr;
          
          // Use Precise Pixel Calculation
          // If screen is 1920x1080 but scaled 125%, innerWidth is 1536.
          // 1536 * 1.25 = 1920. This restores the 1:1 physical pixel mapping.
          const width = window.innerWidth * dpr;
          const height = window.innerHeight * dpr;

          (document.body.style as any).zoom = zoomLevel;
          document.body.style.width = `${width}px`;
          document.body.style.height = `${height}px`;
        } else {
          (document.body.style as any).zoom = 1;
          document.body.style.width = '100%';
          document.body.style.height = '100%';
        }
      }
    };

    // Initial check
    handleResize();

    // Listen for changes (e.g. user drags window to a different monitor or resizes)
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      // Cleanup
      (document.body.style as any).zoom = 1;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    };
  }, []);

  return (
    <TradeProvider>
      <HashRouter>
        <Layout 
            onOpenAddModal={() => setIsModalOpen(true)}
            onOpenTagManager={() => setIsTagManagerOpen(true)}
            onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/strategy" element={<StrategyPage />} />
            <Route path="/strategy/:id" element={<StrategyDetails />} /> 
          </Routes>
        </Layout>
        
        <TradeInfoModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          mode="add"
        />

        <TagManagementModal
            isOpen={isTagManagerOpen}
            onClose={() => setIsTagManagerOpen(false)}
        />

        <UserSettingsModal
            isOpen={isUserSettingsOpen}
            onClose={() => setIsUserSettingsOpen(false)}
        />
      </HashRouter>
    </TradeProvider>
  );
};

export default App;
