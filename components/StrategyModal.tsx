import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Strategy } from '../types';
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

export const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, initialData }) => {
  const { addStrategy, updateStrategy } = useTrades();
  
  const [formData, setFormData] = useState<Partial<Strategy>>({
    name: '',
    description: '',
    rules: [],
    color: '#6366f1'
  });

  const [newRule, setNewRule] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ name: '', description: '', rules: [], color: '#6366f1' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const strategyData = {
        id: formData.id || crypto.randomUUID(),
        name: formData.name,
        description: formData.description || '',
        rules: formData.rules || [],
        color: formData.color || '#6366f1',
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

  const handleAddRule = () => {
      if (!newRule.trim()) return;
      setFormData(prev => ({ ...prev, rules: [...(prev.rules || []), newRule] }));
      setNewRule('');
  };

  const handleRemoveRule = (index: number) => {
      setFormData(prev => ({
          ...prev,
          rules: (prev.rules || []).filter((_, i) => i !== index)
      }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1f2937] w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-[#1f2937] rounded-t-2xl">
            <h2 className="text-xl font-bold text-white">
                {initialData ? '編輯策略 (Edit Strategy)' : '新增策略 (New Strategy)'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">策略名稱 (Name)</label>
                <input 
                    type="text" 
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                    placeholder="e.g. Bull Flag, Gap Fill..."
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">代表顏色 (Color)</label>
                <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, color: c }))}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${formData.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1f2937]' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                        >
                            {formData.color === c && <CheckCircle2 size={16} className="text-white drop-shadow-md" />}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">策略描述 (Description)</label>
                <textarea 
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-primary focus:outline-none h-24 resize-none"
                    placeholder="Describe the setup criteria and context..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-slate-400">執行規則 / 檢查表 (Rules)</label>
                    <span className="text-xs text-slate-500">定義你的進出場條件</span>
                </div>
                
                {/* Rules List */}
                <div className="space-y-2 mb-3">
                    {formData.rules?.map((rule, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700 group">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                <span className="text-sm text-slate-200">{rule}</span>
                            </div>
                            <button onClick={() => handleRemoveRule(idx)} className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {(!formData.rules || formData.rules.length === 0) && (
                        <div className="text-center py-4 border border-dashed border-slate-700 rounded-lg">
                            <p className="text-xs text-slate-500 italic">尚未新增規則...</p>
                        </div>
                    )}
                </div>

                {/* Add Rule Input */}
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                        placeholder="Add a rule (e.g. RSI < 30)"
                        value={newRule}
                        onChange={e => setNewRule(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddRule())}
                    />
                    <button 
                        type="button"
                        onClick={handleAddRule}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors border border-slate-600"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/50 rounded-b-2xl">
             <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">取消</button>
             <button 
                onClick={handleSubmit}
                disabled={!formData.name}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all shadow-lg"
             >
                <Save size={16} /> 儲存
             </button>
        </div>

      </div>
    </div>
  );
};