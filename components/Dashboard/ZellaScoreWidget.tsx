
import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip as RechartsTooltip } from 'recharts';

interface ZellaScoreWidgetProps {
    score: number;
    details: any[];
}

export const ZellaScoreWidget: React.FC<ZellaScoreWidgetProps> = ({ score, details }) => {
    return (
        <div className="lg:col-span-1 bg-surface rounded-xl border border-slate-700/50 p-6 flex flex-col h-[600px]">
             <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">Zella score</h3>
             </div>
             <div className="flex-1 w-full min-h-[400px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={details}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 13, dy: 4 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Score" dataKey="A" stroke="#8b5cf6" strokeWidth={3} fill="#8b5cf6" fillOpacity={0.5} />
                        <RechartsTooltip formatter={(value) => [value, 'Score']} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }} />
                    </RadarChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-auto pt-4 border-t border-slate-800">
                <div className="flex justify-between items-end mb-2">
                    <div><p className="text-sm text-slate-400">Your Zella Score</p><p className="text-5xl font-bold text-white tracking-tight">{score}</p></div>
                </div>
                <div className="w-full bg-slate-700 h-4 rounded-full overflow-hidden relative"><div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 transition-all duration-1000" style={{ width: `${score}%` }} /></div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
             </div>
        </div>
    );
};
