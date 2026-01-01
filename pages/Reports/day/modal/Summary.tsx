
import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../../../../utils/calculations';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SummaryProps {
    data: any[];
    groupLabel: string;
}

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc' | null;
};

export const Summary: React.FC<SummaryProps> = ({ data, groupLabel }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'sortIndex', direction: 'asc' });

    // Handle Sorting
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'desc';
        if (sortConfig.key === key) {
            if (sortConfig.direction === 'desc') direction = 'asc';
            else if (sortConfig.direction === 'asc') direction = null;
        }
        // If sorting is cleared, revert to original index sort
        if (!direction) {
            setSortConfig({ key: 'sortIndex', direction: 'asc' });
        } else {
            setSortConfig({ key, direction });
        }
    };

    const sortedData = useMemo(() => {
        const sorted = [...data];
        if (sortConfig.key && sortConfig.direction) {
            sorted.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                
                // Handle text sort for labels
                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sorted;
    }, [data, sortConfig]);

    const HeaderCell = ({ label, sortKey }: { label: string, sortKey: string }) => {
        const isSorted = sortConfig.key === sortKey;
        return (
            <th 
                className="px-4 py-4 font-bold text-slate-300 text-sm whitespace-nowrap cursor-pointer hover:text-white transition-colors group select-none"
                onClick={() => handleSort(sortKey)}
            >
                <div className="flex items-center justify-end gap-1">
                    {label}
                    <div className={`p-0.5 rounded transition-opacity ${isSorted ? 'text-primary opacity-100' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`}>
                        {isSorted && sortConfig.direction === 'asc' && <ArrowUp size={14} />}
                        {isSorted && sortConfig.direction === 'desc' && <ArrowDown size={14} />}
                        {!isSorted && <ArrowUpDown size={14} />}
                    </div>
                </div>
            </th>
        );
    };

    // Capitalize only first letter for the dynamic label
    const formattedGroupLabel = groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1).toLowerCase();

    const WhiteDash = () => <span className="text-white">-</span>;

    return (
        <div className="bg-surface rounded-xl border border-slate-700/50 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-700/50">
                <h3 className="font-bold text-white text-base">Summary</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-base">
                    <thead className="bg-slate-800/30 border-b border-slate-700/50">
                        <tr>
                            {/* Removed 'uppercase' class to respect JS capitalization */}
                            <th 
                                className="px-4 py-4 text-left font-bold text-slate-300 text-sm whitespace-nowrap cursor-pointer hover:text-white group select-none"
                                onClick={() => handleSort('label')}
                            >
                                <div className="flex items-center gap-1">
                                    {formattedGroupLabel}
                                    <div className={`p-0.5 rounded transition-opacity ${sortConfig.key === 'label' ? 'text-primary opacity-100' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`}>
                                        {sortConfig.key === 'label' && sortConfig.direction === 'asc' && <ArrowUp size={14} />}
                                        {sortConfig.key === 'label' && sortConfig.direction === 'desc' && <ArrowDown size={14} />}
                                        {sortConfig.key !== 'label' && <ArrowUpDown size={14} />}
                                    </div>
                                </div>
                            </th>
                            <HeaderCell label="勝率 %" sortKey="winRate" />
                            <HeaderCell label="淨損益" sortKey="netPnL" />
                            <HeaderCell label="交易次數" sortKey="count" />
                            <HeaderCell label="平均獲利" sortKey="avgWin" />
                            <HeaderCell label="平均虧損" sortKey="avgLoss" />
                            <HeaderCell label="總實現RR" sortKey="totalRR" />
                            <HeaderCell label="平均實現RR" sortKey="avgRR" />
                            <HeaderCell label="平均盈虧RR" sortKey="avgWinLossRR" />
                            <HeaderCell label="最大回撤" sortKey="maxDrawdown" />
                            <HeaderCell label="平均回撤" sortKey="avgDrawdown" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 text-base">
                        {sortedData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/20 transition-colors group">
                                <td className="px-4 py-4 text-left font-bold text-white whitespace-nowrap">{row.label}</td>
                                <td className="px-4 py-4 font-bold text-white">
                                    {row.count > 0 ? `${row.winRate.toFixed(2)}%` : <WhiteDash />}
                                </td>
                                <td className={`px-4 py-4 font-bold ${row.netPnL > 0 ? 'text-emerald-400' : row.netPnL < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {row.count > 0 ? formatCurrency(row.netPnL) : <WhiteDash />}
                                </td>
                                <td className="px-4 py-4 text-white font-medium">{row.count}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? formatCurrency(row.avgWin) : <WhiteDash />}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? formatCurrency(row.avgLoss) : <WhiteDash />}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? row.totalRR.toFixed(2) : <WhiteDash />}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? row.avgRR.toFixed(2) : <WhiteDash />}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? row.avgWinLossRR.toFixed(2) : <WhiteDash />}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? formatCurrency(row.maxDrawdown) : <WhiteDash />}</td>
                                <td className="px-4 py-4 text-white font-medium">{row.count > 0 ? formatCurrency(row.avgDrawdown) : <WhiteDash />}</td>
                            </tr>
                        ))}
                        {sortedData.length === 0 && (
                            <tr>
                                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">No data available</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
