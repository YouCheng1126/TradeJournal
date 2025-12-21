
import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, ChevronDown, Target, Link as LinkIcon, ListChecks } from 'lucide-react';
import { Trade, TradeStatus, TradeDirection, InputMode } from '../../types';
import { useTrades } from '../../contexts/TradeContext';
import { RulesPopover } from './RulesPopover';
import { TagSelector } from './TagSelector';

interface AnalysisSectionProps {
    formData: Partial<Trade>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Trade>>>;
    inputMode: InputMode;
    errors: { [key: string]: string };
    getInputClass: (field: string) => string;
    getDisplayValue: (field: keyof Trade) => string | number;
    handlePriceOrPointsChange: (field: keyof Trade, value: string) => void;
}

export const AnalysisSection: React.FC<AnalysisSectionProps> = ({
    formData, setFormData, inputMode, errors, getInputClass, getDisplayValue, handlePriceOrPointsChange
}) => {
    const { strategies } = useTrades();
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showRulesChecklist, setShowRulesChecklist] = useState(false);
    
    const statusPickerRef = useRef<HTMLDivElement>(null);
    const rulesButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (statusPickerRef.current && !statusPickerRef.current.contains(e.target as Node)) setShowStatusPicker(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExcursionChange = (type: 'maxProfit' | 'maxLoss', valueStr: string) => {
        const isLong = formData.direction === TradeDirection.LONG;
        const targetField = type === 'maxProfit' ? (isLong ? 'highestPriceReached' : 'lowestPriceReached') : (isLong ? 'lowestPriceReached' : 'highestPriceReached');
        handlePriceOrPointsChange(targetField, valueStr);
    };

    const renderStatusInput = () => { 
        const containerClass = getInputClass('status').replace('p-2.5', 'p-1');
        let statusColor = 'text-white';
        if (formData.status === TradeStatus.WIN || formData.status === TradeStatus.SMALL_WIN) statusColor = 'text-emerald-400 font-bold';
        if (formData.status === TradeStatus.LOSS || formData.status === TradeStatus.SMALL_LOSS) statusColor = 'text-red-400 font-bold';
        if (formData.status === TradeStatus.BREAK_EVEN) statusColor = 'text-slate-300';
  
        return (
          <div className="relative" ref={statusPickerRef}>
              <div className={`${containerClass} flex items-center gap-2 px-3 cursor-pointer`} onClick={() => setShowStatusPicker(!showStatusPicker)}>
                  <span className={`text-sm flex-1 ${statusColor}`}>{formData.status}</span>
                  <ChevronDown size={14} className="text-slate-400" />
              </div>
              {showStatusPicker && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-full" onMouseDown={e => e.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                          {Object.values(TradeStatus).map(status => (
                              <button key={status} type="button" onClick={() => { setFormData(p => ({ ...p, status })); setShowStatusPicker(false); }} className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${formData.status === status ? 'bg-primary text-white font-bold' : `hover:bg-slate-700 hover:text-white ${status.includes('Win')?'text-emerald-400':status.includes('Loss')?'text-red-400':'text-slate-300'}`}`}>
                                  {status}
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1.5">{inputMode === 'price' ? '最大浮盈 (Max Profit)' : '最大浮盈點數 (Max Profit)'}</label>
                    <input type="number" step="0.25" value={getDisplayValue(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} onChange={(e) => handleExcursionChange('maxProfit', e.target.value)} className={getInputClass(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} inputMode="decimal" autoComplete="off" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-rose-400 mb-1.5">{inputMode === 'price' ? '最大浮虧 (Max Loss)' : '最大浮虧點數 (Max Loss)'}</label>
                    <input type="number" step="0.25" value={getDisplayValue(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} onChange={(e) => handleExcursionChange('maxLoss', e.target.value)} className={getInputClass(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} inputMode="decimal" autoComplete="off" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">交易結果 (Status)</label>
                    {renderStatusInput()}
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-medium text-slate-400">最佳離場價 (Best Exit)</label>
                        <button type="button" tabIndex={-1} onClick={() => setFormData(p => ({ ...p, bestExitPrice: p.direction === TradeDirection.LONG ? p.highestPriceReached : p.lowestPriceReached }))} className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700" title="同步最大浮盈"><Target size={12} /></button>
                    </div>
                    <input name="bestExitPrice" type="number" step="0.25" value={getDisplayValue('bestExitPrice')} onChange={(e) => handlePriceOrPointsChange('bestExitPrice', e.target.value)} className={getInputClass('bestExitPrice')} placeholder={inputMode === 'price' ? "Price" : "Points"} inputMode="decimal" autoComplete="off" />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">交易策略 (Strategy)</label>
                <div className="flex gap-2 relative">
                    <div className="relative flex-1">
                        <select name="playbookId" value={formData.playbookId || ''} onChange={e => setFormData(p => ({...p, playbookId: e.target.value}))} className={`${getInputClass('playbookId')} appearance-none cursor-pointer h-[42px]`}>
                            <option value="">-- 選擇策略 --</option>
                            {strategies.map(st => (<option key={st.id} value={st.id}>{st.name}</option>))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    
                    <button
                        ref={rulesButtonRef}
                        type="button"
                        disabled={!formData.playbookId}
                        onClick={() => setShowRulesChecklist(!showRulesChecklist)}
                        className={`h-[42px] px-3 border rounded-lg transition-colors flex items-center gap-2 ${showRulesChecklist ? 'bg-primary border-primary text-white' : 'bg-surface/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'} ${!formData.playbookId ? 'opacity-50 cursor-not-allowed hover:border-slate-700 hover:text-slate-400' : ''}`}
                    >
                        <ListChecks size={18} />
                        <span className="text-xs font-bold hidden sm:inline">Rules</span>
                    </button>

                    {showRulesChecklist && formData.playbookId && (
                        <RulesPopover 
                            strategyId={formData.playbookId}
                            rulesFollowed={formData.rulesFollowed || []}
                            onToggleRule={(id) => setFormData(p => {
                                const current = p.rulesFollowed || [];
                                return { ...p, rulesFollowed: current.includes(id) ? current.filter(x => x !== id) : [...current, id] };
                            })}
                            anchorRef={rulesButtonRef}
                            onClose={() => setShowRulesChecklist(false)}
                        />
                    )}
                </div>
            </div>

            <div className="pt-4">
                <TagSelector 
                    selectedTags={formData.tags || []} 
                    onToggleTag={(id) => setFormData(p => {
                        const current = p.tags || [];
                        return { ...p, tags: current.includes(id) ? current.filter(x => x !== id) : [...current, id] };
                    })} 
                />
            </div>

            <div className="mt-2">
                <label className="block text-xs font-medium text-slate-400 mb-2">交易截圖 (Screenshot)</label>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input type="text" placeholder="輸入圖片連結 (例如 TradingView URL)" value={formData.screenshotUrl || ''} onChange={(e) => setFormData(prev => ({ ...prev, screenshotUrl: e.target.value }))} className={`${getInputClass('screenshotUrl')} pl-9`} />
                            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">提示: 推薦使用 TradingView 連結。</p>
            </div>
        </div>
    );
};
