import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrades } from '../contexts/TradeContext';
import { 
    calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor, 
    calculateAvgWinLoss, calculateRMultiple 
} from '../utils/calculations';
import { ArrowLeft, Edit, Trash2, CheckCircle2, TrendingUp, TrendingDown, Target, List, BarChart2, BookOpen } from 'lucide-react';
import { StrategyModal } from '../components/StrategyModal';
import { Strategy, TradeStatus } from '../types';

type Tab = 'overview' | 'rules' | 'trades';

export const StrategyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { strategies, filteredTrades, deleteStrategy } = useTrades();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Find Strategy
  const strategy = strategies.find(s => s.id === id);

  // Calculate Stats specific to this strategy
  const stats = useMemo(() => {
      if (!strategy) return null;
      
      const trades = filteredTrades.filter(t => t.playbookId === strategy.id && t.exitPrice !== undefined);
      const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t), 0);
      const winRate = calculateWinRate(trades);
      const profitFactor = calculateProfitFactor(trades);
      const { avgWin, avgLoss } = calculateAvgWinLoss(trades);
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
  }, [strategy, filteredTrades]);

  if (!strategy || !stats) {
      return <div className="p-10 text-center text-slate-500">Strategy not found.</div>;
  }

  const handleDelete = async () => {
      if (confirm('確定要刪除此策略嗎？交易紀錄將被保留。')) {
          await deleteStrategy(strategy.id);
          navigate('/strategy');
      }
  };

  // Helper Component for Stats Cards
  const StatCard = ({ label, value, colorClass = "text-white" }: { label: string, value: string, colorClass?: string }) => (
      <div className="bg-surface border border-slate-700 p-4 rounded-xl shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      </div>
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-700/50 pb-6">
            <button onClick={() => navigate('/strategy')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-fit">
                <ArrowLeft size={16} /> Back to Strategies
            </button>
            
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-lg" style={{ backgroundColor: strategy.color || '#6366f1' }}>
                        {strategy.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{strategy.name}</h1>
                        <p className="text-slate-400 text-sm mt-1">{strategy.description || "No description provided."}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                        <Edit size={16} /> Edit
                    </button>
                    <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-400 transition-colors">
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            </div>
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

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pt-2">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        label="Total Net P&L" 
                        value={formatCurrency(stats.totalPnL)} 
                        colorClass={stats.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"} 
                    />
                    <StatCard 
                        label="Win Rate" 
                        value={`${stats.winRate}%`} 
                        colorClass={stats.winRate >= 50 ? "text-emerald-400" : "text-slate-200"} 
                    />
                    <StatCard 
                        label="Profit Factor" 
                        value={stats.profitFactor.toFixed(2)} 
                    />
                    <StatCard 
                        label="Expectancy" 
                        value={formatCurrency(stats.expectancy)} 
                        colorClass={stats.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}
                    />
                    
                    <div className="col-span-1 md:col-span-2 bg-surface border border-slate-700 p-6 rounded-xl shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Average Performance</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300">Average Winner</span>
                                <span className="text-emerald-400 font-bold">{formatCurrency(stats.avgWin)}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full" style={{ width: '100%' }}></div>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-slate-300">Average Loser</span>
                                <span className="text-red-400 font-bold">{formatCurrency(stats.avgLoss)}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-red-500 h-full" style={{ width: stats.avgLoss !== 0 ? Math.min(Math.abs(stats.avgLoss / stats.avgWin) * 100, 100) : 0 + '%' }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 bg-surface border border-slate-700 p-6 rounded-xl shadow-sm flex flex-col justify-center items-center text-center">
                         <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 ${stats.winRate >= 50 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {stats.winRate >= 50 ? <TrendingUp size={40} /> : <TrendingDown size={40} />}
                         </div>
                         <p className="text-slate-400 text-sm">Strategy Performance</p>
                         <p className="text-white font-bold mt-1">
                             {stats.totalPnL > 0 ? "Profitable Strategy" : "Unprofitable Strategy"}
                         </p>
                    </div>
                </div>
            )}

            {/* RULES TAB */}
            {activeTab === 'rules' && (
                <div className="bg-surface border border-slate-700 rounded-xl p-6 max-w-3xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="text-primary" size={20} /> Execution Checklist
                    </h3>
                    <div className="space-y-3">
                        {strategy.rules && strategy.rules.length > 0 ? (
                            strategy.rules.map((rule, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                    <CheckCircle2 className="text-emerald-500 mt-0.5 flex-shrink-0" size={18} />
                                    <span className="text-slate-200 text-sm">{rule}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-slate-500 italic">
                                No rules defined for this strategy yet.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TRADES TAB */}
            {activeTab === 'trades' && (
                <div className="bg-surface border border-slate-700 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-900/50 text-xs font-bold text-slate-400 uppercase border-b border-slate-700">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Symbol</th>
                                    <th className="px-6 py-3">Side</th>
                                    <th className="px-6 py-3 text-right">Net P&L</th>
                                    <th className="px-6 py-3 text-right">R-Multiple</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {stats.trades.map(trade => (
                                    <tr key={trade.id} className="hover:bg-slate-700/20">
                                        <td className="px-6 py-4 text-slate-300">
                                            {new Date(trade.entryDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-white">{trade.symbol}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.direction === 'Long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {trade.direction}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${calculatePnL(trade) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(calculatePnL(trade))}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-400">
                                            {calculateRMultiple(trade)}R
                                        </td>
                                    </tr>
                                ))}
                                {stats.trades.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-500">
                                            No trades linked to this strategy.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

        <StrategyModal 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            initialData={strategy}
        />
    </div>
  );
};