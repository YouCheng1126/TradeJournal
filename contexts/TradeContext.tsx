import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Trade, Strategy, Tag, TagCategory } from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

interface DateRange {
    startDate: Date | null;
    endDate: Date | null;
    label?: string;
}

interface TradeContextType {
  trades: Trade[]; // All trades
  filteredTrades: Trade[]; // Trades within date range
  strategies: Strategy[];
  tags: Tag[];
  categories: TagCategory[];
  loading: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  addTrade: (trade: Trade) => Promise<void>;
  updateTrade: (trade: Trade) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  addStrategy: (strategy: Strategy) => Promise<void>;
  updateStrategy: (strategy: Strategy) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  // Tag Management
  addCategory: (category: TagCategory) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addTag: (tag: Tag) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const useTrades = () => {
  const context = useContext(TradeContext);
  if (context === undefined) {
    throw new Error('useTrades must be used within a TradeProvider');
  }
  return context;
};

const DUMMY_STRATEGIES: Strategy[] = [
  { id: 'pb1', name: 'Gap Fill', description: 'Trading the gap fill on open.', rules: ['Gap > 2%', 'Volume > 100k'] },
  { id: 'pb2', name: 'Bull Flag Breakout', description: 'Classic continuation pattern.', rules: ['Strong uptrend', 'Tight consolidation'] },
];

const DUMMY_CATEGORIES: TagCategory[] = [
    { id: 'cat1', name: 'Psychology (心態)', color: 'bg-purple-500' },
    { id: 'cat2', name: 'Mistakes (錯誤)', color: 'bg-red-500' },
];

const DUMMY_TAGS: Tag[] = [
  { id: 't1', name: 'FOMO', categoryId: 'cat1' },
  { id: 't3', name: 'Late Entry', categoryId: 'cat2' },
];

// Local Storage Helper
const getLocalTrades = (): Trade[] => {
    try {
        const stored = localStorage.getItem('zella_trades');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveLocalTrades = (trades: Trade[]) => {
    localStorage.setItem('zella_trades', JSON.stringify(trades));
};

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>(DUMMY_STRATEGIES);
  
  // Tag State
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [loading, setLoading] = useState(true);
  
  // Default to "All Time" (null, null)
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, label: 'All Time' });

  // Initialize Data
  useEffect(() => {
    if (isSupabaseConfigured) {
        Promise.all([
            fetchTradesSupabase(),
            fetchStrategiesSupabase(),
            fetchCategoriesSupabase(),
            fetchTagsSupabase()
        ]).finally(() => setLoading(false));
    } else {
        console.log("Supabase not configured. Using LocalStorage/Dummy.");
        setTrades(getLocalTrades());
        setCategories(DUMMY_CATEGORIES);
        setTags(DUMMY_TAGS);
        setLoading(false);
    }
  }, []);

  // Filter Trades based on Date Range
  const filteredTrades = useMemo(() => {
      if (!dateRange.startDate || !dateRange.endDate) {
          return trades;
      }

      // Convert selected range to YYYY-MM-DD strings (using local date as per picker selection)
      const formatLocal = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
      };
      
      const startStr = formatLocal(dateRange.startDate);
      const endStr = formatLocal(dateRange.endDate);

      return trades.filter(t => {
          // Compare against Trade Date in NY Time (YYYY-MM-DD)
          const tradeDateStr = new Intl.DateTimeFormat('en-CA', { 
              timeZone: 'America/New_York' 
          }).format(new Date(t.entryDate));

          return tradeDateStr >= startStr && tradeDateStr <= endStr;
      });
  }, [trades, dateRange]);

  // --- Fetch Functions ---

  const fetchTradesSupabase = async () => {
    try {
        const { data, error } = await supabase
            .from('trades')
            .select('*')
            .order('entryDate', { ascending: false });

        if (error) throw error;
        if (data) {
            const formattedData: Trade[] = data.map((t: any) => ({
                ...t,
                id: String(t.id),
                tags: t.tags || [],
                screenshotUrl: t.screenshotUrl 
            }));
            setTrades(formattedData);
        }
    } catch (err) {
        console.error("Error fetching trades:", err);
    }
  };

  const fetchStrategiesSupabase = async () => {
      try {
          const { data, error } = await supabase.from('strategies').select('*');
          if (error) throw error;
          if (data) {
              setStrategies(data.map((s: any) => ({ ...s, id: String(s.id), rules: s.rules || [] })));
          }
      } catch (err) { console.warn('Strategy fetch error', err); }
  };

  const fetchCategoriesSupabase = async () => {
      try {
          // Using 'tag_categories' table
          const { data, error } = await supabase.from('tag_categories').select('*');
          if (error) throw error;
          if (data) {
              setCategories(data.map((c: any) => ({ ...c, id: String(c.id) })));
          }
      } catch (err) { console.warn('Categories fetch error', err); }
  };

  const fetchTagsSupabase = async () => {
      try {
          // Using 'tags' table, need to map category_id to camelCase categoryId
          const { data, error } = await supabase.from('tags').select('*');
          if (error) throw error;
          if (data) {
              setTags(data.map((t: any) => ({ 
                  id: String(t.id), 
                  name: t.name, 
                  categoryId: t.category_id 
              })));
          }
      } catch (err) { console.warn('Tags fetch error', err); }
  };

  // --- Trade CRUD ---

  const addTrade = useCallback(async (trade: Trade) => {
    if (isSupabaseConfigured) {
        const dbPayload = { ...trade, tags: trade.tags || [] };
        const { data, error } = await supabase.from('trades').insert([dbPayload]).select();
        
        if (error) throw new Error(error.message || 'Failed to add trade');
        if (data) {
            const newTrade = {
                ...data[0],
                id: String(data[0].id),
                tags: data[0].tags || [],
                screenshotUrl: data[0].screenshotUrl
            } as Trade;
            setTrades((prev) => [newTrade, ...prev]);
        }
    } else {
        setTrades((prev) => {
            const newTrades = [trade, ...prev];
            saveLocalTrades(newTrades);
            return newTrades;
        });
    }
  }, []);

  const updateTrade = useCallback(async (updatedTrade: Trade) => {
    if (isSupabaseConfigured) {
        const dbPayload = { ...updatedTrade, tags: updatedTrade.tags || [] };
        const { error } = await supabase.from('trades').update(dbPayload).eq('id', updatedTrade.id);
        if (error) throw new Error(error.message);
        setTrades((prev) => prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t)));
    } else {
        setTrades((prev) => {
            const newTrades = prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t));
            saveLocalTrades(newTrades);
            return newTrades;
        });
    }
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    const previousTrades = [...trades];
    setTrades((prev) => prev.filter((t) => String(t.id) !== String(id)));

    if (isSupabaseConfigured) {
        const { error } = await supabase.from('trades').delete().eq('id', id);
        if (error) {
            alert('刪除失敗: ' + error.message);
            setTrades(previousTrades);
        }
    } else {
        saveLocalTrades(previousTrades.filter((t) => t.id !== id));
    }
  }, [trades]);

  // --- Strategy CRUD ---
  const addStrategy = useCallback(async (strategy: Strategy) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('strategies').insert([{
              name: strategy.name, description: strategy.description, rules: strategy.rules, color: strategy.color
          }]).select();
          if (error) alert('Error: ' + error.message);
          else if (data) setStrategies(prev => [...prev, { ...data[0], id: String(data[0].id) }]);
      } else {
          setStrategies(prev => [...prev, strategy]);
      }
  }, []);

  const updateStrategy = useCallback(async (strategy: Strategy) => {
      if (isSupabaseConfigured) {
          const { error } = await supabase.from('strategies').update({
              name: strategy.name, description: strategy.description, rules: strategy.rules, color: strategy.color
          }).eq('id', strategy.id);
          if (error) alert('Error: ' + error.message);
          else setStrategies(prev => prev.map(s => s.id === strategy.id ? strategy : s));
      } else {
          setStrategies(prev => prev.map(s => s.id === strategy.id ? strategy : s));
      }
  }, []);

  const deleteStrategy = useCallback(async (id: string) => {
      if (isSupabaseConfigured) {
          const { error } = await supabase.from('strategies').delete().eq('id', id);
          if (error) alert('Error: ' + error.message);
          else setStrategies(prev => prev.filter(s => s.id !== id));
      } else {
          setStrategies(prev => prev.filter(s => s.id !== id));
      }
  }, []);

  // --- Tag Category CRUD (Supabase) ---
  const addCategory = useCallback(async (category: TagCategory) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('tag_categories').insert([{
              name: category.name, color: category.color
          }]).select();
          
          if (error) {
              console.error(error);
              alert('Error adding category: ' + error.message);
          } else if (data) {
              const newCat = { ...data[0], id: String(data[0].id) };
              setCategories(prev => [...prev, newCat]);
          }
      } else {
          setCategories(prev => [...prev, category]);
      }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
      if (isSupabaseConfigured) {
          // Optimistically update UI first to feel snappy
          const prevCats = [...categories];
          const prevTags = [...tags];
          setCategories(prev => prev.filter(c => c.id !== id));
          setTags(prev => prev.filter(t => t.categoryId !== id));

          const { error } = await supabase.from('tag_categories').delete().eq('id', id);
          
          if (error) {
              console.error(error);
              alert('Error deleting category: ' + error.message);
              // Revert on error
              setCategories(prevCats);
              setTags(prevTags);
          }
      } else {
          setCategories(prev => prev.filter(c => c.id !== id));
          setTags(prev => prev.filter(t => t.categoryId !== id));
      }
  }, [categories, tags]);

  // --- Tag CRUD (Supabase) ---
  const addTag = useCallback(async (tag: Tag) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('tags').insert([{
              name: tag.name, category_id: tag.categoryId
          }]).select();

          if (error) {
             console.error(error);
             alert('Error adding tag: ' + error.message);
          } else if (data) {
              const newTag = { id: String(data[0].id), name: data[0].name, categoryId: data[0].category_id };
              setTags(prev => [...prev, newTag]);
          }
      } else {
          setTags(prev => [...prev, tag]);
      }
  }, []);

  const deleteTag = useCallback(async (id: string) => {
      if (isSupabaseConfigured) {
          const { error } = await supabase.from('tags').delete().eq('id', id);
          if (error) alert('Error deleting tag: ' + error.message);
          else setTags(prev => prev.filter(t => t.id !== id));
      } else {
          setTags(prev => prev.filter(t => t.id !== id));
      }
  }, []);

  return (
    <TradeContext.Provider value={{ 
        trades, filteredTrades, strategies, tags, categories, loading, 
        dateRange, setDateRange, 
        addTrade, updateTrade, deleteTrade, 
        addStrategy, updateStrategy, deleteStrategy,
        addCategory, deleteCategory, addTag, deleteTag
    }}>
      {children}
    </TradeContext.Provider>
  );
};