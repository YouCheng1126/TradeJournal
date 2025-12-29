
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowUp, ArrowDown, Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle, Plus, Minus } from 'lucide-react';
import { Trade, TradeDirection, TradeStatus } from '../../types';
import { calculatePnL, formatCurrency, calculateRMultiple, parseIsoSafe, checkDateValidity } from '../../utils/calculations';
import { format, endOfMonth, isSameDay, addMonths, getDaysInMonth, addDays } from 'date-fns';
import { ValidationErrors } from './DataRules';
import { useTrades } from '../../contexts/TradeContext';

interface EditStatsProps {
    formData: Trade;
    onChange: (field: keyof Trade, value: any) => void;
    openDropdown: string | null;
    toggleDropdown: (id: string, e: React.MouseEvent) => void;
    setOpenDropdown: (id: string | null) => void;
    errors?: ValidationErrors;
}

const startOfMonth = (date: Date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const EditStats: React.FC<EditStatsProps> = ({ formData, onChange, openDropdown, toggleDropdown, setOpenDropdown, errors }) => {
    const { userSettings } = useTrades();
    
    // --- Local State for Inputs (Matches AddStats behavior) ---
    const [dateEntry, setDateEntry] = useState({ y: '', m: '', d: '' });
    const [timeEntry, setTimeEntry] = useState({ h: '', m: '' });
    const [timeExit, setTimeExit] = useState({ h: '', m: '' });

    // --- Refs for Synchronous Access (Prevents race conditions) ---
    const valuesRef = useRef({
        entry: { y: '', m: '', d: '', h: '', mi: '' },
        exit: { h: '', mi: '' }
    });

    // --- UI State ---
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState<'entry' | 'exit' | null>(null);
    const [viewDate, setViewDate] = useState(new Date());
    
    // DOM Refs
    const datePickerRef = useRef<HTMLDivElement>(null);
    const timePickerRef = useRef<HTMLDivElement>(null);
    
    // Input Refs for Auto-Jump
    const dateRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timeEntryRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timeExitRefs = useRef<(HTMLInputElement | null)[]>([]);

    // --- Sync Effect (One-way: Global -> Local) ---
    useEffect(() => {
        const p = parseIsoSafe(formData.entryDate);
        setDateEntry({ y: p.y, m: p.m, d: p.d });
        setTimeEntry({ h: p.h, m: p.mi });
        valuesRef.current.entry = { y: p.y, m: p.m, d: p.d, h: p.h, mi: p.mi };

        const pe = parseIsoSafe(formData.exitDate || '');
        setTimeExit({ h: pe.h, m: pe.mi });
        valuesRef.current.exit = { h: pe.h, mi: pe.mi };
    }, [formData.entryDate, formData.exitDate]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) setShowDatePicker(false);
            if (timePickerRef.current && !timePickerRef.current.contains(event.target as Node)) setShowTimePicker(null);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Validation Logic ---
    const entryDateErr = checkDateValidity(dateEntry.y, dateEntry.m, dateEntry.d);
    const isEH_Err = timeEntry.h.length > 0 && (parseInt(timeEntry.h) > 23 || isNaN(parseInt(timeEntry.h)));
    const isEM_Err = timeEntry.m.length > 0 && (parseInt(timeEntry.m) > 59 || isNaN(parseInt(timeEntry.m)));
    const isXH_Err = timeExit.h.length > 0 && (parseInt(timeExit.h) > 23 || isNaN(parseInt(timeExit.h)));
    const isXM_Err = timeExit.m.length > 0 && (parseInt(timeExit.m) > 59 || isNaN(parseInt(timeExit.m)));

    // --- Input Handlers (Matches AddStats Logic) ---

    const handleEnterKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, button:not([tabindex="-1"])')) as HTMLElement[];
            const currentIndex = inputs.indexOf(e.currentTarget as HTMLElement);
            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            }
        }
    };

    const handleInputSelect = (e: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.select();
    };

    // Date Typing Handler
    const handleDateLocalChange = (part: 'y'|'m'|'d', val: string) => {
        const cleanVal = val.replace(/\D/g, '');
        if (part === 'y' && cleanVal.length > 4) return;
        if ((part === 'm' || part === 'd') && cleanVal.length > 2) return;
        
        setDateEntry(prev => ({ ...prev, [part]: cleanVal }));
        valuesRef.current.entry[part] = cleanVal;
        
        // Auto-focus logic
        if (part === 'y' && cleanVal.length === 4) dateRefs.current[1]?.focus();
        if (part === 'm' && cleanVal.length === 2) dateRefs.current[2]?.focus();
    };

    // Time Typing Handler
    const handleTimeLocalChange = (type: 'entry' | 'exit', part: 'h'|'m', val: string) => {
        const cleanVal = val.replace(/\D/g, '');
        if (cleanVal.length > 2) return;
        
        const setFunc = type === 'entry' ? setTimeEntry : setTimeExit;
        setFunc(prev => ({ ...prev, [part]: cleanVal }));
        
        const refKey = type;
        const refPart = part === 'h' ? 'h' : 'mi';
        valuesRef.current[refKey][refPart] = cleanVal;

        const refs = type === 'entry' ? timeEntryRefs : timeExitRefs;
        if (part === 'h' && cleanVal.length === 2) refs.current[1]?.focus();
    };

    // Commit Changes on Blur
    const handleDateBlur = () => {
        const raw = valuesRef.current.entry;
        const y = raw.y.padStart(4, '0') || new Date().getFullYear().toString();
        const m = raw.m.padStart(2, '0') || '01';
        const d = raw.d.padStart(2, '0') || '01';
        const h = raw.h.padStart(2, '0') || '00';
        const mi = raw.mi.padStart(2, '0') || '00';
        
        const iso = `${y}-${m}-${d}T${h}:${mi}:00.000Z`;
        onChange('entryDate', iso);
        
        // Update view just in case
        setDateEntry({ y: raw.y, m: raw.m, d: raw.d });
    };

    const handleTimeBlur = (type: 'entry' | 'exit') => {
        const rawEntry = valuesRef.current.entry;
        const rawExit = valuesRef.current.exit;
        
        // 1. Construct Entry Components
        const ey = rawEntry.y.padStart(4, '0') || new Date().getFullYear().toString();
        const em = rawEntry.m.padStart(2, '0') || '01';
        const ed = rawEntry.d.padStart(2, '0') || '01';
        const eh = rawEntry.h.padStart(2, '0') || '00';
        const emi = rawEntry.mi.padStart(2, '0') || '00';
        const entryDatePart = `${ey}-${em}-${ed}`;

        // 2. Construct Exit Time Components
        const xh = rawExit.h.padStart(2, '0') || '00';
        const xmi = rawExit.mi.padStart(2, '0') || '00';

        // 3. Determine base Exit Date (prior to correction)
        let exitDatePart = entryDatePart;
        if (formData.exitDate) {
            exitDatePart = formData.exitDate.split('T')[0];
        }

        // 4. Auto-Correction: If same day and exit time < entry time, add 1 day
        let finalExitDatePart = exitDatePart;
        if (formData.exitDate && entryDatePart === exitDatePart) {
            const entryMinutes = parseInt(eh, 10) * 60 + parseInt(emi, 10);
            const exitMinutes = parseInt(xh, 10) * 60 + parseInt(xmi, 10);
            
            if (exitMinutes < entryMinutes) {
                try {
                    const dt = new Date(exitDatePart);
                    // Force UTC for date calc to prevent timezone shift surprises with raw strings
                    const utcDt = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
                    const nextDay = addDays(utcDt, 1);
                    finalExitDatePart = format(addDays(new Date(exitDatePart.replace(/-/g, '/')), 1), 'yyyy-MM-dd');
                } catch (e) {
                    console.error("Date calc error", e);
                }
            }
        }

        if (type === 'entry') {
            const entryIso = `${entryDatePart}T${eh}:${emi}:00.000Z`;
            onChange('entryDate', entryIso);
            
            // If auto-correction triggered a date change for exit, apply it
            if (formData.exitDate && finalExitDatePart !== exitDatePart) {
                const exitIso = `${finalExitDatePart}T${xh}:${xmi}:00.000Z`;
                onChange('exitDate', exitIso);
            }
            setTimeEntry({ h: rawEntry.h, m: rawEntry.mi });
        } else {
            // type === 'exit'
            const exitIso = `${finalExitDatePart}T${xh}:${xmi}:00.000Z`;
            onChange('exitDate', exitIso);
            setTimeExit({ h: rawExit.h, m: rawExit.mi });
        }
    };

    const handleExitPriceChange = (valStr: string) => {
        const val = parseFloat(valStr);
        onChange('exitPrice', isNaN(val) ? undefined : val);
        
        // Auto-Fill MAE if Exit == SL
        if (!isNaN(val) && val === formData.initialStopLoss) {
            const maeField = formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached';
            onChange(maeField, val);
        }
    };

    // --- Calculations ---
    const netPnL = calculatePnL(formData, userSettings.commissionPerUnit);
    
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
    
    const totalComm = userSettings.commissionPerUnit > 0 
        ? (qty * userSettings.commissionPerUnit) 
        : (formData.commission || 0);

    const rr = calculateRMultiple(formData, userSettings.commissionPerUnit);

    const hasRiskParams = formData.initialStopLoss !== undefined && formData.initialStopLoss !== 0;
    
    let initialRiskAmt = 0;
    if (hasRiskParams) {
        initialRiskAmt = (Math.abs(entry - (formData.initialStopLoss || 0)) * qty * multiplier) + totalComm;
    }

    let actualRiskAmt = 0;
    const hasExtremes = formData.highestPriceReached !== undefined && formData.lowestPriceReached !== undefined;

    let grossActualRisk = 0;
    if (formData.direction === TradeDirection.LONG) {
        const low = formData.lowestPriceReached ?? entry; 
        grossActualRisk = (entry - low) * qty * multiplier;
    } else {
        const high = formData.highestPriceReached ?? entry;
        grossActualRisk = (high - entry) * qty * multiplier;
    }
    if (grossActualRisk < 0) grossActualRisk = 0;
    
    actualRiskAmt = grossActualRisk + totalComm;

    const actualRiskPct = initialRiskAmt > 0 ? (actualRiskAmt / initialRiskAmt) * 100 : 0;

    let bestPnL = 0;
    let grossBestPnL = 0;
    if (formData.direction === TradeDirection.LONG) {
        const high = formData.highestPriceReached ?? entry;
        grossBestPnL = (high - entry) * qty * multiplier;
    } else {
        const low = formData.lowestPriceReached ?? entry;
        grossBestPnL = (entry - low) * qty * multiplier;
    }
    
    bestPnL = grossBestPnL - totalComm;
    
    const bestRR = initialRiskAmt > 0 ? bestPnL / initialRiskAmt : 0;

    const pnlColor = netPnL >= 0 ? 'text-emerald-400' : 'text-red-400';
    const borderPnlColor = netPnL >= 0 ? 'border-emerald-500' : 'border-red-500';
    
    // Styles
    const baseInputClass = "w-full text-left bg-transparent border rounded px-2 py-0.5 text-sm font-medium transition-all outline-none no-spinner";
    
    const getDisplayError = (field: string) => {
        const err = errors?.[field];
        if (!err) return null;
        return err;
    };

    const getInputClass = (field: string) => {
        const error = getDisplayError(field);
        const base = baseInputClass;
        if (error) {
            return `${base} border-red-500 bg-red-500/10 focus:bg-red-500/20 text-white placeholder-red-300`;
        }
        return `${base} border-transparent hover:border-slate-500 hover:bg-slate-700/50 focus:border-primary focus:bg-slate-700/50 text-white`;
    };

    const ErrorTooltip = ({ error }: { error?: string | null }) => {
        if (!error) return null;
        return (
            <div className="absolute right-0 top-full mt-0.5 z-10 bg-red-900/90 border border-red-500 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none flex items-center gap-1">
                <AlertCircle size={10} />
                {error}
            </div>
        );
    };

    const labelClass = "text-[13px] font-medium text-slate-400"; 
    const rowClass = "grid grid-cols-[55%_45%] items-center py-0.5 pr-4 relative mb-1"; 
    const dropdownBtnClass = "w-full flex items-center justify-between bg-transparent border border-transparent hover:border-slate-500 hover:bg-slate-700/50 text-sm font-bold text-white transition-colors py-0.5 px-2 rounded cursor-pointer";

    // For calendar logic
    const entryD = new Date(formData.entryDate);

    return (
        <div>
            {/* Styles for removing spinners */}
            <style>
                {`
                .no-spinner::-webkit-inner-spin-button, 
                .no-spinner::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
                .no-spinner {
                    -moz-appearance: textfield;
                }
                `}
            </style>

            {/* Header Stats */}
            <div className="mb-2 flex justify-between items-start">
                <div className={`pl-4 border-l-4 ${borderPnlColor}`}>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Net P&L</p>
                    <h2 className={`text-2xl lg:text-3xl xl:text-5xl font-bold tracking-tight ${pnlColor}`}>
                        {formatCurrency(netPnL)}
                    </h2>
                </div>

                {/* Date & Time Inputs */}
                <div className="flex flex-col items-end gap-1">
                    {/* Date Picker Input */}
                    <div className="relative" ref={datePickerRef}>
                        <div className="flex items-center gap-0 group hover:bg-slate-700/30 rounded px-1 -ml-1 transition-colors border border-transparent hover:border-slate-600">
                            <button type="button" tabIndex={-1} onClick={() => setShowDatePicker(!showDatePicker)} className="text-slate-500 hover:text-white mr-1"><Calendar size={12} /></button>
                            <div className="flex items-center">
                                <input 
                                    ref={el => { dateRefs.current[0] = el; }} 
                                    className="bg-transparent w-9 text-center text-sm font-bold text-white focus:outline-none placeholder-slate-600 no-spinner" 
                                    placeholder="YYYY" 
                                    value={dateEntry.y} 
                                    onChange={e => handleDateLocalChange('y', e.target.value)}
                                    onBlur={handleDateBlur}
                                    onKeyDown={handleEnterKey}
                                    onFocus={handleInputSelect}
                                    type="text" inputMode="numeric"
                                />
                                <span className="text-white text-sm select-none font-bold">-</span>
                                <input 
                                    ref={el => { dateRefs.current[1] = el; }} 
                                    className={`bg-transparent w-5 text-center text-sm font-bold focus:outline-none placeholder-slate-600 no-spinner ${entryDateErr.mErr ? 'text-red-500' : 'text-white'}`}
                                    placeholder="MM" 
                                    value={dateEntry.m} 
                                    onChange={e => handleDateLocalChange('m', e.target.value)} 
                                    onBlur={handleDateBlur}
                                    onKeyDown={handleEnterKey}
                                    onFocus={handleInputSelect}
                                    type="text" inputMode="numeric"
                                />
                                <span className="text-white text-sm select-none font-bold">-</span>
                                <input 
                                    ref={el => { dateRefs.current[2] = el; }} 
                                    className={`bg-transparent w-5 text-center text-sm font-bold focus:outline-none placeholder-slate-600 no-spinner ${entryDateErr.dErr ? 'text-red-500' : 'text-white'}`}
                                    placeholder="DD" 
                                    value={dateEntry.d} 
                                    onChange={e => handleDateLocalChange('d', e.target.value)} 
                                    onBlur={handleDateBlur}
                                    onKeyDown={handleEnterKey}
                                    onFocus={handleInputSelect}
                                    type="text" inputMode="numeric"
                                />
                            </div>
                        </div>
                        {showDatePicker && (
                            <div className="absolute top-full right-0 mt-1 bg-surface border border-slate-600 rounded-xl p-3 shadow-xl z-50 w-56">
                                <div className="flex justify-between items-center mb-2">
                                    <button type="button" onClick={() => setViewDate(addMonths(viewDate, -1))} className="text-slate-400 hover:text-white"><ChevronLeft size={16}/></button>
                                    <span className="text-white text-xs font-bold">{format(viewDate, 'MMM yyyy')}</span>
                                    <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="text-slate-400 hover:text-white"><ChevronRight size={16}/></button>
                                </div>
                                <div className="grid grid-cols-7 text-center gap-1">
                                    {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-[10px] text-slate-500">{d}</span>)}
                                    {Array.from({length: startOfMonth(viewDate).getDay()}).map((_,i) => <div key={`e-${i}`} />)}
                                    {Array.from({length: endOfMonth(viewDate).getDate()}).map((_, i) => {
                                        const d = i + 1;
                                        const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
                                        const isSelected = !isNaN(entryD.getTime()) && isSameDay(entryD, current);
                                        return (
                                            <button key={d} type="button" onClick={() => { 
                                                const newY = current.getFullYear();
                                                const newM = (current.getMonth()+1).toString().padStart(2,'0');
                                                const newD = d.toString().padStart(2,'0');
                                                const h = timeEntry.h.padStart(2,'0') || '00';
                                                const m = timeEntry.m.padStart(2,'0') || '00';
                                                const newIso = `${newY}-${newM}-${newD}T${h}:${m}:00.000Z`;
                                                onChange('entryDate', newIso); 
                                                setShowDatePicker(false); 
                                            }} className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{d}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Time Picker Inputs */}
                    <div className="relative" ref={timePickerRef}>
                        <div className="flex items-center gap-2">
                            {/* Entry Time */}
                            <div className="flex items-center gap-0 group hover:bg-slate-700/30 rounded px-1 transition-colors border border-transparent hover:border-slate-600">
                                <button type="button" tabIndex={-1} onClick={() => setShowTimePicker(showTimePicker === 'entry' ? null : 'entry')} className="text-slate-500 hover:text-white mr-1"><Clock size={12} /></button>
                                <div className="flex items-center">
                                    <input 
                                        ref={el => { timeEntryRefs.current[0] = el; }} 
                                        className={`bg-transparent w-5 text-center text-sm font-bold focus:outline-none placeholder-slate-600 no-spinner ${isEH_Err ? 'text-red-500' : 'text-white'}`}
                                        placeholder="HH" 
                                        value={timeEntry.h} 
                                        onChange={e => handleTimeLocalChange('entry', 'h', e.target.value)} 
                                        onBlur={() => handleTimeBlur('entry')}
                                        onKeyDown={handleEnterKey}
                                        onFocus={handleInputSelect}
                                        type="text" inputMode="numeric"
                                    />
                                    <span className="text-white text-sm select-none font-bold">:</span>
                                    <input 
                                        ref={el => { timeEntryRefs.current[1] = el; }} 
                                        className={`bg-transparent w-5 text-center text-sm font-bold focus:outline-none placeholder-slate-600 no-spinner ${isEM_Err ? 'text-red-500' : 'text-white'}`}
                                        placeholder="MM" 
                                        value={timeEntry.m} 
                                        onChange={e => handleTimeLocalChange('entry', 'm', e.target.value)} 
                                        onBlur={() => handleTimeBlur('entry')}
                                        onKeyDown={handleEnterKey}
                                        onFocus={handleInputSelect}
                                        type="text" inputMode="numeric"
                                    />
                                </div>
                            </div>
                            
                            {/* Exit Time */}
                            {formData.exitDate && (
                                <>
                                    <span className="text-white text-xs font-bold">-</span>
                                    <div className="flex items-center gap-0 group hover:bg-slate-700/30 rounded px-1 transition-colors border border-transparent hover:border-slate-600">
                                        <div className="flex items-center">
                                            <input 
                                                ref={el => { timeExitRefs.current[0] = el; }} 
                                                className={`bg-transparent w-5 text-center text-sm font-bold focus:outline-none placeholder-slate-600 no-spinner ${isXH_Err ? 'text-red-500' : 'text-white'}`}
                                                placeholder="HH" 
                                                value={timeExit.h} 
                                                onChange={e => handleTimeLocalChange('exit', 'h', e.target.value)} 
                                                onBlur={() => handleTimeBlur('exit')}
                                                onKeyDown={handleEnterKey}
                                                onFocus={handleInputSelect}
                                                type="text" inputMode="numeric"
                                            />
                                            <span className="text-white text-sm select-none font-bold">:</span>
                                            <input 
                                                ref={el => { timeExitRefs.current[1] = el; }} 
                                                className={`bg-transparent w-5 text-center text-sm font-bold focus:outline-none placeholder-slate-600 no-spinner ${isXM_Err ? 'text-red-500' : 'text-white'}`}
                                                placeholder="MM" 
                                                value={timeExit.m} 
                                                onChange={e => handleTimeLocalChange('exit', 'm', e.target.value)} 
                                                onBlur={() => handleTimeBlur('exit')}
                                                onKeyDown={handleEnterKey}
                                                onFocus={handleInputSelect}
                                                type="text" inputMode="numeric"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {showTimePicker && (
                            <div className="absolute top-full right-0 mt-1 bg-surface border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-32 flex gap-1 h-40">
                                {['Hour', 'Min'].map((col, idx) => (
                                    <div key={col} className="flex-1 flex flex-col overflow-hidden">
                                        <div className="text-center text-[9px] text-slate-500 font-medium py-1 border-b border-slate-700 mb-1 sticky top-0 bg-surface">{col}</div>
                                        <div className="overflow-y-auto flex-1 space-y-0.5 custom-scrollbar">
                                            {Array.from({length: idx===0?24:60}, (_,i) => i).map(val => (
                                                <button key={val} type="button" onClick={() => {
                                                    const type = showTimePicker;
                                                    const cleanVal = val.toString().padStart(2,'0');
                                                    const refKey = type;
                                                    
                                                    if (idx === 0) valuesRef.current[refKey].h = cleanVal;
                                                    else valuesRef.current[refKey].mi = cleanVal;
                                                    
                                                    // Trigger blur-like save
                                                    if (type === 'entry') handleTimeBlur('entry');
                                                    else handleTimeBlur('exit');

                                                    if (idx === 1) setShowTimePicker(null);
                                                }} className={`w-full text-[10px] py-0.5 rounded transition-colors text-slate-400 hover:bg-slate-700 hover:text-white`}>{val.toString().padStart(2,'0')}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-2 mt-6">
                
                <div className={rowClass}>
                    <label className={labelClass}>Symbol</label>
                    <input 
                        type="text" 
                        value={formData.symbol} 
                        onChange={(e) => onChange('symbol', e.target.value.toUpperCase())}
                        className={`${getInputClass('symbol')}`}
                    />
                    <ErrorTooltip error={getDisplayError('symbol')} />
                </div>
                <div className={rowClass}>
                    <label className={labelClass}>Quantity</label>
                    <input 
                        type="number" 
                        value={formData.quantity} 
                        onChange={(e) => onChange('quantity', parseFloat(e.target.value))}
                        className={`${getInputClass('quantity')}`}
                    />
                    <ErrorTooltip error={getDisplayError('quantity')} />
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
                            <ChevronDown size={14} className="text-slate-400"/>
                        </button>
                        {openDropdown === 'side' && (
                            <div 
                                className="absolute left-0 top-full mt-1 w-full bg-slate-700 border border-slate-500 rounded-lg shadow-xl z-20 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {[TradeDirection.LONG, TradeDirection.SHORT].map(dir => (
                                    <button 
                                        key={dir}
                                        onClick={() => { onChange('direction', dir); setOpenDropdown(null); }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-600 text-slate-200 hover:text-white flex items-center gap-2"
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
                            <ChevronDown size={14} className="text-slate-400"/>
                        </button>
                        {openDropdown === 'status' && (
                            <div 
                                className="absolute left-0 top-full mt-1 w-full bg-slate-700 border border-slate-500 rounded-lg shadow-xl z-20 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {Object.values(TradeStatus).map(s => (
                                    <button 
                                        key={s}
                                        onClick={() => { onChange('status', s); setOpenDropdown(null); }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-600 text-slate-200 hover:text-white"
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
                    <div className="relative w-full">
                        <input 
                            type="number" step="0.25"
                            value={formData.entryPrice} 
                            onChange={(e) => onChange('entryPrice', parseFloat(e.target.value))}
                            className={getInputClass('entryPrice')}
                        />
                        <ErrorTooltip error={getDisplayError('entryPrice')} />
                    </div>
                </div>
                <div className={rowClass}>
                    <label className={labelClass}>Exit Price</label>
                    <div className="relative w-full">
                        <input 
                            type="number" step="0.25"
                            value={formData.exitPrice || ''} 
                            onChange={(e) => handleExitPriceChange(e.target.value)}
                            className={`${getInputClass('exitPrice')} font-bold`}
                        />
                        <ErrorTooltip error={getDisplayError('exitPrice')} />
                    </div>
                </div>
                <div className={rowClass}>
                    <label className={labelClass}>Stop Loss</label>
                    <div className="relative w-full">
                        <input 
                            type="number" step="0.25"
                            value={formData.initialStopLoss || ''} 
                            onChange={(e) => onChange('initialStopLoss', parseFloat(e.target.value))}
                            className={getInputClass('initialStopLoss')}
                        />
                        <ErrorTooltip error={getDisplayError('initialStopLoss')} />
                    </div>
                </div>
                <div className={rowClass}>
                    <label className={labelClass}>MFE (Max Profit)</label>
                    <div className="relative w-full">
                        <input 
                            type="number" step="0.25"
                            value={formData.direction === TradeDirection.LONG ? formData.highestPriceReached : formData.lowestPriceReached} 
                            onChange={(e) => onChange(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached', parseFloat(e.target.value))}
                            className={`${getInputClass(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} font-bold ${!getDisplayError(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached') ? 'text-emerald-400' : ''}`}
                        />
                        <ErrorTooltip error={getDisplayError(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} />
                    </div>
                </div>
                <div className={rowClass}>
                    <label className={labelClass}>MAE (Max Loss)</label>
                    <div className="relative w-full">
                        <input 
                            type="number" step="0.25"
                            value={formData.direction === TradeDirection.LONG ? formData.lowestPriceReached : formData.highestPriceReached} 
                            onChange={(e) => onChange(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached', parseFloat(e.target.value))}
                            className={`${getInputClass(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} font-bold ${!getDisplayError(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached') ? 'text-red-400' : ''}`}
                        />
                        <ErrorTooltip error={getDisplayError(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} />
                    </div>
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
        </div>
    );
};
