
import { Trade, TradeDirection, TradeStatus } from '../types';
import { getDaysInMonth } from 'date-fns';

export const getMultiplier = (symbol: string) => {
    const s = symbol.toUpperCase();
    if (s.includes('MES')) return 5;
    if (s.includes('MNQ')) return 2;
    if (s === 'ES') return 50;
    if (s === 'NQ') return 20;
    return 1;
};

export const getStatusWeight = (s: string) => {
    switch(s) {
        case TradeStatus.WIN: return 5;
        case TradeStatus.SMALL_WIN: return 4;
        case TradeStatus.BREAK_EVEN: return 3;
        case TradeStatus.SMALL_LOSS: return 2;
        case TradeStatus.LOSS: return 1;
        default: return 0;
    }
};

/**
 * Calculates Net P&L based on direction, quantity, and prices.
 * Updated to consider global commission per unit setting.
 */
export const calculatePnL = (trade: Trade, commissionPerUnit: number = 0): number => {
  if (!trade.exitPrice) return 0;
  
  const multiplier = getMultiplier(trade.symbol);
  
  const priceDiff = trade.exitPrice - trade.entryPrice;
  const rawPnL = priceDiff * trade.quantity * multiplier;
  const grossPnL = trade.direction === TradeDirection.LONG ? rawPnL : -rawPnL;
  
  // If global commission is set (>0), use it (Qty * Comm). Otherwise use trade's own commission field.
  const totalComm = commissionPerUnit > 0 ? (trade.quantity * commissionPerUnit) : (trade.commission || 0);
  
  const netPnL = grossPnL - totalComm;
  
  return Math.round(netPnL * 100) / 100;
};

// Calculate MFE (Max Favorable Excursion) in Dollars (Net of Commission)
export const calculateNetMFE = (trade: Trade, commissionPerUnit: number = 0): number => {
    const multiplier = getMultiplier(trade.symbol);
    const entry = trade.entryPrice;
    let grossMFE = 0;

    if (trade.direction === TradeDirection.LONG) {
        if (trade.highestPriceReached !== undefined) {
            grossMFE = (trade.highestPriceReached - entry) * trade.quantity * multiplier;
        }
    } else {
        if (trade.lowestPriceReached !== undefined) {
            grossMFE = (entry - trade.lowestPriceReached) * trade.quantity * multiplier;
        }
    }
    
    // MFE is a profit metric, so subtract commission
    const totalComm = commissionPerUnit > 0 ? (trade.quantity * commissionPerUnit) : (trade.commission || 0);
    return Math.round((grossMFE - totalComm) * 100) / 100;
};

// Calculate MAE (Max Adverse Excursion) in Dollars (Net of Commission)
// Note: MAE is typically a "Loss" amount, represented as negative or positive magnitude.
// Here we represent it as the P&L value at the worst point (so usually negative).
export const calculateNetMAE = (trade: Trade, commissionPerUnit: number = 0): number => {
    const multiplier = getMultiplier(trade.symbol);
    const entry = trade.entryPrice;
    let grossMAE = 0;

    if (trade.direction === TradeDirection.LONG) {
        if (trade.lowestPriceReached !== undefined) {
            grossMAE = (trade.lowestPriceReached - entry) * trade.quantity * multiplier;
        }
    } else {
        if (trade.highestPriceReached !== undefined) {
            grossMAE = (entry - trade.highestPriceReached) * trade.quantity * multiplier;
        }
    }

    // MAE is a P&L value (usually negative). Subtracting commission makes it more negative (more loss).
    const totalComm = commissionPerUnit > 0 ? (trade.quantity * commissionPerUnit) : (trade.commission || 0);
    return Math.round((grossMAE - totalComm) * 100) / 100;
};

export const calculateRMultiple = (trade: Trade, commissionPerUnit: number = 0): number | undefined => {
  if (!trade.exitPrice || !trade.initialStopLoss) return undefined;
  
  const multiplier = getMultiplier(trade.symbol);
  
  // 1. Calculate Net P&L (Numerator)
  const netPnL = calculatePnL(trade, commissionPerUnit);

  // 2. Calculate Total Risk (Denominator)
  // Gross Risk = Stop Distance * Qty * Multiplier
  const riskPerShare = Math.abs(trade.entryPrice - trade.initialStopLoss);
  if (riskPerShare === 0) return 0;
  
  const grossRiskAmount = riskPerShare * trade.quantity * multiplier;
  
  // Total Risk = Gross Risk + Commission (If I hit SL, I pay commission too)
  const totalComm = commissionPerUnit > 0 ? (trade.quantity * commissionPerUnit) : (trade.commission || 0);
  const totalRiskAmount = grossRiskAmount + totalComm;

  if (totalRiskAmount === 0) return 0;

  return Number((netPnL / totalRiskAmount).toFixed(2));
};

// New Helper: Calculate Average Actual Risk %
export const calculateAvgActualRiskPct = (trades: Trade[], commissionPerUnit: number = 0): number => {
    let totalPct = 0;
    let count = 0;

    trades.forEach(t => {
        const mult = getMultiplier(t.symbol);
        const entry = t.entryPrice;
        const sl = t.initialStopLoss;
        const qty = t.quantity;

        if (entry && sl && qty) {
            const comm = commissionPerUnit > 0 ? qty * commissionPerUnit : (t.commission || 0);
            const initRisk = Math.abs(entry - sl) * qty * mult + comm;
            
            let actualRisk = 0;
            if (t.direction === TradeDirection.LONG) {
                const low = t.lowestPriceReached ?? entry;
                actualRisk = Math.max(0, (entry - low) * qty * mult);
            } else {
                const high = t.highestPriceReached ?? entry;
                actualRisk = Math.max(0, (high - entry) * qty * mult);
            }
            actualRisk += comm;

            if (initRisk > 0) {
                totalPct += (actualRisk / initRisk);
                count++;
            }
        }
    });

    return count > 0 ? (totalPct / count) * 100 : 0;
};

export const formatCurrency = (amount: number) => {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = `$${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return isNegative ? `-${formatted}` : formatted;
};

// Updated: Based on Status
export const calculateWinRate = (trades: Trade[]): number => {
  const meaningfulTrades = trades.filter(t => 
      t.status === TradeStatus.WIN || 
      t.status === TradeStatus.SMALL_WIN || 
      t.status === TradeStatus.LOSS || 
      t.status === TradeStatus.SMALL_LOSS
  );

  if (meaningfulTrades.length === 0) return 0;
  
  const winners = meaningfulTrades.filter(t => 
      t.status === TradeStatus.WIN || t.status === TradeStatus.SMALL_WIN
  );
  
  return Math.round((winners.length / meaningfulTrades.length) * 100);
};

// Updated: Based on Status
export const calculateProfitFactor = (trades: Trade[], commissionPerUnit: number = 0): number => {
    let grossProfit = 0;
    let grossLoss = 0;
    
    trades.forEach(t => {
        const pnl = calculatePnL(t, commissionPerUnit);
        if (pnl > 0) {
            grossProfit += pnl;
        } else if (pnl < 0) {
            grossLoss += Math.abs(pnl);
        }
    });

    if (grossLoss === 0) return grossProfit > 0 ? 100 : 0;
    return Number((grossProfit / grossLoss).toFixed(2));
};

// Updated: Based on Status
export const calculateGrossStats = (trades: Trade[], commissionPerUnit: number = 0) => {
    let grossProfit = 0;
    let grossLoss = 0;
    
    trades.forEach(t => {
        const pnl = calculatePnL(t, commissionPerUnit);
        if (pnl > 0) {
            grossProfit += pnl;
        } else if (pnl < 0) {
            grossLoss += Math.abs(pnl);
        }
    });
    
    return { grossProfit, grossLoss };
};

// Updated: Based on Status
export const calculateAvgWinLoss = (trades: Trade[], commissionPerUnit: number = 0) => {
    const winners = trades.filter(t => calculatePnL(t, commissionPerUnit) > 0);
    const losers = trades.filter(t => calculatePnL(t, commissionPerUnit) < 0);
    
    const totalWin = winners.reduce((acc, t) => acc + calculatePnL(t, commissionPerUnit), 0);
    const totalLoss = losers.reduce((acc, t) => acc + calculatePnL(t, commissionPerUnit), 0);
    
    const avgWin = winners.length > 0 ? totalWin / winners.length : 0;
    const avgLoss = losers.length > 0 ? totalLoss / losers.length : 0;
    
    return { avgWin, avgLoss };
};

// Updated: Based on Status
export const getConsecutiveStats = (trades: Trade[]) => {
    const sorted = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    
    sorted.forEach(t => {
        const isWin = t.status === TradeStatus.WIN || t.status === TradeStatus.SMALL_WIN;
        const isLoss = t.status === TradeStatus.LOSS || t.status === TradeStatus.SMALL_LOSS;
        
        if (isWin) {
            currentWins++;
            currentLosses = 0;
            if (currentWins > maxWins) maxWins = currentWins;
        } else if (isLoss) {
            currentLosses++;
            currentWins = 0;
            if (currentLosses > maxLosses) maxLosses = currentLosses;
        } else {
            currentWins = 0;
            currentLosses = 0;
        }
    });
    return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
};

export const calculateExtremes = (trades: Trade[], commissionPerUnit: number = 0) => {
    let largestWin = 0;
    let largestLoss = 0;
    trades.forEach(t => {
        const pnl = calculatePnL(t, commissionPerUnit);
        if (pnl > largestWin) largestWin = pnl;
        if (pnl < largestLoss) largestLoss = pnl;
    });
    return { largestWin, largestLoss };
};

// Updated: Based on Status
export const calculateStreaks = (trades: Trade[], commissionPerUnit: number = 0) => {
    if (trades.length === 0) {
        return { 
            currentDayStreak: 0, maxDayWinStreak: 0, maxDayLossStreak: 0,
            currentTradeStreak: 0, maxTradeWinStreak: 0, maxTradeLossStreak: 0,
        };
    }

    const tradesDesc = [...trades].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    
    // Current Trade Streak
    let currentTradeStreak = 0;
    if (tradesDesc.length > 0) {
        const first = tradesDesc[0];
        const pnl = calculatePnL(first, commissionPerUnit);
        
        if (pnl > 0) {
            for (const t of tradesDesc) {
                if (calculatePnL(t, commissionPerUnit) > 0) currentTradeStreak++;
                else break;
            }
        } else if (pnl < 0) {
            for (const t of tradesDesc) {
                if (calculatePnL(t, commissionPerUnit) < 0) currentTradeStreak--; 
                else break;
            }
        }
    }

    const tradeCons = getConsecutiveStats(trades);

    const dailyPnL = new Map<string, number>();
    trades.forEach(t => {
        const day = t.entryDate.split('T')[0];
        dailyPnL.set(day, (dailyPnL.get(day) || 0) + calculatePnL(t, commissionPerUnit));
    });

    const sortedDays = Array.from(dailyPnL.entries())
        .map(([date, pnl]) => ({ date, pnl }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let currentDayStreak = 0;
    if (sortedDays.length > 0) {
        const firstDayPnl = sortedDays[0].pnl;
        if (firstDayPnl > 0) {
            for (const d of sortedDays) {
                if (d.pnl > 0) currentDayStreak++;
                else break;
            }
        } else if (firstDayPnl < 0) {
            for (const d of sortedDays) {
                if (d.pnl < 0) currentDayStreak--; 
                else break;
            }
        }
    }

    let maxDayWin = 0;
    let maxDayLoss = 0;
    let tempWin = 0;
    let tempLoss = 0;
    
    const sortedDaysAsc = [...sortedDays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedDaysAsc.forEach(day => {
        if (day.pnl > 0) {
            tempWin++;
            tempLoss = 0;
            if (tempWin > maxDayWin) maxDayWin = tempWin;
        } else if (day.pnl < 0) {
            tempLoss++;
            tempWin = 0;
            if (tempLoss > maxDayLoss) maxDayLoss = tempLoss;
        } else {
            tempWin = 0;
            tempLoss = 0;
        }
    });

    return {
        currentDayStreak, 
        maxDayWinStreak: maxDayWin,
        maxDayLossStreak: maxDayLoss,
        currentTradeStreak, 
        maxTradeWinStreak: tradeCons.maxConsecutiveWins,
        maxTradeLossStreak: tradeCons.maxConsecutiveLosses
    };
};

export const calculateMaxDrawdown = (trades: Trade[], commissionPerUnit: number = 0): number => {
    if (trades.length === 0) return 0;
    const sorted = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    let peak = 0;
    let currentEquity = 0;
    let maxDrawdown = 0;
    sorted.forEach(t => {
        const pnl = calculatePnL(t, commissionPerUnit);
        currentEquity += pnl;
        if (currentEquity > peak) peak = currentEquity;
        const drawdown = peak - currentEquity;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    return maxDrawdown;
};

export const calculateRecoveryFactor = (trades: Trade[], commissionPerUnit: number = 0): number => {
    const totalNetProfit = trades.reduce((acc, t) => acc + calculatePnL(t, commissionPerUnit), 0);
    const maxDD = Math.abs(calculateMaxDrawdown(trades, commissionPerUnit));
    if (maxDD === 0) return totalNetProfit > 0 ? 10 : 0;
    return Number((totalNetProfit / maxDD).toFixed(2));
}

// Helper: Linear Interpolation for Score Ranges
const interpolateScore = (val: number, rangeMin: number, rangeMax: number, scoreMin: number, scoreMax: number) => {
    const rangeSpan = rangeMax - rangeMin;
    const scoreSpan = scoreMax - scoreMin;
    if (rangeSpan === 0) return scoreMax;
    const progress = (val - rangeMin) / rangeSpan;
    return scoreMin + (progress * scoreSpan);
};

// Helper: Map value to score based on defined ranges
const mapScoreFromRanges = (val: number, ranges: { min: number, max: number, sMin: number, sMax: number }[], defaultScore: number, maxCapScore = 100) => {
    for (const r of ranges) {
        if (val >= r.min && val <= r.max) {
            return interpolateScore(val, r.min, r.max, r.sMin, r.sMax);
        }
    }
    if (ranges.length > 0 && val >= ranges[0].max) return maxCapScore;
    return defaultScore;
};

// Helper: Specific logic for Profit Factor and RR Scoring
// >= 2.6: 100
// 2.0 - 2.59: (100/3)*x + 40/3
// 1.0 - 1.99: 50*x - 20
// 0.5 - 0.99: 60*x - 30
const calculateMetricScore = (val: number) => {
    if (val >= 2.6) return 100;
    if (val >= 2.0) return (100 / 3) * val + (40 / 3);
    if (val >= 1.0) return 50 * val - 20;
    if (val >= 0.5) return 60 * val - 30;
    return 0; // x < 0.5
};

const toFixed1 = (n: number) => Math.round(n * 10) / 10;

export const calculateZellaScore = (trades: Trade[], commissionPerUnit: number = 0, maxDrawdownGoal: number = 0) => {
    const closedTrades = trades.filter(t => t.exitPrice !== undefined);
    
    if (closedTrades.length === 0) {
        return {
            score: 0,
            details: [
                { subject: 'Win %', A: 0, fullMark: 100 },
                { subject: 'Profit Factor', A: 0, fullMark: 100 },
                { subject: 'RR', A: 0, fullMark: 100 },
                { subject: 'Recovery', A: 0, fullMark: 100 },
                { subject: 'Max DD', A: 0, fullMark: 100 },
                { subject: 'Consistency', A: 0, fullMark: 100 },
            ]
        };
    }

    // --- 1. Win % (Weight 15%) ---
    const winRate = calculateWinRate(closedTrades);
    let winScore = (winRate / 60) * 100;
    if (winScore > 100) winScore = 100;

    // --- 2. Profit Factor (Weight 25%) ---
    // Updated Logic
    const pf = calculateProfitFactor(closedTrades, commissionPerUnit);
    const pfScore = calculateMetricScore(pf);

    // --- 3. RR (Weight 20%) ---
    // Updated Logic
    const { avgWin, avgLoss } = calculateAvgWinLoss(closedTrades, commissionPerUnit);
    const absAvgLoss = Math.abs(avgLoss);
    const rrVal = absAvgLoss > 0 ? avgWin / absAvgLoss : 0;
    const rrScore = calculateMetricScore(rrVal);

    // --- 4. Recovery Factor (Weight 10%) ---
    // Keep existing logic
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t, commissionPerUnit), 0);
    
    const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    let currentEquity = 0;
    let maxPeak = 0;
    let maxDDAmount = 0;
    let peakAtMaxDD = 0;

    sortedTrades.forEach(t => {
        const pnl = calculatePnL(t, commissionPerUnit);
        currentEquity += pnl;
        if (currentEquity > maxPeak) maxPeak = currentEquity;
        
        const drawdown = maxPeak - currentEquity;
        if (drawdown > maxDDAmount) {
            maxDDAmount = drawdown;
            peakAtMaxDD = maxPeak;
        }
    });

    const recoveryVal = maxDDAmount > 0 ? totalPnL / maxDDAmount : (totalPnL > 0 ? 10 : 0);
    
    const recRanges = [
        { min: 3.5, max: 9999, sMin: 100, sMax: 100 },
        { min: 3.0, max: 3.49, sMin: 70, sMax: 99 },
        { min: 2.5, max: 2.99, sMin: 60, sMax: 69 },
        { min: 2.0, max: 2.49, sMin: 50, sMax: 59 },
        { min: 1.5, max: 1.99, sMin: 30, sMax: 49 },
        { min: 1.0, max: 1.49, sMin: 1, sMax: 29 },
    ];
    const recoveryScore = mapScoreFromRanges(recoveryVal, recRanges, 0);

    // --- 5. Max Drawdown (Weight 20%) ---
    // Updated Logic: x = (Actual Drawdown / User Max Drawdown)
    // Score = 100 - 25x - 125x^2, min 0
    let ddScore = 0;
    if (maxDrawdownGoal > 0) {
        const x = Math.abs(maxDDAmount) / maxDrawdownGoal;
        const rawScore = 100 - (25 * x) - (125 * Math.pow(x, 2));
        ddScore = Math.max(0, rawScore);
    } else {
        // Fallback if user hasn't set a goal: 100 if no DD, 0 if any DD
        ddScore = maxDDAmount === 0 ? 100 : 0; 
    }

    // --- 6. Consistency (Weight 10%) ---
    const relevantTrades = closedTrades.filter(t => calculatePnL(t, commissionPerUnit) !== 0);
    let consScore = 0;
    
    if (totalPnL <= 0) {
        consScore = 0;
    } else if (relevantTrades.length > 0) {
        const pnls = relevantTrades.map(t => calculatePnL(t, commissionPerUnit));
        const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
        const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnls.length;
        const stdDev = Math.sqrt(variance);
        
        const cvLikeRatio = (stdDev / totalPnL) * 100;
        consScore = Math.max(100 - cvLikeRatio, 0);
    } else {
        consScore = 0; 
    }

    const weightedTotal = 
        (recoveryScore * 0.10) +
        (winScore * 0.15) +
        (rrScore * 0.20) +
        (pfScore * 0.25) +
        (ddScore * 0.20) +
        (consScore * 0.10);

    return {
        score: toFixed1(weightedTotal),
        details: [
            { subject: 'Win %', A: toFixed1(winScore), fullMark: 100 },
            { subject: 'Profit Factor', A: toFixed1(pfScore), fullMark: 100 },
            { subject: 'RR', A: toFixed1(rrScore), fullMark: 100 },
            { subject: 'Recovery', A: toFixed1(recoveryScore), fullMark: 100 }, 
            { subject: 'Max DD', A: toFixed1(ddScore), fullMark: 100 },
            { subject: 'Consistency', A: toFixed1(consScore), fullMark: 100 },
        ]
    };
};

export const parseIsoSafe = (iso: string = '') => {
    const [d, t] = iso.split('T');
    const [y, m, da] = (d || '').split('-');
    
    let h = '', mi = '';
    if (t) {
        const parts = t.split(':');
        h = parts[0] || '';
        mi = parts[1] || '';
    }

    return { y: y || '', m: m || '', d: da || '', h, mi };
};

export const checkDateValidity = (y: string, m: string, d: string) => {
    const year = parseInt(y);
    const month = parseInt(m);
    const day = parseInt(d);
    const effectiveYear = isNaN(year) ? new Date().getFullYear() : year;
    let mErr = false;
    let dErr = false;
    if (m.length > 0) { if (isNaN(month) || month < 1 || month > 12) mErr = true; }
    if (d.length > 0) {
            if (isNaN(day) || day < 1) dErr = true;
            else if (day > 31) dErr = true; 
            else if (!isNaN(month) && month >= 1 && month <= 12) {
                const maxDays = getDaysInMonth(new Date(effectiveYear, month - 1));
                if (day > maxDays) dErr = true;
            }
    }
    return { mErr, dErr };
};

export const getTradeMetrics = (trade: Trade, commissionPerUnit: number) => {
    const mult = getMultiplier(trade.symbol);
    const qty = trade.quantity;
    const entry = trade.entryPrice;
    const totalComm = commissionPerUnit > 0 ? (qty * commissionPerUnit) : (trade.commission || 0);

    // 1. Initial Risk (Denominator)
    let initialRiskAmt = 0;
    if (trade.initialStopLoss) {
        const grossRisk = Math.abs(entry - trade.initialStopLoss) * qty * mult;
        initialRiskAmt = grossRisk + totalComm;
    }

    // 2. Actual Risk (MAE)
    let actualRiskAmt = 0;
    let grossActualRisk = 0;
    if (trade.direction === TradeDirection.LONG) {
        const low = trade.lowestPriceReached ?? entry; 
        grossActualRisk = Math.max(0, (entry - low) * qty * mult); // Loss is positive magnitude here
    } else {
        const high = trade.highestPriceReached ?? entry;
        grossActualRisk = Math.max(0, (high - entry) * qty * mult);
    }
    // Actual Risk Amount (realized loss potential) includes commission
    actualRiskAmt = grossActualRisk + totalComm;

    // 3. Best P&L (MFE)
    let bestPnL = 0;
    let grossBestPnL = 0;
    if (trade.direction === TradeDirection.LONG) {
        const exit = trade.bestExitPrice ?? trade.highestPriceReached ?? entry;
        grossBestPnL = (exit - entry) * qty * mult;
    } else {
        const exit = trade.bestExitPrice ?? trade.lowestPriceReached ?? entry;
        grossBestPnL = (entry - exit) * qty * mult;
    }
    // Best P&L includes commission subtraction
    bestPnL = grossBestPnL - totalComm;

    return {
        initialRiskAmt,
        actualRiskAmt,
        bestPnL,
        actualRiskPct: initialRiskAmt > 0 ? (actualRiskAmt / initialRiskAmt) * 100 : 0,
        bestRR: initialRiskAmt > 0 ? bestPnL / initialRiskAmt : 0
    };
};
