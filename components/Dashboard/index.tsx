
import React, { useMemo, useState } from 'react';
import { useTrades } from '../../contexts/TradeContext';
import { calculatePnL, calculateProfitFactor, calculateAvgWinLoss, calculateZellaScore, calculateGrossStats, calculateStreaks } from '../../utils/calculations';
import { eachDayOfInterval, format } from 'date-fns';
import { TopWidgets } from './TopWidgets';
import { ZellaScoreWidget } from './ZellaScoreWidget';
import { CalendarWidget } from './CalendarWidget';
import { ChartsSection } from './ChartsSection';

export const Dashboard: React.FC = () => {
  const { filteredTrades } = useTrades(); 
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const stats = useMemo(() => {
    const closedTrades = filteredTrades.filter(t => t.exitPrice !== undefined);
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const profitFactor = calculateProfitFactor(closedTrades);
    const { avgWin, avgLoss } = calculateAvgWinLoss(closedTrades);
    const { grossProfit, grossLoss } = calculateGrossStats(closedTrades);
    const streakStats = calculateStreaks(closedTrades);
    
    const winsCount = closedTrades.filter(t => calculatePnL(t) > 0).length;
    const lossesCount = closedTrades.filter(t => calculatePnL(t) < 0).length;
    const breakEvenCount = closedTrades.filter(t => calculatePnL(t) === 0).length;
    
    const totalMeaningfulTrades = winsCount + lossesCount;
    const adjustedWinRate = totalMeaningfulTrades > 0 ? Math.round((winsCount / totalMeaningfulTrades) * 100) : 0;

    const daysMap = new Map<string, number>();
    closedTrades.forEach(t => {
        const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t.entryDate));
        daysMap.set(dateKey, (daysMap.get(dateKey) || 0) + calculatePnL(t));
    });
    
    const { score: zellaScore, details: zellaDetails } = calculateZellaScore(filteredTrades);

    // --- Chart Data Preparation ---
    let chartData: any[] = [];
    let minDailyVal = 0;
    let maxDailyVal = 0;
    let minCumVal = 0;
    let maxCumVal = 0;
    let minDrawdownVal = 0;

    if (closedTrades.length > 0) {
        const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
        const firstDate = new Date(sortedTrades[0].entryDate);
        const lastDate = new Date(sortedTrades[sortedTrades.length - 1].entryDate);
        
        const allDays = eachDayOfInterval({ start: firstDate, end: lastDate });
        
        let runningCumulative = 0;
        let maxPeak = 0;
        
        allDays.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyPnL = daysMap.get(dateKey) || 0;
            
            if (dailyPnL !== 0) runningCumulative += dailyPnL;
            
            if (runningCumulative > maxPeak) maxPeak = runningCumulative;
            const drawdown = runningCumulative - maxPeak;

            minDailyVal = Math.min(minDailyVal, dailyPnL);
            maxDailyVal = Math.max(maxDailyVal, dailyPnL);
            minCumVal = Math.min(minCumVal, runningCumulative);
            maxCumVal = Math.max(maxCumVal, runningCumulative);
            minDrawdownVal = Math.min(minDrawdownVal, drawdown);

            chartData.push({
                date: format(day, 'MM/dd'),
                fullDate: dateKey,
                dailyPnL: dailyPnL,
                cumulativePnL: runningCumulative,
                drawdown: drawdown,
                hasTrades: dailyPnL !== 0
            });
        });
    }

    return { 
        totalPnL, count: closedTrades.length, profitFactor, avgWin, avgLoss,
        zellaScore, zellaDetails, 
        winsCount, lossesCount, breakEvenCount,
        grossProfit, grossLoss,
        ...streakStats,
        adjustedWinRate,
        chartData,
        minDailyVal, maxDailyVal,
        minCumVal, maxCumVal,
        minDrawdownVal
    };
  }, [filteredTrades]);

  return (
    <div className="space-y-6 pb-10">
      <TopWidgets stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ZellaScoreWidget score={stats.zellaScore} details={stats.zellaDetails} />
          <CalendarWidget 
            filteredTrades={filteredTrades} 
            year={year} month={month} 
            setYear={setYear} setMonth={setMonth} 
            today={today}
          />
      </div>

      <ChartsSection 
        chartData={stats.chartData} 
        minDailyVal={stats.minDailyVal} maxDailyVal={stats.maxDailyVal}
        minCumVal={stats.minCumVal} maxCumVal={stats.maxCumVal}
        minDrawdownVal={stats.minDrawdownVal}
      />
    </div>
  );
};
