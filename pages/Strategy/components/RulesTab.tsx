
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Strategy, Trade, StrategyRuleGroup } from '../../../types';
import { 
    calculatePnL, calculateWinRate, calculateProfitFactor, formatCurrency,
    calculateRMultiple, calculateMaxDrawdown, calculateAvgActualRiskPct 
} from '../../../utils/calculations';

interface RulesTabProps {
    strategy: Strategy;
    trades: Trade[];
    commissionPerUnit: number;
    onUpdateStrategy: (strategy: Strategy) => Promise<void>;
}

type DragType = 'GROUP' | 'ITEM';

export const RulesTab: React.FC<RulesTabProps> = ({ strategy, trades, commissionPerUnit, onUpdateStrategy }) => {
    // Local state for immediate UI updates before saving
    const [localRules, setLocalRules] = useState<StrategyRuleGroup[]>([]);
    const [draggedData, setDraggedData] = useState<{ type: DragType, groupId?: string, index: number } | null>(null);
    
    // State to disable drag when hovering inputs (fixes text selection)
    const [disableDrag, setDisableDrag] = useState(false);

    // Delete Confirmation State
    const [itemToDelete, setItemToDelete] = useState<{ type: 'group' | 'rule', groupId: string, ruleId?: string } | null>(null);

    useEffect(() => {
        // Normalize rules into object structure if coming from legacy
        if (strategy.rules) {
            const normalized = strategy.rules.map((g: any) => {
                if (typeof g === 'string') {
                    return { 
                        id: crypto.randomUUID(), 
                        name: "General", 
                        items: [{ id: crypto.randomUUID(), text: g }] 
                    };
                }
                return g;
            });
            setLocalRules(normalized);
        } else {
            setLocalRules([]);
        }
    }, [strategy.rules]);

    // --- Save Logic ---
    const saveChanges = (newRules: StrategyRuleGroup[]) => {
        setLocalRules(newRules);
        onUpdateStrategy({ ...strategy, rules: newRules });
    };

    // --- CRUD Operations ---
    const handleAddGroup = () => {
        const newGroup: StrategyRuleGroup = {
            id: crypto.randomUUID(),
            name: "New Group",
            items: []
        };
        const newRules = [...localRules, newGroup];
        saveChanges(newRules);
    };

    const handleAddRule = (groupId: string) => {
        const newRules = localRules.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: [...g.items, { id: crypto.randomUUID(), text: "New rule" }]
                };
            }
            return g;
        });
        saveChanges(newRules);
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;

        let newRules = [...localRules];
        if (itemToDelete.type === 'group') {
            newRules = newRules.filter(g => g.id !== itemToDelete.groupId);
        } else if (itemToDelete.type === 'rule') {
            newRules = newRules.map(g => {
                if (g.id === itemToDelete.groupId) {
                    return { ...g, items: g.items.filter(i => i.id !== itemToDelete.ruleId) };
                }
                return g;
            });
        }
        
        saveChanges(newRules);
        setItemToDelete(null);
    };

    const handleGroupNameChange = (groupId: string, newName: string) => {
        setLocalRules(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
    };

    const handleRuleTextChange = (groupId: string, itemId: string, newText: string) => {
        setLocalRules(prev => prev.map(g => {
            if (g.id === groupId) {
                return { 
                    ...g, 
                    items: g.items.map(i => i.id === itemId ? { ...i, text: newText } : i) 
                };
            }
            return g;
        }));
    };

    const handleBlur = () => {
        onUpdateStrategy({ ...strategy, rules: localRules });
    };

    // --- Drag and Drop Handlers ---
    const handleGroupDragStart = (e: React.DragEvent, index: number) => {
        if (disableDrag) {
            e.preventDefault();
            return;
        }
        
        setDraggedData({ type: 'GROUP', index });
        e.dataTransfer.effectAllowed = "move";
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '0.5';
    };

    const handleGroupDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '1';
        setDraggedData(null);
    };

    const handleGroupDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedData?.type !== 'GROUP' || draggedData.index === targetIndex) return;

        const newRules = [...localRules];
        const [moved] = newRules.splice(draggedData.index, 1);
        newRules.splice(targetIndex, 0, moved);
        saveChanges(newRules);
    };

    const handleItemDragStart = (e: React.DragEvent, groupId: string, index: number) => {
        e.stopPropagation(); 
        
        if (disableDrag) {
            e.preventDefault();
            return;
        }

        setDraggedData({ type: 'ITEM', groupId, index });
        e.dataTransfer.effectAllowed = "move";
    };

    const handleItemDrop = (e: React.DragEvent, targetGroupId: string, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (draggedData?.type !== 'ITEM') return;
        if (draggedData.groupId !== targetGroupId) return; 
        if (draggedData.index === targetIndex) return;

        const newRules = [...localRules];
        const groupIdx = newRules.findIndex(g => g.id === targetGroupId);
        if (groupIdx === -1) return;

        const group = newRules[groupIdx];
        const newItems = [...group.items];
        const [moved] = newItems.splice(draggedData.index, 1);
        newItems.splice(targetIndex, 0, moved);

        newRules[groupIdx] = { ...group, items: newItems };
        saveChanges(newRules);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Total trades for calc
    const totalStrategyTrades = trades.length;

    // Grid Template Definition: 
    // 1. Reduced Avg Risk (Col 8) to 0.85fr
    // 2. Reduced Expectancy (Col 6) from 0.9fr to 0.65fr to pull Total RR closer
    const gridColsClass = "grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.65fr_0.7fr_0.85fr_0.7fr_0.2fr]";

    return (
        <div className="w-full pb-10">
            {/* Header Row - Increased padding (py-3) & Removed items-center for top alignment (items-start) */}
            <div className={`${gridColsClass} px-4 py-1.5 border-b border-slate-700 text-sm font-bold text-white tracking-wider items-start`}>
                <div className="pl-0"> 
                    <button 
                        onClick={handleAddGroup}
                        className="flex items-center gap-1.5 px-2 h-5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded text-[10px] font-bold transition-all"
                    >
                        <Plus size={10} /> New Group
                    </button>
                </div>
                <div className="text-left">Follow rate</div>
                <div className="text-left">Net P&L</div>
                <div className="text-left">Profit factor</div>
                <div className="text-left">Win rate</div>
                <div className="text-left">Expectancy</div>
                <div className="text-left">Total RR</div>
                <div className="text-left">Avg actual risk %</div>
                <div className="text-left">Max drawdown</div>
                <div className="text-right pr-2"></div> {/* Actions */}
            </div>

            {/* Content - Reduced spacing */}
            <div className="flex flex-col gap-1 mt-1">
                {localRules.map((group, groupIndex) => (
                    <div 
                        key={group.id} 
                        className={`group/container ${!disableDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        draggable={!disableDrag}
                        onDragStart={(e) => handleGroupDragStart(e, groupIndex)}
                        onDragEnd={handleGroupDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleGroupDrop(e, groupIndex)}
                    >
                        {/* Group Title Row */}
                        <div className="flex items-center gap-2 mb-1 px-2 hover:bg-slate-800/50 rounded py-1 transition-colors group/header">
                            <input 
                                className="bg-transparent text-lg font-bold text-white focus:outline-none focus:border-b focus:border-primary w-full py-1 placeholder-slate-500 cursor-text"
                                value={group.name}
                                onChange={(e) => handleGroupNameChange(group.id, e.target.value)}
                                onBlur={handleBlur}
                                onMouseEnter={() => setDisableDrag(true)}
                                onMouseLeave={() => setDisableDrag(false)}
                                placeholder="Group Name"
                            />
                            {/* Group Delete Button */}
                            <button 
                                onClick={() => setItemToDelete({ type: 'group', groupId: group.id })}
                                className="opacity-0 group-hover/header:opacity-100 p-2 text-slate-400 hover:text-white hover:bg-red-500/30 rounded transition-all"
                                title="Delete Group"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Rules List */}
                        <div className="flex flex-col">
                            {group.items.map((item, itemIndex) => {
                                // Stats Calculation
                                const compliantTrades = trades.filter(t => t.rulesFollowed?.includes(item.id));
                                const count = compliantTrades.length;
                                const followRate = totalStrategyTrades > 0 ? (count / totalStrategyTrades) * 100 : 0;
                                const netPnL = compliantTrades.reduce((acc, t) => acc + calculatePnL(t, commissionPerUnit), 0);
                                const winRate = calculateWinRate(compliantTrades);
                                const profitFactor = calculateProfitFactor(compliantTrades, commissionPerUnit);
                                
                                // New Metrics
                                const expectancy = count > 0 ? netPnL / count : 0;
                                const maxDD = calculateMaxDrawdown(compliantTrades, commissionPerUnit);
                                const totalRR = compliantTrades.reduce((acc, t) => acc + (calculateRMultiple(t, commissionPerUnit) || 0), 0);
                                const avgRiskPct = calculateAvgActualRiskPct(compliantTrades, commissionPerUnit);

                                let followColor = "text-emerald-400";
                                if (followRate < 30) followColor = "text-red-400";
                                else if (followRate < 70) followColor = "text-amber-400";

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`${gridColsClass} px-4 py-2 hover:bg-slate-800/30 border-b border-slate-800/50 transition-colors items-center group/row text-base ${!disableDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                        draggable={!disableDrag}
                                        onDragStart={(e) => handleItemDragStart(e, group.id, itemIndex)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleItemDrop(e, group.id, itemIndex)}
                                    >
                                        {/* Text Input */}
                                        <div className="flex items-center gap-3 pr-4">
                                            <input 
                                                className="bg-transparent text-base text-white font-medium focus:outline-none focus:bg-slate-800/50 rounded px-2 py-1 w-full placeholder-slate-600 cursor-text"
                                                value={item.text}
                                                onChange={(e) => handleRuleTextChange(group.id, item.id, e.target.value)}
                                                onBlur={handleBlur}
                                                onMouseEnter={() => setDisableDrag(true)}
                                                onMouseLeave={() => setDisableDrag(false)}
                                                placeholder="Rule description..."
                                            />
                                        </div>

                                        {/* Stats Columns */}
                                        <div className={`font-bold ${followColor}`}>
                                            {followRate.toFixed(1)}%
                                        </div>
                                        <div className={`font-bold ${netPnL > 0 ? 'text-emerald-400' : netPnL < 0 ? 'text-red-400' : 'text-white'}`}>
                                            {formatCurrency(netPnL)}
                                        </div>
                                        <div className="font-bold text-white">
                                            {count > 0 ? (profitFactor === 100 && netPnL > 0 ? '∞' : profitFactor.toFixed(2)) : 'N/A'}
                                        </div>
                                        <div className="font-bold text-white">
                                            {count > 0 ? `${winRate.toFixed(2)}%` : 'N/A'}
                                        </div>
                                        <div className="font-bold text-white">
                                            {formatCurrency(expectancy)}
                                        </div>
                                        <div className={`font-bold ${totalRR > 0 ? 'text-emerald-400' : totalRR < 0 ? 'text-red-400' : 'text-white'}`}>
                                            {totalRR.toFixed(2)}
                                        </div>
                                        <div className="font-bold text-white">
                                            {avgRiskPct.toFixed(1)}%
                                        </div>
                                        <div className="font-bold text-red-400">
                                            {formatCurrency(maxDD)}
                                        </div>
                                        
                                        {/* Actions: Delete Rule */}
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={() => setItemToDelete({ type: 'rule', groupId: group.id, ruleId: item.id })}
                                                className="opacity-0 group-hover/row:opacity-100 text-slate-400 hover:text-white hover:bg-red-500/30 p-1 rounded transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Add Rule Button inside group - Reduced py */}
                            <div className="px-4 py-1">
                                <button 
                                    onClick={() => handleAddRule(group.id)}
                                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary transition-colors py-1 px-2 rounded hover:bg-slate-800/30 w-fit"
                                >
                                    <Plus size={12} /> Add rule
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {localRules.length === 0 && (
                    <div className="text-center py-10 text-slate-500 italic">
                        No rules defined. Click "New Group" to start.
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {itemToDelete && createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-surface border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 ring-4 ring-red-500/5">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Delete {itemToDelete.type === 'group' ? 'Group' : 'Rule'}?</h3>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            Are you sure you want to delete this {itemToDelete.type}?
                            <br/>This action cannot be undone.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button 
                                onClick={() => setItemToDelete(null)} 
                                className="px-6 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-500 rounded-lg hover:bg-slate-600 transition-all flex-1"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete} 
                                className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-500/20 transition-all flex-1"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
