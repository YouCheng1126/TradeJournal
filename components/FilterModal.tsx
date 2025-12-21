import React, { useState, useEffect, useMemo } from 'react';
import { X, Filter, Check, SlidersHorizontal, Tag, Clock, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
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
    if (selectedLabels.length === totalCount) return `All ${prefix}`;
    
    // Join names without length limit as requested
    return selectedLabels.join(', ');
};

// --- Helper Components ---

interface FilterSectionProps {
    id: string;
    label: string;
    isEnabled: boolean;
    onToggleEnable: () => void;
    // Selection Box Props
    isDropdownOpen?: boolean;
    onToggleDropdown?: () => void;
    summaryText?: string;
    // Content
    children?: React.ReactNode;
    // For range inputs which don't have a dropdown list but just content
    isRangeInput?: boolean; 
}

const FilterSection: React.FC<FilterSectionProps> = ({
    id, label, isEnabled, onToggleEnable, 
    isDropdownOpen, onToggleDropdown, summaryText, 
    children, isRangeInput = false
}) => {
    return (
        <div className="flex flex-col gap-2 mb-6" data-section-id={id}>
            {/* 1. Parent Checkbox & Label */}
            <label className="flex items-center gap-3 cursor-pointer group select-none">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isEnabled ? 'bg-primary border-primary' : 'bg-slate-800 border-slate-600 group-hover:border-slate-500'}`}>
                    {isEnabled && <Check size={14} className="text-white" />}
                </div>
                <span className={`text-sm font-semibold ${isEnabled ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                    {label}
                </span>
                <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={isEnabled} 
                    onChange={onToggleEnable} 
                />
            </label>

            {/* 2. Content (Only if enabled) */}
            {isEnabled && (
                <div className="pl-8 animate-in slide-in-from-top-1 duration-200">
                    {isRangeInput ? (
                        // Direct content for inputs like Volume/Time
                        <div className="w-full">
                            {children}
                        </div>
                    ) : (
                        // Dropdown trigger style for Lists
                        <div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onToggleDropdown && onToggleDropdown(); }}
                                className={`w-full flex items-center justify-between bg-[#111827] border border-slate-700 rounded-lg px-4 py-3 text-sm transition-colors hover:border-slate-600 ${isDropdownOpen ? 'ring-1 ring-primary border-primary' : ''}`}
                            >
                                <span className={summaryText?.startsWith('All') ? 'text-slate-400' : 'text-white truncate'}>
                                    {summaryText || 'Select...'}
                                </span>
                                {isDropdownOpen ? <ChevronUp size={16} className="text-slate-500 flex-shrink-0"/> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0"/>}
                            </button>

                            {/* 3. Dropdown Content */}
                            {isDropdownOpen && (
                                <div className="mt-1 bg-[#111827] border border-slate-700 rounded-lg p-2 max-h-60 overflow-y-auto custom-scrollbar shadow-lg">
                                    {children}
                                </div>
                            )}
                        </div>
                    )}
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
    
    // UI State: Which sections are "Enabled" (Checked)
    const [enabledSections, setEnabledSections] = useState<Set<string>>(new Set());
    // UI State: Which dropdowns are currently open
    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

    // Initialize UI state based on current filters when opening
    useEffect(() => {
        if (isOpen) {
            setLocalFilters(filters);
            const initialEnabled = new Set<string>();
            const initialOpen = new Set<string>();

            if (filters.status.length > 0) initialEnabled.add('status');
            if (filters.direction.length > 0) initialEnabled.add('side');
            if (filters.minVolume || filters.maxVolume) initialEnabled.add('volume');
            if (filters.minPnL || filters.maxPnL) initialEnabled.add('pnl');
            if (filters.tagIds.length > 0) {
                 tagCategories.forEach(c => {
                     const catTags = tags.filter(t => t.categoryId === c.id).map(t => t.id);
                     if (catTags.some(id => filters.tagIds.includes(id))) {
                         initialEnabled.add(`tag-${c.id}`);
                     }
                 });
            }
            if (filters.daysOfWeek.length > 0) initialEnabled.add('days');
            if (filters.startTime || filters.endTime) initialEnabled.add('timerange');
            
            // Strategies logic: Enable section if the strategy ID is present
            if (filters.strategyIds.length > 0) {
                filters.strategyIds.forEach(id => initialEnabled.add(`strat-${id}`));
            }

            setEnabledSections(initialEnabled);
            setOpenDropdowns(initialOpen);
        }
    }, [isOpen, filters, tagCategories, tags]);

    // Global Click Listener for closing dropdowns
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as Element;
            // Check if click is inside any active filter section
            // We use data-section-id attribute to identify the section
            const clickedSection = target.closest('[data-section-id]');
            const clickedSectionId = clickedSection?.getAttribute('data-section-id');

            setOpenDropdowns(prev => {
                if (prev.size === 0) return prev;
                
                const next = new Set(prev);
                // Iterate over all currently open dropdowns
                prev.forEach(id => {
                    // If the click was NOT inside the section of this dropdown, close it.
                    // This creates a "click outside to close" effect.
                    if (id !== clickedSectionId) {
                        next.delete(id);
                    }
                });
                return next.size === prev.size ? prev : next;
            });
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        }
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleApply = () => {
        const finalFilters = { ...localFilters };

        if (!enabledSections.has('status')) finalFilters.status = [];
        if (!enabledSections.has('side')) finalFilters.direction = [];
        if (!enabledSections.has('volume')) { finalFilters.minVolume = undefined; finalFilters.maxVolume = undefined; }
        if (!enabledSections.has('pnl')) { finalFilters.minPnL = undefined; finalFilters.maxPnL = undefined; }
        
        // Reconstruct tags based on enabled categories
        if (tagCategories.length > 0) {
            const enabledTagIds: string[] = [];
            tagCategories.forEach(c => {
                if (enabledSections.has(`tag-${c.id}`)) {
                    const catTagIds = tags.filter(t => t.categoryId === c.id).map(t => t.id);
                    const selectedInCat = localFilters.tagIds.filter(id => catTagIds.includes(id));
                    enabledTagIds.push(...selectedInCat);
                }
            });
            finalFilters.tagIds = enabledTagIds;
        }

        if (!enabledSections.has('days')) finalFilters.daysOfWeek = [];
        if (!enabledSections.has('timerange')) { finalFilters.startTime = ''; finalFilters.endTime = ''; }

        // Reconstruct strategies & rules based on enabled sections
        const enabledStrategyIds: string[] = [];
        const enabledRuleIds: string[] = [];

        strategies.forEach(st => {
            if (enabledSections.has(`strat-${st.id}`)) {
                enabledStrategyIds.push(st.id);
                // Get rules selected for this strategy
                const allRuleIdsForStrat: string[] = [];
                st.rules?.forEach(g => {
                    if (typeof g !== 'string') {
                        g.items.forEach(i => allRuleIdsForStrat.push(i.id));
                    }
                });
                
                // Add the ones currently in localFilters (if they match this strategy)
                const selected = localFilters.ruleIds.filter(rId => allRuleIdsForStrat.includes(rId));
                enabledRuleIds.push(...selected);
            }
        });
        
        finalFilters.strategyIds = enabledStrategyIds;
        finalFilters.ruleIds = enabledRuleIds;

        setFilters(finalFilters);
        onClose();
    };

    const handleReset = () => {
        const reset: GlobalFilterState = {
            status: [],
            direction: [],
            strategyIds: [],
            ruleIds: [],
            tagIds: [],
            daysOfWeek: [],
            startTime: '',
            endTime: '',
            minVolume: undefined,
            maxVolume: undefined,
            minPnL: undefined,
            maxPnL: undefined
        };
        setLocalFilters(reset);
        setEnabledSections(new Set());
        setOpenDropdowns(new Set());
    };

    // --- Toggles ---

    const toggleSectionEnabled = (id: string) => {
        setEnabledSections(prev => {
            const next = new Set(prev);
            const isEnabling = !prev.has(id);
            
            if (isEnabling) {
                next.add(id);
                // --- Auto Select All Logic ---
                if (id === 'status') setLocalFilters(p => ({...p, status: Object.values(TradeStatus)}));
                if (id === 'side') setLocalFilters(p => ({...p, direction: [TradeDirection.LONG, TradeDirection.SHORT]}));
                if (id === 'days') setLocalFilters(p => ({...p, daysOfWeek: [0, 1, 2, 3, 4, 5, 6]}));
                
                if (id.startsWith('tag-')) {
                    const catId = id.replace('tag-', '');
                    const catTags = tags.filter(t => t.categoryId === catId).map(t => t.id);
                    setLocalFilters(p => ({
                        ...p,
                        tagIds: Array.from(new Set([...p.tagIds, ...catTags]))
                    }));
                }
                
                // Strategy: Select Strategy + All Rules
                if (id.startsWith('strat-')) {
                    const sId = id.replace('strat-', '');
                    const st = strategies.find(s => s.id === sId);
                    if (st && st.rules) {
                        const allRules: string[] = [];
                        st.rules.forEach(g => {
                            if (typeof g !== 'string') g.items.forEach(i => allRules.push(i.id));
                        });
                        
                        setLocalFilters(p => ({
                            ...p,
                            strategyIds: Array.from(new Set([...p.strategyIds, sId])),
                            ruleIds: Array.from(new Set([...p.ruleIds, ...allRules]))
                        }));
                    }
                }

            } else {
                next.delete(id);
                // --- Clear Logic ---
                if (id === 'status') setLocalFilters(p => ({...p, status: []}));
                if (id === 'side') setLocalFilters(p => ({...p, direction: []}));
                if (id === 'days') setLocalFilters(p => ({...p, daysOfWeek: []}));
                
                if (id.startsWith('tag-')) {
                    const catId = id.replace('tag-', '');
                    const catTags = tags.filter(t => t.categoryId === catId).map(t => t.id);
                    setLocalFilters(p => ({
                        ...p,
                        tagIds: p.tagIds.filter(tid => !catTags.includes(tid))
                    }));
                }

                if (id.startsWith('strat-')) {
                    const sId = id.replace('strat-', '');
                    const st = strategies.find(s => s.id === sId);
                    if (st && st.rules) {
                        const allRules: string[] = [];
                        st.rules.forEach(g => {
                             if (typeof g !== 'string') g.items.forEach(i => allRules.push(i.id));
                        });
                        setLocalFilters(p => ({
                            ...p,
                            strategyIds: p.strategyIds.filter(x => x !== sId),
                            ruleIds: p.ruleIds.filter(r => !allRules.includes(r))
                        }));
                    }
                }

                if (id === 'volume') setLocalFilters(p => ({...p, minVolume: undefined, maxVolume: undefined}));
                if (id === 'pnl') setLocalFilters(p => ({...p, minPnL: undefined, maxPnL: undefined}));
                if (id === 'timerange') setLocalFilters(p => ({...p, startTime: '', endTime: ''}));

                // Close dropdown if disabled
                setOpenDropdowns(d => {
                    const nextD = new Set(d);
                    nextD.delete(id);
                    return nextD;
                });
            }
            return next;
        });
    };

    const toggleDropdown = (id: string) => {
        setOpenDropdowns(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // --- Filter Logic ---

    const toggleStatus = (s: TradeStatus) => {
        setLocalFilters(prev => {
            const current = prev.status;
            return { ...prev, status: current.includes(s) ? current.filter(i => i !== s) : [...current, s] };
        });
    };

    const toggleDirection = (d: TradeDirection) => {
         setLocalFilters(prev => {
            const current = prev.direction;
            return { ...prev, direction: current.includes(d) ? current.filter(i => i !== d) : [...current, d] };
        });
    };

    const toggleDay = (dayIndex: number) => {
        setLocalFilters(prev => {
            const current = prev.daysOfWeek;
            return { ...prev, daysOfWeek: current.includes(dayIndex) ? current.filter(d => d !== dayIndex) : [...current, dayIndex] };
        });
    };

    const toggleTag = (id: string) => {
        setLocalFilters(prev => {
            const current = prev.tagIds;
            return { ...prev, tagIds: current.includes(id) ? current.filter(i => i !== id) : [...current, id] };
        });
    };

    const toggleRule = (id: string) => {
        setLocalFilters(prev => {
            const current = prev.ruleIds;
            return { ...prev, ruleIds: current.includes(id) ? current.filter(i => i !== id) : [...current, id] };
        });
    };

    // --- Badges ---
    const getCategoryBadgeCount = (cat: FilterCategory) => {
        let count = 0;
        if (cat === 'general') {
            if (enabledSections.has('status')) count++;
            if (enabledSections.has('side')) count++;
            if (enabledSections.has('volume')) count++;
            if (enabledSections.has('pnl')) count++;
        }
        if (cat === 'tags') {
            tagCategories.forEach(c => {
                if (enabledSections.has(`tag-${c.id}`)) count++;
            });
        }
        if (cat === 'time') {
             if (enabledSections.has('days')) count++;
             if (enabledSections.has('timerange')) count++;
        }
        if (cat === 'playbook') {
            // Count each enabled strategy
             strategies.forEach(s => {
                 if (enabledSections.has(`strat-${s.id}`)) count++;
             });
        }
        return count;
    };

    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose}>
            <div 
                className="fixed top-16 left-0 md:left-64 bg-[#1f2937] w-full max-w-[500px] h-[500px] border border-slate-700 rounded-br-xl rounded-bl-xl shadow-2xl flex flex-col overflow-hidden z-[101] shadow-black/50"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="h-14 px-5 border-b border-slate-700 bg-[#1f2937] flex justify-between items-center flex-shrink-0">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Filter size={18} className="text-primary"/> 
                        Filters
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><X size={20}/></button>
                </div>

                {/* Body - Two Columns */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Left Sidebar (Navigation) - Width ~35% */}
                    <div className="w-[35%] border-r border-slate-700 bg-surface/50 p-3 space-y-1 overflow-y-auto">
                        {CATEGORIES.map(cat => {
                            const count = getCategoryBadgeCount(cat.id);
                            const isActive = activeCategory === cat.id;
                            const Icon = cat.icon;
                            
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                                        ${isActive 
                                            ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'} />
                                        <span>{cat.label}</span>
                                    </div>
                                    {count > 0 && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-primary'}`}></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Content (Filters List) - Width 65% */}
                    <div className="w-[65%] bg-[#1f2937] flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                            
                            {/* GENERAL CATEGORY */}
                            {activeCategory === 'general' && (
                                <div>
                                    {/* Status */}
                                    <FilterSection
                                        id="status"
                                        label="Status"
                                        isEnabled={enabledSections.has('status')}
                                        onToggleEnable={() => toggleSectionEnabled('status')}
                                        isDropdownOpen={openDropdowns.has('status')}
                                        onToggleDropdown={() => toggleDropdown('status')}
                                        summaryText={formatSummary(
                                            Object.values(TradeStatus).filter(s => localFilters.status.includes(s)), 
                                            Object.values(TradeStatus).length, 
                                            'Statuses'
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            {Object.values(TradeStatus).map(s => (
                                                <SubCheckbox 
                                                    key={s} 
                                                    label={s} 
                                                    checked={localFilters.status.includes(s)}
                                                    onChange={() => toggleStatus(s)}
                                                    colorClass={s.includes('Win') ? 'text-emerald-400' : s.includes('Loss') ? 'text-red-400' : ''}
                                                />
                                            ))}
                                        </div>
                                    </FilterSection>

                                    {/* Side */}
                                    <FilterSection
                                        id="side"
                                        label="Side"
                                        isEnabled={enabledSections.has('side')}
                                        onToggleEnable={() => toggleSectionEnabled('side')}
                                        isDropdownOpen={openDropdowns.has('side')}
                                        onToggleDropdown={() => toggleDropdown('side')}
                                        summaryText={formatSummary(
                                            [TradeDirection.LONG, TradeDirection.SHORT].filter(d => localFilters.direction.includes(d)), 
                                            2, 
                                            'Sides'
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            {[TradeDirection.LONG, TradeDirection.SHORT].map(d => (
                                                <SubCheckbox 
                                                    key={d} 
                                                    label={d} 
                                                    checked={localFilters.direction.includes(d)}
                                                    onChange={() => toggleDirection(d)}
                                                />
                                            ))}
                                        </div>
                                    </FilterSection>

                                    {/* Volume (Range Input) */}
                                    <FilterSection
                                        id="volume"
                                        label="Volume"
                                        isEnabled={enabledSections.has('volume')}
                                        onToggleEnable={() => toggleSectionEnabled('volume')}
                                        isRangeInput={true}
                                    >
                                         <div className="flex items-center gap-6">
                                            <input 
                                                type="number" 
                                                placeholder="Min" 
                                                value={localFilters.minVolume || ''}
                                                onChange={e => setLocalFilters(prev => ({ ...prev, minVolume: e.target.value ? Number(e.target.value) : undefined }))}
                                                className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Max" 
                                                value={localFilters.maxVolume || ''}
                                                onChange={e => setLocalFilters(prev => ({ ...prev, maxVolume: e.target.value ? Number(e.target.value) : undefined }))}
                                                className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                    </FilterSection>

                                     {/* PnL (Range Input) */}
                                     <FilterSection
                                        id="pnl"
                                        label="Net P&L"
                                        isEnabled={enabledSections.has('pnl')}
                                        onToggleEnable={() => toggleSectionEnabled('pnl')}
                                        isRangeInput={true}
                                    >
                                         <div className="flex items-center gap-6">
                                            <input 
                                                type="number" 
                                                placeholder="Min" 
                                                value={localFilters.minPnL || ''}
                                                onChange={e => setLocalFilters(prev => ({ ...prev, minPnL: e.target.value ? Number(e.target.value) : undefined }))}
                                                className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Max" 
                                                value={localFilters.maxPnL || ''}
                                                onChange={e => setLocalFilters(prev => ({ ...prev, maxPnL: e.target.value ? Number(e.target.value) : undefined }))}
                                                className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                    </FilterSection>
                                </div>
                            )}

                            {/* TAGS CATEGORY */}
                            {activeCategory === 'tags' && (
                                <div>
                                    {tagCategories.length === 0 && (
                                        <div className="text-center text-slate-500 text-sm italic mt-4">
                                            No tags configured.
                                        </div>
                                    )}
                                    {tagCategories.map(cat => {
                                        const catTags = tags.filter(t => t.categoryId === cat.id);
                                        if (catTags.length === 0) return null;
                                        
                                        // Sort by name if desired, or assume DB order (catTags order)
                                        const selectedLabels = catTags.filter(t => localFilters.tagIds.includes(t.id)).map(t => t.name);
                                        const summary = formatSummary(selectedLabels, catTags.length, cat.name);

                                        return (
                                            <FilterSection
                                                key={cat.id}
                                                id={`tag-${cat.id}`}
                                                label={cat.name}
                                                isEnabled={enabledSections.has(`tag-${cat.id}`)}
                                                onToggleEnable={() => toggleSectionEnabled(`tag-${cat.id}`)}
                                                isDropdownOpen={openDropdowns.has(`tag-${cat.id}`)}
                                                onToggleDropdown={() => toggleDropdown(`tag-${cat.id}`)}
                                                summaryText={summary}
                                            >
                                                <div className="flex flex-col">
                                                    {catTags.map(tag => (
                                                        <SubCheckbox 
                                                            key={tag.id}
                                                            label={tag.name}
                                                            checked={localFilters.tagIds.includes(tag.id)}
                                                            onChange={() => toggleTag(tag.id)}
                                                        />
                                                    ))}
                                                </div>
                                            </FilterSection>
                                        );
                                    })}
                                </div>
                            )}

                            {/* TIME CATEGORY */}
                            {activeCategory === 'time' && (
                                <div>
                                    {/* Days of Week */}
                                    <FilterSection
                                        id="days"
                                        label="Days of Week"
                                        isEnabled={enabledSections.has('days')}
                                        onToggleEnable={() => toggleSectionEnabled('days')}
                                        isDropdownOpen={openDropdowns.has('days')}
                                        onToggleDropdown={() => toggleDropdown('days')}
                                        summaryText={(() => {
                                            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                            // Sort numbers first
                                            const sortedSelection = [...localFilters.daysOfWeek].sort((a,b) => a - b);
                                            const selectedLabels = sortedSelection.map(i => days[i]);
                                            return formatSummary(selectedLabels, 7, 'Days');
                                        })()}
                                    >
                                         <div className="grid grid-cols-1 gap-1">
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, idx) => (
                                                <SubCheckbox 
                                                    key={d}
                                                    label={d}
                                                    checked={localFilters.daysOfWeek.includes(idx)}
                                                    onChange={() => toggleDay(idx)}
                                                />
                                            ))}
                                        </div>
                                    </FilterSection>

                                    {/* Time Range */}
                                    <FilterSection
                                        id="timerange"
                                        label="Entry Time"
                                        isEnabled={enabledSections.has('timerange')}
                                        onToggleEnable={() => toggleSectionEnabled('timerange')}
                                        isRangeInput={true}
                                    >
                                        <div className="flex items-center gap-6">
                                            <input 
                                                type="time" 
                                                value={localFilters.startTime || ''}
                                                onChange={e => setLocalFilters(prev => ({ ...prev, startTime: e.target.value }))}
                                                className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                            />
                                            <input 
                                                type="time" 
                                                value={localFilters.endTime || ''}
                                                onChange={e => setLocalFilters(prev => ({ ...prev, endTime: e.target.value }))}
                                                className="flex-1 min-w-0 bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                    </FilterSection>
                                </div>
                            )}

                            {/* PLAYBOOK CATEGORY (STRATEGIES & RULES) */}
                            {activeCategory === 'playbook' && (
                                <div>
                                    {strategies.length === 0 && (
                                        <div className="text-center text-slate-500 text-sm italic mt-4">
                                            No strategies defined.
                                        </div>
                                    )}
                                    {strategies.map(st => {
                                        const allRules: { id: string, text: string }[] = [];
                                        if (st.rules) {
                                            st.rules.forEach(g => {
                                                if (typeof g !== 'string') {
                                                    g.items.forEach(i => allRules.push({ id: i.id, text: i.text }));
                                                }
                                            });
                                        }

                                        // Summary calculation for this strategy
                                        // Filter allRules by selected, preserving allRules order
                                        const selectedLabels = allRules.filter(r => localFilters.ruleIds.includes(r.id)).map(r => r.text);
                                        const summary = formatSummary(selectedLabels, allRules.length, 'Rules');

                                        return (
                                            <FilterSection
                                                key={st.id}
                                                id={`strat-${st.id}`}
                                                label={st.name}
                                                isEnabled={enabledSections.has(`strat-${st.id}`)}
                                                onToggleEnable={() => toggleSectionEnabled(`strat-${st.id}`)}
                                                isDropdownOpen={openDropdowns.has(`strat-${st.id}`)}
                                                onToggleDropdown={() => toggleDropdown(`strat-${st.id}`)}
                                                summaryText={summary}
                                            >
                                                <div className="flex flex-col gap-3">
                                                    {st.rules?.map((group, gIdx) => {
                                                        if (typeof group === 'string') return null; // Ignore legacy string rules in UI
                                                        if (group.items.length === 0) return null;

                                                        return (
                                                            <div key={group.id || gIdx} className="flex flex-col">
                                                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-2">
                                                                    {group.name}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    {group.items.map(item => (
                                                                        <SubCheckbox 
                                                                            key={item.id}
                                                                            label={item.text}
                                                                            checked={localFilters.ruleIds.includes(item.id)}
                                                                            onChange={() => toggleRule(item.id)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {allRules.length === 0 && (
                                                        <p className="text-slate-500 italic text-xs px-2">No rules defined.</p>
                                                    )}
                                                </div>
                                            </FilterSection>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="h-16 px-6 border-t border-slate-700 bg-[#1f2937] flex justify-between items-center flex-shrink-0">
                    <button onClick={handleReset} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                        Reset all
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                            Cancel
                        </button>
                        <button onClick={handleApply} className="px-5 py-2 rounded-lg bg-primary hover:bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-colors">
                            Apply
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};