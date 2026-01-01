
import React from 'react';

// Specified Tick Steps
const SPECIFIC_STEPS = [
    0.1, 0.2, 0.5, 
    1, 2, 3, 5, 
    10, 15, 20, 25, 50, 
    100, 200, 250, 300, 500, 750, 
    1000, 1500, 2000, 2500, 3000, 5000, 7500, 
    10000, 20000
];

// Helper to find the smallest step from SPECIFIC_STEPS that results in <= maxTicks
const getBestStep = (min: number, max: number, maxTicks: number = 10) => {
    const range = max - min;
    if (range === 0) return 1; // Edge case

    let step = 10000;
    
    // 1. Try to find a specific step
    for (const s of SPECIFIC_STEPS) {
        // Estimate intervals needed. We need to cover from floor(min/s)*s to ceil(max/s)*s
        const minTick = Math.floor(min / s) * s;
        const maxTick = Math.ceil(max / s) * s;
        const count = Math.round((maxTick - minTick) / s) + 1;
        
        if (count <= maxTicks) {
            step = s;
            break;
        }
    }

    // 2. Large range fallback
    if (step === 10000) { // If we fell through or stuck at max
        const minTick = Math.floor(min / step) * step;
        const maxTick = Math.ceil(max / step) * step;
        const count = Math.round((maxTick - minTick) / step) + 1;
        
        if (count > maxTicks) {
             let currentStep = 30000;
             while (true) {
                const mt = Math.floor(min / currentStep) * currentStep;
                const xt = Math.ceil(max / currentStep) * currentStep;
                const c = Math.round((xt - mt) / currentStep) + 1;
                if (c <= maxTicks) {
                    step = currentStep;
                    break;
                }
                currentStep += 10000;
             }
        }
    }

    return step;
};

// Generate synchronized ticks for dual axes sharing a zero line
export const getSharedDualAxisTicks = (
    data: any[], 
    metric1: string, 
    metric2: string | null
) => {
    // 1. Calculate Min/Max for both
    let min1 = Math.min(...data.map(d => d[metric1] || 0), 0);
    let max1 = Math.max(...data.map(d => d[metric1] || 0), 0);
    
    // If only one metric, standard generation
    if (!metric2) {
        const step = getBestStep(min1, max1, 10);
        const minTick = Math.floor(min1 / step) * step;
        const maxTick = Math.ceil(max1 / step) * step;
        const ticks = [];
        const precision = step < 1 ? 2 : 0;
        for (let i = minTick; i <= maxTick + (step*0.001); i += step) {
            ticks.push(parseFloat(i.toFixed(precision)));
        }
        return { 
            leftTicks: ticks, leftDomain: [ticks[0], ticks[ticks.length-1]],
            rightTicks: [], rightDomain: [0,0]
        };
    }

    let min2 = Math.min(...data.map(d => d[metric2] || 0), 0);
    let max2 = Math.max(...data.map(d => d[metric2] || 0), 0);

    // 2. Determine "Least Lines" Target
    // Find optimal step for each independently to see how many lines they naturally "want"
    const naturalStep1 = getBestStep(min1, max1, 10);
    const naturalStep2 = getBestStep(min2, max2, 10);
    
    const count1 = Math.round((Math.ceil(max1/naturalStep1)*naturalStep1 - Math.floor(min1/naturalStep1)*naturalStep1)/naturalStep1) + 1;
    const count2 = Math.round((Math.ceil(max2/naturalStep2)*naturalStep2 - Math.floor(min2/naturalStep2)*naturalStep2)/naturalStep2) + 1;
    
    // We target the lower count (least lines) but capped at 10
    const targetMaxTicks = Math.min(Math.min(count1, count2), 10);

    // 3. Find synchronized steps
    // We need S1 and S2 such that:
    // N_up = max(ceil(max1/S1), ceil(max2/S2))
    // N_down = max(ceil(|min1|/S1), ceil(|min2|/S2))
    // Total = N_up + N_down + 1 <= 10 (and ideally closer to targetMaxTicks)
    
    let s1Index = SPECIFIC_STEPS.indexOf(naturalStep1);
    let s2Index = SPECIFIC_STEPS.indexOf(naturalStep2);
    if (s1Index === -1) s1Index = SPECIFIC_STEPS.length - 1; // Fallback for huge numbers
    if (s2Index === -1) s2Index = SPECIFIC_STEPS.length - 1;

    // Loop to find valid combined configuration
    // We increase steps until the total grid lines fit the constraint
    let finalS1 = 0;
    let finalS2 = 0;
    let globalUp = 0;
    let globalDown = 0;

    // Safety break
    let iterations = 0;
    while(iterations < 100) {
        const s1 = SPECIFIC_STEPS[s1Index] || (SPECIFIC_STEPS[SPECIFIC_STEPS.length-1] + (s1Index - SPECIFIC_STEPS.length + 1) * 10000);
        const s2 = SPECIFIC_STEPS[s2Index] || (SPECIFIC_STEPS[SPECIFIC_STEPS.length-1] + (s2Index - SPECIFIC_STEPS.length + 1) * 10000);

        const up1 = Math.ceil(max1 / s1);
        const down1 = Math.ceil(Math.abs(min1) / s1);
        const up2 = Math.ceil(max2 / s2);
        const down2 = Math.ceil(Math.abs(min2) / s2);

        const reqUp = Math.max(up1, up2);
        const reqDown = Math.max(down1, down2);
        const total = reqUp + reqDown + 1;

        // Check if fits constraint (10 lines max)
        // Also check if it respects the "least lines" preference (roughly)
        // If we are way above targetMaxTicks, we should try increasing steps
        if (total <= 10) {
            finalS1 = s1;
            finalS2 = s2;
            globalUp = reqUp;
            globalDown = reqDown;
            // If total is significantly larger than target (e.g. we want 4 but got 10), 
            // we might want to continue searching for a looser grid? 
            // But usually satisfying <= 10 is enough. 
            // To strictly follow "least lines", we can try to push indices higher if total > targetMaxTicks?
            // Let's stick to <= 10 as the hard constraint for stability.
            break;
        }

        // Logic to increment steps: increment the one that is causing the bottleneck
        // i.e., the one with more intervals
        const intervals1 = up1 + down1;
        const intervals2 = up2 + down2;
        
        if (intervals1 >= intervals2) s1Index++;
        else s2Index++;
        
        iterations++;
    }

    // 4. Generate Ticks
    const generate = (step: number, down: number, up: number) => {
        const arr = [];
        const precision = step < 1 ? 2 : 0;
        for (let i = -down; i <= up; i++) {
            const val = i * step;
            // Fix floating point math
            arr.push(parseFloat(val.toFixed(precision)));
        }
        return arr;
    };

    const leftTicks = generate(finalS1, globalDown, globalUp);
    const rightTicks = generate(finalS2, globalDown, globalUp);

    return {
        leftTicks,
        leftDomain: [leftTicks[0], leftTicks[leftTicks.length-1]],
        rightTicks,
        rightDomain: [rightTicks[0], rightTicks[rightTicks.length-1]]
    };
};

export const generateTicks = (min: number, max: number) => {
    const step = getBestStep(min, max, 10);
    const minTick = Math.floor(min / step) * step;
    const maxTick = Math.ceil(max / step) * step;
    const ticks = [];
    const precision = step < 1 ? 2 : 0;
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
    const { x } = points[0];
    return (
        <line x1={x} y1={0} x2={x} y2={height} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
    );
};

export const CustomActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    return <circle cx={cx} cy={cy} r={4} stroke="none" fill="#fff" />;
};
