
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
    const { tagCategories, tags, addTagCategory, deleteTagCategory, addTag, deleteTag } = useTrades();
    
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
        await addTagCategory({
            id: crypto.randomUUID(),
            name: newCatName,
            color: newCatColor
        });
        setNewCatName('');
    };

    // Direct Delete - No Confirmation
    const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        await deleteTagCategory(id);
    };

    const handleAddTag = async (e: React.FormEvent, catId: string) => {
        e.preventDefault();
        if (!newTagName.trim()) return;
        await addTag({
            id: crypto.randomUUID(),
            name: newTagName,
            categoryId: catId
        });
        setNewTagName('');
    };

    const handleDeleteTag = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await deleteTag(id);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-surface w-full max-w-3xl rounded-2xl border border-slate-600 shadow-2xl flex flex-col max-h-[85%]">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-600 flex justify-between items-center bg-surface rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Tag size={20} className="text-primary"/> Manage Tags
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface">
                    
                    {/* Add New Category */}
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-600">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <FolderPlus size={16} className="text-emerald-400"/> New Tag Category
                        </h3>
                        <form onSubmit={handleAddCategory} className="flex gap-3 items-start flex-col sm:flex-row">
                            <div className="flex-1 space-y-3 w-full">
                                <input 
                                    type="text" 
                                    placeholder="Category Name (e.g. Setups, Mistakes)" 
                                    value={newCatName}
                                    onChange={e => setNewCatName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none placeholder-slate-500"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button 
                                            key={color}
                                            type="button"
                                            onClick={() => setNewCatColor(color)}
                                            className={`w-6 h-6 rounded-full ${color} flex items-center justify-center ${newCatColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'opacity-70 hover:opacity-100'}`}
                                        >
                                            {newCatColor === color && <Check size={14} className="text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                disabled={!newCatName.trim()}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-lg"
                            >
                                Add
                            </button>
                        </form>
                    </div>

                    {/* List Categories */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tagCategories.map(cat => {
                            const items = tags.filter(i => i.categoryId === cat.id);
                            
                            return (
                                <div key={cat.id} className="bg-slate-800 border border-slate-600 rounded-xl overflow-hidden flex flex-col shadow-sm">
                                    {/* Header */}
                                    <div className="bg-slate-700/50 p-3 flex items-center justify-between border-b border-slate-600">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {/* Updated to use Tag icon with replaced text color */}
                                            <Tag size={18} className={`flex-shrink-0 ${cat.color.replace('bg-', 'text-')}`} />
                                            <span className="font-bold text-white text-sm truncate">{cat.name}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteCategory(e, cat.id)}
                                            className="p-2 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Items */}
                                    <div className="p-3 bg-slate-700 flex-1 flex flex-col gap-3">
                                        <div className="flex flex-wrap gap-2">
                                            {items.map(item => (
                                                <div key={item.id} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-slate-600 bg-slate-800 text-slate-200">
                                                    {item.name}
                                                    <button onClick={(e) => handleDeleteTag(e, item.id)} className="hover:text-red-400 ml-1 text-slate-400">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Tag Input */}
                                        <form onSubmit={(e) => handleAddTag(e, cat.id)} className="flex gap-2 mt-auto pt-2">
                                            <input 
                                                type="text" 
                                                placeholder="Add tag..." 
                                                value={activeCatForTag === cat.id ? newTagName : ''}
                                                onChange={e => {
                                                    setActiveCatForTag(cat.id);
                                                    setNewTagName(e.target.value);
                                                }}
                                                onFocus={() => setActiveCatForTag(cat.id)}
                                                className="flex-1 bg-slate-800/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-slate-500 focus:outline-none placeholder-slate-400"
                                            />
                                            <button 
                                                type="submit"
                                                disabled={activeCatForTag !== cat.id || !newTagName.trim()}
                                                className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded disabled:opacity-30 border border-slate-500"
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

                <div className="p-4 border-t border-slate-600 bg-slate-800/20 rounded-b-2xl flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg">Done</button>
                </div>
            </div>
        </div>
    );
};
