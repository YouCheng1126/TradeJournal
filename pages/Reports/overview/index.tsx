
import React, { useMemo, useState, useEffect } from 'react';
import { useTrades } from '../../../contexts/TradeContext';
import { 
    calculatePnL, formatCurrency, calculateWinRate, calculateProfitFactor, 
    calculateRMultiple, calculateMaxDrawdown, calculateAvgActualRiskPct,
    calculateStreaks, getMultiplier
} from '../../../utils/calculations';
import { format, getYear, getMonth, getDate } from 'date-fns';
import { Info } from 'lucide-react';
import { Trade, TradeStatus } from '../../../types';

export const Overview: React.FC = () => {
    const { filteredTrades, userSettings, strategies, tags, tagCategories } = useTrades();
    const [activeInfo, setActiveInfo] = useState<string | null>(null);

    // Global click listener to close active tooltip
    useEffect(() => {
        const handleGlobalClick = () => {
            setActiveInfo(null);
        };
        document.addEventListener('click', handleGlobalClick);
        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };
    }, []);

    // --- Complex Calculations ---
    const stats = useMemo(() => {
        const closedTrades = filteredTrades.filter(t => t.exitPrice !== undefined);
        const commission = userSettings.commissionPerUnit;

        // 1. Basic Aggregations
        let totalPnL = 0;
        let totalVolume = 0;
        let totalDuration = 0;
        let durationCount = 0;
        let winDuration = 0;
        let winDurationCount = 0;
        let lossDuration = 0;
        let lossDurationCount = 0;
        
        let winningTradesCount = 0;
        let losingTradesCount = 0;
        let breakevenTradesCount = 0;
        
        let totalWinAmt = 0;
        let totalLossAmt = 0;
        
        let largestWin = 0;
        let largestLoss = 0;

        let totalR = 0;
        let totalPlannedR = 0; // Simple approximation: (Exit - Entry) / (Entry - SL)
        let countR = 0;

        // Groupings
        const monthlyPnL = new Map<string, number>();
        const dailyPnL = new Map<string, number>();
        const strategyPnL = new Map<string, number>();
        const tagPnL = new Map<string, number>();

        // Days Set
        const tradingDaysSet = new Set<string>();

        closedTrades.forEach(t => {
            const pnl = calculatePnL(t, commission);
            totalPnL += pnl;
            totalVolume += t.quantity;
            
            const dateStr = format(new Date(t.entryDate), 'yyyy-MM-dd');
            const monthStr = format(new Date(t.entryDate), 'yyyy-MM');
            
            tradingDaysSet.add(dateStr);

            // Grouping Sums
            monthlyPnL.set(monthStr, (monthlyPnL.get(monthStr) || 0) + pnl);
            dailyPnL.set(dateStr, (dailyPnL.get(dateStr) || 0) + pnl);
            
            if (t.playbookId) {
                strategyPnL.set(t.playbookId, (strategyPnL.get(t.playbookId) || 0) + pnl);
            }
            if (t.tags && t.tags.length > 0) {
                t.tags.forEach(tagId => {
                    tagPnL.set(tagId, (tagPnL.get(tagId) || 0) + pnl);
                });
            }

            // Trade Specifics
            if (pnl > 0) {
                winningTradesCount++;
                totalWinAmt += pnl;
                if (pnl > largestWin) largestWin = pnl;
                
                if (t.entryDate && t.exitDate) {
                    const dur = new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
                    winDuration += dur;
                    winDurationCount++;
                }
            } else if (pnl < 0) {
                losingTradesCount++;
                totalLossAmt += Math.abs(pnl); // Store as positive magnitude
                if (pnl < largestLoss) largestLoss = pnl;

                if (t.entryDate && t.exitDate) {
                    const dur = new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
                    lossDuration += dur;
                    lossDurationCount++;
                }
            } else {
                breakevenTradesCount++;
            }

            if (t.entryDate && t.exitDate) {
                const dur = new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
                totalDuration += dur;
                durationCount++;
            }

            // R Multiples
            const r = calculateRMultiple(t, commission);
            if (r !== undefined) {
                totalR += r;
                countR++;
                // Planned R approximation (Reward / Risk)
                if (t.initialStopLoss && t.takeProfitTarget) {
                    const risk = Math.abs(t.entryPrice - t.initialStopLoss);
                    const reward = Math.abs(t.takeProfitTarget - t.entryPrice);
                    if (risk > 0) totalPlannedR += (reward / risk);
                } else {
                    // Fallback if no TP, assume realized is planned for simplicity or skip
                    totalPlannedR += r; 
                }
            }
        });

        // 2. Daily Stats
        const dailyPnLs = Array.from(dailyPnL.values());
        const winningDays = dailyPnLs.filter(p => p > 0);
        const losingDays = dailyPnLs.filter(p => p < 0);
        const breakevenDays = dailyPnLs.filter(p => p === 0);
        
        const largestProfitDay = dailyPnLs.length > 0 ? Math.max(...dailyPnLs) : 0;
        const largestLossDay = dailyPnLs.length > 0 ? Math.min(...dailyPnLs) : 0; // Negative number

        const avgDailyPnL = dailyPnLs.length > 0 ? totalPnL / dailyPnLs.length : 0;
        const avgWinDayPnL = winningDays.length > 0 ? winningDays.reduce((a,b)=>a+b,0) / winningDays.length : 0;
        const avgLossDayPnL = losingDays.length > 0 ? losingDays.reduce((a,b)=>a+b,0) / losingDays.length : 0;

        // 3. Finding Best/Lowest (Headers)
        const findExtremes = (map: Map<string, number>, lookup?: (id: string) => string) => {
            if (map.size === 0) return { best: '-', bestVal: 0, lowest: '-', lowestVal: 0 };
            let bestK = '', bestV = -Infinity;
            let lowK = '', lowV = Infinity;
            
            map.forEach((v, k) => {
                if (v > bestV) { bestV = v; bestK = k; }
                if (v < lowV) { lowV = v; lowK = k; }
            });
            
            return {
                best: lookup ? lookup(bestK) : bestK,
                bestVal: bestV,
                lowest: lookup ? lookup(lowK) : lowK,
                lowestVal: lowV
            };
        };

        const monthStats = findExtremes(monthlyPnL);
        const dayStats = findExtremes(dailyPnL);
        const stratStats = findExtremes(strategyPnL, (id) => strategies.find(s => s.id === id)?.name || 'Unknown');
        const tagStats = findExtremes(tagPnL, (id) => tags.find(t => t.id === id)?.name || 'Unknown');

        // 4. Averages
        const avgWinningTrade = winningTradesCount > 0 ? totalWinAmt / winningTradesCount : 0;
        const avgLosingTrade = losingTradesCount > 0 ? -(totalLossAmt / losingTradesCount) : 0;
        const avgTradePnL = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0;
        const avgDailyVolume = dailyPnL.size > 0 ? totalVolume / dailyPnL.size : 0;

        // 5. Streaks (Using helper)
        const streaks = calculateStreaks(closedTrades, commission);

        // 6. Drawdown
        const maxDD = calculateMaxDrawdown(closedTrades, commission);
        // Avg Drawdown (Approximated as average of daily negative PnLs for simplicity in "Overview", 
        // or strictly sum of drawdowns / count. Let's use Average Daily Loss as a proxy for "Avg Drawdown" sensation in this grid context, or Actual Risk)
        // Better: Average MAE of all trades
        let totalMAE = 0;
        let maeCount = 0;
        closedTrades.forEach(t => {
            const mult = getMultiplier(t.symbol);
            if (t.direction === 'Long' && t.lowestPriceReached !== undefined) {
                totalMAE += (t.entryPrice - t.lowestPriceReached) * t.quantity * mult;
                maeCount++;
            } else if (t.direction === 'Short' && t.highestPriceReached !== undefined) {
                totalMAE += (t.highestPriceReached - t.entryPrice) * t.quantity * mult;
                maeCount++;
            }
        });
        const avgMAE = maeCount > 0 ? -(totalMAE / maeCount) : 0; // Represent as negative PnL

        // 7. Durations
        const formatDuration = (ms: number) => {
            if (ms === 0) return '-';
            const mins = Math.floor(ms / 60000);
            const hrs = Math.floor(mins / 60);
            const remMins = mins % 60;
            return hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
        };

        const avgHoldTime = durationCount > 0 ? formatDuration(totalDuration / durationCount) : '-';
        const avgWinHoldTime = winDurationCount > 0 ? formatDuration(winDuration / winDurationCount) : '-';
        const avgLossHoldTime = lossDurationCount > 0 ? formatDuration(lossDuration / lossDurationCount) : '-';

        return {
            totalPnL,
            avgDailyVolume,
            avgWinningTrade,
            avgLosingTrade,
            totalTrades: closedTrades.length,
            winningTradesCount,
            losingTradesCount,
            breakevenTradesCount,
            maxConsecutiveWins: streaks.maxTradeWinStreak,
            maxConsecutiveLosses: streaks.maxTradeLossStreak,
            totalCommissions: closedTrades.reduce((acc, t) => acc + (commission > 0 ? t.quantity * commission : (t.commission || 0)), 0),
            largestWin,
            largestLoss,
            avgHoldTime,
            avgWinHoldTime,
            avgLossHoldTime,
            avgTradePnL,
            profitFactor: calculateProfitFactor(closedTrades, commission),
            
            // Right Column
            openTrades: filteredTrades.length - closedTrades.length,
            totalTradingDays: dailyPnL.size,
            winningDays: winningDays.length,
            losingDays: losingDays.length,
            breakevenDays: breakevenDays.length,
            loggedDays: dailyPnL.size, // Assuming logged = traded for now
            maxConsecutiveWinDays: streaks.maxDayWinStreak,
            maxConsecutiveLossDays: streaks.maxDayLossStreak,
            avgDailyPnL,
            avgWinDayPnL,
            avgLossDayPnL,
            largestProfitDay,
            largestLossDay,
            avgPlannedR: countR > 0 ? totalPlannedR / countR : 0,
            avgRealizedR: countR > 0 ? totalR / countR : 0,
            expectancy: closedTrades.length > 0 ? totalPnL / closedTrades.length : 0,
            maxDrawdown: maxDD,
            // Simple % calculation for DD (relative to Peak equity not tracked here, using simplified logic or just showing $)
            // Let's hide % for DD unless we have account size.
            avgDrawdown: avgMAE, // Using Avg MAE as proxy

            // Headers
            monthStats,
            dayStats,
            stratStats,
            tagStats,
            
            // Monthly Avg
            avgMonthPnL: monthlyPnL.size > 0 ? totalPnL / monthlyPnL.size : totalPnL
        };
    }, [filteredTrades, userSettings.commissionPerUnit, strategies, tags]);

    // --- Helper Components ---

    const HeaderCard = ({ label, bestLabel, bestVal, worstLabel, worstVal, avgLabel, avgVal, isCurrency = true }: any) => (
        <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</h4>
            
            {/* Best */}
            <div>
                <div className="text-[10px] text-slate-500 mb-0.5">Best</div>
                <div className="text-sm font-bold text-white truncate" title={bestLabel}>{bestLabel}</div>
                <div className={`text-sm font-bold ${bestVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCurrency ? formatCurrency(bestVal) : bestVal}
                </div>
            </div>

            {/* Worst */}
            <div>
                <div className="text-[10px] text-slate-500 mb-0.5">Lowest</div>
                <div className="text-sm font-bold text-white truncate" title={worstLabel}>{worstLabel}</div>
                <div className={`text-sm font-bold ${worstVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCurrency ? formatCurrency(worstVal) : worstVal}
                </div>
            </div>

            {/* Average (Optional) */}
            {avgVal !== undefined && (
                <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">Average</div>
                    <div className={`text-sm font-bold ${avgVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isCurrency ? formatCurrency(avgVal) : avgVal}
                    </div>
                </div>
            )}
        </div>
    );

    const GridRow = ({ label, value, tooltip, id, isCurrency = false, isPnlColor = false, colorOverride }: any) => {
        const isOpen = activeInfo === id;
        
        let displayValue = value;
        let valueClass = "text-white";

        if (isCurrency && typeof value === 'number') {
            displayValue = formatCurrency(value);
        }

        if (isPnlColor && typeof value === 'number') {
            valueClass = value >= 0 ? 'text-emerald-400' : 'text-red-400';
        } else if (colorOverride) {
            valueClass = colorOverride;
        }

        return (
            <div className="flex items-center justify-between py-3 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors px-2">
                <div className="flex items-center gap-1.5 relative">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    <div 
                        className={`text-slate-500 hover:text-primary transition-colors cursor-pointer p-0.5 ${isOpen ? 'text-primary' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveInfo(isOpen ? null : id);
                        }}
                    >
                        <Info size={13} />
                    </div>
                    
                    {/* Tooltip */}
                    {isOpen && (
                        <div 
                            className="absolute bottom-full left-0 mb-2 w-max max-w-[280px] p-3 bg-[#475569] rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.3)] z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                                {tooltip}
                            </p>
                        </div>
                    )}
                </div>
                <div className={`text-sm font-bold font-mono ${valueClass}`}>
                    {displayValue}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-12">
            
            {/* 1. Header Stats (Best/Lowest) */}
            <div className="bg-surface rounded-xl border border-slate-700/50 p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <HeaderCard 
                        label="Month" 
                        bestLabel={stats.monthStats.best} bestVal={stats.monthStats.bestVal}
                        worstLabel={stats.monthStats.lowest} worstVal={stats.monthStats.lowestVal}
                        avgVal={stats.avgMonthPnL}
                    />
                    <HeaderCard 
                        label="Day" 
                        bestLabel={stats.dayStats.best} bestVal={stats.dayStats.bestVal}
                        worstLabel={stats.dayStats.lowest} worstVal={stats.dayStats.lowestVal}
                        avgVal={stats.avgDailyPnL}
                    />
                    <HeaderCard 
                        label="Strategy" 
                        bestLabel={stats.stratStats.best} bestVal={stats.stratStats.bestVal}
                        worstLabel={stats.stratStats.lowest} worstVal={stats.stratStats.lowestVal}
                    />
                    <HeaderCard 
                        label="Tag" 
                        bestLabel={stats.tagStats.best} bestVal={stats.tagStats.bestVal}
                        worstLabel={stats.tagStats.lowest} worstVal={stats.tagStats.lowestVal}
                    />
                </div>
            </div>

            {/* 2. Detailed Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column */}
                <div className="bg-surface rounded-xl border border-slate-700/50 p-6 flex flex-col">
                    <GridRow id="totalPnl" label="總損益 (Total P&L)" value={stats.totalPnL} isCurrency isPnlColor tooltip="選定期間內的總實現損益。" />
                    <GridRow id="avgVol" label="平均每日交易量 (Avg Daily Vol)" value={stats.avgDailyVolume.toFixed(2)} tooltip="平均每個交易日的成交股數/合約數。" />
                    <GridRow id="avgWin" label="平均獲利交易 (Avg Win Trade)" value={stats.avgWinningTrade} isCurrency colorClass="text-emerald-400" tooltip="所有獲利交易的平均金額。" />
                    <GridRow id="avgLoss" label="平均虧損交易 (Avg Loss Trade)" value={stats.avgLosingTrade} isCurrency colorClass="text-red-400" tooltip="所有虧損交易的平均金額。" />
                    <GridRow id="numTrades" label="總交易次數 (Total Trades)" value={stats.totalTrades} tooltip="已平倉的交易總數。" />
                    <GridRow id="numWinners" label="獲利次數 (Winning Trades)" value={stats.winningTradesCount} tooltip="獲利大於 0 的交易次數。" />
                    <GridRow id="numLosers" label="虧損次數 (Losing Trades)" value={stats.losingTradesCount} tooltip="獲利小於 0 的交易次數。" />
                    <GridRow id="numBE" label="損益兩平次數 (Breakeven)" value={stats.breakevenTradesCount} tooltip="損益為 0 的交易次數。" />
                    <GridRow id="maxConsWin" label="最大連勝 (Max Cons. Wins)" value={stats.maxConsecutiveWins} tooltip="連續獲利交易的最多次數。" />
                    <GridRow id="maxConsLoss" label="最大連敗 (Max Cons. Losses)" value={stats.maxConsecutiveLosses} tooltip="連續虧損交易的最多次數。" />
                    <GridRow id="comm" label="總手續費 (Total Comm.)" value={stats.totalCommissions} isCurrency tooltip="總共支付的交易佣金與費用。" />
                    <GridRow id="fees" label="總費用 (Total Fees)" value={0} isCurrency tooltip="其他交易所或平台費用 (目前未啟用)。" />
                    <GridRow id="swap" label="總庫存費 (Total Swap)" value={0} isCurrency tooltip="過夜利息費用 (目前未啟用)。" />
                    <GridRow id="largestWin" label="最大獲利 (Largest Win)" value={stats.largestWin} isCurrency colorClass="text-emerald-400" tooltip="單筆獲利金額最高的交易。" />
                    <GridRow id="largestLoss" label="最大虧損 (Largest Loss)" value={stats.largestLoss} isCurrency colorClass="text-red-400" tooltip="單筆虧損金額最高的交易。" />
                    <GridRow id="holdAll" label="平均持倉時間 (All)" value={stats.avgHoldTime} tooltip="所有交易的平均持有時間。" />
                    <GridRow id="holdWin" label="平均持倉時間 (Win)" value={stats.avgWinHoldTime} tooltip="獲利交易的平均持有時間。" />
                    <GridRow id="holdLoss" label="平均持倉時間 (Loss)" value={stats.avgLossHoldTime} tooltip="虧損交易的平均持有時間。" />
                    <GridRow id="avgTradePnl" label="平均單筆損益 (Avg Trade P&L)" value={stats.avgTradePnL} isCurrency isPnlColor tooltip="總損益除以總交易次數。" />
                    <GridRow id="pf" label="獲利因子 (Profit Factor)" value={stats.profitFactor.toFixed(2)} tooltip="總獲利金額 / 總虧損金額。" />
                </div>

                {/* Right Column */}
                <div className="bg-surface rounded-xl border border-slate-700/50 p-6 flex flex-col">
                    <GridRow id="openTrades" label="未平倉交易 (Open Trades)" value={stats.openTrades} tooltip="目前尚未平倉的交易數量。" />
                    <GridRow id="totalDays" label="總交易天數 (Trading Days)" value={stats.totalTradingDays} tooltip="有進行交易的日期總數。" />
                    <GridRow id="winDays" label="獲利天數 (Winning Days)" value={stats.winningDays} tooltip="當日淨損益 > 0 的天數。" />
                    <GridRow id="lossDays" label="虧損天數 (Losing Days)" value={stats.losingDays} tooltip="當日淨損益 < 0 的天數。" />
                    <GridRow id="beDays" label="平盤天數 (Breakeven Days)" value={stats.breakevenDays} tooltip="當日淨損益 = 0 的天數。" />
                    <GridRow id="logDays" label="記錄天數 (Logged Days)" value={stats.loggedDays} tooltip="有交易記錄的總天數。" />
                    <GridRow id="maxConsWinDays" label="最大連勝天數 (Max Cons. Win Days)" value={stats.maxConsecutiveWinDays} tooltip="連續獲利天數的最長紀錄。" />
                    <GridRow id="maxConsLossDays" label="最大連敗天數 (Max Cons. Loss Days)" value={stats.maxConsecutiveLossDays} tooltip="連續虧損天數的最長紀錄。" />
                    <GridRow id="avgDaily" label="平均每日損益 (Avg Daily P&L)" value={stats.avgDailyPnL} isCurrency isPnlColor tooltip="總損益 / 總交易天數。" />
                    <GridRow id="avgWinDay" label="平均獲利日 (Avg Win Day)" value={stats.avgWinDayPnL} isCurrency colorClass="text-emerald-400" tooltip="獲利日子的平均獲利金額。" />
                    <GridRow id="avgLossDay" label="平均虧損日 (Avg Loss Day)" value={stats.avgLossDayPnL} isCurrency colorClass="text-red-400" tooltip="虧損日子的平均虧損金額。" />
                    <GridRow id="largestDayWin" label="最大獲利日 (Largest Profit Day)" value={stats.largestProfitDay} isCurrency colorClass="text-emerald-400" tooltip="單日獲利最高的金額。" />
                    <GridRow id="largestDayLoss" label="最大虧損日 (Largest Loss Day)" value={stats.largestLossDay} isCurrency colorClass="text-red-400" tooltip="單日虧損最高的金額。" />
                    <GridRow id="planR" label="平均計畫 R (Avg Planned R)" value={stats.avgPlannedR.toFixed(2)} tooltip="平均 (獲利目標 / 止損距離)。" />
                    <GridRow id="realR" label="平均實現 R (Avg Realized R)" value={stats.avgRealizedR.toFixed(2)} tooltip="平均實際獲取的 R 倍數。" />
                    <GridRow id="expectancy" label="期望值 (Expectancy)" value={stats.expectancy} isCurrency isPnlColor tooltip="每筆交易的預期平均收益。" />
                    <GridRow id="maxDD" label="最大回撤 (Max Drawdown)" value={stats.maxDrawdown} isCurrency colorClass="text-red-400" tooltip="資金曲線從最高點回落的最大金額。" />
                    <GridRow id="avgDD" label="平均回撤 (Avg Drawdown)" value={stats.avgDrawdown} isCurrency colorClass="text-red-400" tooltip="所有交易的平均最大浮動虧損 (Average MAE)。" />
                </div>
            </div>
        </div>
    );
};
