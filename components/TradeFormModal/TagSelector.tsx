
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTrades } from '../../contexts/TradeContext';

interface TagSelectorProps {
    selectedTags: string[];
    onToggleTag: (tagId: string) => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({ selectedTags, onToggleTag }) => {
    const { tagCategories, tags } = useTrades();
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = (catId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setActiveDropdown(prev => prev === catId ? null : catId);
    };

    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">標籤 (Tags)</label>
            <div className="flex flex-wrap gap-2 p-2 border border-slate-700/50 rounded-lg bg-slate-800/20 min-h-[42px] items-start relative" ref={dropdownRef}>
                {tagCategories.map(cat => {
                    const items = tags.filter(t => t.categoryId === cat.id);
                    if (items.length === 0) return null;

                    const selectedInCat = items.filter(t => selectedTags.includes(t.id));
                    const isDropdownOpen = activeDropdown === cat.id;
                    
                    return (
                        <div key={cat.id} className="relative inline-block">
                            <button 
                                type="button"
                                onClick={(e) => toggleDropdown(cat.id, e)}
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
                                <div className="absolute top-full left-0 mt-2 min-w-[180px] w-auto max-w-[240px] bg-[#1f2937] border border-slate-600 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1">
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                        {items.map(item => {
                                            const isSelected = selectedTags.includes(item.id);
                                            return (
                                                <button 
                                                    key={item.id} 
                                                    type="button" 
                                                    onClick={(e) => { e.stopPropagation(); onToggleTag(item.id); }} 
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
    );
};
