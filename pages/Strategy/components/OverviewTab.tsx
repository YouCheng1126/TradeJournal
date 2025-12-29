
import React, { useMemo } from 'react';
import { formatCurrency, calculatePnL, calculateRMultiple, calculateMaxDrawdown, getMultiplier } from '../../../utils/calculations';
import { 
    AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ReferenceLine 
} from 'recharts';
import { format } from 'date-fns';
import { Trade } from '../../../types';
import { useTrades } from '../../../contexts/TradeContext';

interface OverviewTabProps {
    stats: {
        trades: Trade[];
        totalPnL: number;
        winRate: number;
        profitFactor: number;
        expectancy: number;
        avgWin: number;
        avgLoss: number;
        tradeCount: number;
    };
}

// Helper Component for a single stat item
const StatItem = ({ label, value, subValue, colorClass = "text-slate-100" }: { label: string, value: string | number, subValue?: string, colorClass?: string }) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-400 tracking-wide group">
            {label}
        </div>
        <div className={`text-2xl font-bold tracking-tight ${colorClass}`}>
            {value}
        </div>
        {subValue && <div className="text-xs text-slate-500">{subValue}</div>}
    </div>
);

export const OverviewTab: React.FC<OverviewTabProps> = ({ stats }) => {
    const { userSettings, strategies } = useTrades();
    const { trades, totalPnL, winRate, profitFactor, expectancy, avgWin, avgLoss, tradeCount } = stats;

    // Advanced Stats Calculation
    const advancedStats = useMemo(() => {
        const closedTrades = trades.filter(t => t.exitPrice !== undefined);
        
        let totalWinnerR = 0;
        let totalLoserR = 0;
        let winnerCount = 0;
        let loserCount = 0;
        let totalDurationMs = 0;
        let durationCount = 0;
        
        // Actual Risk % calculation
        let totalActualRiskPct = 0;
        let riskCount = 0;

        closedTrades.forEach(t => {
            const pnl = calculatePnL(t, userSettings.commissionPerUnit);
            const r = calculateRMultiple(t, userSettings.commissionPerUnit) || 0;

            // R Stats
            if (pnl > 0) {
                totalWinnerR += r;
                winnerCount++;
            } else if (pnl < 0) {
                totalLoserR += r;
                loserCount++;
            }

            // Duration
            if (t.entryDate && t.exitDate) {
                const start = new Date(t.entryDate).getTime();
                const end = new Date(t.exitDate).getTime();
                const diff = end - start;
                if (diff >= 0) {
                    totalDurationMs += diff;
                    durationCount++;
                }
            }

            // Avg Actual Risk %
            const mult = getMultiplier(t.symbol);
            const entry = t.entryPrice;
            const sl = t.initialStopLoss;
            const qty = t.quantity;

            if (entry && sl && qty) {
                const comm = userSettings.commissionPerUnit > 0 ? qty * userSettings.commissionPerUnit : (t.commission || 0);
                const initRisk = Math.abs(entry - sl) * qty * mult + comm;
                
                let actualRisk = 0;
                if (t.direction === 'Long') {
                    const low = t.lowestPriceReached ?? entry;
                    actualRisk = Math.max(0, (entry - low) * qty * mult);
                } else {
                    const high = t.highestPriceReached ?? entry;
                    actualRisk = Math.max(0, (high - entry) * qty * mult);
                }
                actualRisk += comm;

                if (initRisk > 0) {
                    totalActualRiskPct += (actualRisk / initRisk);
                    riskCount++;
                }
            }
        });

        const avgWinnerR = winnerCount > 0 ? totalWinnerR / winnerCount : 0;
        const avgLoserR = loserCount > 0 ? totalLoserR / loserCount : 0;
        const totalR = totalWinnerR + totalLoserR;
        
        // Calculate Max Drawdown
        const maxDrawdown = calculateMaxDrawdown(trades, userSettings.commissionPerUnit);

        // Calculate Avg Duration
        const avgDurationMs = durationCount > 0 ? totalDurationMs / durationCount : 0;
        const avgDurMins = Math.floor(avgDurationMs / 60000);
        const avgDurHrs = Math.floor(avgDurMins / 60);
        const avgDurRemMins = avgDurMins % 60;
        const avgDurationStr = avgDurHrs > 0 ? `${avgDurHrs}h ${avgDurRemMins}m` : `${avgDurRemMins}m`;

        // Calculate Avg Actual Risk %
        const avgActualRiskPct = riskCount > 0 ? (totalActualRiskPct / riskCount) * 100 : 0;

        return {
            avgWinnerR,
            avgLoserR,
            totalR,
            maxDrawdown,
            avgDurationStr,
            avgActualRiskPct
        };
    }, [trades, userSettings.commissionPerUnit]);

    // Chart Data Preparation
    const chartData = useMemo(() => {
        const closedTrades = trades.filter(t => t.exitPrice !== undefined);
        // Sort by Exit Date Ascending
        closedTrades.sort((a, b) => new Date(a.exitDate || a.entryDate).getTime() - new Date(b.exitDate || b.entryDate).getTime());

        let runningPnL = 0;
        const data = closedTrades.map(t => {
            const pnl = calculatePnL(t, userSettings.commissionPerUnit);
            runningPnL += pnl;
            return {
                date: format(new Date(t.exitDate || t.entryDate), 'MM/dd/yy'),
                fullDate: format(new Date(t.exitDate || t.entryDate), 'MMM dd, yyyy'),
                pnl: runningPnL,
                rawPnl: pnl
            };
        });

        // Add a starting point if not empty to make chart look better
        if (data.length > 0) {
            const firstDate = new Date(closedTrades[0].entryDate);
            firstDate.setDate(firstDate.getDate() - 1);
            data.unshift({
                date: format(firstDate, 'MM/dd/yy'),
                fullDate: 'Start',
                pnl: 0,
                rawPnl: 0
            });
        }

        return data;
    }, [trades, userSettings.commissionPerUnit]);

    // Gradient Offset Calculation
    const gradientOffset = () => {
        const dataMax = Math.max(...chartData.map((i) => i.pnl));
        const dataMin = Math.min(...chartData.map((i) => i.pnl));
      
        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;
      
        return dataMax / (dataMax - dataMin);
    };
      
    const off = gradientOffset();

    return (
        <div className="space-y-4 pb-10">
            
            {/* 1. Statistics Grid */}
            {/* Adjusted gap-y from 6 to 4, added -mt-2 to shift up */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-4 gap-x-4 -mt-2">
                {/* Row 1 */}
                <StatItem 
                    label="Net P&L" 
                    value={formatCurrency(totalPnL)} 
                    colorClass={totalPnL >= 0 ? "text-emerald-400" : "text-red-400"} 
                />
                <StatItem 
                    label="Win rate %" 
                    value={`${winRate}%`} 
                    colorClass={winRate >= 50 ? "text-emerald-400" : "text-red-400"}
                />
                <StatItem 
                    label="Profit factor" 
                    value={profitFactor.toFixed(2)} 
                />
                <StatItem 
                    label="Expectancy" 
                    value={formatCurrency(expectancy)} 
                />
                <StatItem 
                    label="Max Drawdown" 
                    value={formatCurrency(advancedStats.maxDrawdown)} 
                    colorClass="text-red-400"
                />
                <StatItem 
                    label="Avg duration" 
                    value={advancedStats.avgDurationStr} 
                />

                {/* Row 2 */}
                <StatItem 
                    label="Avg winner" 
                    value={formatCurrency(avgWin)} 
                />
                <StatItem 
                    label="Avg loser" 
                    value={formatCurrency(avgLoss)} 
                />
                <StatItem 
                    label="Winner RR" 
                    value={advancedStats.avgWinnerR.toFixed(2)} 
                />
                <StatItem 
                    label="Loser RR" 
                    value={advancedStats.avgLoserR.toFixed(2)} 
                />
                <StatItem 
                    label="Total RR" 
                    value={advancedStats.totalR.toFixed(2)} 
                />
                <StatItem 
                    label="Avg actual risk %" 
                    value={`${advancedStats.avgActualRiskPct.toFixed(1)}%`} 
                />
            </div>

            {/* 2. Daily Net Cumulative P&L Chart */}
            <div className="pt-2">
                <h3 className="text-slate-400 text-sm font-bold mb-4">
                    Daily net cumulative P&L
                </h3>
                
                <div className="h-[400px] w-full -ml-2">
                    {chartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="splitColorOverview" x1="0" y1="0" x2="0" y2="1">
                                        {/* Positive Top: High Opacity (70%) */}
                                        <stop offset={0} stopColor="#10b981" stopOpacity={0.7} />
                                        {/* Positive Bottom (near axis): Low Opacity (5%) */}
                                        <stop offset={off} stopColor="#10b981" stopOpacity={0.05} />
                                        
                                        {/* Negative Top (near axis): Low Opacity (5%) */}
                                        <stop offset={off} stopColor="#ef4444" stopOpacity={0.05} />
                                        {/* Negative Bottom: High Opacity (70%) */}
                                        <stop offset={1} stopColor="#ef4444" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#64748b" 
                                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={30}
                                />
                                <YAxis 
                                    stroke="#64748b" 
                                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                                    tickFormatter={(val) => `$${val}`}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip
                                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-slate-800 border border-slate-600 p-3 rounded-lg shadow-xl">
                                                    <p className="text-slate-400 text-xs mb-1 font-mono">{d.fullDate}</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${d.pnl >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                        <span className="text-white font-bold">{formatCurrency(d.pnl)}</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine y={0} stroke="#475569" />
                                {/* Curve Color: Fixed Purple (#8b5cf6), Fill: Gradient */}
                                <Area
                                    type="monotone"
                                    dataKey="pnl"
                                    stroke="#8b5cf6" 
                                    fill="url(#splitColorOverview)"
                                    strokeWidth={3}
                                    activeDot={{ r: 6, fill: '#fff', strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center border border-slate-700/50 rounded-xl bg-slate-800/20 text-slate-500">
                            Not enough data to display chart
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
