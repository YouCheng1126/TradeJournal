import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Calendar, Clock, ChevronDown, ChevronRight, ChevronLeft, Plus, ArrowUp, ArrowDown, Link as LinkIcon, Target, Check, Tag as TagIcon, ListChecks, CheckSquare, Square } from 'lucide-react';
import { endOfMonth, format, isSameDay, addMonths } from 'date-fns';
import startOfMonth from 'date-fns/startOfMonth';
import subMonths from 'date-fns/subMonths';

import { Trade, TradeDirection, TradeStatus, StrategyRuleGroup } from '../types';
import { useTrades } from '../contexts/TradeContext';

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Trade;
}

type InputMode = 'price' | 'points';

export const TradeFormModal: React.FC<TradeFormModalProps> = ({ isOpen, onClose, initialData }) => {
  const { strategies, tagCategories, tags, addTrade, updateTrade } = useTrades();
  
  const [inputMode, setInputMode] = useState<InputMode>('points');
  
  const [formData, setFormData] = useState<Partial<Trade>>(initialData || {
    direction: TradeDirection.LONG,
    status: TradeStatus.WIN, // Default
    symbol: 'MES',
    quantity: 1,
    entryDate: new Date().toISOString().split('T')[0],
    tags: [],
    rulesFollowed: [],
    commission: 0,
    screenshotUrl: '',
  });

  // Strategy Rule Checklist State
  const [showRulesChecklist, setShowRulesChecklist] = useState(false);
  // Default style makes it invisible but rendered for measurement
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
      position: 'fixed',
      opacity: 0,
      pointerEvents: 'none',
      width: '320px' // Fixed width constant
  });
  
  const rulesButtonRef = useRef<HTMLButtonElement>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null); // Ref for the main modal panel
  const strategySelectRef = useRef<HTMLDivElement>(null); // Ref for the strategy dropdown wrapper
  const rulesPopupRef = useRef<HTMLDivElement>(null); // Wrapper ref for rules section
  const fixedPopoverRef = useRef<HTMLDivElement>(null); // Ref for the actual popover content

  // Helper to get current strategy rules
  const selectedStrategy = useMemo(() => {
      return strategies.find(s => s.id === formData.playbookId);
  }, [formData.playbookId, strategies]);

  // Smart Positioning for Rules Popover (Measure-Then-Show Logic)
  useLayoutEffect(() => {
      if (showRulesChecklist && rulesButtonRef.current && selectedStrategy && modalPanelRef.current && strategySelectRef.current && fixedPopoverRef.current) {
          const panelRect = modalPanelRef.current.getBoundingClientRect();
          const btnRect = rulesButtonRef.current.getBoundingClientRect();
          const selectRect = strategySelectRef.current.getBoundingClientRect();
          const contentHeight = fixedPopoverRef.current.offsetHeight; // Measure ACTUAL height
          const viewportHeight = window.innerHeight;
          
          const POP_WIDTH = 320; 
          const PANEL_TOP_OFFSET = 30; // Fixed offset from panel top

          // 1. Horizontal Position
          // Rule: Right edge of popover aligns with Right edge of Strategy Input
          // Left = SelectRight - PopoverWidth
          let leftPos = selectRect.right - POP_WIDTH;
          
          // Safety clamp
          if (leftPos < 10) leftPos = 10;

          // 2. Vertical Position Logic
          const panelTopY = panelRect.top + PANEL_TOP_OFFSET;
          const btnBottomY = btnRect.bottom;
          
          // The "Space" defined in requirement: From PanelTop+30 to ButtonBottom
          // This is the max height available for "Scenario A" (Bottom-to-Button alignment growing upwards)
          const availableSpace = btnBottomY - panelTopY;

          let newStyle: React.CSSProperties = {
              position: 'fixed',
              left: `${leftPos}px`,
              width: `${POP_WIDTH}px`,
              zIndex: 60,
              display: 'flex',
              flexDirection: 'column',
              opacity: 1, // Make visible
              pointerEvents: 'auto',
          };

          // Compare ACTUAL height with available space
          if (contentHeight <= availableSpace) {
              // Condition A: Content fits in the space above the button
              // Align popover bottom to button bottom
              // Top = ButtonBottom - ContentHeight
              newStyle.top = `${btnBottomY - contentHeight}px`;
              newStyle.height = `${contentHeight}px`; // Explicit height to prevent layout shift
          } else {
              // Condition B: Content is too tall for the space above
              // Align popover top to PanelTop + 30
              newStyle.top = `${panelTopY}px`;
              // Extend downwards, usually to bottom of screen with some buffer
              const maxAvailableHeight = viewportHeight - panelTopY - 20; 
              newStyle.maxHeight = `${maxAvailableHeight}px`;
          }

          setPopoverStyle(newStyle);
      } else if (!showRulesChecklist) {
          // Reset style when closed to be ready for next measurement
          setPopoverStyle({
              position: 'fixed',
              opacity: 0,
              pointerEvents: 'none',
              width: '320px'
          });
      }
  }, [showRulesChecklist, selectedStrategy]); // Re-run if strategy (content) changes

  // State for active dropdown category (Replacing Accordion)
  const [activeTagDropdown, setActiveTagDropdown] = useState<string | null>(null); // For Tag selector
  
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Time state (HH:MM string)
  const [entryTime, setEntryTime] = useState<string>('09:30');
  const [exitTime, setExitTime] = useState<string>('16:00');
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [shakeFields, setShakeFields] = useState<string[]>([]);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());

  const [showTimePicker, setShowTimePicker] = useState<'entry' | 'exit' | null>(null);
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  
  // Track time picker selection progress
  const [timeSelection, setTimeSelection] = useState<{hour: boolean, minute: boolean}>({ hour: false, minute: false });

  // Multi Exit Logic
  const [isMultiExit, setIsMultiExit] = useState(false);
  const [exitPrice1, setExitPrice1] = useState<string>('');
  const [exitPrice2, setExitPrice2] = useState<string>('');

  const datePickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const directionPickerRef = useRef<HTMLDivElement>(null);
  const statusPickerRef = useRef<HTMLDivElement>(null);

  // Refs for auto-focusing split inputs
  const dateRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timeEntryRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timeExitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const shakeStyle = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
    .animate-shake {
      animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
      border-color: #ef4444 !important;
      background-color: rgba(239, 68, 68, 0.1) !important;
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #4b5563; 
        border-radius: 2px;
    }
  `;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
            setShowDatePicker(false);
        }
        if (timePickerRef.current && !timePickerRef.current.contains(event.target as Node)) {
            setShowTimePicker(null);
            setTimeSelection({ hour: false, minute: false });
        }
        if (directionPickerRef.current && !directionPickerRef.current.contains(event.target as Node)) {
            setShowDirectionPicker(false);
        }
        if (statusPickerRef.current && !statusPickerRef.current.contains(event.target as Node)) {
            setShowStatusPicker(false);
        }
        // Handle dropdown outside click
        if (activeTagDropdown && tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
            setActiveTagDropdown(null);
        }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeTagDropdown, showRulesChecklist]);

  // Separate outside click handler for the Fixed Popover to manage closing logic
  useEffect(() => {
      function handleFixedClickOutside(event: MouseEvent) {
          if (showRulesChecklist && 
              fixedPopoverRef.current && 
              !fixedPopoverRef.current.contains(event.target as Node) && 
              rulesButtonRef.current && 
              !rulesButtonRef.current.contains(event.target as Node)) {
              setShowRulesChecklist(false);
          }
      }
      document.addEventListener("mousedown", handleFixedClickOutside);
      return () => document.removeEventListener("mousedown", handleFixedClickOutside);
  }, [showRulesChecklist]);


  // Adjust rules popup position based on available space
  const handleToggleRules = () => {
      setShowRulesChecklist(!showRulesChecklist);
  };

  useEffect(() => {
    if (initialData) {
        setFormData(initialData);
        if (initialData.exitPrice) {
            setExitPrice1(initialData.exitPrice.toString());
        }

        try {
            const utcDate = new Date(initialData.entryDate);
            if (!isNaN(utcDate.getTime())) {
                 const taiwanTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
                 const isoParts = taiwanTime.toISOString().split('T');
                 setFormData(prev => ({ ...prev, entryDate: isoParts[0] }));
                 setEntryTime(isoParts[1].substring(0, 5));
            }
            
            if (initialData.exitDate) {
                 const utcExit = new Date(initialData.exitDate);
                 if (!isNaN(utcExit.getTime())) {
                    const taiwanExit = new Date(utcExit.getTime() + (8 * 60 * 60 * 1000));
                    const exitIsoParts = taiwanExit.toISOString().split('T');
                    setExitTime(exitIsoParts[1].substring(0, 5));
                 }
            }
        } catch (e) {
            console.error("Error parsing initial date", e);
        }
    }
  }, [initialData]);

  // Sync multi-exit logic: Calculates average price
  useEffect(() => {
      if (isMultiExit) {
          const v1 = parseFloat(exitPrice1);
          const v2 = parseFloat(exitPrice2);
          if (!isNaN(v1) && !isNaN(v2)) {
              let p1 = v1;
              let p2 = v2;
              
              if (inputMode === 'points' && formData.entryPrice) {
                  const entry = formData.entryPrice;
                  if (formData.direction === TradeDirection.LONG) {
                      p1 = entry + v1;
                      p2 = entry + v2;
                  } else {
                      p1 = entry - v1;
                      p2 = entry - v2;
                  }
              }

              const avg = Math.round(((p1 + p2) / 2) * 100) / 100;
              setFormData(prev => ({ ...prev, exitPrice: avg }));
          }
      }
  }, [exitPrice1, exitPrice2, isMultiExit, inputMode, formData.entryPrice, formData.direction]);

  
  const handleMultiExitToggle = () => {
    const nextState = !isMultiExit;
    setIsMultiExit(nextState);
    if (nextState) {
        let val = '';
        const currentDisplay = getDisplayValue('exitPrice');
        if (currentDisplay !== '') {
            val = currentDisplay.toString();
        }
        setExitPrice1(val);
        setExitPrice2(val); 
    }
  };

  useEffect(() => {
      const sl = formData.initialStopLoss;
      const exit = formData.exitPrice;
      const direction = formData.direction;

      if (sl !== undefined && exit !== undefined && sl === exit) {
          if (direction === TradeDirection.LONG) {
              if (formData.lowestPriceReached !== sl) {
                 setFormData(prev => ({ ...prev, lowestPriceReached: sl }));
              }
          } else {
               if (formData.highestPriceReached !== sl) {
                   setFormData(prev => ({ ...prev, highestPriceReached: sl }));
               }
          }
      }
  }, [formData.initialStopLoss, formData.exitPrice, formData.direction]);

  const toggleTagDropdown = (catId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setActiveTagDropdown(prev => prev === catId ? null : catId);
  }

  // --- Real-time Validation Effect ---
  useEffect(() => {
    const newErrors: { [key: string]: string } = {};
    const { direction, entryPrice, initialStopLoss, exitPrice, highestPriceReached, lowestPriceReached } = formData;
    const entry = Number(entryPrice);
    const sl = Number(initialStopLoss);
    const exit = Number(exitPrice);
    const high = Number(highestPriceReached); 
    const low = Number(lowestPriceReached);   

    const has = (v: any) => v !== undefined && !isNaN(v);

    if (direction === TradeDirection.LONG && has(entry)) {
        if (has(sl) && sl >= entry) newErrors.initialStopLoss = "做多: 初始止損必須 < 入場價";
        if (has(sl) && has(exit) && sl > exit) newErrors.initialStopLoss = "做多: 初始止損必須 <= 出場價";
    } else if (direction === TradeDirection.SHORT && has(entry)) {
        if (has(sl) && sl <= entry) newErrors.initialStopLoss = "做空: 初始止損必須 > 入場價";
        if (has(sl) && has(exit) && sl < exit) newErrors.initialStopLoss = "做空: 初始止損必須 >= 出場價";
    }
    setErrors(newErrors);
  }, [formData, entryTime, exitTime]);


  const handlePriceOrPointsChange = (fieldName: keyof Trade, valueStr: string) => {
      const val = valueStr === '' ? undefined : parseFloat(valueStr);
      if (inputMode === 'price' || !formData.entryPrice) {
          setFormData(prev => ({ ...prev, [fieldName]: val }));
          return;
      }
      if (val === undefined) {
           setFormData(prev => ({ ...prev, [fieldName]: undefined }));
           return;
      }
      const entry = formData.entryPrice;
      const isLong = formData.direction === TradeDirection.LONG;
      let calculatedPrice = 0;
      if (isLong) {
          if (fieldName === 'exitPrice' || fieldName === 'highestPriceReached' || fieldName === 'bestExitPrice') {
              calculatedPrice = entry + val;
          } else {
              calculatedPrice = entry - val;
          }
      } else {
          if (fieldName === 'exitPrice' || fieldName === 'lowestPriceReached' || fieldName === 'bestExitPrice') {
              calculatedPrice = entry - val; 
          } else {
              calculatedPrice = entry + val;
          }
      }
      calculatedPrice = Math.round(calculatedPrice * 100) / 100;
      setFormData(prev => ({ ...prev, [fieldName]: calculatedPrice }));
  };

  const getDisplayValue = (fieldName: keyof Trade): string | number => {
      const val = formData[fieldName];
      if (val === undefined || val === null) return '';
      if (inputMode === 'price' || !formData.entryPrice) return val as number;
      const entry = formData.entryPrice;
      const isLong = formData.direction === TradeDirection.LONG;
      let points = 0;
      if (isLong) {
          if (fieldName === 'exitPrice' || fieldName === 'highestPriceReached' || fieldName === 'bestExitPrice') {
              points = (val as number) - entry;
          } else {
              points = entry - (val as number);
          }
      } else {
          if (fieldName === 'exitPrice' || fieldName === 'lowestPriceReached' || fieldName === 'bestExitPrice') {
              points = entry - (val as number);
          } else {
              points = (val as number) - entry;
          }
      }
      return Math.round(points * 100) / 100;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;
    if (type === 'number') {
        val = value === '' ? undefined : parseFloat(value);
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleExcursionChange = (type: 'maxProfit' | 'maxLoss', valueStr: string) => {
      const isLong = formData.direction === TradeDirection.LONG;
      let targetField: keyof Trade;
      if (type === 'maxProfit') {
          targetField = isLong ? 'highestPriceReached' : 'lowestPriceReached';
      } else {
          targetField = isLong ? 'lowestPriceReached' : 'highestPriceReached';
      }
      handlePriceOrPointsChange(targetField, valueStr);
  };

  const handleSetBestExitToMaxProfit = () => {
      const isLong = formData.direction === TradeDirection.LONG;
      const maxProfitPrice = isLong ? formData.highestPriceReached : formData.lowestPriceReached;
      
      if (maxProfitPrice !== undefined) {
          setFormData(prev => ({ ...prev, bestExitPrice: maxProfitPrice }));
      }
  };

  const triggerShake = (fields: string[]) => {
      setShakeFields(fields);
      setTimeout(() => {
          setShakeFields([]);
      }, 500); 
  };

  const getMissingFields = () => {
    const isLong = formData.direction === TradeDirection.LONG;
    const requiredFields = ['symbol', 'quantity', 'entryPrice', 'exitPrice', 'initialStopLoss', 'status'];
    requiredFields.push(isLong ? 'highestPriceReached' : 'lowestPriceReached'); 
    requiredFields.push(isLong ? 'lowestPriceReached' : 'highestPriceReached'); 

    return requiredFields.filter(f => {
        const val = formData[f as keyof Trade];
        return val === undefined || val === null || val === '';
    });
  };

  const isFormInvalid = useMemo(() => {
      const missing = getMissingFields();
      return missing.length > 0 || Object.keys(errors).length > 0;
  }, [formData, errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields = getMissingFields();
    if (missingFields.length > 0 || Object.keys(errors).length > 0) {
        const allInvalid = [...missingFields, ...Object.keys(errors)];
        triggerShake(allInvalid);
        setTouched(prev => {
            const next = { ...prev };
            allInvalid.forEach(k => next[k] = true);
            return next;
        });
        return; 
    }

    const dateStr = formData.entryDate;
    const entryIsoWithOffset = `${dateStr}T${entryTime}:00+08:00`;
    const exitIsoWithOffset = `${dateStr}T${exitTime}:00+08:00`; 
    
    const entryDateObj = new Date(entryIsoWithOffset);
    const exitDateObj = new Date(exitIsoWithOffset);

    if (isNaN(entryDateObj.getTime())) {
        alert("無效的日期或時間格式。");
        return;
    }

    const tradeData = {
        ...formData,
        id: formData.id || crypto.randomUUID(), 
        entryDate: entryDateObj.toISOString(), 
        exitDate: exitDateObj.toISOString(),
    } as Trade;

    try {
        if (initialData) await updateTrade(tradeData);
        else await addTrade(tradeData);
        onClose();
    } catch (err) {
        console.error("Save Error:", err);
        alert("儲存失敗");
    }
  };

  // Checklist Helpers
  const toggleRuleCheck = (ruleId: string) => {
      setFormData(prev => {
          const current = prev.rulesFollowed || [];
          if (current.includes(ruleId)) {
              return { ...prev, rulesFollowed: current.filter(id => id !== ruleId) };
          } else {
              return { ...prev, rulesFollowed: [...current, ruleId] };
          }
      });
  };

  const getStrategyProgress = () => {
      if (!selectedStrategy || !selectedStrategy.rules) return { checked: 0, total: 0 };
      let total = 0;
      let checked = 0;
      selectedStrategy.rules.forEach(group => {
          // If legacy string
          if (typeof group === 'string') {
              total++; 
              // Legacy doesn't support ID tracking well, ignore for now
          } else {
              // New format
              total += group.items.length;
              group.items.forEach(item => {
                  if (formData.rulesFollowed?.includes(item.id)) checked++;
              });
          }
      });
      return { checked, total };
  };

  const getInputClass = (fieldName: string) => {
      let baseClass = "w-full bg-surface/50 border rounded-lg p-2.5 text-white text-sm focus:outline-none transition-all shadow-sm placeholder-slate-600 font-mono h-[42px] ";
      const hasError = (touched[fieldName] && errors[fieldName]) || shakeFields.includes(fieldName) || (touched[fieldName] && getMissingFields().includes(fieldName));
      const isShaking = shakeFields.includes(fieldName);

      if (hasError || isShaking) {
          baseClass += "border-red-500 focus:border-red-500 bg-red-500/10 ";
          if (isShaking) baseClass += "animate-shake ";
      } else {
          baseClass += "border-slate-700 focus:border-primary hover:border-slate-600 ";
      }
      return baseClass;
  };

  // ... (Previous Render Helpers kept same: renderDirectionPicker, renderDateInput etc. Assuming they are part of original file content, I only modify what's needed below or surrounding logic)
  const renderDirectionPicker = () => {
      // (Implementation hidden for brevity, same as before)
       return (
        <div 
            className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-full"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col gap-1">
                <button
                    type="button"
                    onClick={() => {
                        setFormData(prev => ({ ...prev, direction: TradeDirection.LONG }));
                        setShowDirectionPicker(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${formData.direction === TradeDirection.LONG ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                >
                    <ArrowUp size={14} className={formData.direction === TradeDirection.LONG ? "text-white" : "text-emerald-400"} />
                    Long (做多)
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setFormData(prev => ({ ...prev, direction: TradeDirection.SHORT }));
                        setShowDirectionPicker(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${formData.direction === TradeDirection.SHORT ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                >
                    <ArrowDown size={14} className={formData.direction === TradeDirection.SHORT ? "text-white" : "text-red-400"} />
                    Short (做空)
                </button>
            </div>
        </div>
    );
  };
  const renderDirectionInput = () => { 
    const containerClass = getInputClass('direction').replace('p-2.5', 'p-1');
    const isLong = formData.direction === TradeDirection.LONG;
    return (
        <div className="relative" ref={directionPickerRef}>
            <div 
                className={`${containerClass} flex items-center gap-2 px-3 cursor-pointer`}
                onClick={() => setShowDirectionPicker(!showDirectionPicker)}
            >
                {isLong ? <ArrowUp size={14} className="text-emerald-400" /> : <ArrowDown size={14} className="text-red-400" />}
                <span className="text-white text-sm flex-1">{isLong ? 'Long (做多)' : 'Short (做空)'}</span>
                <ChevronDown size={14} className="text-slate-400" />
            </div>
            {showDirectionPicker && renderDirectionPicker()}
        </div>
    );
  };
  const renderStatusPicker = () => { 
      const statuses = Object.values(TradeStatus);
      return (
        <div 
            className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-full"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col gap-1">
                {statuses.map(status => {
                    let color = 'text-slate-300';
                    if (status === TradeStatus.WIN || status === TradeStatus.SMALL_WIN) color = 'text-emerald-400';
                    if (status === TradeStatus.LOSS || status === TradeStatus.SMALL_LOSS) color = 'text-red-400';
                    
                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => {
                                setFormData(prev => ({ ...prev, status: status }));
                                setShowStatusPicker(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${formData.status === status ? 'bg-primary text-white font-bold' : 'hover:bg-slate-700 hover:text-white ' + color}`}
                        >
                            {status}
                        </button>
                    )
                })}
            </div>
        </div>
      );
  };
  const renderStatusInput = () => { 
      const containerClass = getInputClass('status').replace('p-2.5', 'p-1');
      let statusColor = 'text-white';
      if (formData.status === TradeStatus.WIN || formData.status === TradeStatus.SMALL_WIN) statusColor = 'text-emerald-400 font-bold';
      if (formData.status === TradeStatus.LOSS || formData.status === TradeStatus.SMALL_LOSS) statusColor = 'text-red-400 font-bold';
      if (formData.status === TradeStatus.BREAK_EVEN) statusColor = 'text-slate-300';

      return (
        <div className="relative" ref={statusPickerRef}>
            <div 
                className={`${containerClass} flex items-center gap-2 px-3 cursor-pointer`}
                onClick={() => setShowStatusPicker(!showStatusPicker)}
            >
                <span className={`text-sm flex-1 ${statusColor}`}>{formData.status}</span>
                <ChevronDown size={14} className="text-slate-400" />
            </div>
            {showStatusPicker && renderStatusPicker()}
        </div>
      );
  };
  const handleDatePartChange = (part: 'y'|'m'|'d', val: string) => { 
      const cleanVal = val.replace(/\D/g, '');
      const parts = (formData.entryDate || 'YYYY-MM-DD').split('-');
      const y = parts[0] || '';
      const m = parts[1] || '';
      const d = parts[2] || '';
      
      let newDateStr = '';
      if (part === 'y') newDateStr = `${cleanVal.slice(0,4)}-${m}-${d}`;
      if (part === 'm') newDateStr = `${y}-${cleanVal.slice(0,2)}-${d}`;
      if (part === 'd') newDateStr = `${y}-${m}-${cleanVal.slice(0,2)}`;
      
      setFormData(prev => ({ ...prev, entryDate: newDateStr }));
      
      if (part === 'y' && cleanVal.length === 4) dateRefs.current[1]?.focus();
      if (part === 'm' && cleanVal.length === 2) dateRefs.current[2]?.focus();
  };
  const renderDateInput = () => { 
      const parts = (formData.entryDate || '').split('-');
      const y = parts[0] || '';
      const m = parts[1] || '';
      const d = parts[2] || '';
      const containerClass = getInputClass('entryDate').replace('p-2.5', 'p-1'); 
      return (
          <div className={`${containerClass} flex items-center gap-0 px-2 tracking-tighter`}>
              <button 
                type="button" 
                tabIndex={-1}
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="text-slate-400 hover:text-white focus:outline-none mr-1"
              >
                  <Calendar size={14} />
              </button>
              <div className="flex items-center flex-1 justify-start">
                  <input 
                    ref={el => { dateRefs.current[0] = el; }}
                    className="bg-transparent w-9 text-center focus:outline-none placeholder-slate-600" 
                    placeholder="YYYY" 
                    value={y} 
                    onChange={e => handleDatePartChange('y', e.target.value)}
                  />
                  <span className="text-slate-500 select-none">-</span>
                  <input 
                    ref={el => { dateRefs.current[1] = el; }}
                    className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" 
                    placeholder="MM" 
                    value={m} 
                    onChange={e => handleDatePartChange('m', e.target.value)}
                  />
                  <span className="text-slate-500 select-none">-</span>
                  <input 
                    ref={el => { dateRefs.current[2] = el; }}
                    className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" 
                    placeholder="DD" 
                    value={d} 
                    onChange={e => handleDatePartChange('d', e.target.value)}
                  />
              </div>
          </div>
      );
  };
  const handleTimePartChange = (type: 'entry'|'exit', part: 'h'|'m', val: string) => { 
      const cleanVal = val.replace(/\D/g, '');
      const timeStr = type === 'entry' ? entryTime : exitTime;
      const parts = timeStr.split(':');
      const h = parts[0] || '';
      const m = parts[1] || '';
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
  const renderTimeInput = (type: 'entry' | 'exit') => { 
      const timeStr = type === 'entry' ? entryTime : exitTime;
      const parts = timeStr.split(':');
      const h = parts[0] || '';
      const m = parts[1] || '';
      const errorKey = type === 'entry' ? 'entryTime' : 'exitTime';
      const containerClass = getInputClass(errorKey).replace('p-2.5', 'p-1');
      const refs = type === 'entry' ? timeEntryRefs : timeExitRefs;
      return (
          <div className={`${containerClass} flex items-center gap-0 px-2`}>
               <button 
                   type="button" 
                   tabIndex={-1}
                   onClick={() => {
                       setShowTimePicker(showTimePicker === type ? null : type);
                       setTimeSelection({ hour: false, minute: false });
                   }}
                   className="text-slate-400 hover:text-white focus:outline-none mr-2"
               >
                   <Clock size={14} />
               </button>
               <div className="flex items-center flex-1 justify-start">
                    <input 
                        ref={el => { refs.current[0] = el; }}
                        className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" 
                        placeholder="HH" 
                        value={h} 
                        onChange={e => handleTimePartChange(type, 'h', e.target.value)}
                    />
                    <span className="text-slate-500 select-none px-0.5">:</span>
                    <input 
                        ref={el => { refs.current[1] = el; }}
                        className="bg-transparent w-6 text-center focus:outline-none placeholder-slate-600" 
                        placeholder="MM" 
                        value={m} 
                        onChange={e => handleTimePartChange(type, 'm', e.target.value)}
                    />
               </div>
          </div>
      );
  };
  const renderTimePicker = (type: 'entry' | 'exit') => { 
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const minutes = Array.from({ length: 60 }, (_, i) => i); 
      const currentTimeStr = type === 'entry' ? entryTime : exitTime;
      let currentHour = NaN;
      let currentMinute = NaN;
      if (currentTimeStr && currentTimeStr.includes(':')) {
          const parts = currentTimeStr.split(':');
          currentHour = parseInt(parts[0], 10);
          currentMinute = parseInt(parts[1], 10);
      }
      const handleHourSelect = (h: number) => {
          const hStr = h.toString().padStart(2, '0');
          const mStr = (isNaN(currentMinute) ? 0 : currentMinute).toString().padStart(2, '0');
          const newTime = `${hStr}:${mStr}`;
          if (type === 'entry') setEntryTime(newTime);
          else setExitTime(newTime);
          const newSelection = { ...timeSelection, hour: true };
          setTimeSelection(newSelection);
          if (newSelection.hour && newSelection.minute) {
              setShowTimePicker(null);
          }
      };
      const handleMinuteSelect = (m: number) => {
          const hStr = (isNaN(currentHour) ? 9 : currentHour).toString().padStart(2, '0');
          const mStr = m.toString().padStart(2, '0');
          const newTime = `${hStr}:${mStr}`;
          if (type === 'entry') setEntryTime(newTime);
          else setExitTime(newTime);
          const newSelection = { ...timeSelection, minute: true };
          setTimeSelection(newSelection);
          if (newSelection.hour && newSelection.minute) {
              setShowTimePicker(null);
          }
      };
      return (
          <div 
            className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-2 shadow-xl z-50 w-48 flex gap-1 h-48" 
            onMouseDown={(e) => e.stopPropagation()}
          >
              <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="text-center text-[10px] text-slate-500 font-medium py-1 border-b border-slate-700 mb-1 sticky top-0 bg-[#1f2937]">Hour</div>
                  <div className="overflow-y-auto flex-1 space-y-0.5 pr-0.5 custom-scrollbar">
                      {hours.map(h => (
                          <button 
                            key={h}
                            type="button"
                            onClick={() => handleHourSelect(h)}
                            className={`w-full text-xs py-1 rounded transition-colors ${h === currentHour ? 'bg-primary text-white font-bold' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                          >
                              {h.toString().padStart(2, '0')}
                          </button>
                      ))}
                  </div>
              </div>
              <div className="w-px bg-slate-700 my-1"></div>
              <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="text-center text-[10px] text-slate-500 font-medium py-1 border-b border-slate-700 mb-1 sticky top-0 bg-[#1f2937]">Min</div>
                  <div className="overflow-y-auto flex-1 space-y-0.5 pr-0.5 custom-scrollbar">
                       {minutes.map(m => (
                          <button 
                            key={m}
                            type="button"
                            onClick={() => handleMinuteSelect(m)}
                            className={`w-full text-xs py-1 rounded transition-colors ${m === currentMinute ? 'bg-primary text-white font-bold' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                          >
                              {m.toString().padStart(2, '0')}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      );
  };
  const renderCalendar = () => { 
     const start = startOfMonth(viewDate);
     const end = endOfMonth(viewDate);
     const startDay = start.getDay();
     const days = [];
     for(let i=0; i<startDay; i++) days.push(<div key={`empty-${i}`} />);
     for(let d=1; d<=end.getDate(); d++) {
         const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
         let isSelected = false;
         if (formData.entryDate) {
             const currentDate = new Date(formData.entryDate);
             if (!isNaN(currentDate.getTime())) {
                 isSelected = isSameDay(currentDate, current);
             }
         }
         days.push(
             <button 
                key={d} 
                type="button"
                onClick={() => {
                    const dateStr = format(current, 'yyyy-MM-dd');
                    setFormData(prev => ({...prev, entryDate: dateStr}));
                    setShowDatePicker(false);
                    setTouched(prev => ({...prev, entryDate: true}));
                }}
                className={`w-8 h-8 rounded-full text-xs flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-700'}`}
             >
                 {d}
             </button>
         );
     }
     return (
         <div className="absolute top-full left-0 mt-2 bg-[#1f2937] border border-slate-600 rounded-xl p-4 shadow-xl z-50 w-64" onMouseDown={(e) => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-4">
                 <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="text-slate-400 hover:text-white"><ChevronLeft size={16}/></button>
                 <span className="text-white text-sm font-semibold">{format(viewDate, 'MMM yyyy')}</span>
                 <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="text-slate-400 hover:text-white"><ChevronRight size={16}/></button>
             </div>
             <div className="grid grid-cols-7 text-center gap-1">
                 {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-[10px] text-slate-500">{d}</span>)}
                 {days}
             </div>
         </div>
     );
  };

  if (!isOpen) return null;

  const textInputProps = {
      inputMode: "decimal" as const,
      autoComplete: "off",
  };
  
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <style>{shakeStyle}</style>

      {/* Main Container - Flex Column Layout instead of Overflow-Y */}
      <div ref={modalPanelRef} className="bg-[#1f2937] w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/50 shadow-2xl">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full overflow-hidden">
          
          {/* Header - Fixed - Added rounded-t-2xl */}
          <div className="bg-[#1f2937] border-b border-slate-700/50 p-5 flex justify-between items-center z-20 flex-shrink-0 rounded-t-2xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                {initialData ? '編輯交易 (Edit)' : '新增交易 (New)'}
            </h2>
            <div className="flex items-center gap-4">
                 <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button type="button" onClick={() => setInputMode('price')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${inputMode === 'price' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>價格</button>
                    <button type="button" onClick={() => setInputMode('points')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${inputMode === 'points' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>點數</button>
                 </div>
                <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700"><X size={20} /></button>
            </div>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 pb-40"> {/* pb-40 allows space for dropdowns at bottom */}
                <div className="space-y-6">
                  {/* REMOVED EXECUTION HEADER */}
                  
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">商品 (Symbol)</label>
                      <input name="symbol" type="text" value={formData.symbol || ''} onChange={handleChange} className={getInputClass('symbol')} placeholder="MES" style={{ textTransform: 'uppercase' }} autoComplete="off" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">方向 (Direction)</label>
                      {renderDirectionInput()}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-5">
                     <div className="col-span-2 relative" ref={datePickerRef}>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">日期 (Date)</label>
                        {renderDateInput()}
                        {errors.entryDate && <p className="text-red-400 text-xs mt-1 absolute whitespace-nowrap">{errors.entryDate}</p>}
                        {showDatePicker && renderCalendar()}
                     </div>
                     <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">口數 (Qty)</label>
                        <input name="quantity" type="number" value={formData.quantity} onChange={handleChange} className={getInputClass('quantity')} {...textInputProps} />
                     </div>
                     <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">手續費 (Comm)</label>
                        <input name="commission" type="number" step="0.01" value={formData.commission} onChange={handleChange} className={getInputClass('commission')} {...textInputProps} />
                     </div>
                  </div>

                   <div className="grid grid-cols-2 gap-5" ref={timePickerRef}>
                        <div className="relative">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">進場時間 (In - UTC+8)</label>
                            {renderTimeInput('entry')}
                            {errors.entryTime && <p className="text-red-400 text-xs mt-1 absolute">{errors.entryTime}</p>}
                            {showTimePicker === 'entry' && renderTimePicker('entry')}
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">離場時間 (Out - UTC+8)</label>
                            {renderTimeInput('exit')}
                            {errors.exitTime && <p className="text-red-400 text-xs mt-1 absolute">{errors.exitTime}</p>}
                            {showTimePicker === 'exit' && renderTimePicker('exit')}
                        </div>
                   </div>

                  <div className="grid grid-cols-2 gap-5 pt-4">
                     <div>
                        <label className="block text-xs font-bold text-emerald-400 mb-1.5">入場價 (Entry Price)</label>
                        <input name="entryPrice" type="number" step="0.25" value={formData.entryPrice || ''} onChange={handleChange} className={`${getInputClass('entryPrice')} border-emerald-500/30 focus:border-emerald-500 bg-emerald-500/5`} placeholder="0.00" {...textInputProps} />
                     </div>
                     <div className="relative">
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-rose-400">出場價 (Exit Price)</label>
                            <button type="button" tabIndex={-1} onClick={handleMultiExitToggle} className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700" title="多重出場 (Multiple Exits)">
                                <Plus size={12} />
                            </button>
                        </div>
                        {!isMultiExit ? (
                            <input name="exitPrice" type="number" step="0.25" value={getDisplayValue('exitPrice')} onChange={(e) => handlePriceOrPointsChange('exitPrice', e.target.value)} className={`${getInputClass('exitPrice')} border-rose-500/30 focus:border-rose-500 bg-rose-500/5`} placeholder={inputMode === 'price' ? "0.00" : "+/- Points"} {...textInputProps} />
                        ) : (
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    step="0.25" 
                                    value={exitPrice1} 
                                    onChange={(e) => setExitPrice1(e.target.value)} 
                                    className={`${getInputClass('exitPrice').replace('w-full', 'w-1/2')} border-rose-500/30 focus:border-rose-500 bg-rose-500/5`} 
                                    placeholder={`Exit 1 ${inputMode === 'points' ? '(Pts)' : ''}`}
                                    {...textInputProps} 
                                />
                                <input 
                                    type="number" 
                                    step="0.25" 
                                    value={exitPrice2} 
                                    onChange={(e) => setExitPrice2(e.target.value)} 
                                    className={`${getInputClass('exitPrice').replace('w-full', 'w-1/2')} border-rose-500/30 focus:border-rose-500 bg-rose-500/5`} 
                                    placeholder={`Exit 2 ${inputMode === 'points' ? '(Pts)' : ''}`}
                                    {...textInputProps} 
                                />
                            </div>
                        )}
                     </div>
                  </div>

                  {/* 3. Initial Stop Loss (Moved here from Right Column) */}
                  <div className="mt-4">
                     <label className="block text-xs font-bold text-amber-500 mb-1.5">
                        {inputMode === 'price' ? '初始止損 (Stop Loss)' : '初始止損點數 (Stop Loss Pts)'}
                     </label>
                     <input name="initialStopLoss" type="number" step="0.25" value={getDisplayValue('initialStopLoss')} onChange={(e) => handlePriceOrPointsChange('initialStopLoss', e.target.value)} className={`${getInputClass('initialStopLoss')} border-amber-500/30 focus:border-amber-500 bg-amber-500/5`} placeholder={inputMode === 'price' ? "Price" : "Points"} {...textInputProps} />
                     {errors.initialStopLoss && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> {errors.initialStopLoss}</p>}
                   </div>
                </div>

                <div className="space-y-6">
                   {/* REMOVED ANALYSIS HEADER */}
                   
                   {/* 1. Max Profit / Max Loss */}
                   <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-emerald-400 mb-1.5">
                                {inputMode === 'price' ? '最大浮盈 (Max Profit)' : '最大浮盈點數 (Max Profit)'}
                            </label>
                            <input type="number" step="0.25" value={getDisplayValue(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} onChange={(e) => handleExcursionChange('maxProfit', e.target.value)} className={getInputClass(formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached')} {...textInputProps} />
                            {errors[formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached'] && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> {errors[formData.direction === TradeDirection.LONG ? 'highestPriceReached' : 'lowestPriceReached']}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-rose-400 mb-1.5">
                                {inputMode === 'price' ? '最大浮虧 (Max Loss)' : '最大浮虧點數 (Max Loss)'}
                            </label>
                            <input type="number" step="0.25" value={getDisplayValue(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} onChange={(e) => handleExcursionChange('maxLoss', e.target.value)} className={getInputClass(formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached')} {...textInputProps} />
                            {errors[formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached'] && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> {errors[formData.direction === TradeDirection.LONG ? 'lowestPriceReached' : 'highestPriceReached']}</p>}
                        </div>
                   </div>

                   {/* 2. Status & Best Exit */}
                   <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">交易結果 (Status)</label>
                            {renderStatusInput()}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-medium text-slate-400">最佳離場價 (Best Exit)</label>
                                <button 
                                    type="button" 
                                    tabIndex={-1} 
                                    onClick={handleSetBestExitToMaxProfit} 
                                    className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700" 
                                    title="同步最大浮盈"
                                >
                                    <Target size={12} />
                                </button>
                            </div>
                            <input name="bestExitPrice" type="number" step="0.25" value={getDisplayValue('bestExitPrice')} onChange={(e) => handlePriceOrPointsChange('bestExitPrice', e.target.value)} className={getInputClass('bestExitPrice')} placeholder={inputMode === 'price' ? "Price" : "Points"} {...textInputProps} />
                        </div>
                   </div>
                   
                   {/* Strategy Section */}
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">交易策略 (Strategy)</label>
                      <div className="flex gap-2 relative">
                          <div className="relative flex-1" ref={strategySelectRef}>
                              <select name="playbookId" value={formData.playbookId || ''} onChange={handleChange} className={`${getInputClass('playbookId')} appearance-none cursor-pointer h-[42px]`}>
                                <option value="">-- 選擇策略 --</option>
                                {strategies.map(st => (<option key={st.id} value={st.id}>{st.name}</option>))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          
                          {/* Strategy Rules Button */}
                          <div className="relative" ref={rulesPopupRef}>
                              <button
                                ref={rulesButtonRef}
                                type="button"
                                disabled={!formData.playbookId}
                                onClick={handleToggleRules}
                                className={`h-[42px] px-3 border rounded-lg transition-colors flex items-center gap-2 ${showRulesChecklist ? 'bg-primary border-primary text-white' : 'bg-surface/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'} ${!formData.playbookId ? 'opacity-50 cursor-not-allowed hover:border-slate-700 hover:text-slate-400' : ''}`}
                              >
                                  <ListChecks size={18} />
                                  <span className="text-xs font-bold hidden sm:inline">Rules</span>
                              </button>

                              {/* Strategy Rules Popover (Fixed Overlay) */}
                              {showRulesChecklist && selectedStrategy && (
                                  <div 
                                    ref={fixedPopoverRef}
                                    style={popoverStyle}
                                    className="bg-[#1f2937] border border-slate-600 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-opacity duration-75"
                                  >
                                      {/* Header with Progress */}
                                      <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                                          <div className="flex items-center gap-2 mb-2">
                                              <div className="w-3 h-3 rounded bg-[#8f3f3f]" style={{ backgroundColor: selectedStrategy.color }}></div>
                                              <span className="font-bold text-white text-sm truncate">{selectedStrategy.name}</span>
                                          </div>
                                          
                                          {(() => {
                                              const { checked, total } = getStrategyProgress();
                                              return (
                                                  <div>
                                                      <div className="flex justify-between text-xs text-slate-400 mb-1 font-semibold uppercase">
                                                          <span>Rules Followed</span>
                                                          <span>{checked} / {total}</span>
                                                      </div>
                                                      <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                          <div 
                                                            className="h-full bg-emerald-500 transition-all duration-300" 
                                                            style={{ width: total > 0 ? `${(checked / total) * 100}%` : '0%' }}
                                                          ></div>
                                                      </div>
                                                  </div>
                                              );
                                          })()}
                                      </div>

                                      {/* Rules List - SCROLLABLE */}
                                      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-4">
                                          {selectedStrategy.rules && selectedStrategy.rules.length > 0 ? (
                                              selectedStrategy.rules.map((group) => {
                                                  // Legacy Check
                                                  if (typeof group === 'string') return null;

                                                  return (
                                                      <div key={group.id} className="px-2">
                                                          <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">{group.name}</h4>
                                                          <div className="space-y-1">
                                                              {group.items.map(item => {
                                                                  const isChecked = formData.rulesFollowed?.includes(item.id);
                                                                  return (
                                                                      <button
                                                                          key={item.id}
                                                                          type="button"
                                                                          onClick={() => toggleRuleCheck(item.id)}
                                                                          className="w-full text-left flex items-start gap-3 p-2 rounded hover:bg-slate-800 transition-colors group"
                                                                          data-rule-text={item.text} // For future aggregation logic
                                                                      >
                                                                          <div className={`mt-0.5 transition-colors ${isChecked ? 'text-primary' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                                                              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                                                          </div>
                                                                          <span className={`text-sm leading-snug ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                                                                              {item.text}
                                                                          </span>
                                                                      </button>
                                                                  );
                                                              })}
                                                          </div>
                                                      </div>
                                                  );
                                              })
                                          ) : (
                                              <div className="text-center py-6 text-slate-500 text-xs">No rules defined.</div>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                   </div>

                   {/* --- NEW TAG SELECTOR (Renamed from Bag) --- */}
                   {/* Added pt-4 to align with the visual grid of the left column (Prices section) */}
                   <div className="pt-4">
                      <label className="block text-xs font-medium text-slate-400 mb-2">標籤 (Tags)</label>
                      <div className="flex flex-wrap gap-2 p-2 border border-slate-700/50 rounded-lg bg-slate-800/20 min-h-[42px] items-start relative">
                        {tagCategories.map(cat => {
                            const items = tags.filter(t => t.categoryId === cat.id);
                            if (items.length === 0) return null;

                            const selectedInCat = items.filter(t => formData.tags?.includes(t.id));
                            const isDropdownOpen = activeTagDropdown === cat.id;
                            
                            return (
                                <div key={cat.id} className="relative inline-block">
                                    <button 
                                        type="button"
                                        onClick={(e) => toggleTagDropdown(cat.id, e)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-medium shadow-sm ${isDropdownOpen ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${cat.color}`}></div>
                                        <span>{cat.name}</span>
                                        {selectedInCat.length > 0 && (
                                            <span className="bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold -mr-1 shadow">
                                                {selectedInCat.length}
                                            </span>
                                        )}
                                        <ChevronDown size={10} className={`ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isDropdownOpen && (
                                        <div 
                                            ref={tagDropdownRef}
                                            className="absolute top-full left-0 mt-2 min-w-[180px] w-auto max-w-[240px] bg-[#1f2937] border border-slate-600 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1"
                                        >
                                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                                {items.map(item => {
                                                    const isSelected = formData.tags?.includes(item.id);
                                                    return (
                                                        <button 
                                                            key={item.id} 
                                                            type="button" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const currentItems = formData.tags || [];
                                                                if (currentItems.includes(item.id)) {
                                                                    setFormData(prev => ({ ...prev, tags: currentItems.filter(t => t !== item.id) }));
                                                                } else {
                                                                    setFormData(prev => ({ ...prev, tags: [...currentItems, item.id] }));
                                                                }
                                                            }} 
                                                            className={`text-left text-xs px-2 py-1.5 rounded flex items-center justify-between transition-colors ${isSelected ? `${cat.color} bg-opacity-20 text-white` : 'text-slate-300 hover:bg-slate-700'}`}
                                                        >
                                                            <span>{item.name}</span>
                                                            {isSelected && <Check size={12} className={cat.color.replace('bg-', 'text-')} />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {tags.length === 0 && <span className="text-xs text-slate-500 italic p-1">No tags available.</span>}
                      </div>
                   </div>

                    
                   {/* Screenshot Section - URL Input Only */}
                   <div className="mt-2">
                       <label className="block text-xs font-medium text-slate-400 mb-2">交易截圖 (Screenshot)</label>
                       
                       <div className="flex flex-col gap-3">
                           {/* URL Input */}
                           <div className="flex gap-2">
                               <div className="relative flex-1">
                                   <input 
                                       type="text"
                                       placeholder="輸入圖片連結 (例如 TradingView URL)"
                                       value={formData.screenshotUrl || ''}
                                       onChange={(e) => setFormData(prev => ({ ...prev, screenshotUrl: e.target.value }))}
                                       className={`${getInputClass('screenshotUrl')} pl-9`}
                                   />
                                   <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                               </div>
                           </div>
                       </div>
                       <p className="text-[10px] text-slate-500 mt-1">
                           提示: 推薦使用 TradingView 連結 (如 https://www.tradingview.com/x/...)，讀取速度快且畫質佳。
                       </p>
                   </div>

                </div>
              </div>
          </div>

          {/* Footer - Fixed */}
          <div className="p-5 border-t border-slate-700/50 flex justify-end gap-3 bg-slate-800/30 rounded-b-2xl z-20 flex-shrink-0">
             <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">取消</button>
             <button 
                type="submit" 
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg ${isFormInvalid ? 'bg-slate-700 text-slate-500 opacity-50' : 'bg-primary hover:bg-indigo-600 text-white shadow-indigo-500/30'}`}
             >
                <Save size={16} /> 儲存交易
             </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};