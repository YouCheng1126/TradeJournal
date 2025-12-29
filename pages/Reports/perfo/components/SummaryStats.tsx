
import React, { useMemo, useState } from 'react';
import { Trade } from '../../../../types';
import { 
    calculatePnL, formatCurrency, calculateWinRate, 
    calculateProfitFactor, calculateRMultiple, calculateMaxDrawdown,
    calculateAvgActualRiskPct 
} from '../../../../utils/calculations';
import { format } from 'date-fns';
import { Info } from 'lucide-react';

interface SummaryStatsProps {
    trades: Trade[];
    commission: number;
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({ trades, commission }) => {
    const [activeInfo, setActiveInfo] = useState<string | null>(null);

    const stats = useMemo(() => {
        const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t, commission), 0);
        const winRate = calculateWinRate(trades);
        const profitFactor = calculateProfitFactor(trades, commission);
        
        // --- Group Trades by Day ---
        const tradesByDay = new Map<string, Trade[]>();
        const daysMap = new Map<string, number>(); // Stores final PnL per day for Win/Loss calc
        let loggedDays = 0;
        
        trades.forEach(t => {
            const dateStr = format(new Date(t.entryDate), 'yyyy-MM-dd');
            
            // For PnL aggregation
            if (!daysMap.has(dateStr)) loggedDays++;
            daysMap.set(dateStr, (daysMap.get(dateStr) || 0) + calculatePnL(t, commission));

            // For Intraday Drawdown Calculation
            if (!tradesByDay.has(dateStr)) tradesByDay.set(dateStr, []);
            tradesByDay.get(dateStr)!.push(t);
        });

        // --- Daily PnL Stats (Win/Loss Days) ---
        const dailyPnLs = Array.from(daysMap.values());
        const winningDays = dailyPnLs.filter(p => p > 0);
        const losingDays = dailyPnLs.filter(p => p < 0);
        
        const avgDailyWin = winningDays.length > 0 ? winningDays.reduce((a,b)=>a+b,0)/winningDays.length : 0;
        const avgDailyLoss = losingDays.length > 0 ? losingDays.reduce((a,b)=>a+b,0)/losingDays.length : 0;
        const avgDailyPnL = dailyPnLs.length > 0 ? dailyPnLs.reduce((a,b)=>a+b,0)/dailyPnLs.length : 0;
        const avgDailyWinPct = dailyPnLs.length > 0 ? (winningDays.length / dailyPnLs.length) * 100 : 0;

        // --- Intraday Drawdown Calculation ---
        const dailyDrawdowns: number[] = [];

        tradesByDay.forEach((dayTrades) => {
            const sorted = [...dayTrades].sort((a, b) => {
                const tA = new Date(a.exitDate || a.entryDate).getTime();
                const tB = new Date(b.exitDate || b.entryDate).getTime();
                return tA - tB;
            });

            let currentEquity = 0;
            let peak = 0;
            let maxDD = 0;

            sorted.forEach(t => {
                const pnl = calculatePnL(t, commission);
                currentEquity += pnl;
                if (currentEquity > peak) peak = currentEquity;
                const drawdown = peak - currentEquity;
                if (drawdown > maxDD) maxDD = drawdown;
            });

            dailyDrawdowns.push(maxDD);
        });

        const maxDailyDDMagnitude = dailyDrawdowns.length > 0 ? Math.max(...dailyDrawdowns) : 0;
        
        // Avg Daily Drawdown
        const avgDailyDDMagnitude = dailyDrawdowns.length > 0 
            ? dailyDrawdowns.reduce((a, b) => a + b, 0) / dailyDrawdowns.length 
            : 0;

        // --- Trade logic ---
        const winningTrades = trades.filter(t => calculatePnL(t, commission) > 0);
        const losingTrades = trades.filter(t => calculatePnL(t, commission) < 0);
        const avgTradeWin = winningTrades.length > 0 ? winningTrades.reduce((a,t)=>a+calculatePnL(t,commission),0)/winningTrades.length : 0;
        const avgTradeLoss = losingTrades.length > 0 ? losingTrades.reduce((a,t)=>a+calculatePnL(t,commission),0)/losingTrades.length : 0;
        const avgNetTradePnL = trades.length > 0 ? totalPnL / trades.length : 0;
        
        const totalR = trades.reduce((acc, t) => acc + (calculateRMultiple(t, commission) || 0), 0);
        const avgR = trades.length > 0 ? totalR / trades.length : 0;

        // Global Max Drawdown (Magnitude)
        const maxNetDDMagnitude = calculateMaxDrawdown(trades, commission);
        
        // Trade Expectancy
        const winRateDecimal = winRate / 100;
        const lossRateDecimal = 1 - winRateDecimal;
        const expectancy = (winRateDecimal * avgTradeWin) + (lossRateDecimal * avgTradeLoss); 

        // Hold Time
        let totalDuration = 0;
        let durationCount = 0;
        trades.forEach(t => {
            if (t.entryDate && t.exitDate) {
                totalDuration += new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
                durationCount++;
            }
        });
        const avgDurationMs = durationCount > 0 ? totalDuration / durationCount : 0;
        const avgDurHrs = Math.floor(avgDurationMs / (1000 * 60 * 60));
        const avgDurMins = Math.floor((avgDurationMs % (1000 * 60 * 60)) / (1000 * 60));

        // NEW: Avg Actual Risk %
        const avgActualRiskPct = calculateAvgActualRiskPct(trades, commission);

        // NEW: Max Consecutive Losses
        const sortedTrades = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
        let maxConsLoss = 0;
        let currConsLoss = 0;
        sortedTrades.forEach(t => {
            const pnl = calculatePnL(t, commission);
            if (pnl < 0) {
                currConsLoss++;
                if (currConsLoss > maxConsLoss) maxConsLoss = currConsLoss;
            } else {
                currConsLoss = 0;
            }
        });

        // NEW: Avg Trades Per Day
        const avgTradesPerDay = loggedDays > 0 ? trades.length / loggedDays : 0;

        return {
            totalPnL,
            expectancy,
            avgNetTradePnL,
            winRate,
            avgDailyRR: avgDailyLoss !== 0 ? Math.abs(avgDailyWin / avgDailyLoss) : 0,
            avgDailyPnL,
            avgDailyWinPct,
            avgTradeRR: avgTradeLoss !== 0 ? Math.abs(avgTradeWin / avgTradeLoss) : 0,
            avgR,
            profitFactor,
            avgDuration: `${avgDurHrs}h ${avgDurMins}m`,
            loggedDays,
            // Ensure all drawdowns are negative
            maxDailyDD: -Math.abs(maxDailyDDMagnitude),
            avgDailyDD: -Math.abs(avgDailyDDMagnitude),
            maxNetDD: -Math.abs(maxNetDDMagnitude),
            avgActualRiskPct,
            maxConsLoss,
            avgTradesPerDay
        };
    }, [trades, commission]);

    const StatItem = ({ label, value, isCurrency = false, colorClass = "text-white", description, id }: any) => {
        const isOpen = activeInfo === id;

        return (
            <div className="flex flex-col gap-1 py-2 relative">
                <div className="flex items-center gap-1.5 group">
                    {/* Brighter Label Color */}
                    <span className="text-xs font-bold text-slate-300">{label}</span>
                    
                    {/* Hover Interaction Wrapper */}
                    <div 
                        className="relative flex items-center"
                        onMouseEnter={() => setActiveInfo(id)}
                        onMouseLeave={() => setActiveInfo(null)}
                    >
                        {/* Brighter Icon Color, Removed cursor-help, added cursor-pointer */}
                        <div className={`text-slate-400 hover:text-primary transition-colors p-0.5 rounded-full cursor-pointer ${isOpen ? 'text-primary' : ''}`}>
                            <Info size={14} />
                        </div>
                        
                        {/* Tooltip */}
                        {isOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-max max-w-[280px] p-3 bg-[#475569] rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.3)] z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
                                <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                                    {description}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <div className={`text-xl font-bold tracking-tight ${colorClass}`}>
                    {isCurrency ? formatCurrency(value) : value}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-700/50">
                <h3 className="font-bold text-primary text-sm uppercase tracking-wider">Summary</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                {/* Row 1 */}
                <StatItem 
                    id="netPnl"
                    label="淨損益" 
                    value={stats.totalPnL} 
                    isCurrency 
                    colorClass={stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    description="計算方式：所有平倉交易的 (出場價 - 入場價) * 數量 * 合約乘數 - 手續費。"
                />
                <StatItem 
                    id="expectancy"
                    label="期望值" 
                    value={stats.expectancy} 
                    isCurrency 
                    description="平均每筆交易預期獲利或虧損金額。計算方式：(勝率 x 平均獲利) - (敗率 x 平均虧損)。"
                />
                <StatItem 
                    id="winRate"
                    label="勝率 %" 
                    value={`${stats.winRate}%`} 
                    description="獲利交易筆數佔總交易筆數的百分比。"
                />
                <StatItem 
                    id="avgDailyWinPct"
                    label="平均每日勝率 %" 
                    value={`${stats.avgDailyWinPct.toFixed(2)}%`} 
                    description="獲利天數佔總交易天數的百分比。"
                />

                {/* Row 2 */}
                <StatItem 
                    id="avgDailyPnl"
                    label="平均每日淨損益" 
                    value={stats.avgDailyPnL} 
                    isCurrency 
                    description="總淨損益除以有交易的天數。"
                />
                <StatItem 
                    id="avgTradeRR"
                    label="平均盈虧 RR" 
                    value={stats.avgTradeRR.toFixed(2)} 
                    description="計算方式：Abs(平均獲利金額 / 平均虧損金額)。"
                />
                <StatItem 
                    id="avgR"
                    label="平均實現 RR" 
                    value={`${stats.avgR.toFixed(2)}R`} 
                    description="每筆交易實現的 R 倍數總和除以交易筆數。(1R = 初始風險金額)。"
                />
                <StatItem 
                    id="avgDailyRR"
                    label="平均每日 RR" 
                    value={stats.avgDailyRR.toFixed(2)} 
                    description="計算方式：Abs(平均獲利日金額 / 平均虧損日金額)。顯示賺錢日子相對於賠錢日子的獲利能力。"
                />
                
                {/* Row 3 */}
                <StatItem 
                    id="pf"
                    label="獲利因子" 
                    value={stats.profitFactor.toFixed(2)} 
                    description="總獲利金額除以總虧損金額。數值大於 1 代表獲利，大於 2 通常被視為優良策略。"
                />
                <StatItem 
                    id="avgDailyDD"
                    label="平均每日回撤" 
                    value={stats.avgDailyDD} 
                    isCurrency 
                    colorClass="text-red-400"
                    description="所有交易日的單日回撤金額之平均值。"
                />
                <StatItem 
                    id="maxDailyDD"
                    label="最大單日回撤" 
                    value={stats.maxDailyDD} 
                    isCurrency 
                    colorClass="text-red-400"
                    description="所有交易日中，單日內資金從當日最高點跌落至隨後最低點的最大金額。"
                />
                <StatItem 
                    id="maxDD"
                    label="最大回撤" 
                    value={stats.maxNetDD} 
                    isCurrency 
                    colorClass="text-red-400"
                    description="帳戶資金從歷史最高點跌落至隨後最低點的最大跌幅金額。"
                />

                {/* Row 4 */}
                <StatItem 
                    id="avgActualRiskPct"
                    label="平均真實風險 %" 
                    value={`${stats.avgActualRiskPct.toFixed(1)}%`} 
                    description="計算每筆交易 (實際最大浮虧 / 初始止損風險) 的平均值。此數值顯示您實際承受的風險與計畫風險的比例。"
                />
                <StatItem 
                    id="maxConsLoss"
                    label="最大連敗交易數" 
                    value={stats.maxConsLoss} 
                    description="歷史上連續發生虧損交易的最長次數紀錄。"
                />
                <StatItem 
                    id="avgTradesPerDay"
                    label="平均每日交易數" 
                    value={stats.avgTradesPerDay.toFixed(1)} 
                    description="總交易筆數除以有交易的活躍天數。"
                />
                <StatItem 
                    id="duration"
                    label="平均持倉時間" 
                    value={stats.avgDuration} 
                    description="計算從進場時間到出場時間的平均長度。"
                />
            </div>
        </div>
    );
};
