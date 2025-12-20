import React, { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { TradeProvider } from './contexts/TradeContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Journal } from './pages/Journal';
import { Reports } from './pages/Reports';
import { Trades } from './pages/Trades';
import { StrategyPage } from './pages/Strategy';
import { StrategyDetails } from './pages/StrategyDetails'; // Import new page
import { TradeFormModal } from './components/TradeFormModal';

const App: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <TradeProvider>
      <HashRouter>
        <Layout onOpenAddModal={() => setIsModalOpen(true)}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/strategy" element={<StrategyPage />} />
            <Route path="/strategy/:id" element={<StrategyDetails />} /> 
          </Routes>
        </Layout>
        
        <TradeFormModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </HashRouter>
    </TradeProvider>
  );
};

export default App;