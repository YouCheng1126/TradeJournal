
import React from 'react';
import { formatCurrency } from '../../../../utils/calculations';
import { TrendingUp, TrendingDown, Zap, Trophy } from 'lucide-react';

interface TopWidgetProps {
    data: any[];
    groupingType: string;
}

export const TopWidget: React.FC<TopWidgetProps> = ({ data }) => {
    
    // Helper to calculate median
    const calculateMedian = (values: number[]) => {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    // Helper to find extremes ignoring empty data if possible
    const findStats = () => {
        // 1. Logic for PnL and Activity (Keep filtering 0 counts to avoid showing empty days as "Worst")
        const activeData = data.filter(d => d.count > 0);
        
        let bestPerf = activeData.length > 0 ? activeData[0] : (data[0] || {});
        let worstPerf = activeData.length > 0 ? activeData[0] : (data[0] || {});
        let mostActive = activeData.length > 0 ? activeData[0] : (data[0] || {});

        if (activeData.length > 0) {
            activeData.forEach(d => {
                if (d.netPnL > bestPerf.netPnL) bestPerf = d;
                if (d.netPnL < worstPerf.netPnL) worstPerf = d;
                if (d.count > mostActive.count) mostActive = d;
            });
        }

        // 2. Advanced Logic for Best Win Rate
        
        // A. Calculate Average Expected Volume 
        // Logic Update: Only include items with count > 0 in the denominator
        const nonZeroItems = data.filter(d => d.count > 0);
        const totalTrades = data.reduce((acc, d) => acc + d.count, 0);
        const numberOfActiveItems = nonZeroItems.length;
        
        const avgExpectedVolume = numberOfActiveItems > 0 ? totalTrades / numberOfActiveItems : 0;
        
        // B. Base Threshold (Average Expected Volume * 0.3, Ceiling)
        const baseThreshold = Math.ceil(avgExpectedVolume * 0.3);

        // C. Calculate Median Volume (Using only active items to be consistent with denominator logic, or use all? 
        // Typically stats on distribution usually imply active distribution. Using nonZeroItems.)
        const counts = nonZeroItems.map(d => d.count);
        const medianVolume = calculateMedian(counts);

        // D. Second Threshold (Median * 0.2, Ceiling)
        const secondThreshold = Math.ceil(medianVolume * 0.2);

        // E. Find the Winner
        // Sort all items by Win Rate descending
        const sortedByWinRate = [...data].sort((a, b) => b.winRate - a.winRate);

        // Iterate to find the first item that meets BOTH thresholds
        // Condition: count > baseThreshold AND count > secondThreshold
        let bestWinRate = sortedByWinRate.find(d => d.count > baseThreshold && d.count > secondThreshold);

        // Fallback: If no item meets the strict statistical criteria (e.g. extremely low volume overall),
        // fallback to the highest win rate that has at least 1 trade.
        if (!bestWinRate) {
            bestWinRate = sortedByWinRate.find(d => d.count > 0);
        }

        // Final Fallback: If absolutely no trades exist
        if (!bestWinRate) {
            bestWinRate = data[0] || {};
        }

        return { bestPerf, worstPerf, mostActive, bestWinRate };
    };

    const stats = findStats();

    const Card = ({ label, icon: Icon, mainLabel, subValue, subValue2, valueColor, iconColor, isMostActive = false }: any) => (
        <div className="bg-surface border border-slate-700/50 rounded-xl p-5 flex flex-col justify-between h-36 relative overflow-hidden shadow-sm hover:border-slate-600 transition-colors">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <Icon size={16} className={iconColor} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            
            {stats && (stats.bestPerf.count !== undefined || stats.bestWinRate.count !== undefined) ? (
                <div className="flex items-center justify-between h-full pt-1 gap-2">
                    {/* Left: Item Label (e.g. Wednesday) - Flexible width, wraps if needed */}
                    <div className="flex-1 flex items-center h-full min-w-0">
                        <h4 className="text-3xl font-bold text-white leading-none whitespace-normal break-words" title={mainLabel}>{mainLabel}</h4>
                    </div>

                    {/* Right: Values - Auto width based on content, no fixed width */}
                    <div className="flex-shrink-0 flex flex-col justify-center items-end gap-0">
                        {/* Most Active: Combine Count and 'trades' on one line */}
                        {isMostActive ? (
                            <div className="flex items-baseline gap-1.5">
                                <span className={`text-2xl font-extrabold ${valueColor}`}>{subValue}</span>
                                <span className="text-sm font-bold text-white opacity-80">trades</span>
                            </div>
                        ) : (
                            <>
                                {/* Row 1: Amount or WinRate */}
                                <div className={`text-2xl font-extrabold ${valueColor} whitespace-nowrap`}>
                                    {subValue}
                                </div>
                                {/* Row 2: Trade Count */}
                                {subValue2 && (
                                    <div className="text-sm font-bold text-white opacity-80 whitespace-nowrap">
                                        {subValue2}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm font-medium">
                    No data
                </div>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card 
                label="最佳成績"
                icon={TrendingUp}
                iconColor="text-emerald-400"
                mainLabel={stats?.bestPerf.label}
                subValue={formatCurrency(stats?.bestPerf.netPnL || 0)}
                subValue2={`${stats?.bestPerf.count || 0} trades`}
                valueColor="text-emerald-400"
            />
            <Card 
                label="最差成績"
                icon={TrendingDown}
                iconColor="text-red-400"
                mainLabel={stats?.worstPerf.label}
                subValue={formatCurrency(stats?.worstPerf.netPnL || 0)}
                subValue2={`${stats?.worstPerf.count || 0} trades`}
                valueColor="text-red-400"
            />
            <Card 
                label="交易數量最多"
                icon={Zap}
                iconColor="text-amber-400"
                mainLabel={stats?.mostActive.label}
                subValue={`${stats?.mostActive.count || 0}`}
                valueColor="text-slate-200"
                isMostActive={true}
            />
            <Card 
                label="最高勝率"
                icon={Trophy}
                iconColor="text-blue-400"
                mainLabel={stats?.bestWinRate.label}
                subValue={`${stats?.bestWinRate.winRate?.toFixed(0) || 0}%`}
                subValue2={`${stats?.bestWinRate.count || 0} trades`}
                valueColor="text-blue-400"
            />
        </div>
    );
};
