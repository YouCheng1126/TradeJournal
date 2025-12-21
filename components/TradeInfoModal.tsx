import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Image as ImageIcon, Save, Trash2, CheckSquare, Square, ChevronDown, ArrowUp, ArrowDown, Check, AlertTriangle } from 'lucide-react';
import { Trade, TradeDirection, TradeStatus } from '../types';
import { useTrades } from '../contexts/TradeContext';
import { calculatePnL, formatCurrency, calculateRMultiple } from '../utils/calculations';

interface TradeInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    trade: Trade;
}

type Tab = 'Stats' | 'Strategy' | 'Tags';

export const TradeInfoModal: React.FC<TradeInfoModalProps> = ({ isOpen, onClose, trade: initialTrade }) => {
    const { updateTrade, deleteTrade, strategies, tagCategories, tags } = useTrades();
    const [activeTab, setActiveTab] = useState<Tab>('Stats');
    
    // Local state for editing
    const [formData, setFormData] = useState<Trade>(initialTrade);
    const [isDirty, setIsDirty] = useState(false);

    // Dropdown States - managed centrally for "click outside to close"
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    // Delete Confirmation State
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Reset when trade changes
    useEffect(() => {
        setFormData(initialTrade);
        setIsDirty(false);
        setIsDeleteConfirmOpen(false);
    }, [initialTrade, isOpen]);

    // Global Click Listener to close dropdowns
    useEffect(() => {
        const handleGlobalClick = () => {
            setOpenDropdown(null);
        };
        if (isOpen) {
            window.addEventListener('click', handleGlobalClick);
        }
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [isOpen]);

    const toggleDropdown = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent global click from closing it immediately
        setOpenDropdown(prev => prev === id ? null : id);
    };

    // Handle Input Changes
    const handleChange = (field: keyof Trade, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        await updateTrade(formData);
        setIsDirty(false);
        onClose();
    };

    const handleDeleteClick = () => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        await deleteTrade(formData.id);
        setIsDeleteConfirmOpen(false);
        onClose();
    };

    // --- Calculations ---
    const netPnL = calculatePnL(formData);
    
    // Multiplier logic locally
    const getMultiplier = (symbol: string) => {
        const s = symbol.toUpperCase();
        if (s.includes('MES')) return 5;
        if (s.includes('MNQ')) return 2;
        if (s === 'ES') return 50;
        if (s === 'NQ') return 20;
        return 1;
    };
    
    const multiplier = getMultiplier(formData.symbol);
    const qty = formData.quantity;
    const entry = formData.entryPrice;
    
    // 1. RR (Planned R-Multiple)
    const rr = calculateRMultiple(formData);

    // 2. Actual Risk Calculation
    // Check if we have necessary data
    const hasRiskParams = formData.initialStopLoss !== undefined && formData.initialStopLoss !== 0;
    
    let initialRiskAmt = 0;
    if (hasRiskParams) {
        initialRiskAmt = Math.abs(entry - (formData.initialStopLoss || 0)) * qty * multiplier;
    }

    let actualRiskAmt = 0;
    const hasExtremes = formData.highestPriceReached !== undefined && formData.lowestPriceReached !== undefined;

    if (formData.direction === TradeDirection.LONG) {
        const low = formData.lowestPriceReached ?? entry; 
        actualRiskAmt = (entry - low) * qty * multiplier;
    } else {
        const high = formData.highestPriceReached ?? entry;
        actualRiskAmt = (high - entry) * qty * multiplier;
    }
    if (actualRiskAmt < 0) actualRiskAmt = 0;

    const actualRiskPct = initialRiskAmt > 0 ? (actualRiskAmt / initialRiskAmt) * 100 : 0;

    // 3. Best P&L / Best RR
    let bestPnL = 0;
    if (formData.direction === TradeDirection.LONG) {
        const high = formData.highestPriceReached ?? entry;
        bestPnL = (high - entry) * qty * multiplier;
    } else {
        const low = formData.lowestPriceReached ?? entry;
        bestPnL = (entry - low) * qty * multiplier;
    }
    
    const bestRR = initialRiskAmt > 0 ? bestPnL / initialRiskAmt : 0;

    // Dates
    const entryDateObj = new Date(formData.entryDate);
    const dateStr = entryDateObj.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = entryDateObj.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });

    // Exit Time
    let exitTimeStr = null;
    if (formData.exitDate) {
         const exitDateObj = new Date(formData.exitDate);
         exitTimeStr = exitDateObj.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // Dynamic Styling
    const pnlColor = netPnL >= 0 ? 'text-emerald-400' : 'text-red-400';
    const borderPnlColor = netPnL >= 0 ? 'border-emerald-500' : 'border-red-500';
    
    // Ghost Input Style - Reduced py to 0.5 for more compact height
    const ghostInputClass = "w-full text-left bg-transparent border border-transparent hover:border-slate-600 hover:bg-slate-800 focus:border-primary focus:bg-slate-800 rounded px-2 py-0.5 text-sm font-medium transition-all outline-none";
    const labelClass = "text-sm font-medium text-slate-500";
    const rowClass = "grid grid-cols-[55%_45%] items-center py-0.5 pr-4"; 

    // Custom Dropdown Button Style - Reduced py to 0.5 and px to 2
    const dropdownBtnClass = "w-full flex items-center justify-between bg-transparent border border-transparent hover:border-slate-600 hover:bg-slate-800 text-sm font-bold text-white transition-colors py-0.5 px-2 rounded cursor-pointer";

    // Strategy Rules Calculation
    const currentStrategy = strategies.find(s => s.id === formData.playbookId);
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

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1f2937] w-[1545px] h-[728px] rounded-2xl border border-slate-700 shadow-2xl flex overflow-hidden relative">
                
                <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-slate-700 rounded-full text-white transition-colors">
                    <X size={20} />
                </button>

                {/* Delete Confirmation Overlay */}
                {isDeleteConfirmOpen && (
                    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-[#1f2937] border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                             <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 ring-4 ring-red-500/5">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Delete Trade?</h3>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                                Are you sure you want to delete this trade?<br/>This action cannot be undone.
                            </p>
                            <div className="flex gap-4 justify-center">
                                <button 
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    className="px-6 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:bg-slate-700 transition-all flex-1"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleConfirmDelete}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-500/20 transition-all flex-1"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- LEFT COLUMN (25%) --- */}
                <div className="w-[25%] border-r border-slate-700 flex flex-col bg-[#1f2937]">
                    
                    <div className="flex border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                        {['Stats', 'Strategy', 'Tags'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as Tab)}
                                className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors relative ${activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>}
                            </button>
                        ))}
                    </div>

                    {/* Left Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                        
                        {activeTab === 'Stats' && (
                            <div className="mb-2 flex justify-between items-start">
                                <div className={`pl-4 border-l-4 ${borderPnlColor}`}>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Net P&L</p>
                                    <h2 className={`text-5xl font-bold tracking-tight ${pnlColor}`}>
                                        {formatCurrency(netPnL)}
                                    </h2>
                                </div>
                                <div className="text-right pt-1">
                                    <div className="text-lg font-bold text-slate-300">{dateStr}</div>
                                    <div className="flex flex-col items-end mt-1 gap-0.5">
                                        <div className="text-sm font-medium text-slate-500">{timeStr}</div>
                                        {exitTimeStr && <div className="text-sm font-medium text-slate-500">{exitTimeStr}</div>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Stats' && (
                            // Increased gap from 1 to 2
                            <div className="flex flex-col gap-2">
                                <div className={rowClass}>
                                    <label className={labelClass}>Symbol</label>
                                    <input 
                                        type="text" 
                                        value={formData.symbol} 
                                        onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
                                        className={`${ghostInputClass} text-white`}
                                    />
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Quantity</label>
                                    <input 
                                        type="number" 
                                        value={formData.quantity} 
                                        onChange={(e) => handleChange('quantity', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-white`}
                                    />
                                </div>
                                
                                <div className={rowClass}>
                                    <label className={labelClass}>Side</label>
                                    <div className="relative w-full">
                                        <button 
                                            onClick={(e) => toggleDropdown('side', e)}
                                            className={dropdownBtnClass}
                                        >
                                            <span className={formData.direction === TradeDirection.LONG ? 'text-emerald-400' : 'text-red-400'}>
                                                {formData.direction.toUpperCase()}
                                            </span>
                                            <ChevronDown size={14} className="text-slate-500"/>
                                        </button>
                                        {openDropdown === 'side' && (
                                            <div 
                                                className="absolute left-0 top-full mt-1 w-full bg-[#1f2937] border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {[TradeDirection.LONG, TradeDirection.SHORT].map(dir => (
                                                    <button 
                                                        key={dir}
                                                        onClick={() => { handleChange('direction', dir); setOpenDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-2"
                                                    >
                                                        {dir === TradeDirection.LONG ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                                                        {dir}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={rowClass}>
                                    <label className={labelClass}>Status</label>
                                    <div className="relative w-full">
                                        <button 
                                            onClick={(e) => toggleDropdown('status', e)}
                                            className={dropdownBtnClass}
                                        >
                                            <span className={
                                                formData.status === TradeStatus.WIN ? 'text-emerald-400' : 
                                                formData.status === TradeStatus.LOSS ? 'text-red-400' : 
                                                formData.status === TradeStatus.BREAK_EVEN ? 'text-slate-300' : 
                                                formData.status.includes('Win') ? 'text-emerald-300' : 'text-red-300'
                                            }>
                                                {formData.status}
                                            </span>
                                            <ChevronDown size={14} className="text-slate-500"/>
                                        </button>
                                        {openDropdown === 'status' && (
                                            <div 
                                                className="absolute left-0 top-full mt-1 w-full bg-[#1f2937] border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {Object.values(TradeStatus).map(s => (
                                                    <button 
                                                        key={s}
                                                        onClick={() => { handleChange('status', s); setOpenDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-slate-300 hover:text-white"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={rowClass}>
                                    <label className={labelClass}>Entry Price</label>
                                    <input 
                                        type="number" step="0.25"
                                        value={formData.entryPrice} 
                                        onChange={(e) => handleChange('entryPrice', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-white`}
                                    />
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Exit Price</label>
                                    <input 
                                        type="number" step="0.25"
                                        value={formData.exitPrice || ''} 
                                        onChange={(e) => handleChange('exitPrice', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-white font-bold`}
                                    />
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Stop Loss</label>
                                    <input 
                                        type="number" step="0.25"
                                        value={formData.initialStopLoss || ''} 
                                        onChange={(e) => handleChange('initialStopLoss', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-white`}
                                    />
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>MFE (Max Profit)</label>
                                    <input 
                                        type="number" step="0.25"
                                        value={formData.direction === TradeDirection.LONG ? formData.highestPriceReached : formData.lowestPriceReached} 
                                        onChange={(e) => handleChange(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-emerald-400 font-bold`}
                                    />
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>MAE (Max Loss)</label>
                                    <input 
                                        type="number" step="0.25"
                                        value={formData.direction === TradeDirection.LONG ? formData.lowestPriceReached : formData.highestPriceReached} 
                                        onChange={(e) => handleChange(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-red-400 font-bold`}
                                    />
                                </div>

                                <div className={rowClass}>
                                    <label className={labelClass}>Commissions</label>
                                    <input 
                                        type="number" step="0.01"
                                        value={formData.commission} 
                                        onChange={(e) => handleChange('commission', parseFloat(e.target.value))}
                                        className={`${ghostInputClass} text-white`}
                                    />
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>RR</label>
                                    <span className="text-sm font-bold text-slate-200 px-2 text-left w-full block">{rr !== undefined ? `${rr}R` : '--'}</span>
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Actual Risk</label>
                                    <span className="text-sm font-bold text-red-400 px-2 text-left w-full block">{hasExtremes ? formatCurrency(actualRiskAmt) : '--'}</span>
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Actual Risk %</label>
                                    <span className="text-sm font-bold text-slate-200 px-2 text-left w-full block">{hasExtremes && initialRiskAmt > 0 ? `${actualRiskPct.toFixed(1)}%` : '--'}</span>
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Best P&L</label>
                                    <span className="text-sm font-bold text-emerald-400 px-2 text-left w-full block">{hasExtremes ? formatCurrency(bestPnL) : '--'}</span>
                                </div>
                                <div className={rowClass}>
                                    <label className={labelClass}>Best RR</label>
                                    <span className="text-sm font-bold text-slate-200 px-2 text-left w-full block">{hasExtremes && initialRiskAmt > 0 ? `${bestRR.toFixed(2)}R` : '--'}</span>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Strategy' && (
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
                                            <ChevronDown size={14} className="text-slate-500"/>
                                        </button>
                                        {openDropdown === 'strategy' && (
                                            <div 
                                                className="absolute left-0 top-full mt-1 w-full bg-[#1f2937] border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {strategies.map(s => (
                                                    <button 
                                                        key={s.id}
                                                        onClick={() => { handleChange('playbookId', s.id); setOpenDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-slate-300 hover:text-white"
                                                    >
                                                        {s.name}
                                                    </button>
                                                ))}
                                                <button onClick={() => { handleChange('playbookId', ''); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-slate-500 hover:text-slate-300 border-t border-slate-700">None</button>
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

                                        <div className="space-y-6">
                                            {currentStrategy?.rules?.map((group: any) => {
                                                if(typeof group === 'string') return null;
                                                return (
                                                    <div key={group.id}>
                                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1">{group.name}</h4>
                                                        <div className="space-y-1">
                                                            {group.items.map((item: any) => {
                                                                const isChecked = (formData.rulesFollowed || []).includes(item.id);
                                                                return (
                                                                    <button 
                                                                        key={item.id} 
                                                                        onClick={() => {
                                                                            const current = formData.rulesFollowed || [];
                                                                            const next = current.includes(item.id) ? current.filter(x => x !== item.id) : [...current, item.id];
                                                                            handleChange('rulesFollowed', next);
                                                                        }}
                                                                        className="w-full text-left flex items-start gap-3 p-2 rounded hover:bg-slate-800 transition-colors group"
                                                                    >
                                                                        <div className={isChecked ? "text-primary mt-0.5" : "text-slate-600 mt-0.5 group-hover:text-slate-500"}>
                                                                            {isChecked ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                                        </div>
                                                                        <span className={`text-sm ${isChecked ? 'text-white' : 'text-slate-400'}`}>{item.text}</span>
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
                        )}

                        {activeTab === 'Tags' && (
                            <div className="space-y-8">
                                {tagCategories.map(cat => {
                                    const catTags = tags.filter(t => t.categoryId === cat.id);
                                    if (catTags.length === 0) return null;
                                    
                                    const selectedInCat = catTags.filter(t => (formData.tags || []).includes(t.id));
                                    const dropdownId = `cat-${cat.id}`;

                                    return (
                                        <div key={cat.id} className="space-y-2">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${cat.color}`}></div>
                                                {cat.name}
                                            </h3>
                                            
                                            <div className="relative">
                                                <button 
                                                    onClick={(e) => toggleDropdown(dropdownId, e)}
                                                    className="flex items-center justify-between w-full bg-slate-800/50 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 transition-colors"
                                                >
                                                    <span className="text-sm text-slate-300">
                                                        {selectedInCat.length > 0 
                                                            ? selectedInCat.map(t => t.name).join(', ') 
                                                            : <span className="text-slate-500 italic">Select {cat.name.toLowerCase()}...</span>
                                                        }
                                                    </span>
                                                    <ChevronDown size={14} className="text-slate-500"/>
                                                </button>

                                                {openDropdown === dropdownId && (
                                                    <div 
                                                        className="absolute left-0 top-full mt-1 w-full bg-[#1f2937] border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {catTags.map(tag => {
                                                            const isSelected = (formData.tags || []).includes(tag.id);
                                                            return (
                                                                <button 
                                                                    key={tag.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const current = formData.tags || [];
                                                                        const next = current.includes(tag.id) 
                                                                            ? current.filter(x => x !== tag.id) 
                                                                            : [...current, tag.id];
                                                                        handleChange('tags', next);
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-700 transition-colors ${isSelected ? 'text-white bg-slate-700/50' : 'text-slate-400'}`}
                                                                >
                                                                    <span>{tag.name}</span>
                                                                    {isSelected && <Check size={14} className="text-primary"/>}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {tagCategories.length === 0 && <div className="text-slate-500 italic text-center mt-10">No tag categories defined.</div>}
                            </div>
                        )}

                    </div>

                    <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-between items-center flex-shrink-0">
                        <button onClick={handleDeleteClick} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete Trade">
                            <Trash2 size={18} />
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={!isDirty}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all ${isDirty ? 'bg-primary hover:bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed'}`}
                        >
                            <Save size={16} /> Save Changes
                        </button>
                    </div>

                </div>

                <div className="w-[75%] bg-[#0f1218] flex items-center justify-center relative overflow-hidden">
                    
                    {formData.screenshotUrl ? (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden bg-black/20">
                             <img 
                                src={formData.screenshotUrl} 
                                alt="Trade Screenshot" 
                                className="h-full w-[120%] max-w-none object-contain -ml-[20%]"
                            />
                            
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-slate-600 rounded-full px-4 py-2 flex items-center gap-4 opacity-0 hover:opacity-100 transition-opacity z-20">
                                <a href={formData.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary transition-colors" title="Open Original">
                                    <ExternalLink size={18} />
                                </a>
                                <div className="w-px h-4 bg-slate-500"></div>
                                <button onClick={() => handleChange('screenshotUrl', '')} className="text-white hover:text-red-400 transition-colors" title="Remove Image">
                                    <Trash2 size={18} />
                                </button>
                                <div className="w-px h-4 bg-slate-500"></div>
                                <button onClick={() => {
                                    const url = prompt("Edit Image URL:", formData.screenshotUrl);
                                    if(url !== null) handleChange('screenshotUrl', url);
                                }} className="text-white hover:text-blue-400 transition-colors text-xs font-semibold">
                                    Change URL
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8">
                            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                                <ImageIcon size={48} className="text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-300 mb-2">No Screenshot</h3>
                            <p className="text-sm text-slate-500 mb-6">Add a screenshot to analyze your execution.</p>
                            
                            <div className="w-full max-w-md">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Paste image URL here (e.g. TradingView Link)..."
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-primary outline-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const target = e.target as HTMLInputElement;
                                                handleChange('screenshotUrl', target.value);
                                            }
                                        }}
                                    />
                                    <button 
                                        className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                                        onClick={(e) => {
                                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                            handleChange('screenshotUrl', input.value);
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
};