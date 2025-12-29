
import React, { useState } from 'react';
import { LayoutDashboard, Target, Calendar, Tag, GitCompare, Activity, ShieldAlert, BarChart3 } from 'lucide-react';
import { Performance } from './perfo';
import { Overview } from './overview';
import { DayReport } from './day';
import { RiskReport } from './risk';
import { StrategyReport } from './strategy';
import { TagReport } from './tag';
import { CompareReport } from './compare';
import { CalendarReport } from './calendar';

type ReportTab = 'perfo' | 'overview' | 'day' | 'risk' | 'strategy' | 'tag' | 'compare' | 'calendar';

export const Reports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('perfo');

    const tabs: { id: ReportTab; label: string; icon: any }[] = [
        { id: 'perfo', label: 'Performance', icon: Activity },
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'day', label: 'Day', icon: Calendar }, // Reusing Calendar icon for Day
        { id: 'risk', label: 'Risk', icon: ShieldAlert },
        { id: 'strategy', label: 'Strategy', icon: Target },
        { id: 'tag', label: 'Tag', icon: Tag },
        { id: 'compare', label: 'Compare', icon: GitCompare },
    ];

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Sub-Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-700 pb-1 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-primary/10 text-primary border border-primary/20' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.id === 'perfo' && <span className="ml-1 text-[10px] bg-primary text-white px-1 rounded">NEW</span>}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {activeTab === 'perfo' && <Performance />}
                {activeTab === 'overview' && <Overview />}
                {activeTab === 'day' && <DayReport />}
                {activeTab === 'risk' && <RiskReport />}
                {activeTab === 'strategy' && <StrategyReport />}
                {activeTab === 'tag' && <TagReport />}
                {activeTab === 'compare' && <CompareReport />}
                {activeTab === 'calendar' && <CalendarReport />}
            </div>
        </div>
    );
};
