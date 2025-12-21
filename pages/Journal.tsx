import React, { useState, useEffect, useRef } from 'react';
import { useTrades } from '../contexts/TradeContext';
import { calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor } from '../utils/calculations';
import { ChevronDown, ChevronUp, Calendar as CalendarIcon, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { Trade } from '../types';
import { TradeInfoModal } from '../components/TradeInfoModal';
import { useLocation } from 'react-router-dom';

// Helpers
const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getDate() === d2.getDate();

// --- Daily Card Component ---
interface DailySummaryCardProps {
    dateStr: string;
    trades: Trade[];
    onEditTrade: (trade: Trade) => void;
    onDeleteTrade: (id: string) => void;
    defaultExpanded?: boolean;
}

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ dateStr, trades, onEditTrade, onDeleteTrade, defaultExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    // Use exitPrice existence as filter
    const closedTrades = trades.filter(t => t.exitPrice !== undefined);
    
    // Auto-scroll ref
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (defaultExpanded && cardRef.current) {
            // Use timeout to ensure DOM is ready and layout is settled
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [defaultExpanded]);
    
    // Stats
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const winRate = calculateWinRate(closedTrades);
    const profitFactor = calculateProfitFactor(closedTrades);
    const winners = closedTrades.filter(t => calculatePnL(t) > 0).length;
    const losers = closedTrades.filter(t => calculatePnL(t) <= 0).length;
    const volume = closedTrades.reduce((acc, t) => acc + t.quantity, 0);
    const commissions = closedTrades.reduce((acc, t) => acc + (t.commission || 0), 0);
    const grossPnL = totalPnL + commissions;
    
    // Parse the dateStr (YYYY-MM-DD) which is already in EST from grouping
    const dateObj = new Date(dateStr); 

    // Chart Data Generation & Gradient Offset Calculation
    const { chartData, offset } = React.useMemo(() => {
        let runningPnL = 0;
        const data = [{ index: 0, pnl: 0 }];
        closedTrades.forEach((t, idx) => {
            runningPnL += calculatePnL(t);
            data.push({ index: idx + 1, pnl: runningPnL });
        });

        const max = Math.max(...data.map(d => d.pnl));
        const min = Math.min(...data.map(d => d.pnl));
        let off = 0;

        if (max <= 0) {
            off = 0; 
        } else if (min >= 0) {
            off = 1; 
        } else {
            off = max / (max - min); 
        }

        return { chartData: data, offset: off };
    }, [closedTrades]);

    const isProfit = totalPnL >= 0;
    const gradientId = `splitColor-${dateStr}`;

    return (
        <div ref={cardRef} className="bg-surface rounded-xl border border-slate-700 overflow-hidden mb-4 shadow-sm">
            {/* Card Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50 bg-slate-800/50 cursor-pointer hover:bg-slate-800/70 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 transition-transform">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">
                             {dateStr} <span className="text-sm font-normal text-slate-500">(EST)</span>
                        </h3>
                    </div>
                    <div className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        Net P&L {formatCurrency(totalPnL)}
                    </div>
                </div>
            </div>

            {/* Card Body */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
                {/* Left: Intraday Graph */}
                <div className="md:col-span-5 h-40 relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ left: 10, top: 5, bottom: 5, right: 10 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={offset} stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset={offset} stopColor="#ef4444" stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                            <YAxis 
                                width={60} 
                                tick={{fill: '#94a3b8', fontSize: 10}}
                                tickFormatter={(val) => `$${val}`}
                                allowDecimals={false}
                            />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9', fontSize: '12px' }}
                                itemStyle={{ color: '#f1f5f9' }}
                                formatter={(val: number) => [formatCurrency(val), 'PnL']}
                                labelFormatter={() => ''}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="pnl" 
                                stroke={`url(#${gradientId})`}
                                strokeWidth={2}
                                fill={`url(#${gradientId})`} 
                                activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                            />
                        </AreaChart>
                     </ResponsiveContainer>
                </div>

                {/* Right: Stats Grid */}
                <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                    <div>
                        <p className="text-sm font-semibold text-slate-400 mb-1">Total trades</p>
                        <p className="text-xl font-bold text-white">{closedTrades.length}</p>
                        <p className="text-sm font-semibold text-slate-400 mt-2">Winrate</p>
                        <p className="text-xl font-bold text-white">{winRate}%</p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-400 mb-1">Winners</p>
                        <p className="text-xl font-bold text-white">{winners}</p>
                        <p className="text-sm font-semibold text-slate-400 mt-2">Losers</p>
                        <p className="text-xl font-bold text-white">{losers}</p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-400 mb-1">Gross P&L</p>
                        <p className={`text-xl font-bold ${grossPnL >=0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(grossPnL)}</p>
                        <p className="text-sm font-semibold text-slate-400 mt-2">Volume</p>
                        <p className="text-xl font-bold text-white">{volume}</p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-400 mb-1">Commissions</p>
                        <p className="text-xl font-bold text-slate-300">{formatCurrency(commissions)}</p>
                        <p className="text-sm font-semibold text-slate-400 mt-2">Profit factor</p>
                        <p className="text-xl font-bold text-white">{profitFactor}</p>
                    </div>
                </div>
            </div>
            
            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                    <table className="w-full text-left text-xs text-slate-400">
                        <thead className="text-slate-500 uppercase font-semibold">
                            <tr>
                                <th className="pb-2 pl-2">Time (EST)</th>
                                <th className="pb-2">Symbol</th>
                                <th className="pb-2">Dir</th>
                                <th className="pb-2 text-right">Qty</th>
                                <th className="pb-2 text-right">Entry</th>
                                <th className="pb-2 text-right">Exit</th>
                                <th className="pb-2 text-right">Net P&L</th>
                                <th className="pb-2 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {closedTrades.map(trade => {
                                const pnl = calculatePnL(trade);
                                return (
                                    <React.Fragment key={trade.id}>
                                        <tr className="hover:bg-slate-700/30">
                                            <td className="py-2 pl-2">
                                                {new Date(trade.entryDate).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute:'2-digit', hour12: false })}
                                            </td>
                                            <td className="py-2 font-bold text-white">
                                                <div className="flex items-center gap-1">
                                                    {trade.symbol}
                                                    {trade.screenshotUrl && <ImageIcon size={12} className="text-slate-500" />}
                                                </div>
                                            </td>
                                            <td className="py-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${trade.direction === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {trade.direction === 'Long' ? 'L' : 'S'}
                                                </span>
                                            </td>
                                            <td className="py-2 text-right">{trade.quantity}</td>
                                            <td className="py-2 text-right">{trade.entryPrice}</td>
                                            <td className="py-2 text-right">{trade.exitPrice}</td>
                                            <td className={`py-2 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatCurrency(pnl)}
                                            </td>
                                            <td className="py-2 text-center flex justify-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); onEditTrade(trade); }} className="hover:text-white"><Edit size={14}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteTrade(trade.id); }} className="hover:text-red-400"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                        {/* Show image if available inline */}
                                        {trade.screenshotUrl && (
                                            <tr className="bg-slate-900/40">
                                                <td colSpan={8} className="py-2 px-4">
                                                    <div className="flex gap-2 items-start">
                                                        <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Screenshot:</span>
                                                        <a href={trade.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
                                                            <img 
                                                                src={trade.screenshotUrl} 
                                                                alt="Trade Screenshot" 
                                                                className="max-h-64 rounded border border-slate-700 shadow-md object-contain" 
                                                                onError={(e) => {
                                                                    const img = e.target as HTMLImageElement;
                                                                    img.style.display = 'none'; 
                                                                }}
                                                            />
                                                            <span className="text-xs text-blue-400 underline ml-2">開啟圖片連結</span>
                                                        </a>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export const Journal: React.FC = () => {
  const { filteredTrades, deleteTrade } = useTrades(); 
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const location = useLocation();
  
  // Navigation State from Dashboard
  const focusDateStr = (location.state as any)?.focusDate as string | undefined;

  // Group filtered trades by date (Desc) - USING EST/EDT
  const groupedTrades = React.useMemo(() => {
      const groups = new Map<string, Trade[]>();
      filteredTrades.forEach(t => {
          if (t.exitPrice === undefined) return;
          
          // Use Intl to get the date string in America/New_York timezone
          const dateKey = new Intl.DateTimeFormat('en-CA', { 
              timeZone: 'America/New_York' 
          }).format(new Date(t.entryDate)); // Returns YYYY-MM-DD
          
          if (!groups.has(dateKey)) {
              groups.set(dateKey, []);
          }
          groups.get(dateKey)!.push(t);
      });
      
      // Sort keys desc
      return Array.from(groups.keys()).sort((a, b) => b.localeCompare(a)).map(date => ({
          date,
          trades: groups.get(date)!
      }));
  }, [filteredTrades]);

  return (
    <div className="space-y-6">
       {/* Daily Journal List */}
       <div className="space-y-4">
            {groupedTrades.length > 0 ? (
                groupedTrades.map(group => {
                    // Match directly with the YYYY-MM-DD string passed from Dashboard
                    const isFocused = focusDateStr ? group.date === focusDateStr : false;
                    return (
                        <DailySummaryCard 
                            key={group.date} 
                            dateStr={group.date} 
                            trades={group.trades} 
                            onEditTrade={(t) => { setEditingTrade(t); setIsEditModalOpen(true); }}
                            onDeleteTrade={deleteTrade}
                            defaultExpanded={isFocused}
                        />
                    );
                })
            ) : (
                <div className="text-center py-20 text-slate-500">
                    <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarIcon size={32} />
                    </div>
                    <p>目前篩選條件下無交易紀錄</p>
                </div>
            )}
       </div>

       {/* Edit Modal (Replaced with TradeInfoModal) */}
       {editingTrade && (
          <TradeInfoModal 
            isOpen={isEditModalOpen}
            onClose={() => {
                setIsEditModalOpen(false);
                setEditingTrade(undefined);
            }}
            trade={editingTrade}
          />
      )}
    </div>
  );
};