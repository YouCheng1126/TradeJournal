import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, CheckCircle2, GripVertical, FolderPlus } from 'lucide-react';
import { Strategy, StrategyRuleGroup } from '../types';
import { useTrades } from '../contexts/TradeContext';

interface StrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Strategy;
}

const PRESET_COLORS = ['#6366f1', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

export const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, initialData }) => {
  const { addStrategy, updateStrategy } = useTrades();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [ruleGroups, setRuleGroups] = useState<StrategyRuleGroup[]>([]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setName(initialData.name);
            setColor(initialData.color || '#6366f1');
            if (initialData.rules && initialData.rules.length > 0) {
                const firstRule = initialData.rules[0] as any;
                if (typeof firstRule === 'string') {
                    setRuleGroups([{ id: crypto.randomUUID(), name: "General", items: (initialData.rules as any as string[]).map(t => ({ id: crypto.randomUUID(), text: t })) }]);
                } else setRuleGroups(initialData.rules);
            } else setRuleGroups([]);
        } else {
            setName(''); setColor('#6366f1');
            setRuleGroups([{ id: crypto.randomUUID(), name: "Entry criteria", items: [] }, { id: crypto.randomUUID(), name: "Exit criteria", items: [] }]);
        }
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const strategyData = { id: initialData?.id || crypto.randomUUID(), name, rules: ruleGroups, color, description: '' } as Strategy;
    try {
        if (initialData) await updateStrategy(strategyData);
        else await addStrategy(strategyData);
        onClose();
    } catch (e) { console.error("Failed to save strategy", e); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Forced Full Screen Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md" 
        style={{ top: '-1px', left: '-1px', right: '-1px', bottom: '-1px' }}
        onClick={onClose} 
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-[#1f2937] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-[#1f2937]">
                <h2 className="text-xl font-bold text-white">{initialData ? '編輯策略' : '新增策略'}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                <div><label className="block text-sm font-semibold text-slate-400 mb-2">策略名稱</label><input type="text" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-primary outline-none" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
                <div><label className="block text-sm font-semibold text-slate-400 mb-2">顏色</label><div className="flex flex-wrap gap-2 bg-slate-800 p-2 rounded-lg border border-slate-600">{PRESET_COLORS.map(c => (<button key={c} type="button" onClick={() => setColor(c)} className={`w-6 h-6 rounded-full flex items-center justify-center ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : 'opacity-70'}`} style={{ backgroundColor: c }}>{color === c && <CheckCircle2 size={12} className="text-white" />}</button>))}</div></div>
                
                <div className="space-y-4 pt-2 border-t border-slate-700">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white">策略規則 (Rules)</h3>
                        <button type="button" onClick={() => setRuleGroups(p => [...p, { id: crypto.randomUUID(), name: '新規則群組', items: [] }])} className="text-xs text-primary font-bold hover:underline flex items-center gap-1"><Plus size={14}/> 新增群組</button>
                    </div>
                    {ruleGroups.map((group, gIdx) => (
                        <div key={group.id} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700">
                             <div className="flex items-center gap-2 mb-3">
                                 <input className="bg-transparent font-bold text-slate-200 outline-none flex-1" value={group.name} onChange={e => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, name: e.target.value} : g))} />
                                 <button type="button" onClick={() => setRuleGroups(p => p.filter(g => g.id !== group.id))} className="text-slate-500 hover:text-red-500"><Trash2 size={14} /></button>
                             </div>
                             <div className="space-y-2">
                                 {group.items.map(item => (
                                     <div key={item.id} className="flex items-center gap-2">
                                         <input className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" value={item.text} onChange={e => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, items: g.items.map(i => i.id === item.id ? {...i, text: e.target.value} : i)} : g))} />
                                         <button type="button" onClick={() => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, items: g.items.filter(i => i.id !== item.id)} : g))}><Trash2 size={12} className="text-slate-600" /></button>
                                     </div>
                                 ))}
                                 <button type="button" onClick={() => setRuleGroups(p => p.map(g => g.id === group.id ? {...g, items: [...g.items, {id: crypto.randomUUID(), text: ''}]} : g))} className="text-[10px] text-slate-500 hover:text-primary transition-colors flex items-center gap-1"><Plus size={10}/> 新增規則</button>
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-5 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/50">
                 <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                 <button onClick={handleSubmit} disabled={!name} className="px-6 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-all shadow-lg disabled:opacity-50"><Save size={16} className="inline mr-2" /> 儲存策略</button>
            </div>
        </div>
      </div>
    </div>
  );
};
