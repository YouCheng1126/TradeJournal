
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTrades } from '../../contexts/TradeContext';
import { 
    calculatePnL, calculateWinRate, calculateProfitFactor, 
    calculateAvgWinLoss 
} from '../../utils/calculations';
import { ArrowLeft, BarChart2, Target, List } from 'lucide-react';
import { OverviewTab } from './components/OverviewTab';
import { RulesTab } from './components/RulesTab';
import { TradesTab } from './components/TradesTab';
import { TradeInfoModal } from '../../components/TradeModal';
import { Trade } from '../../types';

type Tab = 'overview' | 'rules' | 'trades';

export const StrategyDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { strategies, filteredTrades, updateStrategy, userSettings } = useTrades();
  
  // Set initial tab from navigation state or default to 'overview'
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Modal State
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
      const state = location.state as { initialTab?: Tab } | null;
      if (state?.initialTab) {
          setActiveTab(state.initialTab);
      }
  }, [location.state]);
  
  // Find Strategy
  const strategy = strategies.find(s => s.id === id);

  // Calculate Stats specific to this strategy
  const stats = useMemo(() => {
      if (!strategy) return null;
      
      const trades = filteredTrades.filter(t => t.playbookId === strategy.id && t.exitPrice !== undefined);
      const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
      const winRate = calculateWinRate(trades);
      const profitFactor = calculateProfitFactor(trades, userSettings.commissionPerUnit);
      const { avgWin, avgLoss } = calculateAvgWinLoss(trades, userSettings.commissionPerUnit);
      const tradeCount = trades.length;
      const expectancy = tradeCount > 0 ? totalPnL / tradeCount : 0;

      return {
          trades,
          totalPnL,
          winRate,
          profitFactor,
          avgWin,
          avgLoss,
          tradeCount,
          expectancy
      };
  }, [strategy, filteredTrades, userSettings.commissionPerUnit]);

  if (!strategy || !stats) {
      return <div className="p-10 text-center text-slate-500">Strategy not found.</div>;
  }

  const handleTradeClick = (trade: Trade) => {
      setEditingTrade(trade);
      setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
        {/* Header - Adjusted to pt-[5px] for precise alignment */}
        <div className="flex justify-between items-start pt-[5px] border-b border-slate-700/50 h-10">
            <button onClick={() => navigate('/strategy')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-fit text-sm font-medium">
                <ArrowLeft size={16} /> Back to Strategies
            </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-slate-700 text-sm font-medium">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`pb-3 flex items-center gap-2 transition-colors ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}
            >
                <BarChart2 size={16} /> Overview
            </button>
            <button 
                onClick={() => setActiveTab('rules')}
                className={`pb-3 flex items-center gap-2 transition-colors ${activeTab === 'rules' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}
            >
                <Target size={16} /> Rules
            </button>
            <button 
                onClick={() => setActiveTab('trades')}
                className={`pb-3 flex items-center gap-2 transition-colors ${activeTab === 'trades' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}
            >
                <List size={16} /> Trades ({stats.tradeCount})
            </button>
        </div>

        {/* Tab Content - Removed pt-2 to reduce gap with New Group button */}
        <div className="flex-1 overflow-y-auto pt-0">
            {activeTab === 'overview' && <div className="pt-2"><OverviewTab stats={stats} /></div>}
            {activeTab === 'rules' && (
                <RulesTab 
                    strategy={strategy} 
                    trades={stats.trades} 
                    commissionPerUnit={userSettings.commissionPerUnit}
                    onUpdateStrategy={updateStrategy}
                />
            )}
            {activeTab === 'trades' && (
                <div className="pt-2">
                    <TradesTab 
                        trades={stats.trades} 
                        commissionPerUnit={userSettings.commissionPerUnit} 
                        onTradeClick={handleTradeClick}
                    />
                </div>
            )}
        </div>

        {/* Edit Modal */}
        {editingTrade && (
            <TradeInfoModal 
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingTrade(undefined);
                }}
                trade={editingTrade}
                mode="edit"
            />
        )}
    </div>
  );
};
