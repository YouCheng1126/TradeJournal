
import React from 'react';
import { formatCurrency } from '../../utils/calculations';
import { SemiCircleGauge, ProfitFactorGauge, AvgWinLossBar, StreakWidget } from '../StatWidgets';

interface TopWidgetsProps {
    stats: {
        totalPnL: number;
        count: number;
        adjustedWinRate: number | string;
        profitFactor: number;
        avgWin: number;
        avgLoss: number;
        winsCount: number;
        lossesCount: number;
        breakEvenCount: number;
        grossProfit: number;
        grossLoss: number;
        currentDayStreak: number;
        maxDayWinStreak: number;
        maxDayLossStreak: number;
        currentTradeStreak: number;
        maxTradeWinStreak: number;
        maxTradeLossStreak: number;
    };
}

export const TopWidgets: React.FC<TopWidgetsProps> = ({ stats }) => {
    const Card = ({ title, value, subValue, children, titleColor = "text-slate-400", alignChildren = "center" }: any) => (
        <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col h-48 relative overflow-hidden shadow-sm">
            <div className="h-8 flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
                <span className={titleColor}>{title}</span>
            </div>
            <div className="flex-1 flex items-center justify-between w-full">
                <div className="flex flex-col justify-center h-full">
                    <span className={`text-3xl font-bold ${typeof value === 'number' ? (value >= 0 ? 'text-white' : 'text-red-400') : 'text-white'}`}>
                        {value}
                    </span>
                    {subValue !== undefined && <span className="text-sm text-slate-500 mt-1">{subValue}</span>}
                </div>
                <div className={`flex items-${alignChildren} justify-center w-full h-full pl-4`}>
                    {children}
                </div>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Net P&L */}
            <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col h-48 relative overflow-hidden shadow-sm">
                <div className="h-8 flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
                    <span className="text-slate-400">Net P&L</span>
                </div>
                <div className="flex-1 flex items-center justify-between w-full">
                    <div className="flex flex-col justify-center h-full mt-6">
                        <span className={`text-3xl font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(stats.totalPnL)}
                        </span>
                        <span className="text-sm text-slate-500 mt-1">{stats.count} trades</span>
                    </div>
                    <div className="flex items-center justify-center w-full h-full pl-4">
                        {/* Placeholder */}
                    </div>
                </div>
            </div>

            <Card title="Trade win %" value={`${stats.adjustedWinRate}%`} subValue="">
                <SemiCircleGauge winCount={stats.winsCount} breakEvenCount={stats.breakEvenCount} lossCount={stats.lossesCount} />
            </Card>
            
            <Card title="Profit factor" value={stats.profitFactor.toFixed(2)} subValue="">
                <ProfitFactorGauge grossProfit={stats.grossProfit} grossLoss={stats.grossLoss} />
            </Card>
            
            {/* Current Streak */}
            <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col h-48 relative overflow-hidden shadow-sm">
                <div className="h-8 flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
                    <span className="text-slate-400">Current Streak</span>
                </div>
                <div className="flex-1 flex items-center justify-center pb-6"> 
                     <StreakWidget 
                        currentDayStreak={stats.currentDayStreak} 
                        maxDayWinStreak={stats.maxDayWinStreak}
                        maxDayLossStreak={stats.maxDayLossStreak}
                        currentTradeStreak={stats.currentTradeStreak}
                        maxTradeWinStreak={stats.maxTradeWinStreak}
                        maxTradeLossStreak={stats.maxTradeLossStreak}
                     />
                </div>
            </div>

            <Card title="Avg win/loss trade" value={(Math.abs(stats.avgWin) / (Math.abs(stats.avgLoss) || 1)).toFixed(2)} subValue="" alignChildren="end">
                <div className="mb-8"> 
                    <AvgWinLossBar win={stats.avgWin} loss={stats.avgLoss} />
                </div>
            </Card>
        </div>
    );
};
