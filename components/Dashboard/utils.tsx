
import React from 'react';

// Helper to generate specific ticks based on data range
// Adjusted to specific steps including decimals for small values
export const generateTicks = (min: number, max: number) => {
    if (min === max) return [min];
    
    // Always encompass 0 if possible, or at least have a logical baseline
    const range = max - min;
    const specificSteps = [0.1, 0.2, 0.25, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 2000, 3000, 5000, 10000];
    
    let step = 10000; // Default fallback for large ranges

    // 1. Try to find a specific step that results in <= 10 lines
    let found = false;
    for (const s of specificSteps) {
        if (range / s <= 10) {
            step = s;
            found = true;
            break;
        }
    }

    // 2. If range is huge (requires step > 10000), use multiples of 10000
    if (!found) {
        // Calculate raw step needed to have ~10 lines
        const rawStep = range / 10;
        // Round up to nearest 10000
        step = Math.ceil(rawStep / 10000) * 10000;
    }

    // Generate ticks
    // Handle floating point precision for decimal steps
    const precision = step < 1 ? 2 : 0;
    
    const minTick = Math.floor(min / step) * step;
    const maxTick = Math.ceil(max / step) * step;

    const ticks = [];
    // Use a small epsilon to handle floating point issues
    for (let i = minTick; i <= maxTick + (step * 0.001); i += step) {
        ticks.push(parseFloat(i.toFixed(precision)));
    }
    
    return ticks;
};

// Custom Components for Recharts
export const CustomCursor = (props: any) => {
    const { points, width, height, payload } = props;
    if (!payload || !payload[0]) return null; 
    // payload[0].payload.hasTrades check removed to be more generic for reports
    const { x } = points[0];
    return (
        <line x1={x} y1={0} x2={x} y2={height} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
    );
};

export const CustomActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    // Removed hasTrades check to be generic
    return <circle cx={cx} cy={cy} r={4} stroke="none" fill="#fff" />;
};
