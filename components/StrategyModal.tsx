import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, CheckCircle2, GripVertical, FolderPlus } from 'lucide-react';
import { Strategy, StrategyRuleGroup } from '../types';
import { useTrades } from '../contexts/TradeContext';

interface StrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Strategy;
}

// Preset colors similar to TradeZella/TradingView tags
const PRESET_COLORS = [
    '#6366f1', // Indigo (Default)
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
    '#64748b', // Slate
];

// Removed Risk Management from defaults
const DEFAULT_GROUPS = [
    { name: "Entry criteria" },
    { name: "Exit criteria" },
    { name: "Market conditions" }
];

export const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, initialData }) => {
  const { addStrategy, updateStrategy } = useTrades();
  
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [ruleGroups, setRuleGroups] = useState<StrategyRuleGroup[]>([]);
  
  // Drag and Drop State
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ gIdx: number, iIdx: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setName(initialData.name);
            setColor(initialData.color || '#6366f1');
            
            // Check if rules are in new format or old format
            if (initialData.rules && initialData.rules.length > 0) {
                const firstRule = initialData.rules[0] as any;
                if (typeof firstRule === 'string') {
                    // Legacy Format
                    setRuleGroups([{
                        id: crypto.randomUUID(),
                        name: "General",
                        items: (initialData.rules as any as string[]).map(t => ({ id: crypto.randomUUID(), text: t }))
                    }]);
                } else {
                    // New Format
                    setRuleGroups(initialData.rules);
                }
            } else {
                 setRuleGroups([]);
            }

        } else {
            // New Strategy - Initialize with default groups
            setName('');
            setColor('#6366f1');
            const defaults = DEFAULT_GROUPS.map(g => ({
                id: crypto.randomUUID(),
                name: g.name,
                items: []
            }));
            setRuleGroups(defaults);
        }
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const strategyData = {
        id: initialData?.id || crypto.randomUUID(),
        name,
        rules: ruleGroups,
        color,
        description: '' 
    } as Strategy;

    try {
        if (initialData) {
            await updateStrategy(strategyData);
        } else {
            await addStrategy(strategyData);
        }
        onClose();
    } catch (e) {
        console.error("Failed to save strategy", e);
    }
  };

  // --- Group Actions ---

  const handleAddGroup = () => {
      setRuleGroups(prev => [
          ...prev, 
          { id: crypto.randomUUID(), name: 'New Group', items: [] }
      ]);
  };

  const handleDeleteGroup = (groupId: string) => {
      setRuleGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleGroupNameChange = (id: string, newName: string) => {
      setRuleGroups(prev => prev.map(g => g.id === id ? { ...g, name: newName } : g));
  };

  // --- Item Actions ---

  const handleAddItem = (groupId: string) => {
      // Add a blank editable item
      setRuleGroups(prev => prev.map(g => {
          if (g.id === groupId) {
              return {
                  ...g,
                  items: [...g.items, { id: crypto.randomUUID(), text: '' }]
              };
          }
          return g;
      }));
  };

  const handleItemTextChange = (groupId: string, itemId: string, newText: string) => {
      setRuleGroups(prev => prev.map(g => {
          if (g.id === groupId) {
              return {
                  ...g,
                  items: g.items.map(i => i.id === itemId ? { ...i, text: newText } : i)
              };
          }
          return g;
      }));
  };

  const handleDeleteItem = (groupId: string, itemId: string) => {
      setRuleGroups(prev => prev.map(g => {
          if (g.id === groupId) {
              return {
                  ...g,
                  items: g.items.filter(i => i.id !== itemId)
              };
          }
          return g;
      }));
  };

  // --- Drag and Drop Logic (HTML5 API) ---

  // 1. Group Reordering
  const handleGroupDragStart = (e: React.DragEvent, index: number) => {
      setDraggedGroupIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleGroupDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); 
      if (draggedGroupIndex === null || draggedGroupIndex === index) return;

      const newGroups = [...ruleGroups];
      const draggedGroup = newGroups[draggedGroupIndex];
      
      newGroups.splice(draggedGroupIndex, 1);
      newGroups.splice(index, 0, draggedGroup);

      setRuleGroups(newGroups);
      setDraggedGroupIndex(index);
  };

  const handleGroupDragEnd = () => {
      setDraggedGroupIndex(null);
  };

  // 2. Item Reordering (Within same group)
  const handleItemDragStart = (e: React.DragEvent, gIdx: number, iIdx: number) => {
      e.stopPropagation(); 
      setDraggedItem({ gIdx, iIdx });
      e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: React.DragEvent, targetGIdx: number, targetIIdx: number) => {
      e.preventDefault();
      // Ensure we are dragging an item, and it is within the same group
      if (!draggedItem || draggedItem.gIdx !== targetGIdx || draggedItem.iIdx === targetIIdx) return;

      const newGroups = [...ruleGroups];
      const group = newGroups[targetGIdx];
      const newItems = [...group.items];
      
      const itemToMove = newItems[draggedItem.iIdx];
      
      newItems.splice(draggedItem.iIdx, 1);
      newItems.splice(targetIIdx, 0, itemToMove);

      newGroups[targetGIdx] = { ...group, items: newItems };
      
      setRuleGroups(newGroups);
      setDraggedItem({ gIdx: targetGIdx, iIdx: targetIIdx });
  };

  const handleItemDragEnd = () => {
      setDraggedItem(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1f2937] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-[#1f2937] rounded-t-2xl z-10">
            <h2 className="text-xl font-bold text-white">
                {initialData ? '編輯策略 (Edit Strategy)' : '新增策略 (New Strategy)'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Name */}
            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">策略名稱 (Name)</label>
                <input 
                    type="text" 
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-primary focus:outline-none placeholder-slate-600"
                    placeholder="e.g. Bull Flag Breakout"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                />
            </div>

            {/* Color */}
            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">顏色 (Color)</label>
                <div className="flex flex-wrap gap-2 bg-slate-800 p-2 rounded-lg border border-slate-600">
                    {PRESET_COLORS.map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                            style={{ backgroundColor: c }}
                        >
                            {color === c && <CheckCircle2 size={12} className="text-white drop-shadow-md" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Rules Builder Section */}
            <div className="space-y-4 pt-2">
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                    <div>
                         <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            Trading Playbook Rules
                         </h3>
                         <p className="text-xs text-slate-500 mt-1">Define your playbook rules with grouping.</p>
                    </div>
                    <button 
                        type="button" 
                        onClick={handleAddGroup}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all"
                    >
                        <FolderPlus size={14} /> Create new group
                    </button>
                </div>

                <div className="space-y-6">
                    {ruleGroups.map((group, gIdx) => (
                        <div 
                            key={group.id} 
                            className={`bg-slate-900/50 rounded-xl p-1 shadow-sm border border-slate-700 transition-colors ${draggedGroupIndex === gIdx ? 'opacity-50 ring-2 ring-primary ring-offset-2 ring-offset-slate-900' : ''}`}
                            draggable
                            onDragStart={(e) => handleGroupDragStart(e, gIdx)}
                            onDragOver={(e) => handleGroupDragOver(e, gIdx)}
                            onDragEnd={handleGroupDragEnd}
                        >
                             {/* Group Header */}
                             <div className="flex items-center gap-2 p-2 group/header cursor-grab active:cursor-grabbing">
                                 <div className="p-1 hover:bg-slate-800 rounded">
                                     <GripVertical size={16} className="text-slate-500" />
                                 </div>
                                 <input 
                                    className="bg-transparent font-bold text-slate-200 focus:outline-none flex-1 hover:bg-slate-800 focus:bg-slate-800 rounded px-1 transition-colors"
                                    value={group.name}
                                    onChange={(e) => handleGroupNameChange(group.id, e.target.value)}
                                    placeholder="Group Name"
                                    onMouseDown={(e) => e.stopPropagation()} 
                                 />
                                 <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                    className="text-slate-500 hover:text-red-500 p-1 opacity-0 group-hover/header:opacity-100 transition-opacity"
                                    title="Delete Group"
                                 >
                                    <Trash2 size={14} />
                                 </button>
                             </div>

                             {/* Items List - With Spacing (Gap) */}
                             <div className="flex flex-col gap-2 p-2">
                                 {group.items.map((item, iIdx) => (
                                     <div 
                                        key={item.id} 
                                        className={`flex items-center gap-3 p-2 rounded-lg border border-slate-700/50 bg-slate-800 shadow-sm group/item hover:bg-slate-700/80 transition-colors ${draggedItem?.iIdx === iIdx && draggedItem.gIdx === gIdx ? 'opacity-40 bg-slate-700 border-primary border-dashed' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleItemDragStart(e, gIdx, iIdx)}
                                        onDragOver={(e) => handleItemDragOver(e, gIdx, iIdx)}
                                        onDragEnd={handleItemDragEnd}
                                     >
                                         <div className="cursor-grab active:cursor-grabbing text-slate-600 group-hover/item:text-slate-400 transition-colors flex-shrink-0">
                                             <GripVertical size={14} />
                                         </div>
                                         <input
                                            className="flex-1 bg-transparent text-sm text-slate-300 focus:outline-none placeholder-slate-500"
                                            value={item.text}
                                            onChange={(e) => handleItemTextChange(group.id, item.id, e.target.value)}
                                            placeholder="Enter rule..."
                                            onMouseDown={(e) => e.stopPropagation()} 
                                         />
                                         <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(group.id, item.id); }}
                                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-1 text-xs px-2"
                                         >
                                             <Trash2 size={14} />
                                         </button>
                                     </div>
                                 ))}

                                 {/* Add Item Button */}
                                 <button 
                                    type="button" 
                                    onClick={() => handleAddItem(group.id)}
                                    className="text-left p-2 text-xs text-slate-400 hover:text-primary hover:bg-slate-800/50 border border-transparent hover:border-slate-700 rounded-lg transition-all flex items-center gap-2 mt-1"
                                 >
                                    <Plus size={14} /> Create new rule
                                 </button>
                             </div>
                        </div>
                    ))}
                    
                    {ruleGroups.length === 0 && (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                            <p>No rules yet. Create a group to start.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/50 rounded-b-2xl">
             <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">取消</button>
             <button 
                onClick={handleSubmit}
                disabled={!name}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all shadow-lg"
             >
                <Save size={16} /> 儲存策略
             </button>
        </div>

      </div>
    </div>
  );
};