
import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../../../../utils/calculations';
import { ChevronDown, Tag, Target, Activity, Layers } from 'lucide-react';

type CrossType = 'strategy' | 'tag' | 'status' | 'side';

interface CrossProps {
    data: any[]; // The aggregated cross data
    rowLabels: string[]; // Groupings (Mon, Tue...)
    colLabels: string[]; // Secondary groupings (Strategy names, Tags...)
    metric: 'pnl' | 'winrate' | 'count';
    onMetricChange: (m: 'pnl' | 'winrate' | 'count') => void;
    primaryLabel: string;
    crossType: CrossType;
    onCrossTypeChange: (t: CrossType) => void;
}

const TYPE_OPTIONS: { id: CrossType; label: string; icon: any }[] = [
    { id: 'strategy', label: 'Strategy', icon: Target },
    { id: 'tag', label: 'Tag', icon: Tag },
    { id: 'side', label: 'Side', icon: Layers },
    { id: 'status', label: 'Status', icon: Activity },
];

export const Cross: React.FC<CrossProps> = ({ data, rowLabels, colLabels, metric, onMetricChange, primaryLabel, crossType, onCrossTypeChange }) => {
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Find min/max for coloring
    let maxVal = 0;
    let minVal = 0;
    
    data.forEach(row => {
        Object.values(row).forEach((cell: any) => {
            if (cell && typeof cell === 'object') {
                const val = metric === 'pnl' ? cell.pnl : metric === 'winrate' ? cell.winRate : cell.count;
                if (val > maxVal) maxVal = val;
                if (val < minVal) minVal = val;
            }
        });
    });

    // Color scale helper
    const getCellColor = (val: number) => {
        if (metric === 'count') {
            const intensity = maxVal > 0 ? (val / maxVal) : 0;
            return `rgba(59, 130, 246, ${0.1 + intensity * 0.5})`; // Blue
        }
        
        if (metric === 'winrate') {
            if (val >= 50) {
                const intensity = (val - 50) / 50;
                return `rgba(16, 185, 129, ${0.1 + intensity * 0.6})`;
            } else {
                const intensity = (50 - val) / 50;
                return `rgba(239, 68, 68, ${0.1 + intensity * 0.6})`;
            }
        }

        // PnL
        if (val > 0) {
            const intensity = maxVal > 0 ? (val / maxVal) : 0;
            return `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`; // Emerald
        } else if (val < 0) {
            const intensity = minVal < 0 ? (val / minVal) : 0; 
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`; // Red
        }
        return 'transparent';
    };

    const formatValue = (val: number) => {
        if (metric === 'pnl') return formatCurrency(val);
        if (metric === 'winrate') return `${val.toFixed(0)}%`;
        return val;
    };

    const activeOption = TYPE_OPTIONS.find(o => o.id === crossType);

    return (
        <div className="bg-surface rounded-xl border border-slate-700/50 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                <h3 className="font-bold text-white text-sm">Cross analysis</h3>
                
                <div className="flex items-center gap-3">
                    {/* Cross Type Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                            className="flex items-center gap-2 bg-slate-800 border border-slate-600 hover:border-slate-500 rounded-lg px-3 py-1 text-xs font-bold text-slate-300 transition-colors"
                        >
                            {activeOption?.icon && <activeOption.icon size={12} />}
                            {activeOption?.label}
                            <ChevronDown size={12} className="text-slate-500" />
                        </button>

                        {isTypeDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 w-32 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
                                {TYPE_OPTIONS.map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { onCrossTypeChange(opt.id); setIsTypeDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-700 flex items-center gap-2 ${crossType === opt.id ? 'text-primary bg-slate-700/50' : 'text-slate-300'}`}
                                    >
                                        <opt.icon size={12} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Metric Toggle */}
                    <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-600">
                        <button onClick={() => onMetricChange('pnl')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${metric === 'pnl' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>P&L</button>
                        <button onClick={() => onMetricChange('winrate')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${metric === 'winrate' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>Win %</button>
                        <button onClick={() => onMetricChange('count')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${metric === 'count' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>Trades</button>
                    </div>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs bg-slate-800/50 border-b border-slate-700 min-w-[120px] sticky left-0 z-10">{primaryLabel}</th>
                            {colLabels.map(col => (
                                <th key={col} className="px-4 py-3 font-bold text-slate-400 text-xs bg-slate-800/30 border-b border-slate-700 min-w-[100px] whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold">
                        {rowLabels.map((rowKey, idx) => {
                            const rowData = data.find(d => d.rowKey === rowKey);
                            return (
                                <tr key={rowKey} className="hover:bg-slate-700/10">
                                    <td className="px-4 py-3 text-left text-white bg-slate-800/20 border-r border-slate-700/50 sticky left-0 z-10">{rowKey}</td>
                                    {colLabels.map(colKey => {
                                        const cellData = rowData ? rowData[colKey] : null;
                                        const val = cellData ? (metric === 'pnl' ? cellData.pnl : metric === 'winrate' ? cellData.winRate : cellData.count) : 0;
                                        const bg = cellData ? getCellColor(val) : 'transparent';
                                        
                                        return (
                                            <td key={colKey} className="px-2 py-3 border-r border-slate-700/30 border-b border-slate-700/30 relative">
                                                {cellData && (
                                                    <div 
                                                        className="absolute inset-1 rounded flex items-center justify-center"
                                                        style={{ backgroundColor: bg }}
                                                    >
                                                        <span className="text-white drop-shadow-md">{formatValue(val)}</span>
                                                    </div>
                                                )}
                                                {!cellData && <span className="text-slate-600">-</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
