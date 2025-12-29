
import React from 'react';
import { useTrades } from '../../../contexts/TradeContext';
import { CumulativePnlChart } from './components/CumulativePnlChart';
import { DailyWinLossChart } from './components/DailyWinLossChart';
import { SummaryStats } from './components/SummaryStats';

export const Performance: React.FC = () => {
    const { filteredTrades, userSettings } = useTrades();
    const closedTrades = filteredTrades.filter(t => t.exitPrice !== undefined);

    if (closedTrades.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                No closed trades available for the selected period.
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Top Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                <div className="bg-surface rounded-xl border border-slate-700/50 p-6 shadow-sm flex flex-col">
                    <CumulativePnlChart trades={closedTrades} commission={userSettings.commissionPerUnit} />
                </div>
                <div className="bg-surface rounded-xl border border-slate-700/50 p-6 shadow-sm flex flex-col">
                    <DailyWinLossChart trades={closedTrades} commission={userSettings.commissionPerUnit} />
                </div>
            </div>

            {/* Bottom Summary Section */}
            <div className="bg-surface rounded-xl border border-slate-700/50 p-6 shadow-sm">
                <SummaryStats trades={closedTrades} commission={userSettings.commissionPerUnit} />
            </div>
        </div>
    );
};
