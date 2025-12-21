import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTrades } from '../contexts/TradeContext';
import { useNavigate } from 'react-router-dom';
import { 
    calculatePnL, formatCurrency, calculateProfitFactor, 
    calculateAvgWinLoss, calculateZellaScore, calculateGrossStats, calculateStreaks, calculateRMultiple
} from '../utils/calculations';
import { 
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip as RechartsTooltip,
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, AreaChart, Area, BarChart
} from 'recharts';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { SemiCircleGauge, ProfitFactorGauge, AvgWinLossBar, StreakWidget } from '../components/StatWidgets';
import { endOfMonth, eachWeekOfInterval, addDays, isSameMonth, format, endOfWeek, eachDayOfInterval } from 'date-fns';
import startOfMonth from 'date-fns/startOfMonth';

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Helper to generate specific ticks based on data range
const generateTicks = (min: number, max: number) => {
    // Requested steps (Added 10, 25)
    const steps = [10, 25, 50, 100, 200, 500, 1000, 2000, 2500, 5000, 10000];
    
    // Determine the total range to cover
    const range = Math.abs(max - min);
    
    if (range === 0) return [0];

    // Select the smallest step that results in <= 10 lines
    let step = steps[steps.length - 1]; // Default to largest if everything fails

    for (let s of steps) {
        const lineCount = range / s;
        if (lineCount <= 10) {
            step = s;
            break; // Found the smallest step that keeps grid lines <= 10
        }
    }

    // Calculate strict multiples for min and max ticks to ensure uniform grid
    const minTick = Math.floor(min / step) * step;
    const maxTick = Math.ceil(max / step) * step;

    const ticks = [];
    for (let i = minTick; i <= maxTick; i += step) {
        ticks.push(i);
    }
    
    // Handle potential floating point errors
    return ticks.map(t => Math.round(t));
};

// Custom Components for Recharts to hide elements on empty days
const CustomCursor = (props: any) => {
    const { points, width, height, payload } = props;
    if (!payload || !payload[0] || !payload[0].payload.hasTrades) return null;
    const { x } = points[0];
    return (
        <line x1={x} y1={0} x2={x} y2={height} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
    );
};

const CustomActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.hasTrades) return null;
    return <circle cx={cx} cy={cy} r={4} stroke="none" fill="#fff" />;
};

export const Dashboard: React.FC = () => {
  const { filteredTrades } = useTrades(); 
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  
  // Dropdown state for Month/Year selector
  const [openDropdown, setOpenDropdown] = useState<'month' | 'year' | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) {
        window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  const handleMonthChange = (delta: number) => {
      let newMonth = month + delta;
      let newYear = year;
      if (newMonth > 11) { newMonth = 0; newYear++; } 
      else if (newMonth < 0) { newMonth = 11; newYear--; }
      setMonth(newMonth);
      setYear(newYear);
  };

  const handleMonthSelect = (idx: number) => {
      setMonth(idx);
      setOpenDropdown(null);
  };

  const handleYearSelect = (y: number) => {
      setYear(y);
      setOpenDropdown(null);
  };

  // Current view date object
  const viewDate = new Date(year, month, 1);

  const stats = useMemo(() => {
    // Check exitPrice as proxy for "Closed" trade
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
        // Use New York time for grouping trades from DB
        const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t.entryDate));
        daysMap.set(dateKey, (daysMap.get(dateKey) || 0) + calculatePnL(t));
    });
    
    let winningDays = 0;
    let losingDays = 0;
    let breakEvenDays = 0;
    daysMap.forEach(pnl => { 
        if(pnl > 0) winningDays++; 
        else if (pnl < 0) losingDays++;
        else breakEvenDays++; 
    });
    
    const totalMeaningfulDays = winningDays + losingDays;
    const adjustedDayWinRate = totalMeaningfulDays > 0 ? ((winningDays / totalMeaningfulDays) * 100).toFixed(0) : 0;
    const { score: zellaScore, details: zellaDetails } = calculateZellaScore(filteredTrades);

    // --- Chart Data Preparation ---
    let chartData: any[] = [];
    
    // Separate Min/Max for Daily vs Cumulative vs Drawdown
    let minDailyVal = 0;
    let maxDailyVal = 0;
    let minCumVal = 0;
    let maxCumVal = 0;
    let minDrawdownVal = 0;

    if (closedTrades.length > 0) {
        // Sort trades by date to find range
        const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
        const firstDate = new Date(sortedTrades[0].entryDate);
        const lastDate = new Date(sortedTrades[sortedTrades.length - 1].entryDate);
        
        // Generate all days in range (Includes Weekends now)
        const allDays = eachDayOfInterval({ start: firstDate, end: lastDate });
        
        let runningCumulative = 0;
        let maxPeak = 0; // High water mark for Drawdown
        
        allDays.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyPnL = daysMap.get(dateKey) || 0; // 0 if no trade that day
            
            // Cumulative PnL logic - maintains previous value if no trade today
            if (dailyPnL !== 0) {
                runningCumulative += dailyPnL;
            }
            
            // Drawdown Logic: Current Cumulative - All Time High (Max Peak)
            if (runningCumulative > maxPeak) {
                maxPeak = runningCumulative;
            }
            const drawdown = runningCumulative - maxPeak;

            // Track min/max for Daily Chart
            minDailyVal = Math.min(minDailyVal, dailyPnL);
            maxDailyVal = Math.max(maxDailyVal, dailyPnL);

            // Track min/max for Cumulative Chart
            minCumVal = Math.min(minCumVal, runningCumulative);
            maxCumVal = Math.max(maxCumVal, runningCumulative);

            // Track min for Drawdown (Max is always 0)
            minDrawdownVal = Math.min(minDrawdownVal, drawdown);

            chartData.push({
                date: format(day, 'MM/dd'),
                fullDate: dateKey,
                dailyPnL: dailyPnL,
                cumulativePnL: runningCumulative,
                drawdown: drawdown,
                hasTrades: dailyPnL !== 0 // Flag for tooltip/cursor
            });
        });
    }

    return { 
        totalPnL, count: closedTrades.length, profitFactor, avgWin, avgLoss,
        zellaScore, zellaDetails, closedTrades, 
        winningDays, losingDays, breakEvenDays,
        winsCount, lossesCount, breakEvenCount,
        grossProfit, grossLoss,
        ...streakStats,
        adjustedWinRate, adjustedDayWinRate,
        chartData,
        minDailyVal, maxDailyVal,
        minCumVal, maxCumVal,
        minDrawdownVal
    };
  }, [filteredTrades]);

  // Generate ticks for Daily Bar Chart
  const dailyTicks = useMemo(() => generateTicks(stats.minDailyVal, stats.maxDailyVal), [stats.minDailyVal, stats.maxDailyVal]);
  const dailyDomain = useMemo(() => [dailyTicks[0], dailyTicks[dailyTicks.length - 1]], [dailyTicks]);

  // Generate ticks for Cumulative Area Chart
  const cumTicks = useMemo(() => generateTicks(stats.minCumVal, stats.maxCumVal), [stats.minCumVal, stats.maxCumVal]);
  const cumDomain = useMemo(() => [cumTicks[0], cumTicks[cumTicks.length - 1]], [cumTicks]);

  // Generate ticks for Drawdown Chart (0 to Min)
  const ddTicks = useMemo(() => generateTicks(stats.minDrawdownVal, 0), [stats.minDrawdownVal]);
  const ddDomain = useMemo(() => [ddTicks[0], 0], [ddTicks]);

  // Gradient Offset Calculation for Cumulative Chart
  const gradientOffset = () => {
    if (stats.maxCumVal <= 0) return 0;
    if (stats.minCumVal >= 0) return 1;
    return stats.maxCumVal / (stats.maxCumVal - stats.minCumVal);
  };
  const off = gradientOffset();

  // Construct Key manually to guarantee "Visual Day 18" = "Filter Date YYYY-MM-18"
  const getDateKey = (date: Date) => {
      return format(date, 'yyyy-MM-dd');
  };

  const getDayStats = (date: Date) => {
    const targetDateStr = getDateKey(date);
    
    const daysTrades = filteredTrades.filter(t => {
        if (t.exitPrice === undefined) return false;
        // Compare against trade's NY date
        const tradeDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t.entryDate));
        return tradeDateStr === targetDateStr;
    });

    const totalPnl = daysTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const tradeCount = daysTrades.length;
    let dailyWinRate = 0;
    let totalR = 0;

    if (tradeCount > 0) {
        const wins = daysTrades.filter(t => calculatePnL(t) > 0).length;
        const losses = daysTrades.filter(t => calculatePnL(t) < 0).length;
        const meaningful = wins + losses;
        if (meaningful > 0) {
            dailyWinRate = Math.round((wins / meaningful) * 100);
        }
        // Calculate Total R for the day
        totalR = daysTrades.reduce((acc, t) => acc + (calculateRMultiple(t) || 0), 0);
    }
    return { totalPnl, tradeCount, dailyWinRate, totalR };
  };

  const getWeeklyStats = (start: Date, end: Date) => {
      // Create search range YYYY-MM-DD strings for simple string comparison (ignoring time)
      const weeklyTrades = filteredTrades.filter(t => {
          if (t.exitPrice === undefined) return false;
          const tradeDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t.entryDate));
          return tradeDateStr >= getDateKey(start) && tradeDateStr <= getDateKey(end);
      });

      const weeklyPnL = weeklyTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
      const weeklyCount = weeklyTrades.length;
      
      let weeklyWinRate = 0;
      let totalR = 0;

      if (weeklyCount > 0) {
          const wins = weeklyTrades.filter(t => calculatePnL(t) > 0).length;
          const losses = weeklyTrades.filter(t => calculatePnL(t) < 0).length;
          const meaningful = wins + losses;
          if (meaningful > 0) {
              weeklyWinRate = Math.round((wins / meaningful) * 100);
          }
          // Calculate Total R for the week
          totalR = weeklyTrades.reduce((acc, t) => acc + (calculateRMultiple(t) || 0), 0);
      }

      return { weeklyPnL, weeklyCount, weeklyWinRate, totalR };
  };

  const handleDayClick = (date: Date) => {
      const dateStr = getDateKey(date);
      navigate('/journal', { state: { focusDate: dateStr } });
  };

  const Card = ({ title, value, subValue, children, titleColor = "text-slate-400", alignChildren = "center" }: any) => (
      <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col h-48 relative overflow-hidden shadow-sm">
        {/* Title Area - Fixed height */}
        <div className="h-8 flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
            <span className={titleColor}>{title}</span>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 flex items-center justify-between w-full">
            <div className="flex flex-col justify-center h-full">
                <span className={`text-3xl font-bold ${typeof value === 'number' ? (value >= 0 ? 'text-white' : 'text-red-400') : 'text-white'}`}>
                    {value}
                </span>
                {/* Unified margin-top to mt-1 for alignment */}
                {subValue !== undefined && <span className="text-sm text-slate-500 mt-1">{subValue}</span>}
            </div>
            <div className={`flex items-${alignChildren} justify-center w-full h-full pl-4`}>
                {children}
            </div>
        </div>
      </div>
  );

  // Calendar Generation Logic: Rows of weeks
  const calendarWeeks = useMemo(() => {
      const start = startOfMonth(viewDate);
      const end = endOfMonth(viewDate);
      // Generate weeks starting on Monday
      const allWeeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      
      // Filter out weeks where no day falls in the current month's weekday range (Mon-Fri)
      // If a week has Mon-Fri ALL in the previous month, skip it.
      return allWeeks.filter(weekStart => {
          // Check Mon(0), Tue(1), Wed(2), Thu(3), Fri(4)
          // If ANY of these days are in the current month, keep the week.
          const weekDays = [0, 1, 2, 3, 4].map(offset => addDays(weekStart, offset));
          return weekDays.some(day => isSameMonth(day, viewDate));
      });
  }, [viewDate]);

  return (
    <div className="space-y-6 pb-10">
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Net P&L: Removed pb-4, added mt-6 to push value down */}
        <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col h-48 relative overflow-hidden shadow-sm">
            <div className="h-8 flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
                <span className="text-slate-400">Net P&L</span>
            </div>
            <div className="flex-1 flex items-center justify-between w-full">
                <div className="flex flex-col justify-center h-full mt-6"> {/* Added mt-6 to move value down */}
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

        <Card title="Trade win %" value={`${stats.adjustedWinRate}%`} subValue=""><SemiCircleGauge winCount={stats.winsCount} breakEvenCount={stats.breakEvenCount} lossCount={stats.lossesCount} /></Card>
        <Card title="Profit factor" value={stats.profitFactor.toFixed(2)} subValue=""><ProfitFactorGauge grossProfit={stats.grossProfit} grossLoss={stats.grossLoss} /></Card>
        
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-surface rounded-xl border border-slate-700/50 p-6 flex flex-col h-[600px]">
             <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">Zella score</h3>
             </div>
             <div className="flex-1 w-full min-h-[400px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats.zellaDetails}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 13, dy: 4 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Score" dataKey="A" stroke="#8b5cf6" strokeWidth={3} fill="#8b5cf6" fillOpacity={0.5} />
                        <RechartsTooltip formatter={(value) => [value, 'Score']} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }} />
                    </RadarChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-auto pt-4 border-t border-slate-800">
                <div className="flex justify-between items-end mb-2">
                    <div><p className="text-sm text-slate-400">Your Zella Score</p><p className="text-5xl font-bold text-white tracking-tight">{stats.zellaScore}</p></div>
                </div>
                <div className="w-full bg-slate-700 h-4 rounded-full overflow-hidden relative"><div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 transition-all duration-1000" style={{ width: `${stats.zellaScore}%` }} /></div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
             </div>
          </div>

          <div className="lg:col-span-2 bg-surface rounded-xl border border-slate-700/50 p-0 flex flex-col h-[600px]">
            <div className="px-4 py-2 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center bg-slate-800/50 gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white flex items-center gap-2">Trade Calendar</h3>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><ChevronLeft size={18} /></button>
                     
                     {/* Month Dropdown */}
                     <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'month' ? null : 'month'); }}
                            className="flex items-center gap-1 bg-slate-800 border border-slate-600 text-white text-sm font-bold py-1.5 px-3 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            {MONTH_NAMES[month]}
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                        {openDropdown === 'month' && (
                            <div className="absolute top-full right-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl shadow-2xl z-50 p-2 w-[280px]">
                                <div className="grid grid-cols-3 gap-1">
                                    {MONTH_NAMES.map((m, idx) => (
                                        <button
                                            key={m}
                                            onClick={(e) => { e.stopPropagation(); handleMonthSelect(idx); }}
                                            className={`text-sm py-2 rounded hover:bg-slate-700 transition-colors ${month === idx ? 'bg-primary text-white font-bold' : 'text-slate-300'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                     </div>

                     {/* Year Dropdown */}
                     <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'year' ? null : 'year'); }}
                            className="flex items-center gap-1 bg-slate-800 border border-slate-600 text-white text-sm font-bold py-1.5 px-3 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            {year}
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                        {openDropdown === 'year' && (
                            <div className="absolute top-full right-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl shadow-2xl z-50 p-2 w-[240px]">
                                <div className="grid grid-cols-4 gap-1">
                                    {Array.from({ length: 16 }, (_, i) => today.getFullYear() - 10 + i).map(y => (
                                        <button
                                            key={y}
                                            onClick={(e) => { e.stopPropagation(); handleYearSelect(y); }}
                                            className={`text-sm py-2 rounded hover:bg-slate-700 transition-colors ${year === y ? 'bg-primary text-white font-bold' : 'text-slate-300'}`}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                     </div>

                     <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><ChevronRight size={18} /></button>
                     <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} className="ml-2 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Today</button>
                </div>
            </div>

            <div className="p-4 bg-surface flex-1 overflow-y-auto">
                {/* Header Row: 5 Days + 1 Summary (White Weekly Title) */}
                <div className="grid grid-cols-6 gap-2 mb-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                        <div key={day} className="text-center py-2 text-xs font-semibold text-white uppercase tracking-wider">{day}</div>
                    ))}
                    <div className="text-center py-2 text-xs font-semibold text-white uppercase tracking-wider">Weekly</div>
                </div>

                {/* Calendar Body: Week Rows */}
                <div className="space-y-2">
                    {calendarWeeks.map((weekStart, weekIdx) => {
                        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                        const { weeklyPnL, weeklyCount, weeklyWinRate, totalR: weeklyTotalR } = getWeeklyStats(weekStart, weekEnd);
                        
                        // Color logic for Weekly P&L (Matches daily cells)
                        let weeklyPnlClass = "text-2xl font-bold text-slate-300"; // Increased font
                        if (weeklyPnL > 0) weeklyPnlClass = "text-2xl font-extrabold text-[#54B990]"; // Increased font
                        else if (weeklyPnL < 0) weeklyPnlClass = "text-2xl font-extrabold text-[#D14A58]"; // Increased font

                        return (
                            <div key={weekStart.toISOString()} className="grid grid-cols-6 gap-2 h-[90px]"> {/* Height reduced to 90px */}
                                {/* Days Mon-Fri (Indices 0 to 4) */}
                                {[0, 1, 2, 3, 4].map(dayOffset => {
                                    const date = addDays(weekStart, dayOffset);
                                    
                                    // Check if date belongs to current month view
                                    if (!isSameMonth(date, viewDate)) {
                                        return <div key={dayOffset} className="bg-transparent rounded" />;
                                    }

                                    const day = date.getDate();
                                    const { totalPnl, tradeCount, dailyWinRate, totalR } = getDayStats(date);
                                    const hasTrades = tradeCount > 0;
                                    const isProfit = totalPnl > 0;
                                    const isLoss = totalPnl < 0;
                                    const isBreakEven = hasTrades && totalPnl === 0;

                                    let cellClass = "bg-[#2C3C4E] h-full rounded border border-slate-700/50 p-1 flex flex-col justify-between hover:border-slate-500 transition-colors cursor-pointer group relative";
                                    let pnlClass = "text-2xl font-bold text-slate-400"; // Increased font

                                    if (hasTrades) {
                                        if (isProfit) {
                                            cellClass = "bg-[#0C412C] h-full rounded border border-green-700 p-1 flex flex-col justify-between hover:border-green-500 cursor-pointer group";
                                            pnlClass = "text-2xl font-extrabold text-[#54B990]"; // Increased font
                                        } else if (isLoss) {
                                            cellClass = "bg-[#491318] h-full rounded border border-red-700 p-1 flex flex-col justify-between hover:border-red-500 cursor-pointer group";
                                            pnlClass = "text-2xl font-extrabold text-[#D14A58]"; // Increased font
                                        } else if (isBreakEven) {
                                            cellClass = "bg-[#2C3C4E] h-full rounded border border-slate-600 p-1 flex flex-col justify-between hover:border-slate-400 cursor-pointer group";
                                            pnlClass = "text-2xl font-extrabold text-slate-300"; // Increased font
                                        }
                                    }

                                    // Today highlight logic
                                    const currentKey = getDateKey(date);
                                    const todayKey = getDateKey(new Date());
                                    const isToday = currentKey === todayKey;

                                    return (
                                        <div key={dayOffset} className={cellClass} onClick={() => handleDayClick(date)}>
                                            {/* Top Right: Date */}
                                            <div className="flex justify-end p-1">
                                                <span className={`text-[10px] font-medium ${isToday ? 'bg-primary text-white w-4 h-4 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>{day}</span>
                                            </div>
                                            
                                            {hasTrades && (
                                                <>
                                                    {/* Center: P&L - Added pb-3 to move text up slightly */}
                                                    <div className="flex-1 flex items-center justify-center pb-3">
                                                        <div className={pnlClass}>{formatCurrency(totalPnl)}</div>
                                                    </div>
                                                    
                                                    {/* Bottom Row: Trades Left, R/Win% Right */}
                                                    <div className="flex justify-between items-end w-full px-1.5 pb-1 text-sm font-medium text-slate-400">
                                                        <span>{tradeCount} Trades</span>
                                                        <span>{totalR.toFixed(1)}R {dailyWinRate}%</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Weekly Summary Card (Column 6) */}
                                <div className="bg-slate-800 h-full rounded border border-slate-700 p-1 flex flex-col justify-between relative overflow-hidden group">
                                    {/* Top Left: Week Label */}
                                    <div className="flex justify-start p-1"> 
                                        <span className="text-[10px] font-medium text-slate-400">Week {weekIdx + 1}</span>
                                    </div>
                                    
                                    {/* Center: P&L - Added pb-3 to move text up slightly */}
                                    <div className="flex-1 flex items-center justify-center pb-3">
                                        <div className={weeklyPnlClass}>
                                            {formatCurrency(weeklyPnL)}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Trades Left, R/Win% Right */}
                                    <div className="flex justify-between items-end w-full px-1.5 pb-1 text-sm font-medium text-slate-400">
                                        <span>{weeklyCount} Trades</span>
                                        <span>{weeklyTotalR.toFixed(1)}R {weeklyWinRate}%</span>
                                    </div>

                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
      </div>

      {/* NEW GRID: Chart & Placeholders in 1 row (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MODULE 1: Daily Net Cumulative P&L (Area Chart) */}
          <div className="bg-surface rounded-xl border border-slate-700/50 p-6 shadow-sm h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    Daily Net Cumulative P&L 
                </h3>
            </div>
            <div className="flex-1 w-full min-h-0"> 
                {stats.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData} margin={{ top: 5, right: 2, bottom: -10, left: -3 }}>
                            <defs>
                                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0} stopColor="#34d399" stopOpacity={0.7}/>
                                    <stop offset={off} stopColor="#34d399" stopOpacity={0.1}/>
                                    <stop offset={off} stopColor="#f87171" stopOpacity={0.1}/>
                                    <stop offset={1} stopColor="#f87171" stopOpacity={0.7}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={20}
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `$${val}`}
                                ticks={cumTicks}
                                domain={cumDomain}
                                interval={0} 
                                width={45}
                            />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={<CustomCursor />}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        if (!data.hasTrades) return null;

                                        const cumulativeData = payload.find(p => p.dataKey === 'cumulativePnL');
                                        const fullDate = data.fullDate;
                                        
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{fullDate}</p>
                                                {cumulativeData && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]"></div>
                                                        <span className="text-slate-300">Cum:</span>
                                                        <span className="font-bold text-white ml-auto">
                                                            {formatCurrency(Number(cumulativeData.value))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="cumulativePnL" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                fill="url(#splitColor)"
                                activeDot={<CustomActiveDot />} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                        No trade data
                    </div>
                )}
            </div>
          </div>

          {/* MODULE 2: Net Daily P&L (Bar Chart) */}
          <div className="bg-surface rounded-xl border border-slate-700/50 h-[400px] p-6 flex flex-col shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    Net Daily P&L
                </h3>
             </div>
             <div className="flex-1 w-full min-h-0">
                {stats.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData} margin={{ top: 5, right: 2, bottom: -10, left: -3 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={20}
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `$${val}`}
                                ticks={dailyTicks}
                                domain={dailyDomain}
                                interval={0} 
                                width={45}
                            />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        if (!data.hasTrades) return null;

                                        const dailyData = payload.find(p => p.dataKey === 'dailyPnL');
                                        const fullDate = data.fullDate;
                                        
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{fullDate}</p>
                                                {dailyData && (
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${Number(dailyData.value) >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                        <span className="text-slate-300">Day:</span>
                                                        <span className={`font-bold ml-auto ${Number(dailyData.value) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {formatCurrency(Number(dailyData.value))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="dailyPnL">
                                {stats.chartData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.dailyPnL >= 0 ? '#34d399' : '#f87171'} radius={[2, 2, 0, 0]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                        No trade data
                    </div>
                )}
             </div>
          </div>

          {/* MODULE 3: Drawdown Chart */}
          <div className="bg-surface rounded-xl border border-slate-700/50 h-[400px] p-6 flex flex-col shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    Drawdown
                </h3>
             </div>
             <div className="flex-1 w-full min-h-0">
                {stats.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData} margin={{ top: 5, right: 2, bottom: -10, left: -3 }}>
                            <defs>
                                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="10%" stopColor="#ef4444" stopOpacity={0.1}/>
                                    <stop offset="70%" stopColor="#ef4444" stopOpacity={0.7}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={20}
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `$${val}`}
                                ticks={ddTicks}
                                domain={ddDomain}
                                interval={0} 
                                width={45}
                            />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={<CustomCursor />}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        if (!data.hasTrades) return null;

                                        const ddData = payload.find(p => p.dataKey === 'drawdown');
                                        const fullDate = data.fullDate;
                                        
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{fullDate}</p>
                                                {ddData && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                        <span className="text-slate-300">DD:</span>
                                                        <span className="font-bold text-red-400 ml-auto">
                                                            {formatCurrency(Number(ddData.value))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="drawdown" 
                                stroke="#ef4444" 
                                strokeWidth={2} 
                                fill="url(#drawdownGradient)"
                                activeDot={<CustomActiveDot />} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                        No trade data
                    </div>
                )}
             </div>
          </div>
      </div>

    </div>
  );
};