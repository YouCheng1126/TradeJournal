
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowUp, ArrowDown, Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle, Plus, Minus } from 'lucide-react';
import { Trade, TradeDirection, TradeStatus } from '../../types';
import { 
    calculatePnL, formatCurrency, 
    parseIsoSafe, checkDateValidity 
} from '../../utils/calculations';
import { format, endOfMonth, addMonths, getDaysInMonth } from 'date-fns';
import { ValidationErrors } from './DataRules';
import { useTrades } from '../../contexts/TradeContext';

interface AddStatsProps {
    formData: Trade;
    onChange: (field: keyof Trade, value: any) => void;
    onBulkChange: (updates: Partial<Trade>) => void;
    openDropdown: string | null;
    toggleDropdown: (id: string, e: React.MouseEvent) => void;
    setOpenDropdown: (id: string | null) => void;
    errors?: ValidationErrors;
    triggerShake?: boolean;
    hasAttemptedSave?: boolean;
    mode?: 'add' | 'edit';
}

type InputMode = 'price' | 'points';

const startOfMonth = (date: Date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const AddStats: React.FC<AddStatsProps> = ({ formData, onChange, onBulkChange, openDropdown, toggleDropdown, setOpenDropdown, errors, triggerShake, hasAttemptedSave }) => {
    const { userSettings } = useTrades();
    // --- State ---
    const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
    const [showTimePicker, setShowTimePicker] = useState<'entry' | 'exit' | null>(null);
    const [viewDate, setViewDate] = useState(new Date());
    const [inputMode, setInputMode] = useState<InputMode>('points'); 
    const [showExitDateInput, setShowExitDateInput] = useState(false);
    const [shaking, setShaking] = useState(false);
    
    // --- LOCAL STATE (Isolated from Global formData until Blur) ---
    // Used for rendering UI immediately
    const [dateEntry, setDateEntry] = useState({ y: '', m: '', d: '' });
    const [timeEntry, setTimeEntry] = useState({ h: '', m: '' });
    const [dateExit, setDateExit] = useState({ y: '', m: '', d: '' });
    const [timeExit, setTimeExit] = useState({ h: '', m: '' });

    // --- REF STATE (For synchronous access in Blur/Jump handlers) ---
    // Solves the "2024 -> 0202" race condition bug
    const valuesRef = useRef({
        entry: { y: '', m: '', d: '', h: '', mi: '' },
        exit: { y: '', m: '', d: '', h: '', mi: '' }
    });

    // --- Sync Effect (One-way: Global -> Local) ---
    useEffect(() => {
        const p = parseIsoSafe(formData.entryDate);
        setDateEntry({ y: p.y, m: p.m, d: p.d });
        setTimeEntry({ h: p.h, m: p.mi });
        
        // Sync Ref
        valuesRef.current.entry = { y: p.y, m: p.m, d: p.d, h: p.h, mi: p.mi };

        const pe = parseIsoSafe(formData.exitDate || '');
        setDateExit({ y: pe.y, m: pe.m, d: pe.d });
        setTimeExit({ h: pe.h, m: pe.mi });

        // Sync Ref
        valuesRef.current.exit = { y: pe.y, m: pe.m, d: pe.d, h: pe.h, mi: pe.mi };

    }, [formData.entryDate, formData.exitDate]);

    // Handle Shake Trigger
    useEffect(() => {
        if (triggerShake) {
            setShaking(true);
            const timer = setTimeout(() => setShaking(false), 500);
            return () => clearTimeout(timer);
        }
    }, [triggerShake]);

    // Multi-Exit State
    const [isMultiExit, setIsMultiExit] = useState(false);
    const [exitPrice1, setExitPrice1] = useState('');
    const [exitPrice2, setExitPrice2] = useState('');

    // Local state for numeric inputs
    const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});

    // Refs
    const datePickerRef = useRef<HTMLDivElement>(null);
    const timePickerRef = useRef<HTMLDivElement>(null);
    
    // Input Refs for Auto-Jump
    const dateEntryRefs = useRef<(HTMLInputElement | null)[]>([]);
    const dateExitRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timeEntryRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timeExitRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) setShowDatePicker(null);
            if (timePickerRef.current && !timePickerRef.current.contains(event.target as Node)) setShowTimePicker(null);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Reset local values when input mode changes
    useEffect(() => {
        setLocalValues({});
        setExitPrice1('');
        setExitPrice2('');
        setIsMultiExit(false); 
    }, [inputMode]);

    // --- Calculations ---
    const canCalcPnL = formData.direction && formData.entryPrice !== undefined && formData.exitPrice !== undefined;
    const netPnL = canCalcPnL ? calculatePnL(formData, userSettings.commissionPerUnit) : 0;
    
    const pnlColor = !canCalcPnL 
        ? 'text-slate-500' 
        : (netPnL >= 0 ? 'text-emerald-400' : 'text-red-400');
        
    const borderPnlColor = !canCalcPnL 
        ? 'border-slate-600' 
        : (netPnL >= 0 ? 'border-emerald-500' : 'border-red-500');
    
    // --- Keyboard Handlers ---
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

    const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: string) => {
        const forbiddenKeys = ['e', '+'];
        
        // Strict logic: Allow negative ONLY if specific field AND inputMode allows it
        // Exit Price: Allow negative ONLY in Points mode
        let allowNegative = false;
        if (field === 'exitPrice' && inputMode === 'points') allowNegative = true;
        
        if (!allowNegative) forbiddenKeys.push('-');
        
        if (forbiddenKeys.includes(e.key)) e.preventDefault();
        handleEnterKey(e);
    };

    const handleInputSelect = (e: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.select();
    };

    // --- Helpers for Point/Price Logic ---
    const getDisplayValue = (field: keyof Trade): string | number => {
        if (localValues[field] !== undefined) return localValues[field];
        
        // Special Case: Entry Price Formatting from Local Value if available, otherwise from FormData
        if (field === 'entryPrice') {
             return formData.entryPrice !== undefined ? formData.entryPrice : '';
        }

        const val = formData[field] as number;
        if (val === undefined || val === null) return '';
        if (inputMode === 'price') return val;
        
        const entry = formData.entryPrice;
        if (!entry) return '';
        return Math.abs(val - entry).toFixed(2);
    };

    const calculateAverageAndSave = (v1: string, v2: string) => {
        const val1 = parseFloat(v1);
        const val2 = parseFloat(v2);
        if (!isNaN(val1) && !isNaN(val2)) {
            const avg = (val1 + val2) / 2;
            handleValueChange('exitPrice', avg.toString(), true); 
        } else {
            onChange('exitPrice', undefined);
        }
    };

    const handleValueChange = (field: keyof Trade, valStr: string, isInternalCalculation = false) => {
        if (!isInternalCalculation) {
            setLocalValues(prev => ({ ...prev, [field]: valStr }));
        }
        
        // Allow typing negative sign or empty without triggering save/logic yet
        if (valStr === '' || valStr === '-') {
            if (valStr === '') onChange(field, undefined);
            return;
        }

        const val = parseFloat(valStr);
        if (isNaN(val)) return; 

        let calculatedPrice = val;

        if (inputMode === 'points') {
            const entry = formData.entryPrice || 0;
            const isLong = formData.direction === TradeDirection.LONG;
            
            if (field === 'highestPriceReached') {
                // Highest Price (MFE for Long, MAE for Short)
                calculatedPrice = entry + val;
            } else if (field === 'lowestPriceReached') {
                // Lowest Price (MAE for Long, MFE for Short)
                calculatedPrice = entry - val;
            } else if (field === 'exitPrice') {
                // Exit Price
                // Long: Entry + Val (Positive points = Profit)
                // Short: Entry - Val (Positive points = Profit)
                calculatedPrice = isLong ? entry + val : entry - val;
            } else if (field === 'initialStopLoss') {
                // Stop Loss
                calculatedPrice = isLong ? entry - val : entry + val;
            } else {
                calculatedPrice = val;
            }
        }

        onChange(field, calculatedPrice);

        // Auto-sync MAE if Exit Price == Stop Loss
        if (field === 'exitPrice') {
            if (formData.initialStopLoss !== undefined && calculatedPrice === formData.initialStopLoss) {
                const maeField = formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached';
                onChange(maeField, calculatedPrice);
                
                // Update Local Value for MAE as well so it reflects immediately in the UI
                setLocalValues(prev => ({ ...prev, [maeField]: valStr }));
            }
        }
    };

    const handleBlur = (field: keyof Trade) => {
        if (field === 'entryPrice') {
            const val = formData.entryPrice;
            if (val !== undefined && !isNaN(val)) {
                const formatted = val.toFixed(2);
                setLocalValues(prev => ({ ...prev, entryPrice: formatted }));
            }
        } else if (field !== 'exitPrice' || !isMultiExit) {
            // Clear local cache for other fields to reset to calculated point view or price view
            setLocalValues(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleMultiExitChange = (index: 1 | 2, value: string) => {
        if (index === 1) setExitPrice1(value);
        else setExitPrice2(value);
        const otherVal = index === 1 ? exitPrice2 : exitPrice1;
        calculateAverageAndSave(value, otherVal);
    };

    const handleDirectionChange = (newDir: TradeDirection) => {
        if (inputMode === 'points' && formData.entryPrice !== undefined) {
            const entry = formData.entryPrice;
            const oldDir = formData.direction;
            
            // Define fields based on OLD direction logic
            const oldMfeField = oldDir === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached';
            const oldMaeField = oldDir === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached';
            
            // Define fields based on NEW direction logic
            const newMfeField = newDir === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached';
            const newMaeField = newDir === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached';
            
            // Helper to get points (current display value)
            const getPoints = (field: keyof Trade) => {
                if (localValues[field]) return parseFloat(localValues[field]);
                const val = formData[field] as number;
                if (val === undefined) return undefined;
                return Math.abs(val - entry);
            };
            
            const mfePts = getPoints(oldMfeField);
            const maePts = getPoints(oldMaeField);
            const exitPts = getPoints('exitPrice');
            const slPts = getPoints('initialStopLoss');
            
            const updates: Partial<Trade> = { direction: newDir };
            const newLocalValues = { ...localValues };
            
            // 1. Recalculate MFE (Profit Field)
            if (mfePts !== undefined) {
                const newPrice = newDir === TradeDirection.LONG ? entry + mfePts : entry - mfePts;
                updates[newMfeField] = newPrice;
                if (newLocalValues[oldMfeField]) {
                    newLocalValues[newMfeField] = newLocalValues[oldMfeField];
                    delete newLocalValues[oldMfeField];
                }
            }
            
            // 2. Recalculate MAE (Loss Field)
            if (maePts !== undefined) {
                const newPrice = newDir === TradeDirection.LONG ? entry - maePts : entry + maePts;
                updates[newMaeField] = newPrice;
                if (newLocalValues[oldMaeField]) {
                    newLocalValues[newMaeField] = newLocalValues[oldMaeField];
                    delete newLocalValues[oldMaeField];
                }
            }
            
            // 3. Recalculate Exit Price
            if (exitPts !== undefined) {
                updates.exitPrice = newDir === TradeDirection.LONG ? entry + exitPts : entry - exitPts;
            }
            
            // 4. Recalculate SL
            if (slPts !== undefined) {
                updates.initialStopLoss = newDir === TradeDirection.LONG ? entry - slPts : entry + slPts;
            }
            
            onBulkChange(updates);
            setLocalValues(newLocalValues);
            
        } else {
            onChange('direction', newDir);
        }
        setOpenDropdown(null);
    };

    // --- Validation Display Logic ---
    const getDisplayError = (field: string) => {
        const err = errors?.[field];
        if (!err) return null;
        
        // Hide "Required" errors until user attempts to save
        const isRequiredError = err.includes('Required'); 
        if (isRequiredError && !hasAttemptedSave) return null;
        
        return err;
    };

    // Use State for visual validation (instant feedback)
    const isEH_Err = timeEntry.h.length > 0 && (parseInt(timeEntry.h) > 23 || isNaN(parseInt(timeEntry.h)));
    const isEM_Err = timeEntry.m.length > 0 && (parseInt(timeEntry.m) > 59 || isNaN(parseInt(timeEntry.m)));
    const isXH_Err = timeExit.h.length > 0 && (parseInt(timeExit.h) > 23 || isNaN(parseInt(timeExit.h)));
    const isXM_Err = timeExit.m.length > 0 && (parseInt(timeExit.m) > 59 || isNaN(parseInt(timeExit.m)));

    const baseInputClass = "w-full text-left bg-slate-800/50 border rounded-lg px-3 py-2 text-base lg:text-lg font-medium transition-all outline-none no-spinner";
    const getInputClass = (field: string, isLocalTimeError: boolean = false) => {
        const errorMsg = getDisplayError(field);
        const hasError = !!errorMsg || isLocalTimeError;
        const shakeClass = hasError && shaking ? 'animate-shake' : '';
        
        let cls = baseInputClass;
        if (hasError) {
            cls = `${cls} border-red-500 focus:border-red-500 bg-red-500/10 text-red-500 placeholder-red-300`;
        } else {
            cls = `${cls} border-slate-600 focus:border-primary focus:bg-slate-800 text-white`;
        }
        
        return `${cls} ${shakeClass}`;
    };
    
    const labelClass = "text-sm font-bold text-slate-400 mb-1 block"; 
    const rowClass = "flex flex-col mb-1 relative"; 
    const dropdownBtnClass = "w-full flex items-center justify-between bg-slate-800/50 border border-slate-600 hover:border-slate-500 focus:border-primary text-base lg:text-lg font-bold text-white transition-colors px-3 py-2 rounded-lg cursor-pointer";

    const ErrorMessage = ({ error }: { error?: string | null }) => {
        if (!error) return null;
        return <div className="absolute top-full left-0 mt-1 z-10"><p className="text-red-400 text-[10px] flex items-center gap-1 font-bold whitespace-nowrap"><AlertCircle size={10}/>{error}</p></div>;
    };

    // --- DATE/TIME LOGIC ---
    // 1. Local Change Handler (Typing)
    const handleDateLocalChange = (type: 'entry' | 'exit', part: 'y'|'m'|'d', val: string) => {
        const cleanVal = val.replace(/\D/g, '');
        if (part === 'y' && cleanVal.length > 4) return;
        if ((part === 'm' || part === 'd') && cleanVal.length > 2) return;
        const setFunc = type === 'entry' ? setDateEntry : setDateExit;
        setFunc(prev => ({ ...prev, [part]: cleanVal }));
        const refKey = type;
        valuesRef.current[refKey][part] = cleanVal;
        const refs = type === 'entry' ? dateEntryRefs : dateExitRefs;
        if (part === 'y' && cleanVal.length === 4) refs.current[1]?.focus();
        if (part === 'm' && cleanVal.length === 2) refs.current[2]?.focus();
    };

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

    const handleDateBlur = (type: 'entry' | 'exit') => {
        const setLocal = type === 'entry' ? setDateEntry : setDateExit;
        const refKey = type;
        const raw = valuesRef.current[refKey];
        const y = raw.y; 
        const m = raw.m.length === 1 ? `0${raw.m}` : raw.m;
        const d = raw.d.length === 1 ? `0${raw.d}` : raw.d;
        setLocal({ y, m, d });
        valuesRef.current[refKey].y = y;
        valuesRef.current[refKey].m = m;
        valuesRef.current[refKey].d = d;
        const saveY = y.padStart(4, '0') || new Date().getFullYear().toString();
        const saveM = m || '01';
        const saveD = d || '01';
        const saveH = valuesRef.current[refKey].h || '00';
        const saveMi = valuesRef.current[refKey].mi || '00';
        const iso = `${saveY}-${saveM}-${saveD}T${saveH}:${saveMi}:00.000Z`;
        const field = type === 'entry' ? 'entryDate' : 'exitDate';
        onChange(field, iso);
        if (type === 'entry' && !showExitDateInput) { onChange('exitDate', iso); }
    };

    const handleTimeBlur = (type: 'entry' | 'exit') => {
        const setLocal = type === 'entry' ? setTimeEntry : setTimeExit;
        const refKey = type;
        const raw = valuesRef.current[refKey];
        const h = raw.h.length === 1 ? `0${raw.h}` : raw.h;
        const m = raw.mi.length === 1 ? `0${raw.mi}` : raw.mi;
        setLocal({ h, m });
        valuesRef.current[refKey].h = h;
        valuesRef.current[refKey].mi = m;
        handleDateBlur(type); 
    };

    const toggleDatePicker = (type: 'entry' | 'exit') => {
        if (showDatePicker === type) {
            setShowDatePicker(null);
        } else {
            const currentIso = type === 'entry' ? formData.entryDate : formData.exitDate;
            if (currentIso) {
                const d = new Date(currentIso);
                if (!isNaN(d.getTime())) setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
            }
            setShowDatePicker(type);
        }
    };

    const handleCalendarSelect = (type: 'entry' | 'exit', newDateIso: string) => {
        const field = type === 'entry' ? 'entryDate' : 'exitDate';
        const refKey = type;
        const [d] = newDateIso.split('T');
        const h = valuesRef.current[refKey].h.padStart(2,'0') || '00';
        const m = valuesRef.current[refKey].mi.padStart(2,'0') || '00';
        const finalIso = `${d}T${h}:${m}:00.000Z`;
        onChange(field, finalIso);
        if (type === 'entry' && !showExitDateInput) { onChange('exitDate', finalIso); }
        setShowDatePicker(null);
    };

    const handleTimePresetClick = (type: 'entry'|'exit', hVal: string, mVal: string) => {
        const refKey = type;
        const y = valuesRef.current[refKey].y || new Date().getFullYear().toString();
        const mo = valuesRef.current[refKey].m || '01';
        const da = valuesRef.current[refKey].d || '01';
        const iso = `${y}-${mo}-${da}T${hVal}:${mVal}:00.000Z`;
        onChange(type === 'entry' ? 'entryDate' : 'exitDate', iso);
        if (type === 'entry' && !showExitDateInput) onChange('exitDate', iso);
    };

    const toggleExitDateInput = () => {
        const nextState = !showExitDateInput;
        setShowExitDateInput(nextState);
        if (!nextState) { onChange('exitDate', formData.entryDate); }
    };

    const entryDateErr = checkDateValidity(dateEntry.y, dateEntry.m, dateEntry.d);
    const exitDateErr = checkDateValidity(dateExit.y, dateExit.m, dateExit.d);

    const getEntryDateError = () => {
        if (entryDateErr.mErr) return "Invalid Month";
        if (entryDateErr.dErr) return "Invalid Day";
        return getDisplayError('entryDate');
    };

    const getExitDateError = () => {
        if (exitDateErr.mErr) return "Invalid Month";
        if (exitDateErr.dErr) return "Invalid Day";
        return getDisplayError('exitDate');
    };

    return (
        <div>
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
                @keyframes shake {
                  0%, 100% { transform: translateX(0); }
                  20% { transform: translateX(-5px); }
                  40% { transform: translateX(5px); }
                  60% { transform: translateX(-5px); }
                  80% { transform: translateX(5px); }
                }
                .animate-shake {
                  animation: shake 0.4s ease-in-out;
                }
                `}
            </style>

            {/* Header Stats & Toggle */}
            <div className="mb-6 flex justify-between items-start">
                <div className={`pl-4 border-l-4 ${borderPnlColor}`}>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Net P&L</p>
                    <h2 className={`text-3xl lg:text-5xl font-bold tracking-tight ${pnlColor}`}>
                        {formatCurrency(netPnL)}
                    </h2>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600 h-fit w-[120px] justify-center">
                        <button 
                            type="button" 
                            onClick={() => setInputMode('price')} 
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${inputMode === 'price' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Price
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setInputMode('points')} 
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${inputMode === 'points' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Points
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-[120px]">
                        <span className="text-xs font-bold text-slate-400">Symbol</span>
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={formData.symbol} 
                                onChange={(e) => onChange('symbol', e.target.value.toUpperCase())}
                                onKeyDown={handleEnterKey}
                                className={`${getInputClass('symbol')} py-1.5 text-center font-bold text-lg`}
                                style={{ height: '34px' }}
                                placeholder="SYM"
                            />
                            <ErrorMessage error={getDisplayError('symbol')} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-6 mt-2">
                
                {/* 1. DATE ROW (Entry Date) */}
                <div className="relative" ref={datePickerRef}>
                    <div className="flex justify-between items-center mb-1">
                        <label className={labelClass}>Entry Date (YYYY-MM-DD)</label>
                        <button 
                            type="button" 
                            onClick={toggleExitDateInput} 
                            className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                            title={showExitDateInput ? "Remove Exit Date" : "Add Exit Date"}
                        >
                            {showExitDateInput ? <><Minus size={12} /> Same Day Exit</> : <><Plus size={12} /> Exit Date</>}
                        </button>
                    </div>
                    <div className={`flex items-center gap-0 bg-slate-800/50 border rounded-lg px-3 py-2 transition-colors relative ${getDisplayError('entryDate') || entryDateErr.mErr || entryDateErr.dErr ? 'border-red-500' : 'border-slate-600 focus-within:border-primary'} ${(getDisplayError('entryDate') || entryDateErr.mErr || entryDateErr.dErr) && shaking ? 'animate-shake' : ''}`}>
                        <button type="button" tabIndex={-1} onClick={() => toggleDatePicker('entry')} className="text-slate-400 hover:text-white mr-3"><Calendar size={18} /></button>
                        <div className="flex items-center flex-1 justify-center gap-1">
                            <input ref={el => { dateEntryRefs.current[0] = el; }} onKeyDown={handleEnterKey} onBlur={() => handleDateBlur('entry')} onFocus={handleInputSelect} onClick={handleInputSelect} className="bg-transparent w-16 text-center text-lg font-bold text-white focus:outline-none placeholder-slate-600 no-spinner" placeholder="YYYY" type="text" inputMode="numeric" value={dateEntry.y} onChange={e => handleDateLocalChange('entry', 'y', e.target.value)} />
                            <span className="text-white text-lg select-none font-bold">-</span>
                            <input ref={el => { dateEntryRefs.current[1] = el; }} onKeyDown={handleEnterKey} onBlur={() => handleDateBlur('entry')} onFocus={handleInputSelect} onClick={handleInputSelect} className={`bg-transparent w-10 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${entryDateErr.mErr ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="MM" type="text" inputMode="numeric" value={dateEntry.m} onChange={e => handleDateLocalChange('entry', 'm', e.target.value)} />
                            <span className="text-white text-lg select-none font-bold">-</span>
                            <input ref={el => { dateEntryRefs.current[2] = el; }} onKeyDown={handleEnterKey} onBlur={() => handleDateBlur('entry')} onFocus={handleInputSelect} onClick={handleInputSelect} className={`bg-transparent w-10 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${entryDateErr.dErr ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="DD" type="text" inputMode="numeric" value={dateEntry.d} onChange={e => handleDateLocalChange('entry', 'd', e.target.value)} />
                        </div>
                    </div>
                    <ErrorMessage error={getEntryDateError()} />
                    
                    {/* Calendar Popup */}
                    {showDatePicker && (
                        <div className="absolute top-full left-0 mt-2 bg-surface border border-slate-600 rounded-xl p-4 shadow-xl z-50 w-[280px]">
                            <div className="flex justify-between items-center mb-4">
                                <button type="button" onClick={() => setViewDate(addMonths(viewDate, -1))} className="text-slate-400 hover:text-white"><ChevronLeft size={20}/></button>
                                <span className="text-white text-sm font-bold">{format(viewDate, 'MMM yyyy')}</span>
                                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="text-slate-400 hover:text-white"><ChevronRight size={20}/></button>
                            </div>
                            <div className="grid grid-cols-7 text-center gap-1">
                                {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-[10px] text-slate-500">{d}</span>)}
                                {Array.from({length: startOfMonth(viewDate).getDay()}).map((_,i) => <div key={`e-${i}`} />)}
                                {Array.from({length: endOfMonth(viewDate).getDate()}).map((_, i) => {
                                    const d = i + 1;
                                    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
                                    const targetDateIso = showDatePicker === 'entry' ? formData.entryDate : formData.exitDate;
                                    let isSelected = false;
                                    if (targetDateIso) {
                                        const [isoDatePart] = targetDateIso.split('T'); 
                                        if (isoDatePart === format(current, 'yyyy-MM-dd')) isSelected = true;
                                    }
                                    return (
                                        <button key={d} type="button" onClick={() => { 
                                            const newIso = `${format(current, 'yyyy-MM-dd')}T00:00:00.000Z`;
                                            handleCalendarSelect(showDatePicker as 'entry'|'exit', newIso);
                                        }} className={`w-8 h-8 rounded-full text-xs flex items-center justify-center transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-700'}`}>{d}</button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* EXIT DATE ROW */}
                {showExitDateInput && (
                    <div className="relative">
                        <label className={labelClass}>Exit Date (YYYY-MM-DD)</label>
                        <div className={`flex items-center gap-0 bg-slate-800/50 border rounded-lg px-3 py-2 transition-colors ${getDisplayError('exitDate') || exitDateErr.mErr || exitDateErr.dErr ? 'border-red-500' : 'border-slate-600 focus-within:border-primary'} ${(getDisplayError('exitDate') || exitDateErr.mErr || exitDateErr.dErr) && shaking ? 'animate-shake' : ''}`}>
                            <button type="button" tabIndex={-1} onClick={() => toggleDatePicker('exit')} className="text-slate-400 hover:text-white mr-3"><Calendar size={18} /></button>
                            <div className="flex items-center flex-1 justify-center gap-1">
                                <input ref={el => { dateExitRefs.current[0] = el; }} onKeyDown={handleEnterKey} onBlur={() => handleDateBlur('exit')} onFocus={handleInputSelect} onClick={handleInputSelect} className="bg-transparent w-16 text-center text-lg font-bold text-white focus:outline-none placeholder-slate-600 no-spinner" placeholder="YYYY" type="text" inputMode="numeric" value={dateExit.y} onChange={e => handleDateLocalChange('exit', 'y', e.target.value)} />
                                <span className="text-white text-lg select-none font-bold">-</span>
                                <input ref={el => { dateExitRefs.current[1] = el; }} onKeyDown={handleEnterKey} onBlur={() => handleDateBlur('exit')} onFocus={handleInputSelect} onClick={handleInputSelect} className={`bg-transparent w-10 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${exitDateErr.mErr ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="MM" type="text" inputMode="numeric" value={dateExit.m} onChange={e => handleDateLocalChange('exit', 'm', e.target.value)} />
                                <span className="text-white text-lg select-none font-bold">-</span>
                                <input ref={el => { dateExitRefs.current[2] = el; }} onKeyDown={handleEnterKey} onBlur={() => handleDateBlur('exit')} onFocus={handleInputSelect} onClick={handleInputSelect} className={`bg-transparent w-10 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${exitDateErr.dErr ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="DD" type="text" inputMode="numeric" value={dateExit.d} onChange={e => handleDateLocalChange('exit', 'd', e.target.value)} />
                            </div>
                        </div>
                        <ErrorMessage error={getExitDateError()} />
                    </div>
                )}

                {/* 2. TIME ROW */}
                <div className="grid grid-cols-2 gap-4 relative" ref={timePickerRef}>
                    {/* ... Entry Time Input ... */}
                    <div className="relative">
                        <label className={labelClass}>Entry Time</label>
                        <div className={`flex items-center gap-0 bg-slate-800/50 border rounded-lg px-3 py-2 transition-colors ${getDisplayError('entryTime') || isEH_Err || isEM_Err ? 'border-red-500' : 'border-slate-600 focus-within:border-primary'} ${(getDisplayError('entryTime') || isEH_Err || isEM_Err) && shaking ? 'animate-shake' : ''}`}>
                            <button type="button" tabIndex={-1} onClick={() => setShowTimePicker(showTimePicker === 'entry' ? null : 'entry')} className="text-slate-400 hover:text-white mr-2"><Clock size={18} /></button>
                            <div className="flex items-center justify-center flex-1">
                                <input ref={el => { timeEntryRefs.current[0] = el; }} className={`bg-transparent w-8 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${isEH_Err ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="HH" type="text" inputMode="numeric" value={timeEntry.h} onFocus={(e) => e.target.select()} onClick={(e) => e.currentTarget.select()} onChange={e => handleTimeLocalChange('entry', 'h', e.target.value)} onBlur={() => handleTimeBlur('entry')} onKeyDown={handleEnterKey} />
                                <span className="text-white text-lg select-none px-1 font-bold">:</span>
                                <input ref={el => { timeEntryRefs.current[1] = el; }} className={`bg-transparent w-8 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${isEM_Err ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="MM" type="text" inputMode="numeric" value={timeEntry.m} onFocus={(e) => e.target.select()} onClick={(e) => e.currentTarget.select()} onChange={e => handleTimeLocalChange('entry', 'm', e.target.value)} onBlur={() => handleTimeBlur('entry')} onKeyDown={handleEnterKey} />
                            </div>
                        </div>
                        <ErrorMessage error={(isEH_Err || isEM_Err) ? "Invalid Time" : getDisplayError('entryTime')} />
                    </div>

                    {/* ... Exit Time Input ... */}
                    <div className="relative">
                        <label className={labelClass}>Exit Time</label>
                        <div className={`flex items-center gap-0 bg-slate-800/50 border rounded-lg px-3 py-2 transition-colors ${getDisplayError('exitTime') || isXH_Err || isXM_Err ? 'border-red-500' : 'border-slate-600 focus-within:border-primary'} ${(getDisplayError('exitTime') || isXH_Err || isXM_Err) && shaking ? 'animate-shake' : ''}`}>
                            <button type="button" tabIndex={-1} onClick={() => setShowTimePicker(showTimePicker === 'exit' ? null : 'exit')} className="text-slate-400 hover:text-white mr-2"><Clock size={18} /></button>
                            <div className="flex items-center justify-center flex-1">
                                <input ref={el => { timeExitRefs.current[0] = el; }} className={`bg-transparent w-8 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${isXH_Err ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="HH" type="text" inputMode="numeric" value={timeExit.h} onFocus={(e) => e.target.select()} onClick={(e) => e.currentTarget.select()} onChange={e => handleTimeLocalChange('exit', 'h', e.target.value)} onBlur={() => handleTimeBlur('exit')} onKeyDown={handleEnterKey} />
                                <span className="text-white text-lg select-none px-1 font-bold">:</span>
                                <input ref={el => { timeExitRefs.current[1] = el; }} className={`bg-transparent w-8 text-center text-lg font-bold focus:outline-none placeholder-slate-600 no-spinner ${isXM_Err ? 'text-red-500 placeholder-red-300' : 'text-white'}`} placeholder="MM" type="text" inputMode="numeric" value={timeExit.m} onFocus={(e) => e.target.select()} onClick={(e) => e.currentTarget.select()} onChange={e => handleTimeLocalChange('exit', 'm', e.target.value)} onBlur={() => handleTimeBlur('exit')} onKeyDown={handleEnterKey} />
                            </div>
                        </div>
                        <ErrorMessage error={(isXH_Err || isXM_Err) ? "Invalid Time" : getDisplayError('exitTime')} />
                    </div>

                    {showTimePicker && (
                        <div className={`absolute top-full mt-2 bg-surface border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-48 flex gap-1 h-48 ${showTimePicker === 'exit' ? 'right-0' : 'left-0'}`}>
                            {/* ... same time picker ... */}
                            {['Hour', 'Min'].map((col, idx) => (
                                <div key={col} className="flex-1 flex flex-col overflow-hidden">
                                    <div className="text-center text-[10px] text-slate-500 font-medium py-1 border-b border-slate-700 mb-1 sticky top-0 bg-surface">{col}</div>
                                    <div className="overflow-y-auto flex-1 space-y-0.5 custom-scrollbar">
                                        {Array.from({length: idx===0?24:60}, (_,i) => i).map(val => (
                                            <button key={val} type="button" onClick={() => {
                                                const type = showTimePicker;
                                                const cleanVal = val.toString().padStart(2,'0');
                                                if (type === 'entry') {
                                                    const h = idx===0 ? cleanVal : (timeEntry.h.padStart(2,'0') || '00');
                                                    const m = idx===1 ? cleanVal : (timeEntry.m.padStart(2,'0') || '00');
                                                    handleTimePresetClick('entry', h, m);
                                                } else {
                                                    const h = idx===0 ? cleanVal : (timeExit.h.padStart(2,'0') || '00');
                                                    const m = idx===1 ? cleanVal : (timeExit.m.padStart(2,'0') || '00');
                                                    handleTimePresetClick('exit', h, m);
                                                }
                                                if (idx === 1) setShowTimePicker(null);
                                            }} className={`w-full text-xs py-1.5 rounded transition-colors text-slate-400 hover:bg-slate-700 hover:text-white`}>{val.toString().padStart(2,'0')}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* MAIN GRID (2 Columns) */}
                <div className="grid grid-cols-2 gap-4">
                    
                    <div className={rowClass}>
                        <label className={labelClass}>Side</label>
                        <div className="relative w-full">
                            <button 
                                onClick={(e) => toggleDropdown('side', e)}
                                className={`${dropdownBtnClass} ${getDisplayError('general') && !formData.direction ? 'border-red-500' : ''} ${getDisplayError('general') && !formData.direction && shaking ? 'animate-shake' : ''}`}
                            >
                                {formData.direction ? (
                                    <span className={`flex items-center gap-2 ${formData.direction === TradeDirection.LONG ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formData.direction === TradeDirection.LONG ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}
                                        {formData.direction.toUpperCase()}
                                    </span>
                                ) : (
                                    <span className="text-slate-500 italic">Select Side</span>
                                )}
                                <div className="text-slate-400">
                                    <ChevronDown size={18} />
                                </div>
                            </button>
                            {openDropdown === 'side' && (
                                <div 
                                    className="absolute left-0 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {[TradeDirection.LONG, TradeDirection.SHORT].map(dir => (
                                        <button 
                                            key={dir}
                                            onClick={() => handleDirectionChange(dir)}
                                            className="w-full text-left px-4 py-3 text-base hover:bg-slate-700 text-slate-200 hover:text-white flex items-center gap-2"
                                        >
                                            {dir === TradeDirection.LONG ? <ArrowUp size={16} className="text-emerald-400"/> : <ArrowDown size={16} className="text-red-400"/>}
                                            {dir}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!formData.direction && <ErrorMessage error={getDisplayError('general')} />}
                    </div>

                    <div className={rowClass}>
                        <label className={labelClass}>Status</label>
                        <div className="relative w-full">
                            <button 
                                onClick={(e) => toggleDropdown('status', e)}
                                className={`${dropdownBtnClass} ${getDisplayError('general') && !formData.status ? 'border-red-500' : ''} ${getDisplayError('general') && !formData.status && shaking ? 'animate-shake' : ''}`}
                            >
                                {formData.status ? (
                                    <span className={
                                        formData.status === TradeStatus.WIN ? 'text-emerald-400' : 
                                        formData.status === TradeStatus.LOSS ? 'text-red-400' : 
                                        formData.status === TradeStatus.BREAK_EVEN ? 'text-slate-300' : 
                                        formData.status.includes('Win') ? 'text-emerald-300' : 'text-red-300'
                                    }>
                                        {formData.status}
                                    </span>
                                ) : (
                                    <span className="text-slate-500 italic">Select Status</span>
                                )}
                                <div className="text-slate-400">
                                    <ChevronDown size={18} />
                                </div>
                            </button>
                            {openDropdown === 'status' && (
                                <div 
                                    className="absolute left-0 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {Object.values(TradeStatus).map(s => (
                                        <button 
                                            key={s}
                                            onClick={() => { onChange('status', s); setOpenDropdown(null); }}
                                            className="w-full text-left px-4 py-3 text-base hover:bg-slate-700 text-slate-200 hover:text-white"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!formData.status && <ErrorMessage error={getDisplayError('general')} />}
                    </div>

                    <div className={rowClass}>
                        <label className={labelClass}>Entry Price</label>
                        <input 
                            type="number" step="0.25" inputMode="decimal"
                            value={localValues.entryPrice !== undefined ? localValues.entryPrice : (formData.entryPrice || '')} 
                            onChange={(e) => {
                                const val = e.target.value;
                                setLocalValues(prev => { const n = {...prev}; delete n.entryPrice; return n; });
                                onChange('entryPrice', val === '' ? undefined : parseFloat(val));
                            }}
                            onKeyDown={e => handleNumberKeyDown(e, 'entryPrice')}
                            onBlur={() => handleBlur('entryPrice')}
                            className={getInputClass('entryPrice')}
                            placeholder={inputMode === 'points' ? 'Pts' : ''}
                        />
                        <ErrorMessage error={getDisplayError('entryPrice')} />
                    </div>

                    {/* Exit Price with Multi Logic - ADJUSTED BUTTON POSITION */}
                    <div className={rowClass}>
                        <div className="relative mb-1 flex items-center h-5">
                            <label className={labelClass}>Exit Price</label>
                            <button 
                                type="button" tabIndex={-1}
                                onClick={() => setIsMultiExit(!isMultiExit)}
                                className="absolute right-0 top-[-2px] text-slate-500 hover:text-white p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Split Exit Price"
                            >
                                {isMultiExit ? <Minus size={12}/> : <Plus size={12}/>}
                            </button>
                        </div>
                        
                        {!isMultiExit ? (
                            <input 
                                type="number" step="0.25" inputMode="decimal"
                                value={getDisplayValue('exitPrice')} 
                                onChange={(e) => handleValueChange('exitPrice', e.target.value)}
                                onBlur={() => handleBlur('exitPrice')}
                                onKeyDown={e => handleNumberKeyDown(e, 'exitPrice')} 
                                className={`${getInputClass('exitPrice')} font-bold`}
                                placeholder={inputMode === 'points' ? 'Pts' : ''}
                            />
                        ) : (
                            <div className="flex gap-2">
                                <input 
                                    type="number" step="0.25" inputMode="decimal"
                                    value={exitPrice1}
                                    onChange={(e) => handleMultiExitChange(1, e.target.value)}
                                    onKeyDown={e => handleNumberKeyDown(e, 'exitPrice')}
                                    className={`${getInputClass('exitPrice')} text-center text-sm`}
                                    placeholder="Exit 1"
                                />
                                <input 
                                    type="number" step="0.25" inputMode="decimal"
                                    value={exitPrice2}
                                    onChange={(e) => handleMultiExitChange(2, e.target.value)}
                                    onKeyDown={e => handleNumberKeyDown(e, 'exitPrice')}
                                    className={`${getInputClass('exitPrice')} text-center text-sm`}
                                    placeholder="Exit 2"
                                />
                            </div>
                        )}
                        <ErrorMessage error={getDisplayError('exitPrice')} />
                    </div>

                    <div className={rowClass}>
                        <label className={labelClass}>Stop Loss</label>
                        <input 
                            type="number" step="0.25" inputMode="decimal"
                            value={getDisplayValue('initialStopLoss')} 
                            onChange={(e) => handleValueChange('initialStopLoss', e.target.value)}
                            onBlur={() => handleBlur('initialStopLoss')}
                            onKeyDown={e => handleNumberKeyDown(e, 'initialStopLoss')}
                            className={getInputClass('initialStopLoss')}
                            placeholder={inputMode === 'points' ? 'Pts' : ''}
                        />
                        <ErrorMessage error={getDisplayError('initialStopLoss')} />
                    </div>

                    <div className={rowClass}>
                        <label className={labelClass}>Quantity</label>
                        <input 
                            type="number" inputMode="decimal"
                            value={formData.quantity} 
                            onChange={(e) => onChange('quantity', parseFloat(e.target.value))}
                            onKeyDown={e => handleNumberKeyDown(e, 'quantity')}
                            className={getInputClass('quantity')}
                        />
                        <ErrorMessage error={getDisplayError('quantity')} />
                    </div>

                    <div className={rowClass}>
                        <label className={`${labelClass} !text-emerald-400`}>MFE (Max Profit)</label>
                        <input 
                            type="number" step="0.25" inputMode="decimal"
                            value={getDisplayValue(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} 
                            onChange={(e) => handleValueChange(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached', e.target.value)}
                            onBlur={() => handleBlur(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')}
                            onKeyDown={e => handleNumberKeyDown(e, 'highestPriceReached')}
                            className={`${getInputClass(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} font-bold ${!getDisplayError(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached') ? '!text-emerald-400' : ''}`}
                            placeholder={inputMode === 'points' ? 'Pts' : ''}
                        />
                        <ErrorMessage error={getDisplayError(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} />
                    </div>
                    <div className={rowClass}>
                        <label className={`${labelClass} !text-red-400`}>MAE (Max Loss)</label>
                        <input 
                            type="number" step="0.25" inputMode="decimal"
                            value={getDisplayValue(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} 
                            onChange={(e) => handleValueChange(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached', e.target.value)}
                            onBlur={() => handleBlur(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')}
                            onKeyDown={e => handleNumberKeyDown(e, 'lowestPriceReached')}
                            className={`${getInputClass(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} font-bold ${!getDisplayError(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached') ? '!text-red-400' : ''}`}
                            placeholder={inputMode === 'points' ? 'Pts' : ''}
                        />
                        <ErrorMessage error={getDisplayError(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} />
                    </div>
                </div>
            </div>
        </div>
    );
};
