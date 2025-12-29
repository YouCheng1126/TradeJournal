
import React from 'react';
import { ChevronDown, Check, Tag as TagIcon } from 'lucide-react';
import { Trade } from '../../types';
import { useTrades } from '../../contexts/TradeContext';

interface TagsPanelProps {
    formData: Trade;
    onChange: (field: keyof Trade, value: any) => void;
    openDropdown: string | null;
    toggleDropdown: (id: string, e: React.MouseEvent) => void;
}

export const TagsPanel: React.FC<TagsPanelProps> = ({ formData, onChange, openDropdown, toggleDropdown }) => {
    const { tagCategories, tags } = useTrades();

    return (
        <div className="space-y-8">
            {tagCategories.map(cat => {
                const catTags = tags.filter(t => t.categoryId === cat.id);
                if (catTags.length === 0) return null;
                
                const selectedInCat = catTags.filter(t => (formData.tags || []).includes(t.id));
                const dropdownId = `cat-${cat.id}`;

                return (
                    <div key={cat.id} className="space-y-2">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {/* Replaced dot with Tag Icon, converting bg-color class to text-color class */}
                            <TagIcon size={18} className={cat.color.replace('bg-', 'text-')} />
                            {cat.name}
                        </h3>
                        
                        <div className="relative">
                            <button 
                                onClick={(e) => toggleDropdown(dropdownId, e)}
                                className="flex items-center justify-between w-full bg-slate-800/20 border border-slate-600 hover:border-slate-500 rounded-lg px-3 py-2 transition-colors"
                            >
                                <span className="text-sm text-slate-300">
                                    {selectedInCat.length > 0 
                                        ? selectedInCat.map(t => t.name).join(', ') 
                                        : <span className="text-slate-500 italic">Select {cat.name.toLowerCase()}...</span>
                                    }
                                </span>
                                <ChevronDown size={14} className="text-slate-500"/>
                            </button>

                            {openDropdown === dropdownId && (
                                <div 
                                    className="absolute left-0 top-full mt-1 w-full bg-slate-700 border border-slate-500 rounded-lg shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {catTags.map(tag => {
                                        const isSelected = (formData.tags || []).includes(tag.id);
                                        return (
                                            <button 
                                                key={tag.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const current = formData.tags || [];
                                                    const next = current.includes(tag.id) 
                                                        ? current.filter(x => x !== tag.id) 
                                                        : [...current, tag.id];
                                                    onChange('tags', next);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-600 transition-colors ${isSelected ? 'text-white bg-slate-600/50' : 'text-slate-300'}`}
                                            >
                                                <span>{tag.name}</span>
                                                {isSelected && <Check size={14} className="text-primary"/>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {tagCategories.length === 0 && <div className="text-slate-500 italic text-center mt-10">No tag categories defined.</div>}
        </div>
    );
};
