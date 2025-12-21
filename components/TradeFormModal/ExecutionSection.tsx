import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, Calendar, Clock, Plus, AlertCircle } from 'lucide-react';
import { Trade, TradeDirection, InputMode } from '../../types';
import { format, endOfMonth, isSameDay, addMonths } from 'date-fns';

interface ExecutionSectionProps {
    formData: Partial<Trade>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Trade>>>;
    inputMode: InputMode;
    entryTime: string;
    setEntryTime: (t: string) => void;
    exitTime: string;
    setExitTime: (t: string) => void;
    errors: { [key: string]: string };
    getInputClass: (field: string) => string;
    getDisplayValue: (field: keyof Trade) => string | number;
    handlePriceOrPointsChange: (field: keyof Trade, value: string) => void;
}

// Helpers
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const subMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setDate(1); // Set to 1st to avoid overflow issues during month navigation
    d.setMonth(d.getMonth() - months);
    return d;
};

export const ExecutionSection: React.FC<ExecutionSectionProps> = ({
    formData, setFormData, inputMode, entryTime, setEntryTime, exitTime, setExitTime,
    errors, getInputClass, getDisplayValue, handlePriceOrPointsChange
}) => {
    // Local UI State for Pickers
    const [showDirectionPicker, setShowDirectionPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState<'entry' | 'exit' | null>(null);
    const [isMultiExit, setIsMultiExit] = useState(false);
    const [exitPrice1, setExitPrice1] = useState<string>('');
    const [exitPrice2, setExitPrice2] = useState<string>('');

    // Refs
    const directionPickerRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<HTMLDivElement>(null);
    const timePickerRef = useRef<HTMLDivElement>(null);
    const dateRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timeEntryRefs = useRef<(HTMLInputElement | null)[]>([]);
    const timeExitRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) setShowDatePicker(false);
            if (timePickerRef.current && !timePickerRef.current.contains(event.target as Node)) setShowTimePicker(null);
            if (directionPickerRef.current && !directionPickerRef.current.contains(event.target as Node)) setShowDirectionPicker(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sync Multi Exit
    useEffect(() => {
        if (isMultiExit) {
            const v1 = parseFloat(exitPrice1);
            const v2 = parseFloat(exitPrice2);
            if (!isNaN(v1) && !isNaN(v2)) {
                let p1 = v1, p2 = v2;
                if (inputMode === 'points' && formData.entryPrice) {
                    const entry = formData.entryPrice;
                    if (formData.direction === TradeDirection.LONG) { p1 = entry + v1; p2 = entry + v2; } 
                    else { p1 = entry - v1; p2 = entry - v2; }
                }
                const avg = Math.round(((p1 + p2) / 2) * 100) / 100;
                setFormData(prev => ({ ...prev, exitPrice: avg }));
            }
        }
    }, [exitPrice1, exitPrice2, isMultiExit, inputMode, formData.entryPrice, formData.direction]);

    const handleMultiExitToggle = () => {
        setIsMultiExit(!isMultiExit);
        if (!isMultiExit) {
            const val = getDisplayValue('exitPrice');
            setExitPrice1(val.toString());
            setExitPrice2(val.toString()); 
        }
    };

    const handleDatePartChange = (part: 'y'|'m'|'d', val: string) => { 
        const cleanVal = val.replace(/\D/g, '');
        const parts = (formData.entryDate || 'YYYY-MM-DD').split('-');
        let [y, m, d] = [parts[0]||'', parts[1]||'', parts[2]||''];
        let newDateStr = '';
        if (part === 'y') newDateStr = `${cleanVal.slice(0,4)}-${m}-${d}`;
        if (part === 'm') newDateStr = `${y}-${cleanVal.slice(0,2)}-${d}`;
        if (part === 'd') newDateStr = `${y}-${m}-${cleanVal.slice(0,2)}`;
        setFormData(prev => ({ ...prev, entryDate: newDateStr }));
        if (part === 'y' && cleanVal.length === 4) dateRefs.current[1]?.focus();
        if (part === 'm' && cleanVal.length === 2) dateRefs.current[2]?.focus();
    };

    const handleTimePartChange = (type: 'entry'|'exit', part: 'h'|'m', val: string) => { 
        const cleanVal = val.replace(/\D/g, '');
        const timeStr = type === 'entry' ? entryTime : exitTime;
        const parts = timeStr.split(':');
        let [h, m] = [parts[0]||'', parts[1]||''];
        let newTimeStr = '';
        if (part === 'h') newTimeStr = `${cleanVal.slice(0,2)}:${m}`;
        if (part === 'm') newTimeStr = `${h}:${cleanVal.slice(0,2)}`;
        if (type === 'entry') {
            setEntryTime(newTimeStr);
            if (part === 'h' && cleanVal.length === 2) timeEntryRefs.current[1]?.focus();
        } else {
            setExitTime(newTimeStr);
            if (part === 'h' && cleanVal.length === 2) timeExitRefs.current[1]?.focus();
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">商品 (Symbol)</label>
                    <input name="symbol" type="text" value={formData.symbol || ''} onChange={e => setFormData(p => ({...p, symbol: e.target.value.toUpperCase()}))} className={getInputClass('symbol')} placeholder="MES" style={{ textTransform: 'uppercase' }} autoComplete="off" />
                </div>
                <div className="relative" ref={directionPickerRef}>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">方向 (Direction)</label>
                    <div className={`${getInputClass('direction').replace('p-2.5', 'p-1')} flex items-center gap-2 px-3 cursor-pointer`} onClick={() => setShowDirectionPicker(!showDirectionPicker)}>
                        {formData.direction === TradeDirection.LONG ? <ArrowUp size={14} className="text-emerald-400" /> : <ArrowDown size={14} className="text-red-400" />}
                        <span className="text-white text-sm flex-1">{formData.direction === TradeDirection.LONG ? 'Long (做多)' : 'Short (做空)'}</span>
                        <ChevronDown size={14} className="text-slate-400" />
                    </div>
                    {showDirectionPicker && (
                        <div className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-full" onMouseDown={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                                {[TradeDirection.LONG, TradeDirection.SHORT].map(dir => (
                                    <button key={dir} type="button" onClick={() => { setFormData(p => ({ ...p, direction: dir })); setShowDirectionPicker(false); }} className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${formData.direction === dir ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                                        {dir === TradeDirection.LONG ? <ArrowUp size={14} className={formData.direction === dir ? "text-white" : "text-emerald-400"} /> : <ArrowDown size={14} className={formData.direction === dir ? "text-white" : "text-red-400"} />}
                                        {dir === TradeDirection.LONG ? 'Long (做多)' : 'Short (做空)'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-5">
                <div className="col-span-2 relative" ref={datePickerRef}>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">日期 (Date)</label>
                    <div className={`${getInputClass('entryDate').replace('p-2.5', 'p-1')} flex items-center gap-0 px-2 tracking-tighter`}>
                        <button type="button" tabIndex={-1} onClick={() => setShowDatePicker(!showDatePicker)} className="text-slate-400 hover:text-white focus:outline-none mr-1"><Calendar size={14} /></button>
                        <div className="flex items-center flex-1 justify-start">
                            <input ref={el => { dateRefs.current[0] = el; }} className="bg-transparent w-9 text-center focus:outline-none placeholder-slate-600" placeholder="YYYY" value={formData.entryDate?.split('-')[0]||''} onChange={e => handleDatePartChange('y', e.target.value)} />
                            <span className="text-slate-500 select-none">-</span>
                            <input ref={el => { dateRefs.current[1] = el; }} className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" placeholder="MM" value={formData.entryDate?.split('-')[1]||''} onChange={e => handleDatePartChange('m', e.target.value)} />
                            <span className="text-slate-500 select-none">-</span>
                            <input ref={el => { dateRefs.current[2] = el; }} className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" placeholder="DD" value={formData.entryDate?.split('-')[2]||''} onChange={e => handleDatePartChange('d', e.target.value)} />
                        </div>
                    </div>
                    {errors.entryDate && <p className="text-red-400 text-xs mt-1 absolute whitespace-nowrap">{errors.entryDate}</p>}
                    {showDatePicker && (
                        <div className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-4 shadow-xl z-50 w-64" onMouseDown={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
                                <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="text-slate-400 hover:text-white"><ChevronDown size={16} className="rotate-90" /></button>
                                <span className="text-white text-sm font-semibold">{format(viewDate, 'MMM yyyy')}</span>
                                <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="text-slate-400 hover:text-white"><ChevronDown size={16} className="-rotate-90" /></button>
                            </div>
                            <div className="grid grid-cols-7 text-center gap-1">
                                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-[10px] text-slate-500">{d}</span>)}
                                {Array.from({length: startOfMonth(viewDate).getDay()}).map((_,i) => <div key={`empty-${i}`} />)}
                                {Array.from({length: endOfMonth(viewDate).getDate()}).map((_, i) => {
                                    const d = i + 1;
                                    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
                                    const isSelected = isSameDay(new Date(formData.entryDate || ''), current);
                                    return (
                                        <button key={d} type="button" onClick={() => { setFormData(p => ({...p, entryDate: format(current, 'yyyy-MM-dd')})); setShowDatePicker(false); }} className={`w-8 h-8 rounded-full text-xs flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{d}</button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">口數 (Qty)</label>
                    <input name="quantity" type="number" value={formData.quantity} onChange={e => setFormData(p=>({...p, quantity: parseFloat(e.target.value)}))} className={getInputClass('quantity')} inputMode="decimal" autoComplete="off" />
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">手續費 (Comm)</label>
                    <input name="commission" type="number" step="0.01" value={formData.commission} onChange={e => setFormData(p=>({...p, commission: parseFloat(e.target.value)}))} className={getInputClass('commission')} inputMode="decimal" autoComplete="off" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5" ref={timePickerRef}>
                {['entry', 'exit'].map(type => (
                    <div key={type} className="relative">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">{type === 'entry' ? '進場時間 (In)' : '離場時間 (Out)'}</label>
                        <div className={`${getInputClass(type === 'entry' ? 'entryTime' : 'exitTime').replace('p-2.5', 'p-1')} flex items-center gap-0 px-2`}>
                            <button type="button" tabIndex={-1} onClick={() => setShowTimePicker(showTimePicker === type ? null : type as any)} className="text-slate-400 hover:text-white focus:outline-none mr-2"><Clock size={14} /></button>
                            <div className="flex items-center flex-1 justify-start">
                                <input ref={el => { (type==='entry'?timeEntryRefs:timeExitRefs).current[0] = el; }} className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" placeholder="HH" value={(type==='entry'?entryTime:exitTime).split(':')[0]||''} onChange={e => handleTimePartChange(type as any, 'h', e.target.value)} />
                                <span className="text-slate-500 select-none px-0.5">:</span>
                                <input ref={el => { (type==='entry'?timeEntryRefs:timeExitRefs).current[1] = el; }} className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" placeholder="MM" value={(type==='entry'?entryTime:exitTime).split(':')[1]||''} onChange={e => handleTimePartChange(type as any, 'm', e.target.value)} />
                            </div>
                        </div>
                        {showTimePicker === type && (
                            <div className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-48 flex gap-1 h-48" onMouseDown={e => e.stopPropagation()}>
                                {['Hour', 'Min'].map((col, idx) => (
                                    <div key={col} className="flex-1 flex flex-col overflow-hidden">
                                        <div className="text-center text-[10px] text-slate-500 font-medium py-1 border-b border-slate-700 mb-1 sticky top-0 bg-[#1f2937]">{col}</div>
                                        <div className="overflow-y-auto flex-1 space-y-0.5 pr-0.5 custom-scrollbar">
                                            {Array.from({length: idx===0?24:60}, (_,i) => i).map(val => (
                                                <button key={val} type="button" onClick={() => {
                                                    const parts = (type==='entry'?entryTime:exitTime).split(':');
                                                    const newVal = val.toString().padStart(2,'0');
                                                    const newTime = idx===0 ? `${newVal}:${parts[1]||'00'}` : `${parts[0]||'09'}:${newVal}`;
                                                    if(type==='entry') setEntryTime(newTime); else setExitTime(newTime);
                                                    if (idx === 1) setShowTimePicker(null);
                                                }} className={`w-full text-xs py-1 rounded transition-colors text-slate-400 hover:bg-slate-700 hover:text-white`}>{val.toString().padStart(2,'0')}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-5 pt-4">
                <div>
                    <label className="block text-xs font-bold text-emerald-400 mb-1.5">入場價 (Entry Price)</label>
                    <input name="entryPrice" type="number" step="0.25" value={formData.entryPrice || ''} onChange={e => setFormData(p => ({...p, [e.target.name]: e.target.value === '' ? undefined : parseFloat(e.target.value)}))} className={`${getInputClass('entryPrice')} border-emerald-500/30 focus:border-emerald-500 bg-emerald-500/5`} placeholder="0.00" inputMode="decimal" autoComplete="off" />
                </div>
                <div className="relative">
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-rose-400">出場價 (Exit Price)</label>
                        <button type="button" tabIndex={-1} onClick={handleMultiExitToggle} className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700" title="多重出場"><Plus size={12} /></button>
                    </div>
                    {!isMultiExit ? (
                        <input name="exitPrice" type="number" step="0.25" value={getDisplayValue('exitPrice')} onChange={(e) => handlePriceOrPointsChange('exitPrice', e.target.value)} className={`${getInputClass('exitPrice')} border-rose-500/30 focus:border-rose-500 bg-rose-500/5`} placeholder={inputMode === 'price' ? "0.00" : "+/- Points"} inputMode="decimal" autoComplete="off" />
                    ) : (
                        <div className="flex gap-2">
                            <input type="number" step="0.25" value={exitPrice1} onChange={(e) => setExitPrice1(e.target.value)} className={`${getInputClass('exitPrice').replace('w-full', 'w-1/2')} border-rose-500/30 focus:border-rose-500 bg-rose-500/5`} placeholder="Exit 1" inputMode="decimal" />
                            <input type="number" step="0.25" value={exitPrice2} onChange={(e) => setExitPrice2(e.target.value)} className={`${getInputClass('exitPrice').replace('w-full', 'w-1/2')} border-rose-500/30 focus:border-rose-500 bg-rose-500/5`} placeholder="Exit 2" inputMode="decimal" />
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-xs font-bold text-amber-500 mb-1.5">{inputMode === 'price' ? '初始止損 (Stop Loss)' : '初始止損點數 (Stop Loss Pts)'}</label>
                <input name="initialStopLoss" type="number" step="0.25" value={getDisplayValue('initialStopLoss')} onChange={(e) => handlePriceOrPointsChange('initialStopLoss', e.target.value)} className={`${getInputClass('initialStopLoss')} border-amber-500/30 focus:border-amber-500 bg-amber-500/5`} placeholder={inputMode === 'price' ? "Price" : "Points"} inputMode="decimal" autoComplete="off" />
                {errors.initialStopLoss && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> {errors.initialStopLoss}</p>}
            </div>
        </div>
    );
};