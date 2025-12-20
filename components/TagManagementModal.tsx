import React, { useState } from 'react';
import { X, Plus, Trash2, FolderPlus, Tag, Check } from 'lucide-react';
import { useTrades } from '../contexts/TradeContext';

interface TagManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-purple-500', 'bg-pink-500'
];

export const TagManagementModal: React.FC<TagManagementModalProps> = ({ isOpen, onClose }) => {
    const { categories, tags, addCategory, deleteCategory, addTag, deleteTag } = useTrades();
    
    // Create Category State
    const [newCatName, setNewCatName] = useState('');
    const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
    
    // Create Tag State
    const [newTagName, setNewTagName] = useState('');
    const [activeCatForTag, setActiveCatForTag] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        await addCategory({
            id: crypto.randomUUID(), // Will be ignored by Supabase mostly, but good for local
            name: newCatName,
            color: newCatColor
        });
        setNewCatName('');
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (window.confirm(`Delete category "${name}" and all its tags?`)) {
            await deleteCategory(id);
        }
    };

    const handleAddTag = async (e: React.FormEvent, catId: string) => {
        e.preventDefault();
        e.stopPropagation(); // Stop propagation
        if (!newTagName.trim()) return;

        await addTag({
            id: crypto.randomUUID(),
            name: newTagName,
            categoryId: catId
        });
        setNewTagName('');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1f2937] w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-[#1f2937] rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Tag size={20} className="text-primary"/> 管理標籤 (Manage Tags)
                    </h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#1f2937]">
                    
                    {/* 1. Add New Category Section */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <FolderPlus size={16} className="text-emerald-400"/> 新增類別 (New Category)
                        </h3>
                        <form onSubmit={handleAddCategory} className="flex gap-3 items-start flex-col sm:flex-row">
                            <div className="flex-1 space-y-3 w-full">
                                <input 
                                    type="text" 
                                    placeholder="Category Name (e.g. Mistakes)" 
                                    value={newCatName}
                                    onChange={e => setNewCatName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button 
                                            key={color}
                                            type="button" // Important
                                            onClick={() => setNewCatColor(color)}
                                            className={`w-6 h-6 rounded-full ${color} flex items-center justify-center ${newCatColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'opacity-70 hover:opacity-100'}`}
                                        >
                                            {newCatColor === color && <Check size={14} className="text-white drop-shadow-md" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                disabled={!newCatName.trim()}
                                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                            >
                                Add Category
                            </button>
                        </form>
                    </div>

                    {/* 2. List Categories Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categories.map(cat => {
                            const catTags = tags.filter(t => t.categoryId === cat.id);
                            return (
                                <div key={cat.id} className="bg-surface border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-sm hover:border-slate-600 transition-colors">
                                    {/* Category Header */}
                                    <div className="bg-slate-800/80 p-3 flex items-center justify-between border-b border-slate-700/50">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={`w-3 h-3 flex-shrink-0 rounded-full ${cat.color}`}></div>
                                            <span className="font-bold text-white text-sm truncate">{cat.name}</span>
                                            <span className="text-xs text-slate-500 ml-1">({catTags.length})</span>
                                        </div>
                                        <button 
                                            type="button" // Important
                                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                            className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Tags List */}
                                    <div className="p-3 bg-slate-900/20 flex-1 flex flex-col gap-3">
                                        <div className="flex flex-wrap gap-2">
                                            {catTags.map(tag => (
                                                <div key={tag.id} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-slate-700 bg-slate-800 text-slate-300">
                                                    {tag.name}
                                                    <button 
                                                        type="button" // Important
                                                        onClick={() => deleteTag(tag.id)} 
                                                        className="hover:text-red-400 ml-1 p-0.5"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            {catTags.length === 0 && (
                                                <span className="text-xs text-slate-500 italic py-1">No tags yet</span>
                                            )}
                                        </div>

                                        {/* Add Tag Inline Input */}
                                        <form 
                                            onSubmit={(e) => handleAddTag(e, cat.id)}
                                            className="flex gap-2 mt-auto pt-2"
                                        >
                                            <input 
                                                type="text" 
                                                placeholder="Add sub-tag..." 
                                                value={activeCatForTag === cat.id ? newTagName : ''}
                                                onChange={e => {
                                                    setActiveCatForTag(cat.id);
                                                    setNewTagName(e.target.value);
                                                }}
                                                onFocus={() => setActiveCatForTag(cat.id)}
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-slate-500 focus:outline-none"
                                            />
                                            <button 
                                                type="submit"
                                                disabled={activeCatForTag !== cat.id || !newTagName.trim()}
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-30 transition-colors"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-2xl flex justify-end">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
