
import React, { useState, useMemo } from 'react';
import { useTrades } from '../../../contexts/TradeContext';
import { calculatePnL, calculateWinRate, calculateProfitFactor, calculateAvgWinLoss, calculateRMultiple, calculateAvgActualRiskPct } from '../../../utils/calculations';
import { getDay, getMonth, getHours } from 'date-fns';
import { TopWidget } from './modal/TopWidget';
import { Chart1 } from './modal/Chart1';
import { Chart2 } from './modal/Chart2';
import { Summary } from './modal/Summary';
import { Cross } from './modal/Cross';
import { Clock, Calendar } from 'lucide-react';

type GroupType = 'day' | 'month' | 'time' | 'duration';
type CrossType = 'strategy' | 'tag' | 'status' | 'side';

// Specific Sort Order for Days (Mon-Fri)
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAYS_ALL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Updated Duration Buckets
const DURATIONS = [
    '< 1m', 
    '1m - 2m', 
    '2m - 5m', 
    '5m - 10m', 
    '10m - 30m', 
    '30m - 1h', 
    '1h - 2h', 
    '2h - 4h', 
    '> 4h'
];

export const DayReport: React.FC = () => {
    const { filteredTrades, userSettings, strategies, tags } = useTrades();
    const [groupType, setGroupType] = useState<GroupType>('day');
    const [crossType, setCrossType] = useState<CrossType>('strategy');
    const [crossMetric, setCrossMetric] = useState<'pnl' | 'winrate' | 'count'>('pnl');

    const closedTrades = useMemo(() => filteredTrades.filter(t => t.exitPrice !== undefined), [filteredTrades]);

    // --- 1. Main Aggregation Logic (With Data Padding) ---
    const aggregatedData = useMemo(() => {
        // Define all keys based on group type to ensure complete list (Padding)
        let allKeys: string[] = [];
        
        if (groupType === 'day') {
            allKeys = DAYS; // Only Mon-Fri per requirement
        } else if (groupType === 'month') {
            allKeys = MONTHS;
        } else if (groupType === 'time') {
            // 00:00 to 23:00, but merge 04-08
            allKeys = [];
            for (let i = 0; i < 24; i++) {
                if (i >= 4 && i < 8) {
                    if (!allKeys.includes('04:00 - 08:00')) allKeys.push('04:00 - 08:00');
                } else {
                    allKeys.push(`${i.toString().padStart(2, '0')}:00`);
                }
            }
        } else if (groupType === 'duration') {
            allKeys = DURATIONS;
        }

        // Map trades to groups
        const tradeMap = new Map<string, typeof closedTrades>();
        
        closedTrades.forEach(t => {
            // RAW DB Time Logic: Strip 'Z' to force local parsing of the string literal
            const rawIso = t.entryDate.endsWith('Z') ? t.entryDate.slice(0, -1) : t.entryDate;
            const d = new Date(rawIso); 
            
            let key = '';

            if (groupType === 'day') {
                const dayIdx = getDay(d); // 0=Sun, 1=Mon...
                key = DAYS_ALL[dayIdx];
                if (!DAYS.includes(key)) key = ''; 
            } else if (groupType === 'month') {
                key = MONTHS[getMonth(d)];
            } else if (groupType === 'time') {
                const h = getHours(d);
                if (h >= 4 && h < 8) {
                    key = '04:00 - 08:00';
                } else {
                    key = `${h.toString().padStart(2, '0')}:00`;
                }
            } else if (groupType === 'duration') {
                if (t.exitDate) {
                    const rawExitIso = t.exitDate.endsWith('Z') ? t.exitDate.slice(0, -1) : t.exitDate;
                    const dExit = new Date(rawExitIso);
                    
                    const diffMs = dExit.getTime() - d.getTime();
                    const diffMins = diffMs / 60000;
                    
                    if (diffMins < 1) key = '< 1m';
                    else if (diffMins <= 2) key = '1m - 2m';
                    else if (diffMins <= 5) key = '2m - 5m';
                    else if (diffMins <= 10) key = '5m - 10m';
                    else if (diffMins <= 30) key = '10m - 30m';
                    else if (diffMins <= 60) key = '30m - 1h';
                    else if (diffMins <= 120) key = '1h - 2h';
                    else if (diffMins <= 240) key = '2h - 4h';
                    else key = '> 4h';
                } else {
                    key = 'Unknown';
                }
            }

            if (key) {
                if (!tradeMap.has(key)) tradeMap.set(key, []);
                tradeMap.get(key)!.push(t);
            }
        });

        // Generate final array ensuring all keys exist
        const result = allKeys.map((label, index) => {
            const groupTrades = tradeMap.get(label) || [];
            
            const netPnL = groupTrades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
            const winRate = calculateWinRate(groupTrades);
            const count = groupTrades.length;
            const pf = calculateProfitFactor(groupTrades, userSettings.commissionPerUnit);
            const { avgWin, avgLoss } = calculateAvgWinLoss(groupTrades, userSettings.commissionPerUnit);
            
            // Calculate RR Stats
            const totalRR = groupTrades.reduce((acc, t) => acc + (calculateRMultiple(t, userSettings.commissionPerUnit) || 0), 0);
            const avgRR = count > 0 ? totalRR / count : 0;

            // Calculate Avg Actual Risk %
            const avgActualRiskPct = calculateAvgActualRiskPct(groupTrades, userSettings.commissionPerUnit);

            // Calculate Max Drawdown & Avg Drawdown for this group
            let maxDrawdown = 0;
            let totalDrawdownAmount = 0;
            let drawdownCount = 0;

            if (count > 0) {
                // Sort trades chronologically
                const sortedTrades = [...groupTrades].sort((a, b) => new Date(a.exitDate || a.entryDate).getTime() - new Date(b.exitDate || b.entryDate).getTime());
                
                let peak = 0;
                let currentEquity = 0;
                
                // For Avg Drawdown (Sequence of losses)
                let currentSequenceLoss = 0;
                let inDrawdownSequence = false;

                sortedTrades.forEach(t => {
                    const pnl = calculatePnL(t, userSettings.commissionPerUnit);
                    
                    // Max Drawdown Logic
                    currentEquity += pnl;
                    if (currentEquity > peak) peak = currentEquity;
                    const dd = currentEquity - peak;
                    if (dd < maxDrawdown) maxDrawdown = dd;

                    // Avg Drawdown Logic: Sum of consecutive losses
                    if (pnl < 0) {
                        currentSequenceLoss += pnl;
                        inDrawdownSequence = true;
                    } else {
                        // Profit trade ends the sequence
                        if (inDrawdownSequence) {
                            totalDrawdownAmount += currentSequenceLoss;
                            drawdownCount++;
                            currentSequenceLoss = 0;
                            inDrawdownSequence = false;
                        }
                    }
                });

                // If ended in a drawdown sequence, count it
                if (inDrawdownSequence) {
                    totalDrawdownAmount += currentSequenceLoss;
                    drawdownCount++;
                }
            }

            const avgDrawdown = drawdownCount > 0 ? totalDrawdownAmount / drawdownCount : 0;

            // Avg Win/Loss RR
            const avgWinLossRR = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

            return {
                label,
                sortIndex: index,
                netPnL,
                winRate,
                count,
                profitFactor: pf,
                avgWin,
                avgLoss,
                totalRR,
                avgRR,
                maxDrawdown, 
                avgDrawdown,
                avgWinLossRR,
                avgActualRiskPct
            };
        });

        return result;
    }, [closedTrades, groupType, userSettings.commissionPerUnit]);

    // --- 2. Cross Analysis Data ---
    const crossData = useMemo(() => {
        const rows = aggregatedData.map(d => d.label);
        
        let cols: string[] = [];
        if (crossType === 'strategy') cols = strategies.map(s => s.name);
        else if (crossType === 'tag') cols = tags.map(t => t.name);
        else if (crossType === 'status') cols = ['Win', 'Loss', 'Break Even'];
        else if (crossType === 'side') cols = ['Long', 'Short'];

        const matrix = rows.map(rowLabel => {
            const rowTrades = closedTrades.filter(t => {
                const rawIso = t.entryDate.endsWith('Z') ? t.entryDate.slice(0, -1) : t.entryDate;
                const d = new Date(rawIso);
                let key = '';
                
                if (groupType === 'day') {
                    key = DAYS_ALL[getDay(d)];
                } else if (groupType === 'month') {
                    key = MONTHS[getMonth(d)];
                } else if (groupType === 'time') {
                    const h = getHours(d);
                    key = (h >= 4 && h < 8) ? '04:00 - 08:00' : `${h.toString().padStart(2, '0')}:00`;
                } else if (groupType === 'duration' && t.exitDate) {
                    const rawExitIso = t.exitDate.endsWith('Z') ? t.exitDate.slice(0, -1) : t.exitDate;
                    const dExit = new Date(rawExitIso);
                    const diffMs = dExit.getTime() - d.getTime();
                    const diffMins = diffMs / 60000;
                    if (diffMins < 1) key = '< 1m';
                    else if (diffMins <= 2) key = '1m - 2m';
                    else if (diffMins <= 5) key = '2m - 5m';
                    else if (diffMins <= 10) key = '5m - 10m';
                    else if (diffMins <= 30) key = '10m - 30m';
                    else if (diffMins <= 60) key = '30m - 1h';
                    else if (diffMins <= 120) key = '1h - 2h';
                    else if (diffMins <= 240) key = '2h - 4h';
                    else key = '> 4h';
                }
                
                return key === rowLabel;
            });

            const rowObj: any = { rowKey: rowLabel };

            cols.forEach(colLabel => {
                const cellTrades = rowTrades.filter(t => {
                    if (crossType === 'strategy') return strategies.find(s => s.id === t.playbookId)?.name === colLabel;
                    if (crossType === 'tag') return t.tags?.some(tid => tags.find(tag => tag.id === tid)?.name === colLabel);
                    if (crossType === 'side') return t.direction === colLabel;
                    if (crossType === 'status') return t.status.includes(colLabel); 
                    return false;
                });

                if (cellTrades.length > 0) {
                    rowObj[colLabel] = {
                        pnl: cellTrades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0),
                        winRate: calculateWinRate(cellTrades),
                        count: cellTrades.length
                    };
                } else {
                    rowObj[colLabel] = null;
                }
            });
            return rowObj;
        });

        return { matrix, cols };
    }, [aggregatedData, closedTrades, crossType, groupType, strategies, tags, userSettings.commissionPerUnit]);

    // UI Helpers
    const groupOptions = [
        { id: 'day', label: 'Days', icon: Calendar },
        { id: 'month', label: 'Months', icon: Calendar },
        { id: 'time', label: 'Trade time', icon: Clock },
        { id: 'duration', label: 'Trade duration', icon: Clock },
    ];

    return (
        <div className="flex flex-col gap-4 pb-10">
            {/* Controls */}
            <div className="flex gap-2 bg-surface w-fit p-1 rounded-lg border border-slate-700">
                {groupOptions.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setGroupType(opt.id as GroupType)}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${groupType === opt.id ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Top Widgets */}
            <TopWidget data={aggregatedData} groupingType={groupType} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Chart1 data={aggregatedData} />
                <Chart2 data={aggregatedData} />
            </div>

            {/* Summary Table */}
            <Summary data={aggregatedData} groupLabel={groupOptions.find(g => g.id === groupType)?.label || 'Group'} />

            {/* Cross Analysis Section */}
            <Cross 
                data={crossData.matrix} 
                rowLabels={aggregatedData.map(d => d.label)} 
                colLabels={crossData.cols}
                metric={crossMetric}
                onMetricChange={setCrossMetric}
                primaryLabel={groupOptions.find(g => g.id === groupType)?.label || 'Group'}
                crossType={crossType}
                onCrossTypeChange={setCrossType}
            />
        </div>
    );
};
