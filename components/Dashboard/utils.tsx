
import React from 'react';

// Helper to generate specific ticks based on data range
export const generateTicks = (min: number, max: number) => {
    const steps = [10, 25, 50, 100, 200, 500, 1000, 2000, 2500, 5000, 10000];
    const range = Math.abs(max - min);
    
    if (range === 0) return [0];

    let step = steps[steps.length - 1]; 

    for (let s of steps) {
        const lineCount = range / s;
        if (lineCount <= 10) {
            step = s;
            break; 
        }
    }

    const minTick = Math.floor(min / step) * step;
    const maxTick = Math.ceil(max / step) * step;

    const ticks = [];
    for (let i = minTick; i <= maxTick; i += step) {
        ticks.push(i);
    }
    
    return ticks.map(t => Math.round(t));
};

// Custom Components for Recharts
export const CustomCursor = (props: any) => {
    const { points, width, height, payload } = props;
    if (!payload || !payload[0] || !payload[0].payload.hasTrades) return null;
    const { x } = points[0];
    return (
        <line x1={x} y1={0} x2={x} y2={height} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
    );
};

export const CustomActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.hasTrades) return null;
    return <circle cx={cx} cy={cy} r={4} stroke="none" fill="#fff" />;
};
