import React from 'react';
import { formatCurrency } from '../utils/calculations';

// --- Reusable Stat Components ---

export const SemiCircleGauge = ({ 
    winCount, 
    lossCount, 
    breakEvenCount
}: { 
    winCount: number, 
    lossCount: number, 
    breakEvenCount: number
}) => {
    const radius = 45; 
    const circumference = Math.PI * radius;
    
    // Total includes break even trades for visual gauge proportions
    const totalTrades = winCount + lossCount + breakEvenCount;
    
    // Calculate Percentages based on total
    const lossPct = totalTrades > 0 ? lossCount / totalTrades : 0;
    const bePct = totalTrades > 0 ? breakEvenCount / totalTrades : 0;
    const winPct = totalTrades > 0 ? winCount / totalTrades : 0;
    
    // Calculate arc lengths
    const lossLen = lossPct * circumference;
    const beLen = bePct * circumference;
    const winLen = winPct * circumference;

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[140px]">
            <div className="relative w-32 h-16 flex items-end justify-center overflow-hidden">
                 <svg width="100%" height="100%" viewBox="0 0 120 60" preserveAspectRatio="none" className="overflow-visible">
                     {/* Background Track */}
                     <path d="M 15 60 A 45 45 0 0 1 105 60" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
                     
                     {/* Loss Segment (Red) - Starts at 0 (Left) */}
                     {lossPct > 0 && (
                         <path 
                            d="M 15 60 A 45 45 0 0 1 105 60" 
                            fill="none" 
                            stroke="#ef4444" 
                            strokeWidth="10"
                            strokeLinecap={totalTrades === lossCount ? "round" : "butt"}
                            strokeDasharray={`${lossLen} ${circumference}`}
                            className="transition-all duration-1000 ease-out"
                         />
                     )}

                     {/* Break Even Segment (Gray) - Starts after Loss */}
                     {bePct > 0 && (
                         <path 
                            d="M 15 60 A 45 45 0 0 1 105 60" 
                            fill="none" 
                            stroke="#64748b" 
                            strokeWidth="10" 
                            strokeLinecap={totalTrades === breakEvenCount ? "round" : "butt"}
                            strokeDasharray={`${beLen} ${circumference}`}
                            strokeDashoffset={-lossLen}
                            className="transition-all duration-1000 ease-out"
                         />
                     )}

                     {/* Win Segment (Green) - Starts after Break Even */}
                     {winPct > 0 && (
                         <path 
                            d="M 15 60 A 45 45 0 0 1 105 60" 
                            fill="none" 
                            stroke="#10b981" 
                            strokeWidth="10" 
                            strokeLinecap={totalTrades === winCount ? "round" : "butt"}
                            strokeDasharray={`${winLen} ${circumference}`}
                            strokeDashoffset={-(lossLen + beLen)}
                            className="transition-all duration-1000 ease-out"
                         />
                     )}
                 </svg>
            </div>
            {/* Counts Legend - Increased spacing */}
            <div className="flex justify-center gap-6 w-full mt-2 px-1">
                <div className="flex flex-col items-center">
                    <div className="bg-red-500/20 text-red-500 rounded px-1.5 py-0.5 text-[10px] font-bold min-w-[20px] text-center">{lossCount}</div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="bg-slate-700 text-slate-400 rounded px-1.5 py-0.5 text-[10px] font-bold min-w-[20px] text-center">{breakEvenCount}</div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="bg-emerald-500/20 text-emerald-500 rounded px-1.5 py-0.5 text-[10px] font-bold min-w-[20px] text-center">{winCount}</div>
                </div>
            </div>
        </div>
    );
};

export const ProfitFactorGauge = ({ grossProfit, grossLoss }: { grossProfit: number, grossLoss: number }) => {
    const total = grossProfit + grossLoss;
    const profitPercent = total > 0 ? (grossProfit / total) : 0;
    const lossPercent = total > 0 ? (grossLoss / total) : 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius; 
    const greenLength = circumference * profitPercent;
    const redLength = circumference * lossPercent;
    const redRotation = -90 - (lossPercent * 180);
    const greenRotation = -90 + (lossPercent * 180);

    return (
        <div className="flex flex-col items-center justify-center gap-1 h-full">
            <div className="text-xs text-red-400 font-bold whitespace-nowrap -mb-1 z-10">{formatCurrency(grossLoss)}</div>
            <div className="relative w-20 h-20 flex-shrink-0">
                <svg width="100%" height="100%" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
                    {lossPercent > 0 && (
                        <circle cx="50" cy="50" r={radius} fill="none" stroke="#ef4444" strokeWidth="10" strokeDasharray={`${redLength} ${circumference}`} strokeLinecap="butt" transform={`rotate(${redRotation} 50 50)`} className="transition-all duration-1000 ease-out" />
                    )}
                    {profitPercent > 0 && (
                        <circle cx="50" cy="50" r={radius} fill="none" stroke="#10b981" strokeWidth="10" strokeDasharray={`${greenLength} ${circumference}`} strokeLinecap="butt" transform={`rotate(${greenRotation} 50 50)`} className="transition-all duration-1000 ease-out" />
                    )}
                </svg>
            </div>
            <div className="text-xs text-green-400 font-bold whitespace-nowrap -mt-1 z-10">{formatCurrency(grossProfit)}</div>
        </div>
    );
};

export const AvgWinLossBar = ({ win, loss }: { win: number, loss: number }) => {
    const absLoss = Math.abs(loss);
    const total = win + absLoss;
    const winPercent = total > 0 ? (win / total) * 100 : 50;
    const lossPercent = total > 0 ? (absLoss / total) * 100 : 50;

    return (
        <div className="flex flex-col w-40 gap-2">
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-700">
                <div style={{ width: `${winPercent}%` }} className="bg-emerald-500 h-full" />
                <div style={{ width: `${lossPercent}%` }} className="bg-red-500 h-full" />
            </div>
            <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-400">{formatCurrency(win)}</span>
                <span className="text-red-400">{formatCurrency(loss)}</span>
            </div>
        </div>
    );
};

export const StreakWidget = ({ 
    currentDayStreak, maxDayWinStreak, maxDayLossStreak,
    currentTradeStreak, maxTradeWinStreak, maxTradeLossStreak 
}: any) => {
    
    // Day Logic
    const dayVal = Math.abs(currentDayStreak);
    const isDayWin = currentDayStreak >= 0;
    const dayColor = isDayWin ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400';
    
    // Trade Logic
    const tradeVal = Math.abs(currentTradeStreak);
    const isTradeWin = currentTradeStreak >= 0;
    const tradeColor = isTradeWin ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400';

    const SmallBlock = ({ label, val, isWin }: { label: string, val: number, isWin: boolean }) => (
        <div className={`px-2 py-1 rounded text-[10px] font-bold text-center w-[70px] ${isWin ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {val} {label}
        </div>
    );

    return (
        <div className="flex items-center justify-center gap-4 h-full">
            {/* Day Circle */}
            <div className="flex flex-col items-center gap-1">
                 <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Day</span>
                 <div className={`w-14 h-14 rounded-full border-[4px] flex items-center justify-center ${dayColor}`}>
                    <span className="text-xl font-bold">{dayVal}</span>
                 </div>
            </div>

            {/* Day Blocks */}
            <div className="flex flex-col gap-1.5 pt-4">
                <SmallBlock label="loss" val={maxDayLossStreak} isWin={true} />
                <SmallBlock label="wins" val={maxDayWinStreak} isWin={false} />
            </div>

            <div className="w-px h-12 bg-slate-700 mx-2 self-center mt-4"></div>

            {/* Trade Circle */}
            <div className="flex flex-col items-center gap-1">
                 <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Trade</span>
                 <div className={`w-14 h-14 rounded-full border-[4px] flex items-center justify-center ${tradeColor}`}>
                    <span className="text-xl font-bold">{tradeVal}</span>
                 </div>
            </div>

            {/* Trade Blocks */}
            <div className="flex flex-col gap-1.5 pt-4">
                <SmallBlock label="loss" val={maxTradeLossStreak} isWin={true} />
                <SmallBlock label="wins" val={maxTradeWinStreak} isWin={false} />
            </div>
        </div>
    );
};