
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, ArrowRight } from 'lucide-react';
import { Trade, TradeDirection, TradeStatus } from '../../types';
import { useTrades } from '../../contexts/TradeContext';
import { calculatePnL, calculateWinRate, calculateProfitFactor, formatCurrency, calculateRMultiple } from '../../utils/calculations';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface DayDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date | null;
    trades: Trade[];
}

// Helper to get raw HH:MM from ISO string to match DB exactly
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

export const DayDetailsModal: React.FC<DayDetailsModalProps> = ({ isOpen, onClose, date, trades }) => {
    const { userSettings, strategies, setDateRange } = useTrades();
    const navigate = useNavigate();

    const stats = useMemo(() => {
        const closedTrades = trades.filter(t => t.exitPrice !== undefined);
        
        // Chart sorted by Exit Time
        closedTrades.sort((a, b) => {
            const timeA = new Date(a.exitDate || a.entryDate).getTime();
            const timeB = new Date(b.exitDate || b.entryDate).getTime();
            return timeA - timeB;
        });

        const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
        const winRate = calculateWinRate(closedTrades);
        const profitFactor = calculateProfitFactor(closedTrades, userSettings.commissionPerUnit);
        
        // Count based on status
        const winners = closedTrades.filter(t => t.status === TradeStatus.WIN || t.status === TradeStatus.SMALL_WIN).length;
        const losers = closedTrades.filter(t => t.status === TradeStatus.LOSS || t.status === TradeStatus.SMALL_LOSS).length;
        
        const volume = closedTrades.reduce((acc, t) => acc + t.quantity, 0);
        const commissions = closedTrades.reduce((acc, t) => acc + (userSettings.commissionPerUnit > 0 ? (t.quantity * userSettings.commissionPerUnit) : (t.commission || 0)), 0);
        const grossPnL = totalPnL + commissions;

        // Chart Data Calculation
        let runningPnL = 0;
        const chartData: any[] = [];
        
        // Fix: If only one trade, start chart at 09:30 with 0 PnL
        if (closedTrades.length === 1) {
             chartData.push({
                time: '09:30',
                pnl: 0,
                symbol: '',
                fullDate: '' 
             });
        }
        
        closedTrades.forEach((t) => {
            const pnl = calculatePnL(t, userSettings.commissionPerUnit);
            runningPnL += pnl;
            chartData.push({ 
                time: getIsoTime(t.exitDate || t.entryDate), 
                pnl: runningPnL,
                symbol: t.symbol,
                fullDate: t.exitDate // Store full date for tooltip if needed
            });
        });

        // Gradient offset
        const max = Math.max(...chartData.map(d => d.pnl), 0);
        const min = Math.min(...chartData.map(d => d.pnl), 0);
        let offset = 0;
        if (max <= 0) offset = 0;
        else if (min >= 0) offset = 1;
        else offset = max / (max - min);

        return {
            totalPnL,
            count: closedTrades.length,
            winRate,
            profitFactor,
            winners,
            losers,
            volume,
            commissions,
            grossPnL,
            chartData,
            offset
        };
    }, [trades, userSettings.commissionPerUnit]);

    if (!isOpen || !date) return null;

    const dateStr = format(date, 'EEE | MMM dd, yyyy');

    const handleViewDetails = () => {
        setDateRange({ startDate: date, endDate: date, label: format(date, 'MM/dd/yyyy') });
        navigate('/journal');
    };

    const isProfit = stats.totalPnL >= 0;
    const gradientId = `modal-splitColor-${date.getTime()}`;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            {/* Updated Main Background to bg-background (#475569) */}
            <div className="bg-background w-full max-w-[95%] xl:max-w-[90%] h-auto max-h-[90%] rounded-2xl border border-slate-600 shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* Header - bg-background */}
                <div className="p-5 border-b border-slate-600 flex justify-between items-center bg-background">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/20 p-2 rounded-lg text-primary">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">{dateStr}</h2>
                            </div>
                        </div>
                        
                        <div>
                            <span className={`text-2xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(stats.totalPnL)}
                            </span>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content - bg-background */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background">
                    
                    {/* Top Section: Chart + Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[280px]">
                        
                        {/* Chart - Changed to bg-surface (#334155) */}
                        <div className="bg-surface rounded-xl border border-slate-700/50 p-4 relative flex flex-col">
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.chartData} margin={{ left: -10, top: 10, bottom: 0, right: 30 }}>
                                        <defs>
                                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset={stats.offset} stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset={stats.offset} stopColor="#ef4444" stopOpacity={0.3} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                                        <YAxis 
                                            width={50} 
                                            tick={{fill: '#ffffff', fontSize: 10}}
                                            tickFormatter={(val) => `$${val}`}
                                            allowDecimals={false}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <XAxis 
                                            dataKey="time" 
                                            tick={{fill: '#ffffff', fontSize: 10}}
                                            axisLine={false}
                                            tickLine={false}
                                            minTickGap={30}
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
                        </div>

                        {/* Stats Grid - Changed to bg-surface (#334155) */}
                        <div className="bg-surface rounded-xl border border-slate-700/50 flex flex-col justify-center">
                            <div className="grid grid-cols-4">
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total trades</p>
                                    <p className="text-2xl font-bold text-white">{stats.count}</p>
                                </div>
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Winners</p>
                                    <p className="text-2xl font-bold text-emerald-400">{stats.winners}</p>
                                </div>
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Gross P&L</p>
                                    <p className={`text-2xl font-bold ${stats.grossPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(stats.grossPnL)}</p>
                                </div>
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Commissions</p>
                                    <p className="text-2xl font-bold text-slate-300">{formatCurrency(stats.commissions)}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-4">
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Winrate</p>
                                    <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.winRate}%</p>
                                </div>
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Losers</p>
                                    <p className="text-2xl font-bold text-red-400">{stats.losers}</p>
                                </div>
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Volume</p>
                                    <p className="text-2xl font-bold text-white">{stats.volume}</p>
                                </div>
                                <div className="p-4 flex flex-col justify-center">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Profit factor</p>
                                    <p className="text-2xl font-bold text-white">{stats.profitFactor}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trades Table */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="w-1 h-5 bg-primary rounded-full"></span>
                            Trades
                        </h3>
                        {/* Table Wrapper - bg-surface (#334155) */}
                        <div className="bg-surface border border-slate-700 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-base">
                                {/* Table Header - Updated Color and Spacing */}
                                <thead className="bg-slate-800/50 text-slate-300 text-sm font-bold border-b border-slate-700 tracking-wide">
                                    <tr>
                                        <th className="px-4 py-4">Open Time</th>
                                        <th className="px-4 py-4">Exit Time</th>
                                        <th className="px-2 py-4">Side</th>
                                        <th className="px-2 py-4 text-center">Status</th>
                                        <th className="px-2 py-4 text-right">Entry Price</th>
                                        <th className="px-4 py-4 text-right">Exit Price</th>
                                        <th className="px-4 py-4 text-right">Net P&L</th>
                                        <th className="px-4 py-4 text-right">RR</th>
                                        <th className="px-4 py-4 text-right pr-12">Duration</th>
                                        <th className="px-4 py-4 text-center">Strategy</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {trades.map(trade => {
                                        const pnl = calculatePnL(trade, userSettings.commissionPerUnit);
                                        const rr = calculateRMultiple(trade, userSettings.commissionPerUnit);
                                        const strategyName = strategies.find(s => s.id === trade.playbookId)?.name || '-';
                                        
                                        const openTimeStr = getIsoTime(trade.entryDate);
                                        const exitTimeStr = getIsoTime(trade.exitDate || '');
                                        const durationStr = getDuration(trade.entryDate, trade.exitDate);

                                        return (
                                            <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="px-4 py-4 text-white font-mono">{openTimeStr}</td>
                                                <td className="px-4 py-4 text-white font-mono">{exitTimeStr}</td>
                                                <td className="px-2 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.direction === TradeDirection.LONG ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {trade.direction}
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
                                        );
                                    })}
                                    {trades.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                                                No closed trades for this day.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                {/* Footer Button - bg-background */}
                <div className="p-4 border-t border-slate-600 bg-background flex justify-end">
                    <button 
                        onClick={handleViewDetails}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl group shadow-indigo-500/20"
                    >
                        View Details <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
