
import React from 'react';
import { Save } from 'lucide-react';

interface FooterProps {
    onClose: () => void;
    isInvalid: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onClose, isInvalid }) => {
    return (
        <div className="p-5 border-t border-slate-700/50 flex justify-end gap-3 bg-slate-800/30 rounded-b-2xl z-20 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">取消</button>
            <button 
                type="submit" 
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg ${isInvalid ? 'bg-slate-700 text-slate-500 opacity-50' : 'bg-primary hover:bg-indigo-600 text-white shadow-indigo-500/30'}`}
            >
                <Save size={16} /> 儲存交易
            </button>
        </div>
    );
};
