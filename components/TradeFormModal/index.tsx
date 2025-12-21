
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trade, TradeDirection, TradeStatus, InputMode } from '../../types';
import { useTrades } from '../../contexts/TradeContext';
import { Header } from './Header';
import { Footer } from './Footer';
import { ExecutionSection } from './ExecutionSection';
import { AnalysisSection } from './AnalysisSection';

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Trade;
}

export const TradeFormModal: React.FC<TradeFormModalProps> = ({ isOpen, onClose, initialData }) => {
  const { addTrade, updateTrade } = useTrades();
  
  const [inputMode, setInputMode] = useState<InputMode>('points');
  const [entryTime, setEntryTime] = useState<string>('09:30');
  const [exitTime, setExitTime] = useState<string>('16:00');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [shakeFields, setShakeFields] = useState<string[]>([]);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const modalPanelRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Trade>>(initialData || {
    direction: TradeDirection.LONG,
    status: TradeStatus.WIN,
    symbol: 'MES',
    quantity: 1,
    entryDate: new Date().toISOString().split('T')[0],
    tags: [],
    rulesFollowed: [],
    commission: 0,
    screenshotUrl: '',
  });

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

  // Initialize Data
  useEffect(() => {
    if (initialData) {
        setFormData(initialData);
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

  // Validation Effect
  useEffect(() => {
    const newErrors: { [key: string]: string } = {};
    const { direction, entryPrice, initialStopLoss, exitPrice } = formData;
    const entry = Number(entryPrice);
    const sl = Number(initialStopLoss);
    const exit = Number(exitPrice);
    const has = (v: any) => v !== undefined && !isNaN(v);

    if (direction === TradeDirection.LONG && has(entry)) {
        if (has(sl) && sl >= entry) newErrors.initialStopLoss = "做多: 初始止損必須 < 入場價";
        if (has(sl) && has(exit) && sl > exit) newErrors.initialStopLoss = "做多: 初始止損必須 <= 出場價";
    } else if (direction === TradeDirection.SHORT && has(entry)) {
        if (has(sl) && sl <= entry) newErrors.initialStopLoss = "做空: 初始止損必須 > 入場價";
        if (has(sl) && has(exit) && sl < exit) newErrors.initialStopLoss = "做空: 初始止損必須 >= 出場價";
    }
    setErrors(newErrors);
  }, [formData]);

  // Logic: Stop Loss / Exit Sync
  useEffect(() => {
      const sl = formData.initialStopLoss;
      const exit = formData.exitPrice;
      const direction = formData.direction;

      if (sl !== undefined && exit !== undefined && sl === exit) {
          if (direction === TradeDirection.LONG) {
              if (formData.lowestPriceReached !== sl) setFormData(prev => ({ ...prev, lowestPriceReached: sl }));
          } else {
               if (formData.highestPriceReached !== sl) setFormData(prev => ({ ...prev, highestPriceReached: sl }));
          }
      }
  }, [formData.initialStopLoss, formData.exitPrice, formData.direction]);

  const getInputClass = (fieldName: string) => {
      let baseClass = "w-full bg-surface/50 border rounded-lg p-2.5 text-white text-sm focus:outline-none transition-all shadow-sm placeholder-slate-600 font-mono h-[42px] ";
      const hasError = (touched[fieldName] && errors[fieldName]) || shakeFields.includes(fieldName) || (touched[fieldName] && !formData[fieldName as keyof Trade] && fieldName !== 'commission');
      const isShaking = shakeFields.includes(fieldName);

      if (hasError || isShaking) {
          baseClass += "border-red-500 focus:border-red-500 bg-red-500/10 ";
          if (isShaking) baseClass += "animate-shake ";
      } else {
          baseClass += "border-slate-700 focus:border-primary hover:border-slate-600 ";
      }
      return baseClass;
  };

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
          if (fieldName === 'exitPrice' || fieldName === 'highestPriceReached' || fieldName === 'bestExitPrice') calculatedPrice = entry + val;
          else calculatedPrice = entry - val;
      } else {
          if (fieldName === 'exitPrice' || fieldName === 'lowestPriceReached' || fieldName === 'bestExitPrice') calculatedPrice = entry - val;
          else calculatedPrice = entry + val;
      }
      setFormData(prev => ({ ...prev, [fieldName]: Math.round(calculatedPrice * 100) / 100 }));
  };

  const getDisplayValue = (fieldName: keyof Trade): string | number => {
      const val = formData[fieldName];
      if (val === undefined || val === null) return '';
      if (inputMode === 'price' || !formData.entryPrice) return val as number;
      const entry = formData.entryPrice;
      const isLong = formData.direction === TradeDirection.LONG;
      let points = 0;
      if (isLong) {
          if (fieldName === 'exitPrice' || fieldName === 'highestPriceReached' || fieldName === 'bestExitPrice') points = (val as number) - entry;
          else points = entry - (val as number);
      } else {
          if (fieldName === 'exitPrice' || fieldName === 'lowestPriceReached' || fieldName === 'bestExitPrice') points = entry - (val as number);
          else points = (val as number) - entry;
      }
      return Math.round(points * 100) / 100;
  };

  const triggerShake = (fields: string[]) => {
      setShakeFields(fields);
      setTimeout(() => setShakeFields([]), 500); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isLong = formData.direction === TradeDirection.LONG;
    const requiredFields = ['symbol', 'quantity', 'entryPrice', 'exitPrice', 'initialStopLoss', 'status'];
    requiredFields.push(isLong ? 'highestPriceReached' : 'lowestPriceReached'); 
    requiredFields.push(isLong ? 'lowestPriceReached' : 'highestPriceReached'); 

    const missing = requiredFields.filter(f => {
        const val = formData[f as keyof Trade];
        return val === undefined || val === null || val === '';
    });

    if (missing.length > 0 || Object.keys(errors).length > 0) {
        const allInvalid = [...missing, ...Object.keys(errors)];
        triggerShake(allInvalid);
        setTouched(prev => {
            const next = { ...prev };
            allInvalid.forEach(k => next[k] = true);
            return next;
        });
        return; 
    }

    const dateStr = formData.entryDate;
    const entryIso = `${dateStr}T${entryTime}:00+08:00`;
    const exitIso = `${dateStr}T${exitTime}:00+08:00`; 
    
    if (isNaN(new Date(entryIso).getTime())) {
        alert("無效的日期或時間格式。");
        return;
    }

    const tradeData = {
        ...formData,
        id: formData.id || crypto.randomUUID(), 
        entryDate: new Date(entryIso).toISOString(), 
        exitDate: new Date(exitIso).toISOString(),
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

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <style>{shakeStyle}</style>
      <div ref={modalPanelRef} className="bg-[#1f2937] w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/50 shadow-2xl">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full overflow-hidden">
          
          <Header 
            title={initialData ? '編輯交易 (Edit)' : '新增交易 (New)'} 
            inputMode={inputMode} 
            setInputMode={setInputMode} 
            onClose={onClose} 
          />

          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 pb-40">
                
                <ExecutionSection 
                    formData={formData}
                    setFormData={setFormData}
                    inputMode={inputMode}
                    entryTime={entryTime}
                    setEntryTime={setEntryTime}
                    exitTime={exitTime}
                    setExitTime={setExitTime}
                    errors={errors}
                    getInputClass={getInputClass}
                    getDisplayValue={getDisplayValue}
                    handlePriceOrPointsChange={handlePriceOrPointsChange}
                />

                <AnalysisSection 
                    formData={formData}
                    setFormData={setFormData}
                    inputMode={inputMode}
                    errors={errors}
                    getInputClass={getInputClass}
                    getDisplayValue={getDisplayValue}
                    handlePriceOrPointsChange={handlePriceOrPointsChange}
                />

              </div>
          </div>

          <Footer onClose={onClose} isInvalid={Object.keys(errors).length > 0} />
        </form>
      </div>
    </div>,
    document.body
  );
};
