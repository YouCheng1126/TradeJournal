
import React from 'react';
import { ExternalLink, Image as ImageIcon, Trash2, Link as LinkIcon, Edit } from 'lucide-react';
import { Trade } from '../../types';

interface ImagePanelProps {
    screenshotUrl?: string;
    onChange: (url: string) => void;
}

export const ImagePanel: React.FC<ImagePanelProps> = ({ screenshotUrl, onChange }) => {
    return (
        <div className="flex-1 bg-surface flex items-center justify-center relative overflow-hidden h-full border-l border-slate-600">
            {screenshotUrl ? (
                <div className="w-full h-full flex items-center justify-center overflow-hidden bg-black/10 group relative">
                    <img 
                        src={screenshotUrl} 
                        alt="Trade Screenshot" 
                        className="h-full w-auto max-w-none object-contain"
                    />
                    
                    <div className="absolute top-4 left-4 flex gap-2 opacity-30 hover:opacity-100 transition-opacity z-20">
                        <button 
                            onClick={() => onChange('')} 
                            className="p-2 bg-black/60 backdrop-blur-md hover:bg-red-500/80 rounded-full text-white transition-colors border border-slate-500/50"
                            title="Remove Image"
                        >
                            <Trash2 size={18} />
                        </button>
                        <a 
                            href={screenshotUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-2 bg-black/60 backdrop-blur-md hover:bg-primary/80 rounded-full text-white transition-colors border border-slate-500/50"
                            title="Open Original"
                        >
                            <ExternalLink size={18} />
                        </a>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8">
                    <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                        <ImageIcon size={48} className="text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-300 mb-2">No Screenshot</h3>
                    <p className="text-sm text-slate-500 mb-6">Add a screenshot to analyze your execution.</p>
                    
                    <div className="w-full max-w-md">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Paste image URL here (e.g. TradingView Link)..."
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:border-primary outline-none transition-all shadow-inner"
                                onChange={(e) => onChange(e.target.value)}
                            />
                            <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
