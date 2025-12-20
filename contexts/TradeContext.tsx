import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Trade, Strategy, TagCategory, Tag } from '../types';
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
  
  // Tag System
  tagCategories: TagCategory[];
  tags: Tag[];
  
  loading: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  
  addTrade: (trade: Trade) => Promise<void>;
  updateTrade: (trade: Trade) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  
  addStrategy: (strategy: Strategy) => Promise<void>;
  updateStrategy: (strategy: Strategy) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  
  // New Tag Management
  addTagCategory: (cat: TagCategory) => Promise<void>;
  deleteTagCategory: (id: string) => Promise<void>;
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
  { 
      id: 'pb1', 
      name: 'Gap Fill', 
      description: 'Trading the gap fill on open.', 
      rules: [
          {
              id: 'g1',
              name: 'Entry criteria',
              items: [
                  { id: 'r1', text: 'Gap > 2%' },
                  { id: 'r2', text: 'Volume > 100k' }
              ]
          },
          {
              id: 'g2',
              name: 'Exit criteria',
              items: [
                  { id: 'r3', text: 'Gap filled' }
              ]
          }
      ] 
  },
  { 
      id: 'pb2', 
      name: 'Bull Flag Breakout', 
      description: 'Classic continuation pattern.', 
      rules: [
          {
              id: 'g1',
              name: 'Entry criteria',
              items: [
                  { id: 'r1', text: 'Strong uptrend' },
                  { id: 'r2', text: 'Tight consolidation' }
              ]
          }
      ] 
  },
];

// Local Storage Keys
const LS_TRADES = 'zella_trades';
const LS_STRATEGIES = 'zella_strategies';
const LS_TAG_CATS = 'zella_tag_cats';
const LS_TAGS = 'zella_tags';

// Helper to load/save
const loadLocal = <T,>(key: string, defaultVal: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultVal;
    } catch {
        return defaultVal;
    }
};

const saveLocal = (key: string, val: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
        console.error("Local Storage Save Error", e);
    }
};

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  
  // Tag State
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
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
            fetchTagCategoriesSupabase(),
            fetchTagsSupabase()
        ]).finally(() => setLoading(false));
    } else {
        console.log("Supabase not configured. Using LocalStorage/Dummy.");
        setTrades(loadLocal(LS_TRADES, []));
        setStrategies(loadLocal(LS_STRATEGIES, DUMMY_STRATEGIES));
        setTagCategories(loadLocal(LS_TAG_CATS, []));
        setTags(loadLocal(LS_TAGS, []));
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
                tags: t.tags || [], // Renamed column
                rulesFollowed: t.rulesFollowed || [], // Explicitly handle missing/null field
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
              // Ensure rules is parsed if it's stored as JSONB, or default to []
              setStrategies(data.map((s: any) => ({ 
                  ...s, 
                  id: String(s.id), 
                  rules: s.rules || [] 
              })));
          }
      } catch (err) { console.warn('Strategy fetch error', err); }
  };

  // --- Tag Fetch ---
  const fetchTagCategoriesSupabase = async () => {
      try {
          const { data, error } = await supabase.from('tag_categories').select('*');
          if (error) throw error;
          if (data) {
              setTagCategories(data.map((c: any) => ({ ...c, id: String(c.id) })));
          }
      } catch (err) { console.warn('Tag Cat fetch error', err); }
  };

  const fetchTagsSupabase = async () => {
      try {
          // Table renamed to 'tags'
          const { data, error } = await supabase.from('tags').select('*');
          if (error) throw error;
          if (data) {
              setTags(data.map((i: any) => ({ 
                  id: String(i.id), name: i.name, categoryId: i.category_id 
              })));
          }
      } catch (err) { console.warn('Tag fetch error', err); }
  };


  // --- Trade CRUD ---

  const addTrade = useCallback(async (trade: Trade) => {
    if (isSupabaseConfigured) {
        // Prepare payload
        const { tags: tradeTags, rulesFollowed, ...tradeData } = trade;
        
        const dbPayload: any = { 
            ...tradeData, 
            tags: tradeTags || [],
            rulesFollowed: rulesFollowed || [] 
        };
        
        // Remove purely frontend calculated metrics if they exist in the object
        delete dbPayload.netPnL;
        delete dbPayload.rMultiple;
        delete dbPayload.mfe;
        delete dbPayload.mae;

        const { data, error } = await supabase.from('trades').insert([dbPayload]).select();
        
        if (error) throw new Error(error.message || 'Failed to add trade');
        if (data) {
            const newTrade = {
                ...data[0],
                id: String(data[0].id),
                tags: data[0].tags || [],
                rulesFollowed: data[0].rulesFollowed || [],
                screenshotUrl: data[0].screenshotUrl
            } as Trade;
            setTrades((prev) => [newTrade, ...prev]);
        }
    } else {
        setTrades((prev) => {
            const newTrades = [trade, ...prev];
            saveLocal(LS_TRADES, newTrades);
            return newTrades;
        });
    }
  }, []);

  const updateTrade = useCallback(async (updatedTrade: Trade) => {
    if (isSupabaseConfigured) {
        const { tags: tradeTags, rulesFollowed, ...tradeData } = updatedTrade;
        
        const dbPayload: any = { 
            ...tradeData, 
            tags: tradeTags || [],
            rulesFollowed: rulesFollowed || []
        };

        // Remove purely frontend calculated metrics if they exist in the object
        delete dbPayload.netPnL;
        delete dbPayload.rMultiple;
        delete dbPayload.mfe;
        delete dbPayload.mae;

        const { error } = await supabase.from('trades').update(dbPayload).eq('id', updatedTrade.id);
        if (error) throw new Error(error.message);
        setTrades((prev) => prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t)));
    } else {
        setTrades((prev) => {
            const newTrades = prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t));
            saveLocal(LS_TRADES, newTrades);
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
        saveLocal(LS_TRADES, previousTrades.filter((t) => t.id !== id));
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
          setStrategies(prev => {
              const next = [...prev, strategy];
              saveLocal(LS_STRATEGIES, next);
              return next;
          });
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
          setStrategies(prev => {
              const next = prev.map(s => s.id === strategy.id ? strategy : s);
              saveLocal(LS_STRATEGIES, next);
              return next;
          });
      }
  }, []);

  const deleteStrategy = useCallback(async (id: string) => {
      if (isSupabaseConfigured) {
          const { error } = await supabase.from('strategies').delete().eq('id', id);
          if (error) alert('Error: ' + error.message);
          else setStrategies(prev => prev.filter(s => s.id !== id));
      } else {
          setStrategies(prev => {
              const next = prev.filter(s => s.id !== id);
              saveLocal(LS_STRATEGIES, next);
              return next;
          });
      }
  }, []);


  // --- NEW TAG SYSTEM CRUD ---

  const addTagCategory = useCallback(async (cat: TagCategory) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('tag_categories').insert([{
              name: cat.name, color: cat.color
          }]).select();
          if (error) { alert(error.message); return; }
          if (data) {
              setTagCategories(prev => [...prev, { ...data[0], id: String(data[0].id) }]);
          }
      } else {
          setTagCategories(prev => {
              const next = [...prev, cat];
              saveLocal(LS_TAG_CATS, next);
              return next;
          });
      }
  }, []);

  /**
   * DELETE TAG CATEGORY (MANUAL CASCADE)
   */
  const deleteTagCategory = useCallback(async (id: string) => {
      const prevCats = [...tagCategories];
      const prevItems = [...tags];

      // Optimistic UI update
      setTagCategories(prev => prev.filter(c => c.id !== id));
      setTags(prev => prev.filter(i => i.categoryId !== id));

      if (isSupabaseConfigured) {
          try {
              // 1. Delete Items First (Manual Cascade)
              const { error: itemError } = await supabase
                  .from('tags')
                  .delete()
                  .eq('category_id', id);

              if (itemError) {
                  console.error("Failed to delete tags:", itemError);
                  throw new Error(`無法刪除子項目 (Tags): ${itemError.message}`);
              }

              // 2. Delete Category
              const { error: catError } = await supabase
                  .from('tag_categories')
                  .delete()
                  .eq('id', id);

              if (catError) {
                   console.error("Failed to delete category:", catError);
                   throw new Error(`無法刪除類別 (Tag Category): ${catError.message}`);
              }

              // Success
              await Promise.all([fetchTagCategoriesSupabase(), fetchTagsSupabase()]);

          } catch (err: any) {
              console.error("Delete Category Failed:", err);
              alert(`刪除失敗: ${err.message || JSON.stringify(err)}.\n請檢查資料庫 RLS 設定。`);
              
              // Rollback
              setTagCategories(prevCats);
              setTags(prevItems);
              await fetchTagCategoriesSupabase();
              await fetchTagsSupabase();
          }
      } else {
          const nextCats = tagCategories.filter(c => c.id !== id);
          const nextItems = tags.filter(i => i.categoryId !== id);
          saveLocal(LS_TAG_CATS, nextCats);
          saveLocal(LS_TAGS, nextItems);
      }
  }, [tagCategories, tags]);

  const addTag = useCallback(async (tag: Tag) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('tags').insert([{
              name: tag.name, category_id: tag.categoryId
          }]).select();
          if (error) { alert(error.message); return; }
          if (data) {
              setTags(prev => [...prev, { id: String(data[0].id), name: data[0].name, categoryId: data[0].category_id } as Tag]);
          }
      } else {
          setTags(prev => {
              const next = [...prev, tag];
              saveLocal(LS_TAGS, next);
              return next;
          });
      }
  }, []);

  const deleteTag = useCallback(async (id: string) => {
      const prevItems = [...tags];
      setTags(prev => prev.filter(i => i.id !== id));
      
      if (isSupabaseConfigured) {
          try {
              const { error } = await supabase.from('tags').delete().eq('id', id);
              if (error) throw error;
          } catch(err: any) { 
              alert(err.message); 
              setTags(prevItems); // Rollback
              fetchTagsSupabase(); 
          }
      } else {
          const next = tags.filter(i => i.id !== id);
          saveLocal(LS_TAGS, next);
      }
  }, [tags]);

  return (
    <TradeContext.Provider value={{ 
        trades, filteredTrades, strategies, loading, 
        dateRange, setDateRange, 
        addTrade, updateTrade, deleteTrade, 
        addStrategy, updateStrategy, deleteStrategy,
        // Tag System
        tagCategories, tags,
        addTagCategory, deleteTagCategory,
        addTag, deleteTag
    }}>
      {children}
    </TradeContext.Provider>
  );
};