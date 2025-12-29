
import React, { useState, useEffect } from 'react';
import { 
    format, endOfWeek, endOfMonth, isSameDay, isWithinInterval, addMonths, differenceInCalendarMonths,
    addDays // Added addDays to replace subDays
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (start: Date | null, end: Date | null, label: string) => void;
    initialStart: Date | null;
    initialEnd: Date | null;
}

// Local Helpers for missing date-fns exports
const startOfMonth = (date: Date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfWeek = (date: Date, { weekStartsOn }: { weekStartsOn?: number } = {}) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < (weekStartsOn || 0) ? 7 : 0) + day - (weekStartsOn || 0);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const setMonth = (date: Date, month: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(month);
    if (d.getDate() !== day) {
        d.setDate(0); // Handle month overflow
    }
    return d;
};

const setYear = (date: Date, year: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setFullYear(year);
    if (d.getDate() !== day) {
        d.setDate(0); // Handle leap year overflow
    }
    return d;
};

const PRESETS = [
    { label: 'Today', getValue: () => [new Date(), new Date()] },
    { label: 'This Week', getValue: () => [startOfWeek(new Date(), { weekStartsOn: 0 }), endOfWeek(new Date(), { weekStartsOn: 0 })] },
    { label: 'This Month', getValue: () => [startOfMonth(new Date()), endOfMonth(new Date())] },
    { label: 'Last 30 Days', getValue: () => [addDays(new Date(), -29), new Date()] },
    { label: 'Last Month', getValue: () => {
        const lastMonth = addMonths(new Date(), -1);
        return [startOfMonth(lastMonth), endOfMonth(lastMonth)];
    }},
    { label: 'All Time', getValue: () => [null, null] } 
];

const SHORT_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Generate year range (e.g., current year - 10 to + 5)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 16 }, (_, i) => currentYear - 10 + i);

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ isOpen, onClose, onApply, initialStart, initialEnd }) => {
    const [startDate, setStartDate] = useState<Date | null>(initialStart);
    const [endDate, setEndDate] = useState<Date | null>(initialEnd);
    
    // Independent View States
    const [leftViewDate, setLeftViewDate] = useState<Date>(initialStart || new Date());
    const [rightViewDate, setRightViewDate] = useState<Date>(initialEnd || addMonths(new Date(), 1));

    const [activePreset, setActivePreset] = useState<string>('');
    
    // Dropdown State: { side: 'left'|'right', type: 'month'|'year' } | null
    const [openDropdown, setOpenDropdown] = useState<{ side: 'left' | 'right', type: 'month' | 'year' } | null>(null);

    // Initialize views to ensure they are not same month if possible
    useEffect(() => {
        if (isOpen) {
            let lDate = initialStart || new Date();
            let rDate = initialEnd || addMonths(lDate, 1);
            
            if (differenceInCalendarMonths(rDate, lDate) === 0) {
                rDate = addMonths(lDate, 1);
            }
            if (rDate <= lDate) {
                rDate = addMonths(lDate, 1);
            }

            setLeftViewDate(startOfMonth(lDate));
            setRightViewDate(startOfMonth(rDate));
        }
    }, [isOpen, initialStart, initialEnd]);

    useEffect(() => {
        const handleClickOutside = () => setOpenDropdown(null);
        if (openDropdown) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openDropdown]);

    if (!isOpen) return null;

    const handlePresetClick = (label: string, getValue: () => (Date | null)[]) => {
        const [start, end] = getValue();
        setStartDate(start);
        setEndDate(end);
        setActivePreset(label);
        
        if (start) {
            setLeftViewDate(startOfMonth(start));
            let rDate = end ? startOfMonth(end) : addMonths(start, 1);
            if (differenceInCalendarMonths(rDate, start) === 0) {
                rDate = addMonths(start, 1);
            }
            setRightViewDate(rDate);
        }
    };

    const handleDayClick = (day: Date) => {
        setActivePreset(''); 
        if (!startDate || (startDate && endDate)) {
            setStartDate(day);
            setEndDate(null); 
        } else if (startDate && !endDate) {
            if (day < startDate) {
                setEndDate(startDate); 
                setStartDate(day);
            } else {
                setEndDate(day);
            }
        }
    };

    const handlePrevMonth = (side: 'left' | 'right') => {
        if (side === 'left') setLeftViewDate(prev => addMonths(prev, -1));
        else setRightViewDate(prev => addMonths(prev, -1));
    };

    const handleNextMonth = (side: 'left' | 'right') => {
        if (side === 'left') setLeftViewDate(prev => addMonths(prev, 1));
        else setRightViewDate(prev => addMonths(prev, 1));
    };

    const handleMonthSelect = (side: 'left' | 'right', monthIndex: number) => {
        if (side === 'left') {
            const newDate = setMonth(leftViewDate, monthIndex);
            setLeftViewDate(newDate);
            if (differenceInCalendarMonths(rightViewDate, newDate) <= 0) setRightViewDate(addMonths(newDate, 1));
        } else {
            const newDate = setMonth(rightViewDate, monthIndex);
            setRightViewDate(newDate);
            if (differenceInCalendarMonths(newDate, leftViewDate) <= 0) setLeftViewDate(addMonths(newDate, -1));
        }
        setOpenDropdown(null);
    };

    const handleYearSelect = (side: 'left' | 'right', year: number) => {
        if (side === 'left') {
            const newDate = setYear(leftViewDate, year);
            setLeftViewDate(newDate);
             if (differenceInCalendarMonths(rightViewDate, newDate) <= 0) setRightViewDate(addMonths(newDate, 1));
        } else {
            const newDate = setYear(rightViewDate, year);
            setRightViewDate(newDate);
             if (differenceInCalendarMonths(newDate, leftViewDate) <= 0) setLeftViewDate(addMonths(newDate, -1));
        }
        setOpenDropdown(null);
    };

    const renderCalendar = (side: 'left' | 'right') => {
        const viewDate = side === 'left' ? leftViewDate : rightViewDate;
        const isAdjacent = differenceInCalendarMonths(rightViewDate, leftViewDate) === 1;
        const disablePrev = side === 'right' && isAdjacent;
        const disableNext = side === 'left' && isAdjacent;
        const start = startOfMonth(viewDate);
        const end = endOfMonth(viewDate);
        const startDay = start.getDay();
        const days = [];
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < startDay; i++) days.push(<div key={`pad-${i}`} />);
        for (let d = 1; d <= end.getDate(); d++) {
            const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
            const isSelectedStart = startDate && isSameDay(current, startDate);
            const isSelectedEnd = endDate && isSameDay(current, endDate);
            const isSingleDay = startDate && endDate && isSameDay(startDate, endDate) && isSameDay(current, startDate);
            const isInRange = startDate && endDate && !isSingleDay && isWithinInterval(current, { start: startDate, end: endDate });
            const isSelectingRange = startDate && !endDate; // Has clicked first, waiting for second
            
            let btnClass = "w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors relative z-10 ";
            
            if (isSelectedStart || isSelectedEnd) {
                // If we are currently selecting (start exists, end is null), use lighter purple for start
                if (isSelectingRange && isSelectedStart) {
                    btnClass += "bg-primary/50 text-white font-bold shadow-lg ";
                } else {
                    btnClass += "bg-primary text-white font-bold shadow-lg shadow-primary/50 ";
                }
            } else if (isInRange) {
                btnClass += "bg-primary/20 text-primary ";
            } else {
                btnClass += "text-slate-300 hover:bg-slate-600 hover:text-white ";
            }
            days.push(<div key={d} className="flex items-center justify-center py-1"><button onClick={() => handleDayClick(current)} className={btnClass}>{d}</button></div>);
        }

        return (
            <div className="w-64">
                <div className="flex justify-between items-center mb-4 px-1 relative z-20">
                    <button onClick={() => !disablePrev && handlePrevMonth(side)} disabled={disablePrev} className={`p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors ${disablePrev ? 'opacity-30' : ''}`}><ChevronLeft size={16} /></button>
                    <div className="flex gap-2">
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown({ side, type: 'month' }); }} className="flex items-center gap-1 text-sm font-bold text-white hover:bg-slate-600 px-2 py-1 rounded transition-colors">{format(viewDate, 'MMM')}<ChevronDown size={12} className="text-slate-500" /></button>
                            {openDropdown?.side === side && openDropdown.type === 'month' && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-24 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>{SHORT_MONTHS.map((m, idx) => (<button key={m} onClick={() => handleMonthSelect(side, idx)} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${viewDate.getMonth() === idx ? 'text-primary font-bold' : 'text-slate-300'}`}>{m}</button>))}</div>
                            )}
                        </div>
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown({ side, type: 'year' }); }} className="flex items-center gap-1 text-sm font-bold text-white hover:bg-slate-600 px-2 py-1 rounded transition-colors">{format(viewDate, 'yyyy')}<ChevronDown size={12} className="text-slate-500" /></button>
                            {openDropdown?.side === side && openDropdown.type === 'year' && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>{YEARS.map((y) => (<button key={y} onClick={() => handleYearSelect(side, y)} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${viewDate.getFullYear() === y ? 'text-primary font-bold' : 'text-slate-300'}`}>{y}</button>))}</div>
                            )}
                        </div>
                    </div>
                    <button onClick={() => !disableNext && handleNextMonth(side)} disabled={disableNext} className={`p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors ${disableNext ? 'opacity-30' : ''}`}><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs text-slate-500 mb-2 text-center">{weekDays.map(wd => <div key={wd}>{wd}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">{days}</div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose}>
            {/* Changed from fixed with viewport units to absolute within the fixed wrapper and percentage units */}
            {/* Changed bg-[#1f2937] to bg-surface */}
            <div className="absolute top-16 left-0 md:left-64 bg-surface border border-slate-600 rounded-br-xl rounded-bl-xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-w-4xl max-h-[85%] z-[101] shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <div className="w-40 bg-slate-800/20 border-r border-slate-600 p-2 flex flex-col gap-1 overflow-y-auto">{PRESETS.map(preset => (<button key={preset.label} onClick={() => handlePresetClick(preset.label, preset.getValue)} className={`text-left px-4 py-2 text-sm rounded transition-colors ${activePreset === preset.label ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-600 hover:text-white'}`}>{preset.label}</button>))}</div>
                <div className="p-6 flex flex-col">
                    <div className="flex justify-end items-center mb-2"><button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-slate-600 rounded-full transition-colors"><X size={20} /></button></div>
                    <div className="flex flex-col md:flex-row gap-8 items-start relative px-8">{renderCalendar('left')}<div className="hidden md:block w-px bg-slate-600 h-64 self-center" />{renderCalendar('right')}</div>
                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-600">
                        <button onClick={() => { setStartDate(null); setEndDate(null); setActivePreset(''); }} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded hover:bg-slate-600 hover:text-white transition-colors">Clear Selection</button>
                        <button onClick={() => {
                            let finalStart = startDate;
                            let finalEnd = endDate;
                            
                            // If only start date is selected, treat it as single day selection (start == end)
                            if (finalStart && !finalEnd) {
                                finalEnd = finalStart;
                            }

                            let label = activePreset;
                            if (!label) {
                                if (finalStart && finalEnd) {
                                    if (isSameDay(finalStart, finalEnd)) label = format(finalStart, 'MM/dd/yyyy');
                                    else label = `${format(finalStart, 'MM/dd/yyyy')} - ${format(finalEnd, 'MM/dd/yyyy')}`;
                                } else label = 'All Time'; // Fallback
                            }
                            
                            onApply(finalStart, finalEnd, label);
                            onClose();
                        }} className="px-6 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded shadow-lg shadow-primary/20 transition-colors">Apply Dates</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
