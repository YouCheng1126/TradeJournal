import React, { useState, useMemo } from 'react';
import { useTrades } from '../contexts/TradeContext';
import { Plus, BookOpen, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { StrategyModal } from '../components/StrategyModal';
import { Strategy } from '../types';
import { 
    calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor 
} from '../utils/calculations';
import { useNavigate } from 'react-router-dom';

export const StrategyPage: React.FC = () => {
  const { strategies, filteredTrades } = useTrades();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // Calculate stats for each strategy based on filteredTrades
  const strategyStats = useMemo(() => {
      return strategies.map(st => {
          // Use filteredTrades to respect date range from global context
          const trades = filteredTrades.filter(t => t.playbookId === st.id && t.exitPrice !== undefined);
          
          const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t), 0);
          const winRate = calculateWinRate(trades);
          const profitFactor = calculateProfitFactor(trades);
          const tradeCount = trades.length;

          return {
              ...st,
              stats: {
                  totalPnL,
                  winRate,
                  tradeCount,
                  profitFactor
              }
          };
      });
  }, [strategies, filteredTrades]);

  const handleCreate = () => {
      setIsModalOpen(true);
  };

  const handleCardClick = (id: string) => {
      navigate(`/strategy/${id}`);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
        
        {/* Simplified Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
            <div>
                <h2 className="text-2xl font-bold text-white">My Strategies</h2>
                <p className="text-slate-400 text-sm mt-1">Manage and analyze your trading playbooks.</p>
            </div>
            
            <button 
                onClick={handleCreate}
                className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all"
            >
                <Plus size={16} /> Create Strategy
            </button>
        </div>

        {/* Grid View (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategyStats.map((st) => (
                <div 
                    key={st.id} 
                    onClick={() => handleCardClick(st.id)}
                    className="bg-surface rounded-xl overflow-hidden border border-slate-700 hover:border-slate-500 hover:shadow-xl transition-all cursor-pointer group flex flex-col"
                >
                    {/* Top Color Bar */}
                    <div className="h-1.5 w-full" style={{ backgroundColor: st.color || '#6366f1' }}></div>
                    
                    <div className="p-6 flex flex-col flex-1">
                        {/* Header Section */}
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{st.name}</h3>
                            <div className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs font-semibold">
                                {st.stats.tradeCount} Trades
                            </div>
                        </div>

                        {/* Description Truncated */}
                        <p className="text-slate-500 text-sm mb-6 line-clamp-2 min-h-[40px]">
                            {st.description || "No description provided."}
                        </p>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-slate-700/50">
                            <div>
                                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Net P&L</p>
                                <p className={`text-xl font-bold ${st.stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(st.stats.totalPnL)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Win Rate</p>
                                <div className="flex items-center justify-end gap-1">
                                    {st.stats.winRate >= 50 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
                                    <span className="text-xl font-bold text-white">{st.stats.winRate}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Hover Action Indicator */}
                    <div className="bg-slate-800/50 p-2 flex justify-center items-center text-xs text-slate-500 group-hover:bg-slate-800 group-hover:text-primary transition-colors">
                        View Details <ChevronRight size={12} className="ml-1" />
                    </div>
                </div>
            ))}

            {/* Add New Placeholder Card */}
            <div 
                onClick={handleCreate}
                className="border-2 border-dashed border-slate-700 hover:border-primary/50 hover:bg-slate-800/30 rounded-xl flex flex-col items-center justify-center min-h-[250px] cursor-pointer transition-all group"
            >
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 group-hover:bg-primary/10 group-hover:border-primary/30 flex items-center justify-center mb-3 transition-colors">
                    <Plus size={24} className="text-slate-500 group-hover:text-primary" />
                </div>
                <h3 className="text-slate-400 font-semibold group-hover:text-white text-sm">Create New Strategy</h3>
            </div>
        </div>

        <StrategyModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
        />
    </div>
  );
};