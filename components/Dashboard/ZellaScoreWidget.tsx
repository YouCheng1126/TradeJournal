
import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip as RechartsTooltip } from 'recharts';

interface ZellaScoreWidgetProps {
    score: number;
    details: any[];
}

export const ZellaScoreWidget: React.FC<ZellaScoreWidgetProps> = ({ score, details }) => {
    
    // Augment data for background rings
    const chartData = useMemo(() => {
        return details.map(item => ({
            ...item,
            full: 100,
            val80: 80,
            val60: 60,
            val40: 40,
            val20: 20
        }));
    }, [details]);

    // Custom Tooltip to ignore background radars
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            // Find the payload specifically for the main 'Score' radar
            const data = payload.find((p: any) => p.name === 'Score');
            if (!data) return null;

            return (
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs">
                    <p className="text-slate-400 mb-1 font-mono">{data.payload.subject}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]"></div>
                        <span className="text-slate-300">Score:</span>
                        <span className="font-bold text-white ml-auto">{data.value}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="lg:col-span-1 bg-surface rounded-xl border border-slate-700/50 p-6 flex flex-col h-[600px]">
             <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">Zella score</h3>
             </div>
             
             {/* Radar Chart */}
             <div className="flex-1 w-full min-h-[300px] relative -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                        
                        {/* Background Rings: 
                            Layering static radars to create bands. 
                            Bg color of card is #334155 (Mask), Ring color is #475569.
                            activeDot={false} ensures no hover dots appear on these rings.
                        */}
                        
                        {/* 60-80% Ring */}
                        <Radar name="bg80" dataKey="val80" stroke="none" fill="#475569" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} />
                        <Radar name="bg60" dataKey="val60" stroke="none" fill="#334155" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} />
                        
                        {/* 20-40% Ring */}
                        <Radar name="bg40" dataKey="val40" stroke="none" fill="#475569" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} />
                        <Radar name="bg20" dataKey="val20" stroke="none" fill="#334155" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} />

                        {/* Grid on top of rings - Updated color to lighter slate for better contrast */}
                        <PolarGrid stroke="#cbd5e1" strokeOpacity={0.5} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#e2e8f0', fontSize: 11, dy: 4, fontWeight: 500 }} />
                        <PolarRadiusAxis 
                            angle={30} 
                            domain={[0, 100]} 
                            tick={false} 
                            axisLine={false} 
                            ticks={[0, 20, 40, 60, 80, 100] as any} 
                        />
                        
                        {/* Main Data Radar */}
                        <Radar 
                            name="Score" 
                            dataKey="A" 
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            strokeOpacity={0.8} 
                            fill="#8b5cf6" 
                            fillOpacity={0.4} 
                            // Dot style: Black border, 100% opacity fill
                            dot={{ r: 4, fill: "#8b5cf6", fillOpacity: 1, strokeWidth: 2, stroke: "#000000" }}
                            activeDot={{ r: 6, fill: "#8b5cf6", fillOpacity: 1, strokeWidth: 2, stroke: "#000000" }}
                        />
                        {/* Cursor enabled to show line from 0 to 100% */}
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
                    </RadarChart>
                </ResponsiveContainer>
             </div>

             {/* Total Score Bar */}
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
