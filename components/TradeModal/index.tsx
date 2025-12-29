
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Save, FilePlus2 } from 'lucide-react';
import { Trade, TradeDirection, TradeStatus } from '../../types';
import { useTrades } from '../../contexts/TradeContext';
import { ImagePanel } from './ImagePanel';
import { StrategyPanel } from './StrategyPanel';
import { TagsPanel } from './TagsPanel';
import { EditStats } from './EditStats';
import { AddStats } from './AddStats';
import { validateTrade } from './DataRules';
import { addDays, isSameDay } from 'date-fns';

interface TradeInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    trade?: Trade; // Optional for Add Mode
    mode?: 'add' | 'edit';
}

type Tab = 'Stats' | 'Strategy' | 'Tags';

// Module-level variables for persistence
let lastQuantity = 1;
let lastEntryDateStr = new Date().toISOString(); // Default to now initially

const DEFAULT_TRADE: Trade = {
    id: '',
    symbol: 'MES',
    direction: '' as any, 
    status: '' as any,
    entryDate: new Date().toISOString(),
    quantity: 1,
    entryPrice: 0, 
    initialStopLoss: 0, 
    commission: 0,
    tags: [],
    rulesFollowed: [],
    screenshotUrl: ''
};

// Helper: Converts CST Input (which is stored in ISO format) to ET Wall Time ISO
const convertCstToEtIso = (isoString: string) => {
    if (!isoString) return isoString;
    try {
        const [d, tWithZ] = isoString.split('T');
        if (!tWithZ) return isoString;
        
        const [t] = tWithZ.split('.');
        const timeStr = t.slice(0, 5); // HH:MM

        // Create CST Date Object (UTC+8)
        const cstIso = `${d}T${timeStr}:00+08:00`;
        const dateObj = new Date(cstIso);
        if (isNaN(dateObj.getTime())) return isoString;

        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const parts = formatter.formatToParts(dateObj);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value;
        
        return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:00.000Z`;
    } catch (e) {
        console.error("Time conversion error", e);
        return isoString;
    }
};

export const TradeInfoModal: React.FC<TradeInfoModalProps> = ({ isOpen, onClose, trade, mode = 'edit' }) => {
    const { updateTrade, deleteTrade, addTrade } = useTrades();
    const [activeTab, setActiveTab] = useState<Tab>('Stats');
    const [formData, setFormData] = useState<Trade>(DEFAULT_TRADE);
    const [isDirty, setIsDirty] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    
    // Validation & UX State
    const [triggerShake, setTriggerShake] = useState(false);
    const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

    // Validation State
    const { isValid, errors } = useMemo(() => validateTrade(formData), [formData]);

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && trade) {
                setFormData(trade);
            } else {
                // Initialize for Add Mode
                // Use lastEntryDateStr date part only, discard time
                const [datePart] = lastEntryDateStr.split('T');
                
                // Set entryDate and exitDate to just "YYYY-MM-DD"
                // This ensures DataRules sees missing time part and AddStats renders empty inputs
                setFormData({
                    ...DEFAULT_TRADE,
                    id: crypto.randomUUID(),
                    entryDate: datePart,
                    exitDate: datePart, // Default Exit Date to same as Entry
                    quantity: lastQuantity,
                    entryPrice: undefined as any,
                    initialStopLoss: undefined as any,
                    highestPriceReached: undefined as any,
                    lowestPriceReached: undefined as any,
                    exitPrice: undefined as any,
                });
            }
            setIsDirty(false);
            setIsDeleteConfirmOpen(false);
            setTriggerShake(false);
            setHasAttemptedSave(false);
            setActiveTab('Stats');
        }
    }, [trade, isOpen, mode]);

    useEffect(() => {
        const handleGlobalClick = () => setOpenDropdown(null);
        if (isOpen) window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [isOpen]);

    const toggleDropdown = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenDropdown(prev => prev === id ? null : id);
    };

    const handleChange = (field: keyof Trade, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleBulkChange = (updates: Partial<Trade>) => {
        setFormData(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setHasAttemptedSave(true);
        // Trigger validation visual effects
        if (!isValid) {
            setTriggerShake(true);
            setTimeout(() => setTriggerShake(false), 500); // Reset after animation
            return;
        }

        if (mode === 'add') {
            const finalData = { ...formData };
            
            // Automatic Overnight Date Correction
            // Check if Exit < Entry AND they are on the same day (implying user didn't manually change date)
            if (finalData.entryDate && finalData.exitDate) {
                const eDate = new Date(finalData.entryDate);
                const xDate = new Date(finalData.exitDate);
                
                // Compare timestamps directly to see if exit is earlier
                if (xDate.getTime() < eDate.getTime()) {
                    // Check if they are notionally the same calendar day (based on how input sets them)
                    if (isSameDay(eDate, xDate)) {
                        // Assuming this is an overnight trade, add 1 day to exit date
                        const newExitDate = addDays(xDate, 1);
                        finalData.exitDate = newExitDate.toISOString();
                    }
                }
            }

            // Convert CST to ET before saving ONLY in Add Mode
            // The inputs in AddStats treat the date/time as raw CST
            finalData.entryDate = convertCstToEtIso(finalData.entryDate);
            if (finalData.exitDate) {
                finalData.exitDate = convertCstToEtIso(finalData.exitDate);
            }

            await addTrade(finalData);
            lastQuantity = formData.quantity;
            lastEntryDateStr = formData.entryDate; // Persist raw input date
        } else {
            await updateTrade(formData);
        }
        setIsDirty(false);
        onClose();
    };

    const handleConfirmDelete = async () => {
        await deleteTrade(formData.id);
        setIsDeleteConfirmOpen(false);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-[95%] xl:max-w-[1545px] h-full max-h-[95%] rounded-2xl border border-slate-600 shadow-2xl flex overflow-hidden relative">
                
                <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/30 hover:bg-slate-600 rounded-full text-white transition-colors">
                    <X size={20} />
                </button>

                {isDeleteConfirmOpen && (
                    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-surface border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                             <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 ring-4 ring-red-500/5">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Delete Trade?</h3>
                            <p className="text-slate-300 text-sm mb-8 leading-relaxed">
                                Are you sure you want to delete this trade?<br/>This action cannot be undone.
                            </p>
                            <div className="flex gap-4 justify-center">
                                <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-6 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-500 rounded-lg hover:bg-slate-600 transition-all flex-1">Cancel</button>
                                <button onClick={handleConfirmDelete} className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-500/20 transition-all flex-1">Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="w-[30%] lg:w-[25%] min-w-[280px] border-r border-slate-600 flex flex-col bg-surface">
                    <div className="flex border-b border-slate-600 bg-slate-800/20 flex-shrink-0">
                        {['Stats', 'Strategy', 'Tags'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors relative ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                        {activeTab === 'Stats' && (
                            mode === 'add' ? (
                                <AddStats 
                                    formData={formData} 
                                    onChange={handleChange}
                                    onBulkChange={handleBulkChange}
                                    openDropdown={openDropdown} 
                                    toggleDropdown={toggleDropdown}
                                    setOpenDropdown={setOpenDropdown}
                                    errors={errors} 
                                    triggerShake={triggerShake} 
                                    hasAttemptedSave={hasAttemptedSave}
                                    mode={mode} // Pass mode
                                />
                            ) : (
                                <EditStats 
                                    formData={formData} 
                                    onChange={handleChange} 
                                    openDropdown={openDropdown} 
                                    toggleDropdown={toggleDropdown}
                                    setOpenDropdown={setOpenDropdown}
                                    errors={errors} // Passing errors to EditStats
                                />
                            )
                        )}
                        {activeTab === 'Strategy' && (
                            <StrategyPanel 
                                formData={formData} 
                                onChange={handleChange}
                                openDropdown={openDropdown}
                                toggleDropdown={toggleDropdown}
                                setOpenDropdown={setOpenDropdown}
                            />
                        )}
                        {activeTab === 'Tags' && (
                            <TagsPanel 
                                formData={formData} 
                                onChange={handleChange} 
                                openDropdown={openDropdown} 
                                toggleDropdown={toggleDropdown}
                            />
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-600 bg-slate-800/20 flex justify-between items-center flex-shrink-0">
                        {mode === 'edit' ? (
                            <button onClick={() => setIsDeleteConfirmOpen(true)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete Trade">
                                <Trash2 size={18} />
                            </button>
                        ) : (
                            <div className="w-8"></div> // Spacer
                        )}
                        
                        <button 
                            onClick={handleSave} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all ${isValid ? 'bg-primary hover:bg-purple-600 text-white shadow-indigo-500/20' : 'bg-slate-700 text-slate-500 cursor-pointer shadow-none opacity-80 hover:opacity-100'}`}
                        >
                            {mode === 'add' ? <FilePlus2 size={16} /> : <Save size={16} />} 
                            {mode === 'add' ? 'Add Trade' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                <ImagePanel screenshotUrl={formData.screenshotUrl} onChange={(url) => handleChange('screenshotUrl', url)} />
            </div>
        </div>,
        document.body
    );
};
