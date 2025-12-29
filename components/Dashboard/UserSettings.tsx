
import React, { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';
import { useTrades } from '../../contexts/TradeContext';

interface UserSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsProps> = ({ isOpen, onClose }) => {
    const { userSettings, updateUserSettings } = useTrades();
    const [maxDD, setMaxDD] = useState<string>('');
    const [commission, setCommission] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setMaxDD(userSettings.maxDrawdown.toString());
            setCommission(userSettings.commissionPerUnit.toString());
        }
    }, [isOpen, userSettings]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const newMaxDD = parseFloat(maxDD);
        const newComm = parseFloat(commission);
        
        updateUserSettings({
            maxDrawdown: isNaN(newMaxDD) ? 0 : newMaxDD,
            commissionPerUnit: isNaN(newComm) ? 0 : newComm,
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface w-full max-w-md rounded-2xl border border-slate-600 shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-600 flex justify-between items-center bg-surface">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings size={20} className="text-slate-400" /> 
                        User Settings
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSave} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2">Max Drawdown Goal ($)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                            <input 
                                type="number" 
                                step="0.01"
                                value={maxDD}
                                onChange={(e) => setMaxDD(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-white focus:border-primary focus:outline-none transition-colors"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Set your maximum drawdown limit for visual reference.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2">Commission (Per Unit)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                            <input 
                                type="number" 
                                step="0.01"
                                value={commission}
                                onChange={(e) => setCommission(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-white focus:border-primary focus:outline-none transition-colors"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            This value is multiplied by volume and subtracted from gross P&L automatically across all metrics (PnL, MFE, MAE, etc).
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-700 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center gap-2">
                            <Save size={16} /> Save Settings
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
