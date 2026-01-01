
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BarChart, Bar, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { Trade } from '../../../../types';
import { calculatePnL, formatCurrency, calculateRMultiple } from '../../../../utils/calculations';
import { format } from 'date-fns';
import { generateTicks, CustomCursor, CustomActiveDot } from '../../../../components/Dashboard/utils';
import { TrendingUp, BarChart3, ChevronDown, Info } from 'lucide-react';

interface DailyWinLossChartProps {
    trades: Trade[];
    commission: number;
}

type Timeframe = 'day' | 'month';
type ChartType = 'bar' | 'line';
type MetricType = 'cum_pnl' | 'per_pnl' | 'cum_pnl_avg' | 'cum_max_dd' | 'per_dd' | 'cum_dd_avg' | 'per_rr' | 'cum_rr_sum' | 'cum_avg_rr' | 'cum_daily_rr_avg' | 'cum_pl_ratio';

const METRICS: { id: MetricType; label: string; desc: string }[] = [
    { id: 'cum_pnl', label: '總淨損益-累計', desc: '累積的淨損益總額。' },
    { id: 'per_pnl', label: '單日淨損益', desc: '該週期（日/月）內的淨損益。' },
    { id: 'cum_pnl_avg', label: '平均每日淨損益-累積', desc: '截至當日的「總淨損益 / 交易天數」之平均值。' },
    { id: 'cum_max_dd', label: '最大回撤-累計', desc: '截至當日，資金曲線從最高點回落的最大金額。' },
    { id: 'per_dd', label: '單日回撤', desc: '該週期（日/月）內資金曲線從最高點跌至最低點的金額。' },
    { id: 'cum_dd_avg', label: '平均每日回撤-累積', desc: '截至當日的「單日回撤總和 / 交易天數」之平均值。' },
    { id: 'per_rr', label: '單日實現 RR', desc: '該週期（日/月）內所有交易 RR 的總和。' },
    { id: 'cum_rr_sum', label: '單日實現 RR-累積', desc: '截至當日的所有交易 RR 總和的累加值。' },
    { id: 'cum_avg_rr', label: '平均實現 RR-累積', desc: '截至當日的所有交易 RR 總和 / 總交易筆數。' },
    { id: 'cum_daily_rr_avg', label: '平均每日 RR-累積', desc: '顯示獲利日相對於虧損日的獲利能力。計算方式：Abs(平均獲利日金額 / 平均虧損日金額)。' },
    { id: 'cum_pl_ratio', label: '平均盈虧 RR-累積', desc: '截至當日的「平均獲利金額 / 平均虧損金額」比率。' },
];

export const DailyWinLossChart: React.FC<DailyWinLossChartProps> = ({ trades, commission }) => {
    const [timeframe, setTimeframe] = useState<Timeframe>('day');
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [metric, setMetric] = useState<MetricType>('per_pnl'); // Default to Daily PnL
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    
    // Ref for click outside logic
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const infoRef = useRef<HTMLDivElement>(null);

    // Dropdown Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Info Tooltip Click Outside
    useEffect(() => {
        const handleClickOutsideInfo = (event: MouseEvent) => {
            if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
                setShowInfo(false);
            }
        };
        if (showInfo) {
            document.addEventListener('mousedown', handleClickOutsideInfo);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideInfo);
        };
    }, [showInfo]);

    // Custom Scroll Logic to control scroll amount (Task 2)
    useEffect(() => {
        const listEl = listRef.current;
        if (!isDropdownOpen || !listEl) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const step = 60; 
            listEl.scrollTop += (e.deltaY > 0 ? step : -step);
        };

        listEl.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            listEl.removeEventListener('wheel', handleWheel);
        };
    }, [isDropdownOpen]);

    const { data, ticks, domain, minVal, maxVal } = useMemo(() => {
        const sortedTrades = [...trades].sort((a, b) => new Date(a.exitDate || a.entryDate).getTime() - new Date(b.exitDate || b.entryDate).getTime());
        
        const groups = new Map<string, Trade[]>();
        sortedTrades.forEach(t => {
            const dateStr = timeframe === 'day' 
                ? format(new Date(t.entryDate), 'yyyy-MM-dd')
                : format(new Date(t.entryDate), 'yyyy-MM');
            if (!groups.has(dateStr)) groups.set(dateStr, []);
            groups.get(dateStr)!.push(t);
        });

        const sortedKeys = Array.from(groups.keys()).sort();
        
        let cumPnl = 0;
        let cumR = 0; 
        let cumDailyRRSum = 0; 
        let cumDD = 0; 
        let peakEquity = 0; 
        
        let totalTradesCount = 0;
        let totalDaysCount = 0;

        let sumWins = 0;
        let countWins = 0;
        let sumLosses = 0;
        let countLosses = 0;

        // For Avg Daily RR (Win Day Avg / Loss Day Avg)
        let winDaySum = 0;
        let winDayCount = 0;
        let lossDaySum = 0;
        let lossDayCount = 0;
        
        const chartData = sortedKeys.map(key => {
            const periodTrades = groups.get(key) || [];
            totalDaysCount++;
            
            const periodPnl = periodTrades.reduce((acc, t) => acc + calculatePnL(t, commission), 0);
            
            if (periodPnl > 0) {
                winDaySum += periodPnl;
                winDayCount++;
            } else if (periodPnl < 0) {
                lossDaySum += Math.abs(periodPnl);
                lossDayCount++;
            }

            const periodR = periodTrades.reduce((acc, t) => acc + (calculateRMultiple(t, commission) || 0), 0);
            const periodTradesCount = periodTrades.length;
            const periodRRSum = periodR;

            const periodWins = periodTrades.filter(t => calculatePnL(t, commission) > 0);
            const periodLosses = periodTrades.filter(t => calculatePnL(t, commission) < 0);
            
            // Period Drawdown logic (Peak to Trough)
            const sortedPeriodTrades = [...periodTrades].sort((a, b) => new Date(a.exitDate || a.entryDate).getTime() - new Date(b.exitDate || b.entryDate).getTime());
            let currentPeriodEquity = 0;
            let periodPeak = 0;
            let maxPeriodDD = 0;
            sortedPeriodTrades.forEach(t => {
                currentPeriodEquity += calculatePnL(t, commission);
                if (currentPeriodEquity > periodPeak) periodPeak = currentPeriodEquity;
                const dd = currentPeriodEquity - periodPeak;
                if (dd < maxPeriodDD) maxPeriodDD = dd;
            });
            const periodDrawdown = maxPeriodDD;

            cumPnl += periodPnl;
            cumR += periodR;
            cumDailyRRSum += periodRRSum;
            cumDD += periodDrawdown;
            totalTradesCount += periodTradesCount;

            if (cumPnl > peakEquity) peakEquity = cumPnl;
            const currentMaxDD = cumPnl - peakEquity; 

            periodWins.forEach(t => { sumWins += calculatePnL(t, commission); countWins++; });
            periodLosses.forEach(t => { sumLosses += Math.abs(calculatePnL(t, commission)); countLosses++; });

            let value = 0;
            switch (metric) {
                case 'cum_pnl': value = cumPnl; break;
                case 'per_pnl': value = periodPnl; break;
                case 'cum_pnl_avg': value = totalDaysCount > 0 ? cumPnl / totalDaysCount : 0; break;
                
                case 'cum_max_dd': value = currentMaxDD; break;
                case 'per_dd': value = periodDrawdown; break;
                case 'cum_dd_avg': value = totalDaysCount > 0 ? cumDD / totalDaysCount : 0; break;
                
                case 'per_rr': value = periodRRSum; break;
                case 'cum_rr_sum': value = cumDailyRRSum; break; 
                case 'cum_avg_rr': value = totalTradesCount > 0 ? cumR / totalTradesCount : 0; break;
                case 'cum_daily_rr_avg': 
                    const avgWinDay = winDayCount > 0 ? winDaySum / winDayCount : 0;
                    const avgLossDay = lossDayCount > 0 ? lossDaySum / lossDayCount : 0;
                    value = avgLossDay !== 0 ? Math.abs(avgWinDay / avgLossDay) : 0;
                    break;
                
                case 'cum_pl_ratio': 
                    const avgWin = countWins > 0 ? sumWins / countWins : 0;
                    const avgLoss = countLosses > 0 ? sumLosses / countLosses : 0;
                    value = avgLoss !== 0 ? avgWin / avgLoss : 0; 
                    break;
            }

            return {
                date: timeframe === 'day' ? format(new Date(key), 'MM/dd') : format(new Date(key + '-01'), 'MM/yy'),
                fullDate: key,
                value: Number(value.toFixed(2)),
            };
        });

        // Calculate Ticks
        let min = 0;
        let max = 0;
        if (chartData.length > 0) {
            min = Math.min(...chartData.map(d => d.value));
            max = Math.max(...chartData.map(d => d.value));
        }
        if (min > 0) min = 0; 
        if (max < 0) max = 0;

        const generatedTicks = generateTicks(min, max);
        const generatedDomain = [generatedTicks[0], generatedTicks[generatedTicks.length - 1]];

        return { data: chartData, ticks: generatedTicks, domain: generatedDomain, minVal: min, maxVal: max };
    }, [trades, commission, timeframe, metric]);

    // Gradient Offset Calculation
    const gradientOffset = () => {
        if (maxVal <= 0) return 0;
        if (minVal >= 0) return 1;
        return maxVal / (maxVal - minVal);
    };
    const off = gradientOffset();

    const getToggleClass = (isActive: boolean) => 
        `flex-1 flex justify-center items-center py-1 text-xs font-bold rounded-md transition-all ${
            isActive 
            ? 'bg-primary text-white shadow-sm' 
            : 'bg-slate-600/30 text-slate-400 hover:text-white hover:bg-slate-600/50'
        }`;

    const isCurrency = ['cum_pnl', 'per_pnl', 'cum_pnl_avg', 'cum_max_dd', 'per_dd', 'cum_dd_avg'].includes(metric);
    const formatVal = (val: number) => isCurrency ? formatCurrency(val) : `${val.toFixed(2)}`;
    const currentMetricObj = METRICS.find(m => m.id === metric);

    return (
        <>
            <div className="flex items-center justify-between mb-4 relative z-20">
                <div className="flex items-center gap-3">
                    {/* Chart Type Toggle */}
                    <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-600 w-20">
                        <button 
                            onClick={() => setChartType('line')}
                            className={getToggleClass(chartType === 'line')}
                            title="Line Chart"
                        >
                            <TrendingUp size={14} />
                        </button>
                        <button 
                            onClick={() => setChartType('bar')}
                            className={getToggleClass(chartType === 'bar')}
                            title="Bar Chart"
                        >
                            <BarChart3 size={14} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Dropdown Title */}
                        <div className="relative" ref={dropdownRef}>
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center gap-2 text-white font-bold text-sm hover:bg-slate-600/50 px-3 py-1.5 rounded transition-colors bg-[#334155] border border-slate-600"
                            >
                                {currentMetricObj?.label}
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>
                            
                            {isDropdownOpen && (
                                <div 
                                    ref={listRef}
                                    className="absolute top-full left-0 mt-1 w-64 bg-[#475569] border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden py-1 max-h-[130px] overflow-y-auto custom-scrollbar"
                                >
                                    {METRICS.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => { setMetric(m.id); setIsDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-700 transition-colors ${metric === m.id ? 'text-primary' : 'text-slate-300'}`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Info Icon with Clickable Tooltip */}
                        <div ref={infoRef} className="relative flex items-center">
                            <div 
                                onClick={() => setShowInfo(!showInfo)}
                                className={`transition-colors cursor-pointer ${showInfo ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                            >
                                <Info size={16} />
                            </div>
                            {showInfo && (
                                <div className="absolute top-[-9px] left-full ml-2 w-max max-w-[280px] p-3 bg-[#475569] rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.3)] z-50 text-left">
                                    <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                                        {currentMetricObj?.desc}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Timeframe Toggle */}
                <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-600 w-32">
                    <button 
                        onClick={() => setTimeframe('day')}
                        className={getToggleClass(timeframe === 'day')}
                    >
                        Day
                    </button>
                    <button 
                        onClick={() => setTimeframe('month')}
                        className={getToggleClass(timeframe === 'month')}
                    >
                        Month
                    </button>
                </div>
            </div>
            
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={30}
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => isCurrency ? `$${val}` : `${val}`}
                                ticks={ticks}
                                domain={domain as [number, number]}
                                width={45}
                                interval={0}
                            />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{d.fullDate}</p>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${d.value >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                    <span className={`font-bold ${d.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatVal(d.value)}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    ) : (
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                            <defs>
                                <linearGradient id="splitColorRight" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0} stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset={off} stopColor="#10b981" stopOpacity={0.1}/>
                                    <stop offset={off} stopColor="#ef4444" stopOpacity={0.1}/>
                                    <stop offset={1} stopColor="#ef4444" stopOpacity={0.8}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={30}
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => isCurrency ? `$${val}` : `${val}`}
                                ticks={ticks}
                                domain={domain as [number, number]}
                                width={45}
                                interval={0}
                            />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={<CustomCursor />}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{d.fullDate}</p>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${d.value >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                    <span className={`font-bold ${d.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatVal(d.value)}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                fill="url(#splitColorRight)" 
                                activeDot={<CustomActiveDot />}
                            />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>
        </>
    );
};
