
import React, { useState, useMemo } from 'react';
import { ChevronDown, CheckSquare, Square } from 'lucide-react';
import { Trade } from '../../types';
import { useTrades } from '../../contexts/TradeContext';

interface StrategyPanelProps {
    formData: Trade;
    onChange: (field: keyof Trade, value: any) => void;
    openDropdown: string | null;
    toggleDropdown: (id: string, e: React.MouseEvent) => void;
    setOpenDropdown: (id: string | null) => void;
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({ formData, onChange, openDropdown, toggleDropdown, setOpenDropdown }) => {
    const { strategies } = useTrades();
    const currentStrategy = strategies.find(s => s.id === formData.playbookId);
    
    // Strategy Rules Stats
    const ruleStats = useMemo(() => {
        if (!currentStrategy?.rules) return { checked: 0, total: 0 };
        let total = 0, checked = 0;
        currentStrategy.rules.forEach(g => {
            if (typeof g !== 'string') {
                total += g.items.length;
                g.items.forEach(i => { if ((formData.rulesFollowed || []).includes(i.id)) checked++; });
            }
        });
        return { checked, total };
    }, [currentStrategy, formData.rulesFollowed]);

    // Increased padding (py-3) for larger hit area/height
    const dropdownBtnClass = "w-full flex items-center justify-between bg-transparent border border-transparent hover:border-slate-500 hover:bg-slate-700/50 text-sm font-bold text-white transition-colors py-3 px-3 rounded cursor-pointer";

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400">Strategy</label>
                <div className="relative w-full">
                    <button 
                        onClick={(e) => toggleDropdown('strategy', e)}
                        className={dropdownBtnClass}
                    >
                        <span className="text-white">
                            {currentStrategy ? currentStrategy.name : '-- Select --'}
                        </span>
                        <ChevronDown size={14} className="text-slate-400"/>
                    </button>
                    {openDropdown === 'strategy' && (
                        <div 
                            className="absolute left-0 top-full mt-1 w-full bg-slate-700 border border-slate-500 rounded-lg shadow-xl z-20 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {strategies.map(s => (
                                <button 
                                    key={s.id}
                                    onClick={() => { onChange('playbookId', s.id); setOpenDropdown(null); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-slate-600 text-slate-200 hover:text-white"
                                >
                                    {s.name}
                                </button>
                            ))}
                            <button onClick={() => { onChange('playbookId', ''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-600 text-slate-400 hover:text-slate-200 border-t border-slate-500">None</button>
                        </div>
                    )}
                </div>
            </div>

            {formData.playbookId && (
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1 font-semibold uppercase">
                            <span>Rules Followed</span>
                            <span>{ruleStats.checked} / {ruleStats.total}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ width: ruleStats.total > 0 ? `${(ruleStats.checked / ruleStats.total) * 100}%` : '0%' }}
                            ></div>
                        </div>
                    </div>

                    <div className="space-y-4"> {/* Reduced from space-y-6 */}
                        {currentStrategy?.rules?.map((group: any) => {
                            if(typeof group === 'string') return null;
                            return (
                                <div key={group.id}>
                                    {/* Reduced font margin from mb-3 to mb-1 */}
                                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-1 pl-1">{group.name}</h4>
                                    <div className="space-y-1"> {/* Reduced from space-y-2 */}
                                        {group.items.map((item: any) => {
                                            const isChecked = (formData.rulesFollowed || []).includes(item.id);
                                            return (
                                                <button 
                                                    key={item.id} 
                                                    onClick={() => {
                                                        const current = formData.rulesFollowed || [];
                                                        const next = current.includes(item.id) ? current.filter(x => x !== item.id) : [...current, item.id];
                                                        onChange('rulesFollowed', next);
                                                    }}
                                                    // Reverted to items-start for better multi-line support
                                                    className="w-full text-left flex items-start gap-3 p-2 rounded hover:bg-slate-700/50 transition-colors group"
                                                >
                                                    {/* Adjusted margin to center with text-base line-height (24px). Icon is 20px. 2px margin centers it. */}
                                                    <div className={isChecked ? "text-primary mt-[2px]" : "text-slate-500 group-hover:text-slate-400 mt-[2px]"}>
                                                        {isChecked ? <CheckSquare size={20}/> : <Square size={20}/>}
                                                    </div>
                                                    {/* Added pt-[1px] to nudge text down slightly as requested */}
                                                    <span className={`text-base pt-[4px] leading-snug ${isChecked ? 'text-white' : 'text-slate-400'}`}>{item.text}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
