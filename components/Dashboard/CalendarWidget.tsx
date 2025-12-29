
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { endOfMonth, eachWeekOfInterval, addDays, isSameMonth, format, endOfWeek } from 'date-fns';
import { Trade } from '../../types';
import { calculatePnL, calculateRMultiple, formatCurrency } from '../../utils/calculations';
import { useTrades } from '../../contexts/TradeContext';

interface CalendarWidgetProps {
    filteredTrades: Trade[];
    year: number;
    month: number;
    setYear: (y: number) => void;
    setMonth: (m: number) => void;
    today: Date;
    onDayClick: (date: Date) => void;
}

// Helpers
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ filteredTrades, year, month, setYear, setMonth, today, onDayClick }) => {
    const { userSettings } = useTrades();
    const [openDropdown, setOpenDropdown] = useState<'month' | 'year' | null>(null);

    // Current view date object
    const viewDate = useMemo(() => new Date(year, month, 1), [year, month]);

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

    const getDateKey = (date: Date) => {
        return format(date, 'yyyy-MM-dd');
    };

    const getDayStats = (date: Date) => {
        const targetDateStr = getDateKey(date);
        
        const daysTrades = filteredTrades.filter(t => {
            if (t.exitPrice === undefined) return false;
            // Use local date formatting (Database time)
            const tradeDateStr = format(new Date(t.entryDate), 'yyyy-MM-dd');
            return tradeDateStr === targetDateStr;
        });
    
        const totalPnl = daysTrades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
        const tradeCount = daysTrades.length;
        let dailyWinRate = 0;
        let totalR = 0;
    
        if (tradeCount > 0) {
            const wins = daysTrades.filter(t => calculatePnL(t, userSettings.commissionPerUnit) > 0).length;
            const losses = daysTrades.filter(t => calculatePnL(t, userSettings.commissionPerUnit) < 0).length;
            const meaningful = wins + losses;
            if (meaningful > 0) {
                dailyWinRate = Math.round((wins / meaningful) * 100);
            }
            totalR = daysTrades.reduce((acc, t) => acc + (calculateRMultiple(t) || 0), 0);
        }
        return { totalPnl, tradeCount, dailyWinRate, totalR };
    };

    const getWeeklyStats = (start: Date, end: Date) => {
        const startStr = getDateKey(start);
        const endStr = getDateKey(end);

        const weeklyTrades = filteredTrades.filter(t => {
            if (t.exitPrice === undefined) return false;
            const tradeDateStr = format(new Date(t.entryDate), 'yyyy-MM-dd');
            return tradeDateStr >= startStr && tradeDateStr <= endStr;
        });
  
        const weeklyPnL = weeklyTrades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
        const weeklyCount = weeklyTrades.length;
        
        let weeklyWinRate = 0;
        let totalR = 0;
  
        if (weeklyCount > 0) {
            const wins = weeklyTrades.filter(t => calculatePnL(t, userSettings.commissionPerUnit) > 0).length;
            const losses = weeklyTrades.filter(t => calculatePnL(t, userSettings.commissionPerUnit) < 0).length;
            const meaningful = wins + losses;
            if (meaningful > 0) {
                weeklyWinRate = Math.round((wins / meaningful) * 100);
            }
            totalR = weeklyTrades.reduce((acc, t) => acc + (calculateRMultiple(t) || 0), 0);
        }
  
        return { weeklyPnL, weeklyCount, weeklyWinRate, totalR };
    };

    const calendarWeeks = useMemo(() => {
        const start = startOfMonth(viewDate);
        const end = endOfMonth(viewDate);
        const allWeeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
        
        return allWeeks.filter(weekStart => {
            const weekDays = [0, 1, 2, 3, 4].map(offset => addDays(weekStart, offset));
            return weekDays.some(day => isSameMonth(day, viewDate));
        });
    }, [viewDate]);

    return (
        <div className="lg:col-span-2 bg-surface rounded-xl border border-slate-700/50 p-0 flex flex-col h-[600px]">
            <div className="px-4 py-2 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center bg-slate-800/20 gap-4">
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
                            <div className="absolute top-full right-0 mt-2 bg-surface border border-slate-600 rounded-xl shadow-2xl z-50 p-2 w-[280px]">
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
                            <div className="absolute top-full right-0 mt-2 bg-surface border border-slate-600 rounded-xl shadow-2xl z-50 p-2 w-[240px]">
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
                {/* Header Row */}
                <div className="grid grid-cols-6 gap-2 mb-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                        <div key={day} className="text-center py-2 text-xs font-semibold text-white uppercase tracking-wider">{day}</div>
                    ))}
                    <div className="text-center py-2 text-xs font-semibold text-white uppercase tracking-wider">Weekly</div>
                </div>

                {/* Calendar Body */}
                <div className="space-y-2">
                    {calendarWeeks.map((weekStart, weekIdx) => {
                        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                        const { weeklyPnL, weeklyCount, weeklyWinRate, totalR: weeklyTotalR } = getWeeklyStats(weekStart, weekEnd);
                        
                        let weeklyPnlClass = "text-2xl font-bold text-slate-300";
                        if (weeklyPnL > 0) weeklyPnlClass = "text-2xl font-extrabold text-[#54B990]";
                        else if (weeklyPnL < 0) weeklyPnlClass = "text-2xl font-extrabold text-[#D14A58]";

                        return (
                            <div key={weekStart.toISOString()} className="grid grid-cols-6 gap-2 h-[90px]">
                                {/* Days Mon-Fri */}
                                {[0, 1, 2, 3, 4].map(dayOffset => {
                                    const date = addDays(weekStart, dayOffset);
                                    
                                    if (!isSameMonth(date, viewDate)) {
                                        return <div key={dayOffset} className="bg-transparent rounded" />;
                                    }

                                    const day = date.getDate();
                                    const { totalPnl, tradeCount, dailyWinRate, totalR } = getDayStats(date);
                                    const hasTrades = tradeCount > 0;
                                    const isProfit = totalPnl > 0;
                                    const isLoss = totalPnl < 0;
                                    const isBreakEven = hasTrades && totalPnl === 0;

                                    // Default background changed from #2C3C4E to bg-slate-600 (lighter dark)
                                    let cellClass = "bg-slate-600 h-full rounded border border-slate-500/50 p-1 flex flex-col justify-between hover:border-slate-400 transition-colors cursor-pointer group relative";
                                    let pnlClass = "text-2xl font-bold text-slate-300"; // Lighter text

                                    if (hasTrades) {
                                        if (isProfit) {
                                            cellClass = "bg-emerald-900/80 h-full rounded border border-green-600 p-1 flex flex-col justify-between hover:border-green-400 cursor-pointer group";
                                            pnlClass = "text-2xl font-extrabold text-[#54B990]";
                                        } else if (isLoss) {
                                            cellClass = "bg-red-900/80 h-full rounded border border-red-600 p-1 flex flex-col justify-between hover:border-red-400 cursor-pointer group";
                                            pnlClass = "text-2xl font-extrabold text-[#D14A58]";
                                        } else if (isBreakEven) {
                                            cellClass = "bg-slate-600 h-full rounded border border-slate-500 p-1 flex flex-col justify-between hover:border-slate-300 cursor-pointer group";
                                            pnlClass = "text-2xl font-extrabold text-slate-300";
                                        }
                                    }

                                    const currentKey = getDateKey(date);
                                    const todayKey = getDateKey(new Date());
                                    const isToday = currentKey === todayKey;

                                    return (
                                        <div key={dayOffset} className={cellClass} onClick={() => onDayClick(date)}>
                                            <div className="flex justify-end p-1">
                                                <span className={`text-[10px] font-medium ${isToday ? 'bg-primary text-white w-4 h-4 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>{day}</span>
                                            </div>
                                            
                                            {hasTrades && (
                                                <>
                                                    <div className="flex-1 flex items-center justify-center pb-3">
                                                        <div className={pnlClass}>{formatCurrency(totalPnl)}</div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-end w-full px-1.5 pb-1 text-sm font-medium text-slate-300">
                                                        <span>{tradeCount} Trades</span>
                                                        <span>{totalR.toFixed(1)}R {dailyWinRate}%</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Weekly Summary */}
                                <div className="bg-slate-700 h-full rounded border border-slate-600 p-1 flex flex-col justify-between relative overflow-hidden group">
                                    <div className="flex justify-start p-1"> 
                                        <span className="text-[10px] font-medium text-slate-400">Week {weekIdx + 1}</span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center pb-3">
                                        <div className={weeklyPnlClass}>
                                            {formatCurrency(weeklyPnL)}
                                        </div>
                                    </div>
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
    );
};
