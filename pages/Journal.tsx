
import React, { useState, useEffect, useRef } from 'react';
import { useTrades } from '../contexts/TradeContext';
import { calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor, calculateRMultiple } from '../utils/calculations';
import { ChevronDown, ChevronUp, Calendar as CalendarIcon, Image as ImageIcon } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { Trade, Strategy, TradeDirection, TradeStatus } from '../types';
import { TradeInfoModal } from '../components/TradeModal'; 
import { useLocation } from 'react-router-dom';

// Helpers
const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getDate() === d2.getDate();

const getIsoTime = (isoString: string) => {
    if (!isoString) return '-';
    try {
        return isoString.split('T')[1].substring(0, 5);
    } catch (e) {
        return '-';
    }
};

const getDuration = (startIso: string, endIso?: string) => {
    if (!endIso) return '-';
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diff = end - start;
    const mins = Math.floor(diff / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

// --- Daily Card Component ---
interface DailySummaryCardProps {
    dateStr: string;
    trades: Trade[];
    strategies: Strategy[];
    onEditTrade: (trade: Trade) => void;
    onDeleteTrade: (id: string) => void;
    defaultExpanded?: boolean;
    commissionPerUnit: number;
}

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ dateStr, trades, strategies, onEditTrade, onDeleteTrade, defaultExpanded = false, commissionPerUnit }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    // Use exitPrice existence as filter
    const closedTrades = trades.filter(t => t.exitPrice !== undefined);
    
    // Auto-scroll ref
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (defaultExpanded && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [defaultExpanded]);
    
    // Stats
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t, commissionPerUnit), 0);
    const winRate = calculateWinRate(closedTrades);
    const profitFactor = calculateProfitFactor(closedTrades, commissionPerUnit);
    const winners = closedTrades.filter(t => calculatePnL(t, commissionPerUnit) > 0).length;
    const losers = closedTrades.filter(t => calculatePnL(t, commissionPerUnit) <= 0).length;
    const volume = closedTrades.reduce((acc, t) => acc + t.quantity, 0);
    const commissions = closedTrades.reduce((acc, t) => acc + (commissionPerUnit > 0 ? (t.quantity * commissionPerUnit) : (t.commission || 0)), 0);
    const grossPnL = totalPnL + commissions;
    
    // Parse the dateStr (YYYY-MM-DD) which is already in EST from grouping
    const dateObj = new Date(dateStr); 

    // Chart Data Generation & Gradient Offset Calculation
    const { chartData, offset } = React.useMemo(() => {
        // Sort trades by Exit Time (or Entry Time fallback) ascending
        const sortedTrades = [...closedTrades].sort((a, b) => {
            const timeA = new Date(a.exitDate || a.entryDate).getTime();
            const timeB = new Date(b.exitDate || b.entryDate).getTime();
            return timeA - timeB;
        });

        let runningPnL = 0;
        const data: any[] = [];
        
        // If only one trade, start chart at 09:30 with 0 PnL
        if (sortedTrades.length === 1) {
             data.push({
                time: '09:30',
                pnl: 0,
             });
        }
        
        sortedTrades.forEach((t) => {
            const pnl = calculatePnL(t, commissionPerUnit);
            runningPnL += pnl;
            data.push({ 
                time: getIsoTime(t.exitDate || t.entryDate), 
                pnl: runningPnL 
            });
        });

        if (data.length === 0) return { chartData: [], offset: 0 };

        const max = Math.max(...data.map(d => d.pnl), 0);
        const min = Math.min(...data.map(d => d.pnl), 0);
        let off = 0;

        if (max <= 0) {
            off = 0; 
        } else if (min >= 0) {
            off = 1; 
        } else {
            off = max / (max - min); 
        }

        return { chartData: data, offset: off };
    }, [closedTrades, commissionPerUnit]);

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
                        <AreaChart data={chartData} margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={offset} stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset={offset} stopColor="#ef4444" stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                            {/* Updated Grid Color */}
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                            <YAxis 
                                width={50} 
                                tick={{fill: '#94a3b8', fontSize: 10}}
                                tickFormatter={(val) => `$${val}`}
                                allowDecimals={false}
                                axisLine={false}
                                tickLine={false}
                            />
                            <XAxis 
                                dataKey="time" 
                                tick={{fill: '#94a3b8', fontSize: 10}}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={20}
                            />
                            <RechartsTooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        const value = payload[0].value as number;
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{data.time}</p>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${value >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                    <span className={`font-bold ml-auto text-white`}>{formatCurrency(value)}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
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
            
            {/* Expanded Details Table - Updated to match DayDetailsModal */}
            {isExpanded && (
                <div className="border-t border-slate-700 p-4 bg-surface rounded-xl overflow-hidden">
                    <div className="bg-surface border border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-base">
                            <thead className="bg-slate-800/50 text-slate-300 text-sm font-bold border-b border-slate-700 tracking-wide">
                                <tr>
                                    <th className="px-4 py-4">Open Time</th>
                                    <th className="px-2 py-4">Symbol</th>
                                    <th className="px-2 py-4">Side</th>
                                    <th className="px-2 py-4 text-center">Status</th>
                                    <th className="px-2 py-4 text-right">Entry</th>
                                    <th className="px-4 py-4 text-right">Exit</th>
                                    <th className="px-4 py-4 text-right">Net P&L</th>
                                    <th className="px-4 py-4 text-right">RR</th>
                                    <th className="px-4 py-4 text-right pr-12">Duration</th>
                                    <th className="px-4 py-4 text-center">Strategy</th>
                                    {/* Action Column Removed */}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {closedTrades.map(trade => {
                                    const pnl = calculatePnL(trade, commissionPerUnit);
                                    const rr = calculateRMultiple(trade, commissionPerUnit);
                                    const strategyName = strategies.find(s => s.id === trade.playbookId)?.name || '-';
                                    const openTimeStr = getIsoTime(trade.entryDate);
                                    const exitTimeStr = getIsoTime(trade.exitDate || '');
                                    const durationStr = getDuration(trade.entryDate, trade.exitDate);

                                    return (
                                        <React.Fragment key={trade.id}>
                                            <tr 
                                                className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                                                onClick={() => onEditTrade(trade)}
                                            >
                                                <td className="px-4 py-4 text-white font-mono">{openTimeStr}</td>
                                                <td className="px-2 py-4 font-bold text-white">
                                                    <div className="flex items-center gap-1">
                                                        {trade.symbol}
                                                        {trade.screenshotUrl && <ImageIcon size={12} className="text-slate-500" />}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.direction === TradeDirection.LONG ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {trade.direction === TradeDirection.LONG ? 'LONG' : 'SHORT'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase 
                                                        ${trade.status === TradeStatus.WIN ? 'bg-emerald-500 text-white' : 
                                                          trade.status === TradeStatus.LOSS ? 'bg-red-500 text-white' : 
                                                          trade.status === TradeStatus.BREAK_EVEN ? 'bg-slate-600 text-slate-200' : 
                                                          trade.status.includes('Win') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {trade.status}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-4 text-right text-white font-medium">
                                                    {trade.entryPrice}
                                                </td>
                                                <td className="px-4 py-4 text-right text-white font-medium">
                                                    {trade.exitPrice || '-'}
                                                </td>
                                                <td className={`px-4 py-4 text-right font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {formatCurrency(pnl)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-white font-medium">
                                                    {rr !== undefined ? `${rr}R` : '-'}
                                                </td>
                                                <td className="px-4 py-4 text-right text-white font-medium pr-12">
                                                    {durationStr}
                                                </td>
                                                <td className="px-4 py-4 text-white font-medium text-center">
                                                    {strategyName}
                                                </td>
                                            </tr>
                                            {/* Show image if available inline */}
                                            {trade.screenshotUrl && (
                                                <tr className="bg-slate-900/40" onClick={(e) => e.stopPropagation()}>
                                                    <td colSpan={10} className="py-2 px-4">
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
                </div>
            )}
        </div>
    );
};

export const Journal: React.FC = () => {
  const { filteredTrades, deleteTrade, userSettings, strategies } = useTrades(); 
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
                            strategies={strategies} // Pass strategies down
                            onEditTrade={(t) => { setEditingTrade(t); setIsEditModalOpen(true); }}
                            onDeleteTrade={deleteTrade}
                            defaultExpanded={isFocused}
                            commissionPerUnit={userSettings.commissionPerUnit}
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
            mode="edit"
          />
      )}
    </div>
  );
};
