
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, GripVertical, FilePlus2 } from 'lucide-react';
import { Strategy, StrategyRuleGroup } from '../../../types';
import { useTrades } from '../../../contexts/TradeContext';

interface StrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Strategy;
}

export const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, initialData }) => {
  const { addStrategy, updateStrategy } = useTrades();
  const [name, setName] = useState('');
  const [ruleGroups, setRuleGroups] = useState<StrategyRuleGroup[]>([]);
  
  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{ groupId: string, index: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setName(initialData.name);
            
            let loadedGroups: StrategyRuleGroup[] = [];
            
            // 1. Normalize existing data (Handle legacy string arrays vs new object structure)
            if (initialData.rules && initialData.rules.length > 0) {
                const firstRule = initialData.rules[0] as any;
                if (typeof firstRule === 'string') {
                    // Legacy: Map strings to "Entry criteria" to fit new structure
                    loadedGroups = [{ 
                        id: crypto.randomUUID(), 
                        name: "Entry criteria", 
                        items: (initialData.rules as any as string[]).map(t => ({ id: crypto.randomUUID(), text: t })) 
                    }];
                } else {
                    loadedGroups = initialData.rules;
                }
            }

            // 2. Enforce Default Structure [Entry, Exit, Market]
            const defaultNames = ["Entry criteria", "Exit criteria", "Market conditions"];
            const finalGroups: StrategyRuleGroup[] = [];

            // Add default groups (populating with existing data if available)
            defaultNames.forEach(defName => {
                const existing = loadedGroups.find(g => g.name === defName);
                if (existing) {
                    finalGroups.push(existing);
                } else {
                    finalGroups.push({ id: crypto.randomUUID(), name: defName, items: [] });
                }
            });

            // Append any custom groups that aren't in the default list
            loadedGroups.forEach(g => {
                if (!defaultNames.includes(g.name)) {
                    finalGroups.push(g);
                }
            });

            setRuleGroups(finalGroups);

        } else {
            // Add Mode: Initialize with clean default structure
            setName('');
            setRuleGroups([
                { id: crypto.randomUUID(), name: "Entry criteria", items: [] }, 
                { id: crypto.randomUUID(), name: "Exit criteria", items: [] },
                { id: crypto.randomUUID(), name: "Market conditions", items: [] }
            ]);
        }
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    // Default color if not provided (Updated to Purple #8b5cf6)
    const defaultColor = initialData?.color || '#8b5cf6'; 

    const strategyData = { 
        id: initialData?.id || crypto.randomUUID(), 
        name, 
        rules: ruleGroups, 
        color: defaultColor, 
        description: '' 
    } as Strategy;

    try {
        if (initialData) await updateStrategy(strategyData);
        else await addStrategy(strategyData);
        onClose();
    } catch (e) { console.error("Failed to save strategy", e); }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, groupId: string, index: number) => {
      setDraggedItem({ groupId, index });
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent, targetGroupId: string, targetIndex: number) => {
      e.preventDefault();
      
      if (!draggedItem) return;
      
      // Only allow reordering within the same group
      if (draggedItem.groupId !== targetGroupId) return;
      if (draggedItem.index === targetIndex) return;

      const newGroups = [...ruleGroups];
      const groupIndex = newGroups.findIndex(g => g.id === targetGroupId);
      if (groupIndex === -1) return;

      const group = newGroups[groupIndex];
      const newItems = [...group.items];

      // Remove from old index
      const [movedItem] = newItems.splice(draggedItem.index, 1);
      // Insert at new index
      newItems.splice(targetIndex, 0, movedItem);

      newGroups[groupIndex] = { ...group, items: newItems };
      setRuleGroups(newGroups);
      setDraggedItem(null);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
        {/* Main Container */}
        <div className="bg-background w-full max-w-2xl rounded-2xl border border-slate-600 shadow-2xl flex flex-col max-h-[90%] overflow-hidden relative">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-600 flex justify-between items-center bg-background shrink-0">
                <h2 className="text-xl font-bold text-white">{initialData ? '編輯策略' : '新增策略'}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 bg-background">
                <div>
                    <label className="block text-sm font-semibold text-slate-400 mb-2">策略名稱</label>
                    <input type="text" className="w-full bg-surface border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none" value={name} onChange={e => setName(e.target.value)} autoFocus />
                </div>
                
                <div className="space-y-4 pt-4 border-t border-slate-600 mt-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white">策略規則 (Rules)</h3>
                        <button type="button" onClick={() => setRuleGroups(p => [...p, { id: crypto.randomUUID(), name: '新規則群組', items: [] }])} className="text-xs text-primary font-bold hover:underline flex items-center gap-1"><Plus size={14}/> 新增群組</button>
                    </div>
                    {ruleGroups.map((group, gIdx) => (
                        <div key={group.id} className="bg-surface rounded-xl p-3 border border-slate-600">
                             <div className="flex items-center gap-2 mb-3">
                                 <input className="bg-transparent font-bold text-slate-200 outline-none flex-1" value={group.name} onChange={e => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, name: e.target.value} : g))} />
                                 <button type="button" onClick={() => setRuleGroups(p => p.filter(g => g.id !== group.id))} className="text-slate-500 hover:text-red-500"><Trash2 size={14} /></button>
                             </div>
                             <div className="space-y-2">
                                 {group.items.map((item, itemIndex) => (
                                     <div 
                                        key={item.id} 
                                        className="flex items-center gap-2 group/item"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, group.id, itemIndex)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, group.id, itemIndex)}
                                     >
                                         <div className="text-slate-600 cursor-grab hover:text-slate-400">
                                            <GripVertical size={16} />
                                         </div>
                                         <input className="flex-1 bg-slate-700/50 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-slate-500 focus:outline-none" value={item.text} onChange={e => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, items: g.items.map(i => i.id === item.id ? {...i, text: e.target.value} : i)} : g))} />
                                         <button type="button" onClick={() => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, items: g.items.filter(i => i.id !== item.id)} : g))}><Trash2 size={12} className="text-slate-600 hover:text-red-400 transition-colors" /></button>
                                     </div>
                                 ))}
                                 <button type="button" onClick={() => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, items: [...g.items, {id: crypto.randomUUID(), text: ''}]} : g))} className="text-[10px] text-slate-500 hover:text-primary transition-colors flex items-center gap-1 ml-6"><Plus size={10}/> 新增規則</button>
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-600 flex justify-end gap-3 bg-background shrink-0 relative z-50">
                 <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">取消</button>
                 <button 
                    onClick={handleSubmit} 
                    disabled={!name} 
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg ${
                        !name 
                        ? 'bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed shadow-none' 
                        : 'bg-primary hover:bg-purple-600 text-white shadow-indigo-500/20'
                    }`}
                 >
                    {initialData ? <Save size={16} /> : <FilePlus2 size={16} />}
                    {initialData ? '儲存變更' : '新增策略'}
                 </button>
            </div>
        </div>
    </div>,
    document.body
  );
};
