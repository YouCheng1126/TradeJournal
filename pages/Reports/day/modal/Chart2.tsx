
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { formatCurrency } from '../../../../utils/calculations';
import { ChevronDown, Info, Plus, Minus } from 'lucide-react';
import { getSharedDualAxisTicks } from '../../../../components/Dashboard/utils';

interface Chart2Props {
    data: any[];
}

type MetricType = 'netPnL' | 'winRate' | 'count' | 'profitFactor' | 'avgWin' | 'avgLoss' | 'totalRR' | 'avgRR' | 'avgWinLossRR' | 'avgActualRiskPct' | 'avgDrawdown' | 'maxDrawdown';

const METRICS: { id: MetricType; label: string; desc: string }[] = [
    { id: 'netPnL', label: '總淨損益', desc: '選定分組下的淨損益總額。' },
    { id: 'winRate', label: '勝率 %', desc: '獲利交易筆數佔總交易筆數的百分比。' },
    { id: 'count', label: '交易次數', desc: '已平倉的交易總數。' },
    { id: 'profitFactor', label: '獲利因子', desc: '總獲利金額除以總虧損金額。' },
    { id: 'avgWin', label: '平均獲利', desc: '所有獲利交易的平均金額。' },
    { id: 'avgLoss', label: '平均虧損', desc: '所有虧損交易的平均金額。' },
    { id: 'totalRR', label: '總實現RR', desc: '所有交易的 R 倍數總和。' },
    { id: 'avgRR', label: '平均實現RR', desc: '平均每筆交易的風險回報比 (R-Multiple)。' },
    { id: 'avgWinLossRR', label: '平均盈虧RR', desc: '平均獲利金額除以平均虧損金額。' },
    { id: 'avgActualRiskPct', label: '平均真實RR %', desc: '平均 (實際最大浮虧 / 初始止損風險) 百分比。' },
    { id: 'avgDrawdown', label: '平均回撤', desc: '每次回撤事件的平均金額。' },
    { id: 'maxDrawdown', label: '最大回撤', desc: '該分組內資金曲線從最高點回落的最大金額。' },
];

const STORAGE_KEY_METRIC = 'zella_day_chart2_metric';
const STORAGE_KEY_METRIC_2 = 'zella_day_chart2_metric_2';

export const Chart2: React.FC<Chart2Props> = ({ data }) => {
    const [metric, setMetric] = useState<MetricType>('winRate');
    const [secondMetric, setSecondMetric] = useState<MetricType | null>(null); // Default OFF
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSecondDropdownOpen, setIsSecondDropdownOpen] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const secondDropdownRef = useRef<HTMLDivElement>(null);
    const infoRef = useRef<HTMLDivElement>(null);

    // Load saved state
    useEffect(() => {
        const savedMetric = localStorage.getItem(STORAGE_KEY_METRIC);
        const savedMetric2 = localStorage.getItem(STORAGE_KEY_METRIC_2);
        
        if (savedMetric) setMetric(savedMetric as MetricType);
        if (savedMetric2) setSecondMetric(savedMetric2 === 'null' ? null : savedMetric2 as MetricType);
    }, []);

    // Save state changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_METRIC, metric);
    }, [metric]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_METRIC_2, secondMetric || 'null');
    }, [secondMetric]);

    // Outside Click Handlers
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (secondDropdownRef.current && !secondDropdownRef.current.contains(e.target as Node)) {
                setIsSecondDropdownOpen(false);
            }
            if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
                setShowInfo(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentMetricObj = METRICS.find(m => m.id === metric);
    const secondMetricObj = secondMetric ? METRICS.find(m => m.id === secondMetric) : null;

    const checkIsCurrency = (m: MetricType) => ['netPnL', 'avgWin', 'avgLoss', 'maxDrawdown', 'avgDrawdown'].includes(m);
    const checkIsPercent = (m: MetricType) => m === 'winRate' || m === 'avgActualRiskPct';

    const formatValue = (val: number, m: MetricType) => {
        if (checkIsCurrency(m)) return formatCurrency(val);
        if (checkIsPercent(m)) return `${val.toFixed(0)}%`;
        if (m === 'avgRR' || m === 'profitFactor' || m === 'avgWinLossRR' || m === 'totalRR') return val.toFixed(2);
        return val.toFixed(2);
    };

    // Axis Tick Formatter (Integer Only)
    const formatAxisTick = (val: number, m: MetricType) => {
        if (checkIsCurrency(m)) return `$${Math.round(val)}`;
        if (checkIsPercent(m)) return `${Math.round(val)}%`;
        if (m === 'avgRR' || m === 'profitFactor' || m === 'avgWinLossRR' || m === 'totalRR') return `${val.toFixed(1)}`;
        return `${Math.round(val)}`;
    };

    // Calculate Dynamic Y-Axis Width
    const calculateWidth = (m: MetricType, ticks: number[]) => {
        if (ticks.length === 0) return 40;
        const maxLen = Math.max(...ticks.map(t => formatAxisTick(t, m).length));
        return Math.max(35, maxLen * 7 + 10);
    };

    // Calculate Dynamic Right Margin for X-Axis Labels
    const lastLabel = useMemo(() => {
        if (data.length === 0) return '';
        return String(data[data.length - 1].label || '');
    }, [data]);

    const rightMargin = useMemo(() => {
        if (secondMetric) return 0; // Second Y-Axis takes precedence space
        // Estimate approx 6px per char for font-size 11
        const estimatedWidth = lastLabel.length * 6;
        // Need at least half the label width + padding
        return Math.max(10, estimatedWidth / 2 + 8);
    }, [secondMetric, lastLabel]);

    // Get Synchronized Ticks
    const { leftTicks, leftDomain, rightTicks, rightDomain } = useMemo(() => {
        return getSharedDualAxisTicks(data, metric, secondMetric);
    }, [data, metric, secondMetric]);

    const leftYAxisWidth = useMemo(() => calculateWidth(metric, leftTicks), [metric, leftTicks]);
    const rightYAxisWidth = useMemo(() => secondMetric ? calculateWidth(secondMetric, rightTicks) : 0, [secondMetric, rightTicks]);

    return (
        <div className="bg-surface rounded-xl border border-slate-700/50 p-6 flex flex-col h-[400px] shadow-sm relative">
            
            {/* Header Controls */}
            <div className="flex justify-between items-center mb-4 z-20 relative">
                <div className="flex items-center gap-3">
                    
                    {/* Primary Metric Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-2 text-white font-bold text-sm hover:bg-slate-600/50 px-3 py-1.5 rounded transition-colors bg-[#334155] border border-slate-600"
                        >
                            {currentMetricObj?.label}
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                        
                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#475569] border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-[300px] overflow-y-auto custom-scrollbar">
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

                    {/* Secondary Metric Dropdown (If Active) */}
                    {secondMetric && (
                        <div className="relative" ref={secondDropdownRef}>
                            <button 
                                onClick={() => setIsSecondDropdownOpen(!isSecondDropdownOpen)}
                                className="flex items-center gap-2 text-orange-300 font-bold text-sm hover:bg-slate-600/50 px-3 py-1.5 rounded transition-colors bg-[#334155] border border-orange-500/50"
                            >
                                {secondMetricObj?.label}
                                <ChevronDown size={14} className="text-orange-400" />
                            </button>
                            
                            {isSecondDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-[#475569] border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {METRICS.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => { setSecondMetric(m.id); setIsSecondDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-700 transition-colors ${secondMetric === m.id ? 'text-orange-400' : 'text-slate-300'}`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add/Remove Metric Button */}
                    <button 
                        onClick={() => setSecondMetric(prev => prev ? null : 'count')}
                        className={`p-1.5 rounded transition-colors border border-slate-600 bg-slate-800/50 hover:bg-slate-700 ${secondMetric ? 'text-red-400' : 'text-slate-400 hover:text-white'}`}
                        title={secondMetric ? "Remove Metric" : "Add Metric"}
                    >
                        {secondMetric ? <Minus size={14} /> : <Plus size={14} />}
                    </button>

                    {/* Info Icon */}
                    <div ref={infoRef} className="relative flex items-center">
                        <div 
                            onClick={() => setShowInfo(!showInfo)}
                            className={`transition-colors cursor-pointer ${showInfo ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                        >
                            <Info size={16} />
                        </div>
                        {showInfo && (
                            <div className="absolute top-[-9px] left-full ml-2 w-max max-w-[250px] p-3 bg-[#475569] border border-slate-600 rounded-lg shadow-xl z-50 text-left">
                                <p className="text-[11px] text-slate-200 leading-relaxed font-medium mb-1">
                                    <span className="text-primary">{currentMetricObj?.label}:</span> {currentMetricObj?.desc}
                                </p>
                                {secondMetricObj && (
                                    <p className="text-[11px] text-slate-200 leading-relaxed font-medium pt-1 border-t border-slate-600">
                                        <span className="text-orange-400">{secondMetricObj?.label}:</span> {secondMetricObj?.desc}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: rightMargin, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.4} vertical={false} />
                        
                        {/* Masking ReferenceLine: Thick and Background Color to hide grid line */}
                        <ReferenceLine y={0} yAxisId="left" stroke="#334155" strokeWidth={3} strokeOpacity={1} />
                        
                        {/* Visible ReferenceLine: Thin and Axis Color */}
                        <ReferenceLine y={0} yAxisId="left" stroke="#94a3b8" strokeWidth={1} strokeOpacity={1} />

                        <XAxis 
                            dataKey="label" 
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false} 
                            minTickGap={30}
                        />
                        
                        {/* Left Y Axis */}
                        <YAxis 
                            yAxisId="left"
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(val) => formatAxisTick(val, metric)}
                            width={leftYAxisWidth}
                            ticks={leftTicks}
                            domain={leftDomain as [number, number]}
                            interval={0}
                        />

                        {/* Right Y Axis */}
                        {secondMetric && (
                            <YAxis 
                                yAxisId="right"
                                orientation="right"
                                stroke="#fdba74" 
                                fontSize={11} 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(val) => formatAxisTick(val, secondMetric)}
                                width={rightYAxisWidth}
                                ticks={rightTicks}
                                domain={rightDomain as [number, number]}
                                interval={0}
                            />
                        )}

                        <Tooltip 
                            cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const val1 = Number(payload[0].value);
                                    const val2 = secondMetric && payload[1] ? Number(payload[1].value) : null;
                                    
                                    return (
                                        <div className="bg-slate-800 border border-slate-600 p-3 rounded-lg shadow-xl text-xs">
                                            <p className="text-white font-bold mb-2">{label}</p>
                                            
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                <span className="text-slate-300">{currentMetricObj?.label}:</span>
                                                <span className={`font-bold ${metric === 'netPnL' ? (val1 >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-blue-400'}`}>
                                                    {formatValue(val1, metric)}
                                                </span>
                                            </div>

                                            {secondMetric && val2 !== null && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                    <span className="text-slate-300">{secondMetricObj?.label}:</span>
                                                    <span className={`font-bold ${secondMetric === 'netPnL' ? (val2 >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-blue-400'}`}>
                                                        {formatValue(val2, secondMetric)}
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
                            yAxisId="left"
                            type="monotone" 
                            dataKey={metric} 
                            stroke="#60a5fa" 
                            fill="none" 
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#1e293b', stroke: '#60a5fa', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#60a5fa', stroke: '#fff' }}
                        />

                        {secondMetric && (
                            <Area 
                                yAxisId="right"
                                type="monotone" 
                                dataKey={secondMetric} 
                                stroke="#f97316" 
                                fill="none" 
                                strokeWidth={2}
                                dot={{ r: 4, fill: '#1e293b', stroke: '#f97316', strokeWidth: 2 }}
                                activeDot={{ r: 6, fill: '#f97316', stroke: '#fff' }}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
