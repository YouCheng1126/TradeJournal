
import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Bar, Cell } from 'recharts';
import { formatCurrency } from '../../utils/calculations';
import { generateTicks, CustomCursor, CustomActiveDot } from './utils';

interface ChartsSectionProps {
    chartData: any[];
    minDailyVal: number;
    maxDailyVal: number;
    minCumVal: number;
    maxCumVal: number;
    minDrawdownVal: number;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ 
    chartData, minDailyVal, maxDailyVal, minCumVal, maxCumVal, minDrawdownVal 
}) => {
    
    // Generate ticks
    const dailyTicks = useMemo(() => generateTicks(minDailyVal, maxDailyVal), [minDailyVal, maxDailyVal]);
    const dailyDomain = useMemo(() => [dailyTicks[0], dailyTicks[dailyTicks.length - 1]], [dailyTicks]);

    const cumTicks = useMemo(() => generateTicks(minCumVal, maxCumVal), [minCumVal, maxCumVal]);
    const cumDomain = useMemo(() => [cumTicks[0], cumTicks[cumTicks.length - 1]], [cumTicks]);

    const ddTicks = useMemo(() => generateTicks(minDrawdownVal, 0), [minDrawdownVal]);
    const ddDomain = useMemo(() => [ddTicks[0], 0], [ddTicks]);

    const gradientOffset = () => {
        if (maxCumVal <= 0) return 0;
        if (minCumVal >= 0) return 1;
        return maxCumVal / (maxCumVal - minCumVal);
    };
    const off = gradientOffset();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MODULE 1: Daily Net Cumulative P&L */}
          <div className="bg-surface rounded-xl border border-slate-700/50 p-6 shadow-sm h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">Daily Net Cumulative P&L</h3>
            </div>
            <div className="flex-1 w-full min-h-0"> 
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 2, bottom: -10, left: -3 }}>
                            <defs>
                                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0} stopColor="#34d399" stopOpacity={0.7}/>
                                    <stop offset={off} stopColor="#34d399" stopOpacity={0.1}/>
                                    <stop offset={off} stopColor="#f87171" stopOpacity={0.1}/>
                                    <stop offset={1} stopColor="#f87171" stopOpacity={0.7}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} ticks={cumTicks} domain={cumDomain as [number, number]} interval={0} width={45} />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={<CustomCursor />}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        if (!data.hasTrades) return null;
                                        const cumulativeData = payload.find(p => p.dataKey === 'cumulativePnL');
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{data.fullDate}</p>
                                                {cumulativeData && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]"></div>
                                                        <span className="text-slate-300">Cum:</span>
                                                        <span className="font-bold text-white ml-auto">{formatCurrency(Number(cumulativeData.value))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area type="monotone" dataKey="cumulativePnL" stroke="#8b5cf6" strokeWidth={2} fill="url(#splitColor)" activeDot={<CustomActiveDot />} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">No trade data</div>
                )}
            </div>
          </div>

          {/* MODULE 2: Net Daily P&L */}
          <div className="bg-surface rounded-xl border border-slate-700/50 h-[400px] p-6 flex flex-col shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">Net Daily P&L</h3>
             </div>
             <div className="flex-1 w-full min-h-0">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 2, bottom: -10, left: -3 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} ticks={dailyTicks} domain={dailyDomain as [number, number]} interval={0} width={45} />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        if (!data.hasTrades) return null;
                                        const dailyData = payload.find(p => p.dataKey === 'dailyPnL');
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{data.fullDate}</p>
                                                {dailyData && (
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${Number(dailyData.value) >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                        <span className="text-slate-300">Day:</span>
                                                        <span className={`font-bold ml-auto ${Number(dailyData.value) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(Number(dailyData.value))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="dailyPnL" radius={[2, 2, 0, 0]}>
                                {chartData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.dailyPnL >= 0 ? '#34d399' : '#f87171'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">No trade data</div>
                )}
             </div>
          </div>

          {/* MODULE 3: Drawdown Chart */}
          <div className="bg-surface rounded-xl border border-slate-700/50 h-[400px] p-6 flex flex-col shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">Drawdown</h3>
             </div>
             <div className="flex-1 w-full min-h-0">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 2, bottom: -10, left: -3 }}>
                            <defs>
                                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="10%" stopColor="#ef4444" stopOpacity={0.1}/>
                                    <stop offset="70%" stopColor="#ef4444" stopOpacity={0.7}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} ticks={ddTicks} domain={ddDomain as [number, number]} interval={0} width={45} />
                            <Tooltip 
                                position={{ y: 50 }} 
                                cursor={<CustomCursor />}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        if (!data.hasTrades) return null;
                                        const ddData = payload.find(p => p.dataKey === 'drawdown');
                                        return (
                                            <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                                                <p className="text-slate-400 mb-1 font-mono">{data.fullDate}</p>
                                                {ddData && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                        <span className="text-slate-300">DD:</span>
                                                        <span className="font-bold text-red-400 ml-auto">{formatCurrency(Number(ddData.value))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={2} fill="url(#drawdownGradient)" activeDot={<CustomActiveDot />} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">No trade data</div>
                )}
             </div>
          </div>
        </div>
    );
};
