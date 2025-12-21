
import React from 'react';
import { X } from 'lucide-react';
import { InputMode } from '../../types';

interface HeaderProps {
    title: string;
    inputMode: InputMode;
    setInputMode: (mode: InputMode) => void;
    onClose: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, inputMode, setInputMode, onClose }) => {
    return (
        <div className="bg-[#1f2937] border-b border-slate-700/50 p-5 flex justify-between items-center z-20 flex-shrink-0 rounded-t-2xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                {title}
            </h2>
            <div className="flex items-center gap-4">
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button 
                        type="button" 
                        onClick={() => setInputMode('price')} 
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${inputMode === 'price' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        價格
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setInputMode('points')} 
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${inputMode === 'points' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        點數
                    </button>
                </div>
                <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
