import React, { useState, useEffect, useMemo } from 'react';
import { X, Filter, Check, SlidersHorizontal, Tag, Clock, BookOpen, ChevronDown, ChevronUp, ListChecks, Ban, Layers, ListFilter } from 'lucide-react';
import { useTrades } from '../contexts/TradeContext';
import { GlobalFilterState, TradeStatus, TradeDirection } from '../types';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type FilterCategory = 'general' | 'tags' | 'time' | 'playbook';

const CATEGORIES: { id: FilterCategory; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: SlidersHorizontal },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'time', label: 'Day & Time', icon: Clock },
    { id: 'playbook', label: 'Strategy', icon: BookOpen },
];

// --- Helper Functions ---

const formatSummary = (selectedLabels: string[], totalCount: number, prefix: string = '') => {
    if (selectedLabels.length === 0) return 'Select...';
    if (totalCount > 0 && selectedLabels.length === totalCount) return `All ${prefix}`;
    return selectedLabels.join(', ');
};

// --- Helper Components ---

interface FilterSectionProps {
    id: string;
    label: string;
    isEnabled: boolean;
    onToggleEnable: () => void;
    isDropdownOpen?: boolean;
    onToggleDropdown?: () => void;
    summaryText?: string;
    children?: React.ReactNode;
    isRangeInput?: boolean; 
    canExpand?: boolean;
    showSelectionBox?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({
    id, label, isEnabled, onToggleEnable, 
    isDropdownOpen, onToggleDropdown, summaryText, 
    children, isRangeInput = false, canExpand = true,
    showSelectionBox = true
}) => {
    const hasContentToDisplay = isEnabled && (isRangeInput || showSelectionBox || (children && canExpand));

    return (
        <div className="flex flex-col mb-6" data-section-id={id}>
            <label className="flex items-center gap-3 cursor-pointer group select-none">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isEnabled ? 'bg-primary border-primary' : 'bg-slate-800 border-slate-600 group-hover:border-slate-500'}`}>
                    {isEnabled && <Check size={14} className="text-white" />}
                </div>
                <span className={`text-sm font-semibold ${isEnabled ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                    {label}
                </span>
                <input type="checkbox" className="hidden" checked={isEnabled} onChange={onToggleEnable} />
            </label>

            {hasContentToDisplay && (
                <div className="pl-8 mt-2 animate-in slide-in-from-top-1 duration-200">
                    {isRangeInput ? (
                        <div className="w-full">{children}</div>
                    ) : showSelectionBox ? (
                        <div className="relative">
                            <button 
                                data-dropdown-trigger={id}
                                onClick={(e) => { e.stopPropagation(); if (canExpand && onToggleDropdown) onToggleDropdown(); }}
                                className={`w-full flex items-center justify-between bg-[#111827] border border-slate-700 rounded-lg px-4 py-3 text-sm transition-colors ${canExpand ? 'hover:border-slate-600' : 'cursor-default'} ${isDropdownOpen ? 'ring-1 ring-primary border-primary' : ''}`}
                                disabled={!canExpand}
                            >
                                <span className="text-slate-400 truncate">{summaryText || 'Select...'}</span>
                                {canExpand && (isDropdownOpen ? <ChevronUp size={16} className="text-slate-500 flex-shrink-0"/> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0"/>)}
                            </button>

                            {isDropdownOpen && canExpand && (
                                <div 
                                    data-dropdown-content={id}
                                    className="mt-1 bg-[#111827] border border-slate-700 rounded-lg p-2 max-h-60 overflow-y-auto custom-scrollbar shadow-lg z-20"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {children}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

const SubCheckbox = ({ label, checked, onChange, colorClass = "" }: any) => (
    <label className="flex items-center gap-3 cursor-pointer group/item py-2 px-2 hover:bg-slate-800 rounded transition-colors">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${checked ? 'bg-primary border-primary' : 'border-slate-600 group-hover/item:border-slate-500 bg-slate-800'}`}>
            {checked && <Check size={12} className="text-white" />}
        </div>
        <span className={`text-sm ${checked ? 'text-white' : 'text-slate-400'} ${colorClass}`}>{label}</span>
        <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
    </label>
);

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose }) => {
    const { filters, setFilters, strategies, tagCategories, tags } = useTrades();
    const [localFilters, setLocalFilters] = useState<GlobalFilterState>(filters);
    const [activeCategory, setActiveCategory] = useState<FilterCategory>('general');
    
    const [enabledSections, setEnabledSections] = useState<Set<string>>(new Set());
    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
    const [includeRules, setIncludeRules] = useState(filters.includeRules);
    const [excludeMode, setExcludeMode] = useState(filters.excludeMode);
    const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>(filters.filterLogic);

    useEffect(() => {
        if (isOpen) {
            setLocalFilters(filters);
            setIncludeRules(filters.includeRules);
            setExcludeMode(filters.excludeMode);
            setFilterLogic(filters.filterLogic);

            const initialEnabled = new Set<string>();
            if (filters.status.length > 0) initialEnabled.add('status');
            if (filters.direction.length > 0) initialEnabled.add('side');
            if (filters.minVolume || filters.maxVolume) initialEnabled.add('volume');
            if (filters.minPnL || filters.maxPnL) initialEnabled.add('pnl');
            if (filters.minRR !== undefined || filters.maxRR !== undefined) initialEnabled.add('rr');
            if (filters.minSLSize !== undefined || filters.maxSLSize !== undefined) initialEnabled.add('slsize');
            if (filters.minActualRisk !== undefined || filters.maxActualRisk !== undefined) initialEnabled.add('actualrisk');
            if (filters.minActualRiskPct !== undefined || filters.maxActualRiskPct !== undefined) initialEnabled.add('actualriskpct');

            if (filters.tagIds.length > 0) {
                 tagCategories.forEach(c => {
                     const catTags = tags.filter(t => t.categoryId === c.id).map(t => t.id);
                     if (catTags.some(id => filters.tagIds.includes(id))) initialEnabled.add(`tag-${c.id}`);
                 });
            }
            if (filters.daysOfWeek.length > 0) initialEnabled.add('days');
            if (filters.startTime || filters.endTime) initialEnabled.add('timerange');
            if (filters.exitStartTime || filters.exitEndTime) initialEnabled.add('exittimerange');
            if (filters.minDuration !== undefined || filters.maxDuration !== undefined) initialEnabled.add('duration');
            if (filters.strategyIds.length > 0) filters.strategyIds.forEach(id => initialEnabled.add(`strat-${id}`));
            setEnabledSections(initialEnabled);
            setOpenDropdowns(new Set());
        }
    }, [isOpen, filters, tagCategories, tags]);

    // Handle outside clicks for dropdowns
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isInsideDropdown = target.closest('[data-dropdown-content]') || target.closest('[data-dropdown-trigger]');
            if (!isInsideDropdown) {
                setOpenDropdowns(new Set());
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleApply = () => {
        const finalFilters = { ...localFilters, includeRules, excludeMode, filterLogic };
        if (!enabledSections.has('status')) finalFilters.status = [];
        if (!enabledSections.has('side')) finalFilters.direction = [];
        if (!enabledSections.has('volume')) { finalFilters.minVolume = undefined; finalFilters.maxVolume = undefined; }
        if (!enabledSections.has('pnl')) { finalFilters.minPnL = undefined; finalFilters.maxPnL = undefined; }
        if (!enabledSections.has('rr')) { finalFilters.minRR = undefined; finalFilters.maxRR = undefined; }
        if (!enabledSections.has('slsize')) { finalFilters.minSLSize = undefined; finalFilters.maxSLSize = undefined; }
        if (!enabledSections.has('actualrisk')) { finalFilters.minActualRisk = undefined; finalFilters.maxActualRisk = undefined; }
        if (!enabledSections.has('actualriskpct')) { finalFilters.minActualRiskPct = undefined; finalFilters.maxActualRiskPct = undefined; }

        if (tagCategories.length > 0) {
            const enabledTagIds: string[] = [];
            tagCategories.forEach(c => {
                if (enabledSections.has(`tag-${c.id}`)) {
                    const catTagIds = tags.filter(t => t.categoryId === c.id).map(t => t.id);
                    enabledTagIds.push(...localFilters.tagIds.filter(id => catTagIds.includes(id)));
                }
            });
            finalFilters.tagIds = enabledTagIds;
        }
        if (!enabledSections.has('days')) finalFilters.daysOfWeek = [];
        if (!enabledSections.has('timerange')) { finalFilters.startTime = ''; finalFilters.endTime = ''; }
        if (!enabledSections.has('exittimerange')) { finalFilters.exitStartTime = ''; finalFilters.exitEndTime = ''; }
        if (!enabledSections.has('duration')) { finalFilters.minDuration = undefined; finalFilters.maxDuration = undefined; }
        const enabledStrategyIds: string[] = [];
        let finalRuleIds: string[] = [];
        strategies.forEach(st => {
            if (enabledSections.has(`strat-${st.id}`)) {
                enabledStrategyIds.push(st.id);
                if (includeRules) {
                    const allRuleIdsForStrat: string[] = [];
                    st.rules?.forEach(g => { if (typeof g !== 'string') g.items.forEach(i => allRuleIdsForStrat.push(i.id)); });
                    finalRuleIds.push(...localFilters.ruleIds.filter(rId => allRuleIdsForStrat.includes(rId)));
                }
            }
        });
        finalFilters.strategyIds = enabledStrategyIds;
        finalFilters.ruleIds = includeRules ? finalRuleIds : [];
        setFilters(finalFilters);
        onClose();
    };

    const handleReset = () => {
        const reset: GlobalFilterState = {
            status: [], direction: [], strategyIds: [], ruleIds: [], tagIds: [],
            daysOfWeek: [], startTime: '', endTime: '', exitStartTime: '', exitEndTime: '',
            minDuration: undefined, maxDuration: undefined,
            minVolume: undefined, maxVolume: undefined, minPnL: undefined, maxPnL: undefined,
            minRR: undefined, maxRR: undefined, minSLSize: undefined, maxSLSize: undefined,
            minActualRisk: undefined, maxActualRisk: undefined,
            minActualRiskPct: undefined, maxActualRiskPct: undefined,
            includeRules: false, excludeMode: false, filterLogic: 'AND',
        };
        setLocalFilters(reset); setEnabledSections(new Set()); setOpenDropdowns(new Set()); setIncludeRules(false); setExcludeMode(false); setFilterLogic('AND');
    };

    const toggleSectionEnabled = (id: string) => {
        setEnabledSections(prev => {
            const next = new Set(prev);
            if (!prev.has(id)) {
                next.add(id);
                if (id.startsWith('strat-')) setLocalFilters(p => ({ ...p, strategyIds: Array.from(new Set([...p.strategyIds, id.replace('strat-', '')])) }));
            } else {
                next.delete(id);
                if (id === 'status') setLocalFilters(p => ({...p, status: []}));
                if (id === 'side') setLocalFilters(p => ({...p, direction: []}));
                if (id === 'days') setLocalFilters(p => ({...p, daysOfWeek: []}));
                if (id.startsWith('tag-')) {
                    const catId = id.replace('tag-', '');
                    const catTags = tags.filter(t => t.categoryId === catId).map(t => t.id);
                    setLocalFilters(p => ({ ...p, tagIds: p.tagIds.filter(tid => !catTags.includes(tid)) }));
                }
                if (id.startsWith('strat-')) {
                    const sId = id.replace('strat-', '');
                    const st = strategies.find(s => s.id === sId);
                    setLocalFilters(p => ({ ...p, strategyIds: p.strategyIds.filter(x => x !== sId), ruleIds: (st && st.rules) ? p.ruleIds.filter(r => !st.rules!.flatMap(g => typeof g !== 'string' ? g.items.map(item => item.id) : []).includes(r)) : p.ruleIds }));
                }
                if (id === 'volume') setLocalFilters(p => ({...p, minVolume: undefined, maxVolume: undefined}));
                if (id === 'pnl') setLocalFilters(p => ({...p, minPnL: undefined, maxPnL: undefined}));
                if (id === 'rr') setLocalFilters(p => ({...p, minRR: undefined, maxRR: undefined}));
                if (id === 'slsize') setLocalFilters(p => ({...p, minSLSize: undefined, maxSLSize: undefined}));
                if (id === 'actualrisk') setLocalFilters(p => ({...p, minActualRisk: undefined, maxActualRisk: undefined}));
                if (id === 'actualriskpct') setLocalFilters(p => ({...p, minActualRiskPct: undefined, maxActualRiskPct: undefined}));
                if (id === 'timerange') setLocalFilters(p => ({...p, startTime: '', endTime: ''}));
                if (id === 'exittimerange') setLocalFilters(p => ({...p, exitStartTime: '', exitEndTime: ''}));
                if (id === 'duration') setLocalFilters(p => ({...p, minDuration: undefined, maxDuration: undefined}));
                setOpenDropdowns(d => { const n = new Set(d); n.delete(id); return n; });
            }
            return next;
        });
    };

    const toggleStatus = (s: TradeStatus) => { setLocalFilters(prev => ({ ...prev, status: prev.status.includes(s) ? prev.status.filter(i => i !== s) : [...prev.status, s] })); };
    const toggleDirection = (d: TradeDirection) => { setLocalFilters(prev => ({ ...prev, direction: prev.direction.includes(d) ? prev.direction.filter(i => i !== d) : [...prev.direction, d] })); };
    const toggleDay = (idx: number) => { setLocalFilters(prev => ({ ...prev, daysOfWeek: prev.daysOfWeek.includes(idx) ? prev.daysOfWeek.filter(d => d !== idx) : [...prev.daysOfWeek, idx] })); };
    const toggleTag = (id: string) => { setLocalFilters(prev => ({ ...prev, tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter(i => i !== id) : [...prev.tagIds, id] })); };
    const toggleRule = (id: string) => { setLocalFilters(prev => ({ ...prev, ruleIds: prev.ruleIds.includes(id) ? prev.ruleIds.filter(i => i !== id) : [...prev.ruleIds, id] })); };

    const getReadableRuleTexts = (strat: any) => {
        const selected = localFilters.ruleIds;
        const result: string[] = [];
        strat.rules?.forEach((g: any) => {
            if (typeof g !== 'string') {
                g.items.forEach((i: any) => {
                    if (selected.includes(i.id)) result.push(i.text);
                });
            }
        });
        return result;
    };

    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose}>
            <div className="fixed top-16 left-0 md:left-64 bg-[#1f2937] w-full max-w-[500px] h-[520px] border border-slate-700 rounded-br-xl rounded-bl-xl shadow-2xl flex flex-col overflow-hidden z-[101] shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-[35%] border-r border-slate-700 bg-surface/50 p-3 space-y-1 overflow-y-auto">
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            const isActive = activeCategory === cat.id;
                            return (
                                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3"><Icon size={16} /><span>{cat.label}</span></div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="w-[65%] bg-[#1f2937] flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                            {activeCategory === 'general' && (
                                <div className="pb-4">
                                    <FilterSection id="status" label="Status" isEnabled={enabledSections.has('status')} onToggleEnable={() => toggleSectionEnabled('status')} isDropdownOpen={openDropdowns.has('status')} onToggleDropdown={() => setOpenDropdowns(d => new Set(d.has('status') ? [] : ['status']))} summaryText={formatSummary(localFilters.status, Object.values(TradeStatus).length, 'Statuses')}>
                                        <div className="flex flex-col">{Object.values(TradeStatus).map(s => <SubCheckbox key={s} label={s} checked={localFilters.status.includes(s)} onChange={() => toggleStatus(s)} />)}</div>
                                    </FilterSection>
                                    <FilterSection id="side" label="Side" isEnabled={enabledSections.has('side')} onToggleEnable={() => toggleSectionEnabled('side')} isDropdownOpen={openDropdowns.has('side')} onToggleDropdown={() => setOpenDropdowns(d => new Set(d.has('side') ? [] : ['side']))} summaryText={formatSummary(localFilters.direction, 2, 'Sides')}>
                                        <div className="flex flex-col">{[TradeDirection.LONG, TradeDirection.SHORT].map(d => <SubCheckbox key={d} label={d} checked={localFilters.direction.includes(d)} onChange={() => toggleDirection(d)} />)}</div>
                                    </FilterSection>
                                    
                                    <FilterSection id="volume" label="Volume" isEnabled={enabledSections.has('volume')} onToggleEnable={() => toggleSectionEnabled('volume')} isRangeInput={true}>
                                         <div className="flex items-center gap-6">
                                            <input type="number" placeholder="Min" value={localFilters.minVolume || ''} onChange={e => setLocalFilters(prev => ({ ...prev, minVolume: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                            <input type="number" placeholder="Max" value={localFilters.maxVolume || ''} onChange={e => setLocalFilters(prev => ({ ...prev, maxVolume: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                        </div>
                                    </FilterSection>
                                    
                                    <FilterSection id="pnl" label="Net P&L" isEnabled={enabledSections.has('pnl')} onToggleEnable={() => toggleSectionEnabled('pnl')} isRangeInput={true}>
                                         <div className="flex items-center gap-6">
                                            <input type="number" placeholder="Min" value={localFilters.minPnL || ''} onChange={e => setLocalFilters(prev => ({ ...prev, minPnL: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                            <input type="number" placeholder="Max" value={localFilters.maxPnL || ''} onChange={e => setLocalFilters(prev => ({ ...prev, maxPnL: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                        </div>
                                    </FilterSection>

                                    <FilterSection id="rr" label="R/R (R-multiple)" isEnabled={enabledSections.has('rr')} onToggleEnable={() => toggleSectionEnabled('rr')} isRangeInput={true}>
                                         <div className="flex items-center gap-6">
                                            <input type="number" step="0.1" placeholder="Min" value={localFilters.minRR || ''} onChange={e => setLocalFilters(prev => ({ ...prev, minRR: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                            <input type="number" step="0.1" placeholder="Max" value={localFilters.maxRR || ''} onChange={e => setLocalFilters(prev => ({ ...prev, maxRR: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                        </div>
                                    </FilterSection>

                                    <FilterSection id="slsize" label="SL Size (Points)" isEnabled={enabledSections.has('slsize')} onToggleEnable={() => toggleSectionEnabled('slsize')} isRangeInput={true}>
                                         <div className="flex items-center gap-6">
                                            <input type="number" step="0.25" placeholder="Min" value={localFilters.minSLSize || ''} onChange={e => setLocalFilters(prev => ({ ...prev, minSLSize: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                            <input type="number" step="0.25" placeholder="Max" value={localFilters.maxSLSize || ''} onChange={e => setLocalFilters(prev => ({ ...prev, maxSLSize: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                        </div>
                                    </FilterSection>

                                    <FilterSection id="actualrisk" label="Actual Risk (Points)" isEnabled={enabledSections.has('actualrisk')} onToggleEnable={() => toggleSectionEnabled('actualrisk')} isRangeInput={true}>
                                         <div className="flex items-center gap-6">
                                            <input type="number" step="0.25" placeholder="Min" value={localFilters.minActualRisk || ''} onChange={e => setLocalFilters(prev => ({ ...prev, minActualRisk: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                            <input type="number" step="0.25" placeholder="Max" value={localFilters.maxActualRisk || ''} onChange={e => setLocalFilters(prev => ({ ...prev, maxActualRisk: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                        </div>
                                    </FilterSection>

                                    <FilterSection id="actualriskpct" label="Actual Risk %" isEnabled={enabledSections.has('actualriskpct')} onToggleEnable={() => toggleSectionEnabled('actualriskpct')} isRangeInput={true}>
                                         <div className="flex items-center gap-6">
                                            <input type="number" placeholder="Min" value={localFilters.minActualRiskPct || ''} onChange={e => setLocalFilters(prev => ({ ...prev, minActualRiskPct: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                            <input type="number" placeholder="Max" value={localFilters.maxActualRiskPct || ''} onChange={e => setLocalFilters(prev => ({ ...prev, maxActualRiskPct: e.target.value ? Number(e.target.value) : undefined }))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                                        </div>
                                    </FilterSection>
                                </div>
                            )}

                            {activeCategory === 'tags' && (
                                <div>{tagCategories.map(cat => (
                                    <FilterSection key={cat.id} id={`tag-${cat.id}`} label={cat.name} isEnabled={enabledSections.has(`tag-${cat.id}`)} onToggleEnable={() => toggleSectionEnabled(`tag-${cat.id}`)} isDropdownOpen={openDropdowns.has(`tag-${cat.id}`)} onToggleDropdown={() => setOpenDropdowns(d => new Set(d.has(`tag-${cat.id}`) ? [] : [`tag-${cat.id}`]))} summaryText={formatSummary(tags.filter(t => t.categoryId === cat.id && localFilters.tagIds.includes(t.id)).map(t => t.name), 0, cat.name)}>
                                        <div className="flex flex-col">{tags.filter(t => t.categoryId === cat.id).map(tag => <SubCheckbox key={tag.id} label={tag.name} checked={localFilters.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />)}</div>
                                    </FilterSection>
                                ))}</div>
                            )}

                            {activeCategory === 'time' && (
                                <div>
                                    <FilterSection id="days" label="Days of Week" isEnabled={enabledSections.has('days')} onToggleEnable={() => toggleSectionEnabled('days')} isDropdownOpen={openDropdowns.has('days')} onToggleDropdown={() => setOpenDropdowns(d => new Set(d.has('days') ? [] : ['days']))} summaryText={formatSummary(localFilters.daysOfWeek.map(i => ['Mon','Tue','Wed','Thu','Fri'][i-1] || ''), 5, 'Days')}>
                                         <div className="grid grid-cols-1 gap-1">
                                            {[{n:'Mon',v:1},{n:'Tue',v:2},{n:'Wed',v:3},{n:'Thu',v:4},{n:'Fri',v:5}].map(d => <SubCheckbox key={d.v} label={d.n} checked={localFilters.daysOfWeek.includes(d.v)} onChange={() => toggleDay(d.v)} />)}
                                        </div>
                                    </FilterSection>
                                    <FilterSection id="timerange" label="Entry Time" isEnabled={enabledSections.has('timerange')} onToggleEnable={() => toggleSectionEnabled('timerange')} isRangeInput={true}>
                                        <div className="flex items-center gap-6">
                                            <input type="time" value={localFilters.startTime || ''} onChange={e => setLocalFilters(p => ({...p, startTime: e.target.value}))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                                            <input type="time" value={localFilters.endTime || ''} onChange={e => setLocalFilters(p => ({...p, endTime: e.target.value}))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                                        </div>
                                    </FilterSection>
                                    <FilterSection id="exittimerange" label="Exit Time" isEnabled={enabledSections.has('exittimerange')} onToggleEnable={() => toggleSectionEnabled('exittimerange')} isRangeInput={true}>
                                        <div className="flex items-center gap-6">
                                            <input type="time" value={localFilters.exitStartTime || ''} onChange={e => setLocalFilters(p => ({...p, exitStartTime: e.target.value}))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                                            <input type="time" value={localFilters.exitEndTime || ''} onChange={e => setLocalFilters(p => ({...p, exitEndTime: e.target.value}))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                                        </div>
                                    </FilterSection>
                                    <FilterSection id="duration" label="Duration (Mins)" isEnabled={enabledSections.has('duration')} onToggleEnable={() => toggleSectionEnabled('duration')} isRangeInput={true}>
                                        <div className="flex items-center gap-6">
                                            <input type="number" placeholder="Min" value={localFilters.minDuration || ''} onChange={e => setLocalFilters(p => ({...p, minDuration: e.target.value ? Number(e.target.value) : undefined}))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                                            <input type="number" placeholder="Max" value={localFilters.maxDuration || ''} onChange={e => setLocalFilters(p => ({...p, maxDuration: e.target.value ? Number(e.target.value) : undefined}))} className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                                        </div>
                                    </FilterSection>
                                </div>
                            )}

                            {activeCategory === 'playbook' && (
                                <div>
                                    <button onClick={() => setIncludeRules(!includeRules)} className={`flex items-center justify-center gap-2 w-1/4 py-2 mb-8 rounded-xl border transition-all font-bold text-sm shadow-lg ${includeRules ? 'bg-primary border-primary text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}><ListChecks size={18} /><span>Rules</span></button>
                                    {strategies.map(st => (
                                        <FilterSection 
                                            key={st.id} id={`strat-${st.id}`} label={st.name} isEnabled={enabledSections.has(`strat-${st.id}`)} onToggleEnable={() => toggleSectionEnabled(`strat-${st.id}`)} 
                                            isDropdownOpen={includeRules && openDropdowns.has(`strat-${st.id}`)} onToggleDropdown={() => setOpenDropdowns(d => new Set(d.has(`strat-${st.id}`) ? [] : [`strat-${st.id}`]))} 
                                            summaryText={includeRules ? formatSummary(getReadableRuleTexts(st), 0, 'Rules') : st.name} 
                                            canExpand={includeRules} showSelectionBox={includeRules}
                                        >
                                            {includeRules && <div className="flex flex-col gap-3">{st.rules?.map((group, gIdx) => (typeof group !== 'string' && group.items.length > 0) && <div key={group.id || gIdx} className="flex flex-col"><div className="text-xs font-bold text-slate-500 uppercase px-2 mb-1">{group.name}</div>{group.items.map(item => <SubCheckbox key={item.id} label={item.text} checked={localFilters.ruleIds.includes(item.id)} onChange={() => toggleRule(item.id)} />)}</div>)}</div>}
                                        </FilterSection>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="h-16 px-6 border-t border-slate-700 bg-[#1f2937] flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={handleReset} className="text-sm font-medium text-slate-400 hover:text-white transition-colors mr-2">Reset all</button>
                        
                        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                             <button 
                                onClick={() => setFilterLogic('AND')}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${filterLogic === 'AND' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Matches ALL categories"
                             >
                                <ListFilter size={10} /> AND
                             </button>
                             <button 
                                onClick={() => setFilterLogic('OR')}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${filterLogic === 'OR' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Matches ANY category"
                             >
                                <Layers size={10} /> OR
                             </button>
                        </div>

                        <button 
                            onClick={() => setExcludeMode(!excludeMode)} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-md ${excludeMode ? 'bg-red-500 border-red-400 text-white shadow-red-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                            <Ban size={14} /> Exclude
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleApply} className="px-5 py-2 rounded-lg bg-primary hover:bg-indigo-600 text-white text-sm font-bold shadow-lg transition-colors">Apply</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
