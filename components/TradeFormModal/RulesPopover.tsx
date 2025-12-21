
import React, { useMemo, useLayoutEffect, useRef, useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { useTrades } from '../../contexts/TradeContext';

interface RulesPopoverProps {
    strategyId: string;
    rulesFollowed: string[];
    onToggleRule: (ruleId: string) => void;
    anchorRef: React.RefObject<HTMLButtonElement>;
    onClose: () => void;
}

export const RulesPopover: React.FC<RulesPopoverProps> = ({ strategyId, rulesFollowed, onToggleRule, anchorRef, onClose }) => {
    const { strategies } = useTrades();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', opacity: 0, pointerEvents: 'none' });

    const selectedStrategy = useMemo(() => strategies.find(s => s.id === strategyId), [strategies, strategyId]);

    const { checked, total } = useMemo(() => {
        if (!selectedStrategy || !selectedStrategy.rules) return { checked: 0, total: 0 };
        let t = 0, c = 0;
        selectedStrategy.rules.forEach(g => {
            if (typeof g !== 'string') {
                t += g.items.length;
                g.items.forEach(i => { if (rulesFollowed.includes(i.id)) c++; });
            }
        });
        return { checked: c, total: t };
    }, [selectedStrategy, rulesFollowed]);

    useLayoutEffect(() => {
        if (anchorRef.current && popoverRef.current) {
            const btnRect = anchorRef.current.getBoundingClientRect();
            const contentHeight = popoverRef.current.offsetHeight;
            const viewportHeight = window.innerHeight;
            const POP_WIDTH = 320; 
            
            // Align Right of Popover to Right of Button (conceptually, usually logic aligns to input right)
            // Here, let's align right edge to button right edge for neatness
            let leftPos = btnRect.right - POP_WIDTH;
            if (leftPos < 10) leftPos = 10;

            // Vertical
            const spaceBelow = viewportHeight - btnRect.bottom;
            const spaceAbove = btnRect.top;
            
            let topPos = 0;
            let maxHeight = 'none';

            if (contentHeight < spaceAbove && spaceAbove > spaceBelow) {
                // Place above
                topPos = btnRect.top - contentHeight - 5;
            } else {
                // Place below
                topPos = btnRect.bottom + 5;
                if (contentHeight > spaceBelow) maxHeight = `${spaceBelow - 20}px`;
            }

            setStyle({
                position: 'fixed',
                left: `${leftPos}px`,
                top: `${topPos}px`,
                width: `${POP_WIDTH}px`,
                maxHeight,
                zIndex: 110,
                display: 'flex',
                flexDirection: 'column',
                opacity: 1,
                pointerEvents: 'auto',
            });
        }
    }, [anchorRef, selectedStrategy]);

    // Handle outside click
    useLayoutEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    if (!selectedStrategy) return null;

    return (
        <div ref={popoverRef} style={style} className="bg-[#1f2937] border border-slate-600 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded bg-[#8f3f3f]" style={{ backgroundColor: selectedStrategy.color }}></div>
                    <span className="font-bold text-white text-sm truncate">{selectedStrategy.name}</span>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1 font-semibold uppercase">
                        <span>Rules Followed</span>
                        <span>{checked} / {total}</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: total > 0 ? `${(checked / total) * 100}%` : '0%' }}></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-4">
                {selectedStrategy.rules && selectedStrategy.rules.length > 0 ? (
                    selectedStrategy.rules.map((group: any) => {
                        if (typeof group === 'string') return null;
                        return (
                            <div key={group.id} className="px-2">
                                <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">{group.name}</h4>
                                <div className="space-y-1">
                                    {group.items.map((item: any) => {
                                        const isChecked = rulesFollowed.includes(item.id);
                                        return (
                                            <button key={item.id} type="button" onClick={() => onToggleRule(item.id)} className="w-full text-left flex items-start gap-3 p-2 rounded hover:bg-slate-800 transition-colors group">
                                                <div className={`mt-0.5 transition-colors ${isChecked ? 'text-primary' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                                    {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </div>
                                                <span className={`text-sm leading-snug ${isChecked ? 'text-white' : 'text-slate-400'}`}>{item.text}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-6 text-slate-500 text-xs">No rules defined.</div>
                )}
            </div>
        </div>
    );
};
