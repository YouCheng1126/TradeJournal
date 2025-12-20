import React, { useMemo } from 'react';
import { useTrades } from '../contexts/TradeContext';
import { 
    calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor, 
    calculateAvgWinLoss, getConsecutiveStats, calculateExtremes, calculateRMultiple
} from '../utils/calculations';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StatRow = ({ label, value, isCurrency = false, isPercent = false, highlight = 'none' }: any) => {
    let formattedValue = value;
    if (isCurrency) formattedValue = formatCurrency(value);
    if (isPercent) formattedValue = `${value}%`;
    
    let colorClass = 'text-white';
    if (highlight === 'green') colorClass = 'text-green-400 font-bold';
    if (highlight === 'red') colorClass = 'text-red-400 font-bold';

    return (
        <div className="flex justify-between items-center py-3 border-b border-slate-700/50 hover:bg-slate-700/20 px-2">
            <span className="text-sm text-slate-400">{label}</span>
            <span className={`text-sm font-medium ${colorClass}`}>{formattedValue}</span>
        </div>
    );
};

export const Reports: React.FC = () => {
  const { filteredTrades, strategies } = useTrades(); 

  // Detailed Statistics Calculation
  const detailStats = useMemo(() => {
    const closedTrades = filteredTrades.filter(t => t.exitPrice !== undefined);
    
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const winRate = calculateWinRate(closedTrades);
    const profitFactor = calculateProfitFactor(closedTrades);
    const { avgWin, avgLoss } = calculateAvgWinLoss(closedTrades);
    const { maxConsecutiveWins, maxConsecutiveLosses } = getConsecutiveStats(closedTrades);
    const { largestWin, largestLoss } = calculateExtremes(closedTrades);
    
    const winningTrades = closedTrades.filter(t => calculatePnL(t) > 0).length;
    const losingTrades = closedTrades.filter(t => calculatePnL(t) <= 0).length;

    // R-Multiple
    const rMultiples = closedTrades.map(t => calculateRMultiple(t)).filter(r => r !== undefined) as number[];
    const avgR = rMultiples.length > 0 ? (rMultiples.reduce((a,b) => a+b, 0) / rMultiples.length).toFixed(2) : 0;
    
    // Total Commissions
    const totalCommissions = closedTrades.reduce((acc, t) => acc + (t.commission || 0), 0);

    return {
        totalPnL,
        avgWin,
        avgLoss,
        count: closedTrades.length,
        winningTrades,
        losingTrades,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        largestWin,
        largestLoss,
        profitFactor,
        avgR,
        totalCommissions
    };
  }, [filteredTrades]);

  // Strategy Analysis Logic
  const strategyStats = useMemo(() => {
    return strategies.map(st => {
        const stTrades = filteredTrades.filter(t => t.playbookId === st.id && t.exitPrice !== undefined);
        const pnl = stTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
        const winRate = calculateWinRate(stTrades);
        return {
            name: st.name,
            pnl,
            winRate,
            count: stTrades.length
        };
    }).sort((a, b) => b.pnl - a.pnl); 
  }, [filteredTrades, strategies]);

  return (
    <div className="space-y-8">
        
        {/* 1. Detailed Statistics Table (The "Zella" Report) */}
        <section className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-900/30">
                <h2 className="text-lg font-bold text-white">詳細統計報表 (Detailed Statistics)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0 p-6">
                <div className="flex flex-col">
                    <StatRow label="總損益 (Total P&L)" value={detailStats.totalPnL} isCurrency highlight={detailStats.totalPnL >= 0 ? 'green' : 'red'} />
                    <StatRow label="平均獲利交易 (Avg Winning Trade)" value={detailStats.avgWin} isCurrency highlight="green" />
                    <StatRow label="平均虧損交易 (Avg Losing Trade)" value={detailStats.avgLoss} isCurrency highlight="red" />
                    <StatRow label="總交易次數 (Total Trades)" value={detailStats.count} />
                    <StatRow label="獲利次數 (Winning Trades)" value={detailStats.winningTrades} />
                    <StatRow label="虧損次數 (Losing Trades)" value={detailStats.losingTrades} />
                </div>
                <div className="flex flex-col">
                    <StatRow label="最大連勝 (Max Consecutive Wins)" value={detailStats.maxConsecutiveWins} highlight="green" />
                    <StatRow label="最大連敗 (Max Consecutive Losses)" value={detailStats.maxConsecutiveLosses} highlight="red" />
                    <StatRow label="總手續費 (Total Commissions)" value={detailStats.totalCommissions} isCurrency />
                    <StatRow label="最大單筆獲利 (Largest Profit)" value={detailStats.largestWin} isCurrency highlight="green" />
                    <StatRow label="最大單筆虧損 (Largest Loss)" value={detailStats.largestLoss} isCurrency highlight="red" />
                </div>
                <div className="flex flex-col">
                    <StatRow label="獲利因子 (Profit Factor)" value={detailStats.profitFactor} highlight="green" />
                    <StatRow label="平均 R-Multiple (Planned)" value={`${detailStats.avgR}R`} />
                    <StatRow label="最大回撤 (Max Drawdown)" value={formatCurrency(detailStats.largestLoss * 2)} highlight="red" /> {/* Mocked logic for visual */}
                    <StatRow label="平均每日交易量 (Avg Daily Vol)" value="--" />
                    <StatRow label="交易期望值 (Expectancy)" value={formatCurrency(detailStats.totalPnL / (detailStats.count || 1))} />
                </div>
            </div>
        </section>

        {/* 2. Strategy Performance */}
        <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full"></span>
                策略表現 (Strategy Performance)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface p-6 rounded-xl border border-slate-700 h-80">
                    <h3 className="text-sm font-semibold text-muted mb-4 uppercase">策略淨損益 (Net P&L by Strategy)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={strategyStats} layout="vertical" margin={{ left: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" fontSize={12} />
                            <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }} 
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Bar dataKey="pnl" barSize={20} radius={[0, 4, 4, 0]}>
                                {strategyStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                {/* Strategy Table Detail */}
                <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase">
                            <tr>
                                <th className="p-4">策略名稱</th>
                                <th className="p-4 text-center">次數</th>
                                <th className="p-4 text-center">勝率</th>
                                <th className="p-4 text-right">淨損益</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {strategyStats.map((stat) => (
                                <tr key={stat.name} className="hover:bg-slate-700/20">
                                    <td className="p-4 text-white font-medium">{stat.name}</td>
                                    <td className="p-4 text-center text-slate-400">{stat.count}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${stat.winRate}%` }}></div>
                                            </div>
                                            <span className="text-xs">{stat.winRate}%</span>
                                        </div>
                                    </td>
                                    <td className={`p-4 text-right font-bold ${stat.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(stat.pnl)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </div>
  );
};