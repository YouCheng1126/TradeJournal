
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTrades } from '../../contexts/TradeContext';
import { Plus, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { StrategyModal } from './components/StrategyModal';
import { 
    calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor, calculateAvgWinLoss, calculateMaxDrawdown 
} from '../../utils/calculations';
import { useNavigate } from 'react-router-dom';
import { Strategy } from '../../types';

// Simple Circular Progress for Win Rate
const WinRateRing = ({ percent }: { percent: number }) => {
    const radius = 18;
    const stroke = 3;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    
    let color = '#10b981'; // Green
    if (percent < 40) color = '#ef4444'; // Red
    else if (percent < 50) color = '#f59e0b'; // Amber

    return (
        <div className="relative w-12 h-12 flex items-center justify-center">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                <circle
                    stroke="#334155"
                    strokeWidth={stroke}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                <circle
                    stroke={color}
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
            </svg>
        </div>
    );
};

export const StrategyPage: React.FC = () => {
  const navigate = useNavigate();
  const { strategies, filteredTrades, deleteStrategy, userSettings } = useTrades();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Delete State
  const [strategyToDelete, setStrategyToDelete] = useState<string | null>(null);
  
  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setActiveMenuId(null);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate stats for each strategy based on filteredTrades
  const strategyStats = useMemo(() => {
      return strategies.map(st => {
          // Use filteredTrades to respect date range from global context
          const trades = filteredTrades.filter(t => t.playbookId === st.id && t.exitPrice !== undefined);
          
          const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
          const winRate = calculateWinRate(trades);
          const profitFactor = calculateProfitFactor(trades, userSettings.commissionPerUnit);
          const { avgWin, avgLoss } = calculateAvgWinLoss(trades, userSettings.commissionPerUnit);
          const maxDrawdown = calculateMaxDrawdown(trades, userSettings.commissionPerUnit);
          const tradeCount = trades.length;
          const expectancy = tradeCount > 0 ? totalPnL / tradeCount : 0;
          
          // Avg Win/Loss Ratio
          const avgWinLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

          return {
              ...st,
              stats: {
                  totalPnL,
                  winRate,
                  tradeCount,
                  profitFactor,
                  avgWin,
                  avgLoss,
                  avgWinLossRatio,
                  expectancy,
                  maxDrawdown
              }
          };
      });
  }, [strategies, filteredTrades, userSettings.commissionPerUnit]);

  const handleCreate = () => {
      setIsModalOpen(true);
  };

  const handleCardClick = (id: string) => {
      navigate(`/strategy/${id}`);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleEdit = (e: React.MouseEvent, strategy: Strategy) => {
      e.stopPropagation();
      // Navigate to details page with state to select Rules tab
      navigate(`/strategy/${strategy.id}`, { state: { initialTab: 'rules' } });
      setActiveMenuId(null);
  };

  // Open Confirm Modal
  const confirmDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setStrategyToDelete(id);
      setActiveMenuId(null);
  };

  // Execute Delete
  const handleBulkDelete = async () => {
      if (strategyToDelete) {
          await deleteStrategy(strategyToDelete);
          setStrategyToDelete(null);
      }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
            <div>
                <h2 className="text-2xl font-bold text-white">My Strategies</h2>
            </div>
            
            <button 
                onClick={handleCreate}
                className="bg-primary hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all"
            >
                <Plus size={16} /> Create Strategy
            </button>
        </div>

        {/* Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategyStats.map((st) => (
                <div 
                    key={st.id} 
                    onClick={() => handleCardClick(st.id)}
                    className="bg-surface rounded-xl border border-slate-700 overflow-visible hover:shadow-xl hover:border-slate-500 transition-all cursor-pointer group flex flex-col relative"
                >
                    {/* Top Color Bar - Updated Default to Purple #8b5cf6 */}
                    <div className="h-1.5 w-full rounded-t-xl" style={{ backgroundColor: st.color || '#8b5cf6' }}></div>

                    {/* Main Content */}
                    <div className="p-6 flex-1">
                        {/* Title & Actions */}
                        <div className="flex justify-between items-start mb-6 relative">
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight group-hover:text-primary transition-colors">
                                    {st.name}
                                </h3>
                                <span className="text-xs font-semibold text-primary mt-1 inline-block bg-primary/10 px-2 py-0.5 rounded">
                                    {st.stats.tradeCount} trades
                                </span>
                            </div>
                            
                            <div className="relative">
                                <button 
                                    onClick={(e) => toggleMenu(e, st.id)}
                                    className={`p-1 rounded transition-colors ${activeMenuId === st.id ? 'text-white bg-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                                >
                                    <MoreHorizontal size={20} />
                                </button>
                                
                                {activeMenuId === st.id && (
                                    <div 
                                        ref={menuRef}
                                        className="absolute right-0 top-full mt-2 w-32 bg-[#475569] border border-slate-600 rounded-lg shadow-xl z-20 py-1 overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button 
                                            onClick={(e) => handleEdit(e, st)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-600/50"
                                        >
                                            <Edit size={14} /> Edit
                                        </button>
                                        <button 
                                            onClick={(e) => confirmDelete(e, st.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Split Data Presentation */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            
                            {/* Left Column */}
                            <div className="space-y-4 border-r border-slate-700/50 pr-4">
                                {/* Win Rate */}
                                <div className="flex items-center gap-3">
                                    <WinRateRing percent={st.stats.winRate} />
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Win rate</p>
                                        <p className="text-lg font-bold text-slate-200">{st.stats.winRate.toFixed(0)}%</p>
                                    </div>
                                </div>

                                {/* Profit Factor */}
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Profit factor</p>
                                    <p className="text-sm font-bold text-slate-200">{st.stats.profitFactor.toFixed(2)}</p>
                                </div>

                                {/* Expectancy */}
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Expectancy</p>
                                    <p className="text-sm font-bold text-slate-200">{formatCurrency(st.stats.expectancy)}</p>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-4 pl-1">
                                {/* Net P&L */}
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Net P&L</p>
                                    <p className={`text-xl font-bold ${st.stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatCurrency(st.stats.totalPnL)}
                                    </p>
                                </div>

                                {/* Avg Win/Loss Ratio */}
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Avg Win/Loss</p>
                                    <p className="text-sm font-bold text-slate-200">{st.stats.avgWinLossRatio.toFixed(2)}</p>
                                </div>

                                {/* Max Drawdown */}
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Max Drawdown</p>
                                    <p className="text-sm font-bold text-red-400">{formatCurrency(st.stats.maxDrawdown)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <StrategyModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
        />

        {/* Delete Confirmation Modal */}
        {strategyToDelete && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-surface border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 ring-4 ring-red-500/5">
                        <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Delete Strategy?</h3>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                        Are you sure you want to delete this strategy?<br/>
                        All associated trade tags will be preserved, but the strategy link will be removed.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={() => setStrategyToDelete(null)} 
                            className="px-6 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-500 rounded-lg hover:bg-slate-600 transition-all flex-1"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleBulkDelete} 
                            className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-500/20 transition-all flex-1"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};
