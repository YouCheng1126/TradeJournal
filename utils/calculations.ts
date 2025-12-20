import { Trade, TradeDirection } from '../types';

/**
 * Calculates Net P&L based on direction, quantity, and prices.
 */
export const calculatePnL = (trade: Trade): number => {
  if (!trade.exitPrice) return 0;
  
  const symbol = trade.symbol.toUpperCase();
  let multiplier = 1;

  if (symbol.includes('MES')) {
      multiplier = 5; 
  } else if (symbol.includes('MNQ')) {
      multiplier = 2; 
  } else if (symbol === 'ES') {
      multiplier = 50; 
  } else if (symbol === 'NQ') {
      multiplier = 20; 
  }
  
  const priceDiff = trade.exitPrice - trade.entryPrice;
  const rawPnL = priceDiff * trade.quantity * multiplier;
  const grossPnL = trade.direction === TradeDirection.LONG ? rawPnL : -rawPnL;
  
  const netPnL = grossPnL - (trade.commission || 0);
  
  return Math.round(netPnL * 100) / 100;
};

export const calculateRMultiple = (trade: Trade): number | undefined => {
  if (!trade.exitPrice || !trade.initialStopLoss) return undefined;
  const riskPerShare = Math.abs(trade.entryPrice - trade.initialStopLoss);
  if (riskPerShare === 0) return 0;
  const priceDiff = trade.direction === TradeDirection.LONG
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice;
  return Number((priceDiff / riskPerShare).toFixed(2));
};

export const formatCurrency = (amount: number) => {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = `$${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return isNegative ? `-${formatted}` : formatted;
};

export const calculateWinRate = (trades: Trade[]): number => {
  if (trades.length === 0) return 0;
  const winners = trades.filter(t => (calculatePnL(t) > 0));
  return Math.round((winners.length / trades.length) * 100);
};

export const calculateProfitFactor = (trades: Trade[]): number => {
    let grossProfit = 0;
    let grossLoss = 0;
    trades.forEach(t => {
        const pnl = calculatePnL(t);
        if (pnl > 0) grossProfit += pnl;
        else grossLoss += Math.abs(pnl);
    });
    if (grossLoss === 0) return grossProfit > 0 ? 100 : 0;
    return Number((grossProfit / grossLoss).toFixed(2));
};

export const calculateGrossStats = (trades: Trade[]) => {
    let grossProfit = 0;
    let grossLoss = 0;
    trades.forEach(t => {
        const pnl = calculatePnL(t);
        if (pnl > 0) grossProfit += pnl;
        else grossLoss += Math.abs(pnl);
    });
    return { grossProfit, grossLoss };
};

export const calculateAvgWinLoss = (trades: Trade[]) => {
    const winners = trades.filter(t => calculatePnL(t) > 0);
    const losers = trades.filter(t => calculatePnL(t) <= 0);
    const totalWin = winners.reduce((acc, t) => acc + calculatePnL(t), 0);
    const totalLoss = losers.reduce((acc, t) => acc + calculatePnL(t), 0);
    const avgWin = winners.length > 0 ? totalWin / winners.length : 0;
    const avgLoss = losers.length > 0 ? totalLoss / losers.length : 0;
    return { avgWin, avgLoss };
};

export const getConsecutiveStats = (trades: Trade[]) => {
    const sorted = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    sorted.forEach(t => {
        const pnl = calculatePnL(t);
        if (pnl > 0) {
            currentWins++;
            currentLosses = 0;
            if (currentWins > maxWins) maxWins = currentWins;
        } else if (pnl < 0) {
            currentLosses++;
            currentWins = 0;
            if (currentLosses > maxLosses) maxLosses = currentLosses;
        }
    });
    return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
};

export const calculateExtremes = (trades: Trade[]) => {
    let largestWin = 0;
    let largestLoss = 0;
    trades.forEach(t => {
        const pnl = calculatePnL(t);
        if (pnl > largestWin) largestWin = pnl;
        if (pnl < largestLoss) largestLoss = pnl;
    });
    return { largestWin, largestLoss };
};

export const calculateStreaks = (trades: Trade[]) => {
    if (trades.length === 0) {
        return { 
            currentDayStreak: 0, maxDayWinStreak: 0, maxDayLossStreak: 0,
            currentTradeStreak: 0, maxTradeWinStreak: 0, maxTradeLossStreak: 0,
        };
    }

    // --- 1. Trade Streaks ---
    const tradesDesc = [...trades].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    
    // Current Trade Streak
    let currentTradeStreak = 0;
    if (tradesDesc.length > 0) {
        const firstPnl = calculatePnL(tradesDesc[0]);
        if (firstPnl > 0) {
            for (const t of tradesDesc) {
                if (calculatePnL(t) > 0) currentTradeStreak++;
                else break;
            }
        } else if (firstPnl < 0) {
            for (const t of tradesDesc) {
                if (calculatePnL(t) < 0) currentTradeStreak--; 
                else break;
            }
        }
    }

    // Historical Trade Streaks
    const tradeCons = getConsecutiveStats(trades);

    // --- 2. Day Streaks ---
    const dailyPnL = new Map<string, number>();
    trades.forEach(t => {
        const day = t.entryDate.split('T')[0];
        dailyPnL.set(day, (dailyPnL.get(day) || 0) + calculatePnL(t));
    });

    const sortedDays = Array.from(dailyPnL.entries())
        .map(([date, pnl]) => ({ date, pnl }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Current Day Streak
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

    // Historical Day Streaks
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

export const calculateMaxDrawdown = (trades: Trade[]): number => {
    if (trades.length === 0) return 0;
    const sorted = [...trades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    let peak = 0;
    let currentEquity = 0;
    let maxDrawdown = 0;
    sorted.forEach(t => {
        const pnl = calculatePnL(t);
        currentEquity += pnl;
        if (currentEquity > peak) peak = currentEquity;
        const drawdown = currentEquity - peak;
        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    });
    return maxDrawdown;
};

export const calculateRecoveryFactor = (trades: Trade[]): number => {
    const totalNetProfit = trades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const maxDD = Math.abs(calculateMaxDrawdown(trades));
    if (maxDD === 0) return totalNetProfit > 0 ? 10 : 0;
    return Number((totalNetProfit / maxDD).toFixed(2));
}

export const calculateZellaScore = (trades: Trade[]) => {
    if (trades.length === 0) {
        return {
            score: 0,
            details: [
                { subject: 'Consistency', A: 0, fullMark: 100 },
                { subject: 'Profit Factor', A: 0, fullMark: 100 },
                { subject: 'Avg Win/Loss', A: 0, fullMark: 100 },
                { subject: 'Drawdown', A: 0, fullMark: 100 },
                { subject: 'Win %', A: 0, fullMark: 100 },
                { subject: 'Recovery', A: 0, fullMark: 100 },
            ]
        };
    }

    // Since users now manually select status, all logged trades are considered 'Closed' for scoring
    // We check for exitPrice to ensure PnL can be calculated
    const closedTrades = trades.filter(t => t.exitPrice !== undefined);
    if (closedTrades.length === 0) return { score: 0, details: [] };
    
    const winRate = calculateWinRate(closedTrades);
    let winRateScore = Math.min((winRate / 60) * 100, 100);
    
    const pf = calculateProfitFactor(closedTrades);
    let pfScore = Math.min(Math.max((pf - 0.8) * 50, 0), 100);

    const { avgWin, avgLoss } = calculateAvgWinLoss(closedTrades);
    const ratio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
    let ratioScore = Math.min(ratio * 40, 100); 

    const totalProfit = closedTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const maxDD = Math.abs(calculateMaxDrawdown(closedTrades));
    
    let ddScore = 100;
    if (totalProfit > 0 && maxDD > 0) {
        const ddRatio = maxDD / totalProfit;
        ddScore = Math.max(100 - (ddRatio * 100), 0);
    } else if (totalProfit <= 0) {
        ddScore = 20; 
    }

    const pnls = closedTrades.map(t => calculatePnL(t));
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    let consistencyScore = 50;
    if (mean > 0) {
        const cv = stdDev / mean;
        consistencyScore = Math.max(100 - ((cv - 1) * 33), 0);
        consistencyScore = Math.min(consistencyScore, 100);
    } else {
        consistencyScore = 20;
    }

    const recovery = calculateRecoveryFactor(closedTrades);
    let recoveryScore = Math.min(recovery * 20, 100);

    const weightedScore = (
        (winRateScore * 0.20) + 
        (pfScore * 0.20) + 
        (ratioScore * 0.15) + 
        (ddScore * 0.20) + 
        (consistencyScore * 0.15) +
        (recoveryScore * 0.10)
    );

    return {
        score: Number(weightedScore.toFixed(2)),
        details: [
            { subject: 'Consistency', A: Math.round(consistencyScore), fullMark: 100 },
            { subject: 'Profit Factor', A: Math.round(pfScore), fullMark: 100 },
            { subject: 'Avg Win/Loss', A: Math.round(ratioScore), fullMark: 100 },
            { subject: 'Drawdown', A: Math.round(ddScore), fullMark: 100 },
            { subject: 'Win %', A: Math.round(winRateScore), fullMark: 100 },
            { subject: 'Recovery', A: Math.round(recoveryScore), fullMark: 100 }, 
        ]
    };
};