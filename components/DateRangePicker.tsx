import React, { useState } from 'react';
import { format, endOfWeek, endOfMonth, isSameDay, isWithinInterval, addMonths } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import startOfMonth from 'date-fns/startOfMonth';
import subMonths from 'date-fns/subMonths';
import subDays from 'date-fns/subDays';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (start: Date | null, end: Date | null, label: string) => void;
    initialStart: Date | null;
    initialEnd: Date | null;
}

const PRESETS = [
    { label: 'Today', getValue: () => [new Date(), new Date()] },
    { label: 'This Week', getValue: () => [startOfWeek(new Date()), endOfWeek(new Date())] },
    { label: 'This Month', getValue: () => [startOfMonth(new Date()), endOfMonth(new Date())] },
    { label: 'Last 30 Days', getValue: () => [subDays(new Date(), 29), new Date()] },
    { label: 'Last Month', getValue: () => {
        const lastMonth = subMonths(new Date(), 1);
        return [startOfMonth(lastMonth), endOfMonth(lastMonth)];
    }},
    { label: 'All Time', getValue: () => [null, null] } 
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ isOpen, onClose, onApply, initialStart, initialEnd }) => {
    const [startDate, setStartDate] = useState<Date | null>(initialStart);
    const [endDate, setEndDate] = useState<Date | null>(initialEnd);
    const [viewDate, setViewDate] = useState<Date>(new Date());
    const [activePreset, setActivePreset] = useState<string>('');

    if (!isOpen) return null;

    const handlePresetClick = (label: string, getValue: () => (Date | null)[]) => {
        const [start, end] = getValue();
        setStartDate(start);
        setEndDate(end);
        setActivePreset(label);
        if (start) setViewDate(start);
    };

    const handleDayClick = (day: Date) => {
        setActivePreset(''); 
        
        // Scenario 1: Start fresh or reset
        if (!startDate || (startDate && endDate)) {
            setStartDate(day);
            setEndDate(null); // Clear end date to allow single day selection flow
        } 
        // Scenario 2: Selecting End Date (or same day)
        else if (startDate && !endDate) {
            if (day < startDate) {
                // If clicked date is before start, swap them
                setEndDate(startDate); 
                setStartDate(day);
            } else {
                // If clicked date is same as start or after, set as end
                setEndDate(day);
            }
        }
    };

    const handlePrevMonth = () => {
        setViewDate(subMonths(viewDate, 1));
    };

    const handleNextMonth = () => {
        setViewDate(addMonths(viewDate, 1));
    };

    const renderCalendar = (baseDate: Date) => {
        const start = startOfMonth(baseDate);
        const end = endOfMonth(baseDate);
        const startDay = start.getDay();
        const days = [];
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`pad-${i}`} />);
        }

        for (let d = 1; d <= end.getDate(); d++) {
            const current = new Date(baseDate.getFullYear(), baseDate.getMonth(), d);
            const isSelectedStart = startDate && isSameDay(current, startDate);
            const isSelectedEnd = endDate && isSameDay(current, endDate);
            
            // Allow highlighting for single day selection (start == end)
            const isSingleDay = startDate && endDate && isSameDay(startDate, endDate) && isSameDay(current, startDate);

            const isInRange = startDate && endDate && !isSingleDay && isWithinInterval(current, { start: startDate, end: endDate });
            
            let btnClass = "w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors relative z-10 ";
            
            if (isSelectedStart || isSelectedEnd) {
                btnClass += "bg-primary text-white font-bold shadow-lg shadow-indigo-500/50 ";
            } else if (isInRange) {
                btnClass += "bg-primary/20 text-primary ";
            } else {
                btnClass += "text-slate-300 hover:bg-slate-700 hover:text-white ";
            }

            days.push(
                <div key={d} className="flex items-center justify-center py-1">
                    <button onClick={() => handleDayClick(current)} className={btnClass}>
                        {d}
                    </button>
                </div>
            );
        }

        return (
            <div className="w-64">
                <div className="text-center font-semibold text-white mb-4">
                    {format(baseDate, 'MMM yyyy')}
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs text-slate-500 mb-2 text-center">
                    {weekDays.map(wd => <div key={wd}>{wd}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1f2937] border border-slate-700 rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-w-4xl max-h-[90vh]">
                
                <div className="w-40 bg-slate-800/50 border-r border-slate-700 p-2 flex flex-col gap-1 overflow-y-auto">
                    {PRESETS.map(preset => (
                        <button 
                            key={preset.label}
                            onClick={() => handlePresetClick(preset.label, preset.getValue)}
                            className={`text-left px-4 py-2 text-sm rounded transition-colors ${activePreset === preset.label ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 flex flex-col">
                    <div className="flex justify-end items-center mb-2">
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-start relative px-8">
                        <button onClick={handlePrevMonth} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full">
                            <ChevronLeft />
                        </button>
                        
                        {renderCalendar(viewDate)}
                        <div className="hidden md:block w-px bg-slate-700 h-64 self-center" />
                        {renderCalendar(addMonths(viewDate, 1))}

                        <button onClick={handleNextMonth} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full">
                            <ChevronRight />
                        </button>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-700">
                        <button onClick={() => { setStartDate(null); setEndDate(null); setActivePreset(''); }} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded hover:bg-slate-700 hover:text-white transition-colors">Clear Selection</button>
                        <button 
                            onClick={() => {
                                let label = activePreset;
                                if (!label) {
                                    if (startDate && endDate) {
                                        if (isSameDay(startDate, endDate)) {
                                            label = format(startDate, 'MM/dd/yyyy');
                                        } else {
                                            label = `${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`;
                                        }
                                    } else {
                                        label = 'Custom Range';
                                    }
                                }
                                onApply(startDate, endDate, label);
                                onClose();
                            }} 
                            className="px-6 py-2 bg-primary hover:bg-indigo-600 text-white text-sm font-medium rounded shadow-lg shadow-indigo-500/20 transition-colors"
                        >
                            Apply Dates
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};