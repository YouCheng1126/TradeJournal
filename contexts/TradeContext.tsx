
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Trade, Strategy, TagCategory, Tag, GlobalFilterState, TradeDirection, UserSettings } from '../types';
import { calculatePnL, calculateRMultiple } from '../utils/calculations';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

interface DateRange {
    startDate: Date | null;
    endDate: Date | null;
    label?: string;
}

interface TradeContextType {
  trades: Trade[]; // All trades
  filteredTrades: Trade[]; // Trades within date range AND filters
  strategies: Strategy[];
  
  // Tag System
  tagCategories: TagCategory[];
  tags: Tag[];
  
  loading: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;

  // New Global Filters
  filters: GlobalFilterState;
  setFilters: (filters: GlobalFilterState) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  
  // User Settings
  userSettings: UserSettings;
  updateUserSettings: (settings: UserSettings) => void;

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
const LS_SETTINGS = 'zella_user_settings';

const DEFAULT_FILTERS: GlobalFilterState = {
    status: [],
    direction: [],
    strategyIds: [],
    ruleIds: [],
    tagIds: [],
    daysOfWeek: [],
    startTime: '',
    endTime: '',
    exitStartTime: '',
    exitEndTime: '',
    minDuration: undefined,
    maxDuration: undefined,
    minVolume: undefined,
    maxVolume: undefined,
    minPnL: undefined,
    maxPnL: undefined,
    minRR: undefined,
    maxRR: undefined,
    minSLSize: undefined,
    maxSLSize: undefined,
    minActualRisk: undefined,
    maxActualRisk: undefined,
    minActualRiskPct: undefined,
    maxActualRiskPct: undefined,
    includeRules: false,
    crossStrategies: false,
    excludeMode: false,
    filterLogic: 'AND',
};

const DEFAULT_USER_SETTINGS: UserSettings = {
    maxDrawdown: 0,
    commissionPerUnit: 0,
};

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
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, label: 'All Time' });
  const [filters, setFilters] = useState<GlobalFilterState>(DEFAULT_FILTERS);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    // Initial Load
    if (isSupabaseConfigured) {
        // Load Settings from Supabase
        fetchSettingsSupabase();

        Promise.all([
            fetchTradesSupabase(),
            fetchStrategiesSupabase(),
            fetchTagCategoriesSupabase(),
            fetchTagsSupabase()
        ]).finally(() => setLoading(false));
    } else {
        // Fallback to LocalStorage
        setUserSettings(loadLocal(LS_SETTINGS, DEFAULT_USER_SETTINGS));
        setTrades(loadLocal(LS_TRADES, []));
        setStrategies(loadLocal(LS_STRATEGIES, DUMMY_STRATEGIES));
        setTagCategories(loadLocal(LS_TAG_CATS, []));
        setTags(loadLocal(LS_TAGS, []));
        setLoading(false);
    }
  }, []);

  const fetchSettingsSupabase = async () => {
      try {
          // Fetch the single row (assumes only 1 row exists or we take the first one)
          const { data, error } = await supabase.from('user_settings').select('*').limit(1).single();
          
          if (data) {
              setUserSettings({
                  maxDrawdown: Number(data.max_drawdown),
                  commissionPerUnit: Number(data.commission_per_unit)
              });
          }
      } catch (err) {
          console.error('Error fetching user settings:', err);
      }
  };

  const updateUserSettings = async (settings: UserSettings) => {
      // Optimistic update
      setUserSettings(settings);
      
      if (isSupabaseConfigured) {
          try {
              // Update the settings in DB (Assuming ID 1, or update all rows since it's single user logic)
              // Using ID 1 based on the SQL setup script provided
              const { error } = await supabase
                  .from('user_settings')
                  .update({
                      max_drawdown: settings.maxDrawdown,
                      commission_per_unit: settings.commissionPerUnit
                  })
                  .eq('id', 1);

              if (error) {
                  // Fallback: If ID 1 doesn't exist, try to insert it (Upsert logic simulation)
                  // Or assume user ran the setup SQL correctly.
                  console.error('Error updating settings in DB:', error.message);
              }
          } catch (e) {
              console.error(e);
          }
      } else {
          saveLocal(LS_SETTINGS, settings);
      }
  };

  const filteredTrades = useMemo(() => {
      let result = trades;

      // 1. Date Range Filtering (Always mandatory)
      if (dateRange.startDate && dateRange.endDate) {
          const formatLocal = (d: Date) => {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
          };
          const startStr = formatLocal(dateRange.startDate);
          const endStr = formatLocal(dateRange.endDate);

          result = result.filter(t => {
              const tradeDateStr = new Intl.DateTimeFormat('en-CA', { 
                  timeZone: 'America/New_York' 
              }).format(new Date(t.entryDate));
              return tradeDateStr >= startStr && tradeDateStr <= endStr;
          });
      }

      // Check which filter categories are active
      const activeCategories: { key: string, check: (t: Trade) => boolean }[] = [];

      // Status/Direction: Trade has ONE value
      if (filters.status.length > 0) {
          activeCategories.push({ 
              key: 'status', 
              check: (t) => {
                  // If strictly AND, selecting multiple distinct statuses should result in 0 trades
                  if (filters.filterLogic === 'AND' && filters.status.length > 1) return false;
                  return filters.status.includes(t.status);
              } 
          });
      }
      
      if (filters.direction.length > 0) {
          activeCategories.push({ 
              key: 'side', 
              check: (t) => {
                  if (filters.filterLogic === 'AND' && filters.direction.length > 1) return false;
                  return filters.direction.includes(t.direction);
              } 
          });
      }
      
      // Strategy Filtering Logic
      // Logic: If 'includeRules' is on, we identify strategies that are only selected because their rules are checked.
      // We remove these from the strict "Strategy ID" filter to avoid double counting or parent-child OR issues.
      
      const strategiesWithSelectedRules = new Set<string>();
      if (filters.includeRules && filters.ruleIds.length > 0) {
          strategies.forEach(s => {
              const hasSelectedRule = s.rules?.some(g => 
                  typeof g !== 'string' && g.items.some(i => filters.ruleIds.includes(i.id))
              );
              if (hasSelectedRule) strategiesWithSelectedRules.add(s.id);
          });
      }

      // Only filter by Strategy ID if it's NOT just a container for selected rules
      // UNLESS CrossStrategy is on, in which case we ignore strategy IDs entirely if Rules are present
      const effectiveStrategyIds = filters.strategyIds.filter(id => !strategiesWithSelectedRules.has(id));
      const ignoreStrategyFilter = filters.crossStrategies && filters.ruleIds.length > 0;

      if (effectiveStrategyIds.length > 0 && !ignoreStrategyFilter) {
          activeCategories.push({ 
              key: 'strat', 
              check: (t) => {
                  // If strictly AND, selecting multiple distinct strategies should result in 0 trades
                  // (A trade cannot belong to Strategy A AND Strategy B)
                  if (filters.filterLogic === 'AND' && effectiveStrategyIds.length > 1) return false;
                  return t.playbookId ? effectiveStrategyIds.includes(t.playbookId) : false;
              } 
          });
      }

      // Rules: Trade can have MULTIPLE values. 
      if (filters.includeRules && filters.ruleIds.length > 0) {
          activeCategories.push({ key: 'rules', check: (t) => {
              const tradeRules = t.rulesFollowed || [];
              
              // Cross Strategy Logic
              if (filters.crossStrategies) {
                  // 1. Get definitions (Group Name + Text) of selected rule IDs
                  const selectedDefs = new Set<string>();
                  strategies.forEach(s => {
                      s.rules?.forEach(g => {
                          if(typeof g === 'string') return;
                          g.items.forEach(i => {
                              if (filters.ruleIds.includes(i.id)) {
                                  selectedDefs.add(`${g.name.trim()}::${i.text.trim()}`);
                              }
                          });
                      });
                  });

                  if (filters.filterLogic === 'AND') {
                        // Strict Cross Matching: Trade must match ALL selected *Definitions*
                        const currentStrat = strategies.find(s => s.id === t.playbookId);
                        if (!currentStrat) return false;

                        const tradeRuleDefs = new Set<string>();
                        currentStrat.rules?.forEach(g => {
                            if(typeof g === 'string') return;
                            g.items.forEach(i => {
                                if (tradeRules.includes(i.id)) {
                                    tradeRuleDefs.add(`${g.name.trim()}::${i.text.trim()}`);
                                }
                            });
                        });

                        // Check if all selected definitions are present in trade
                        for (let req of selectedDefs) {
                            if (!tradeRuleDefs.has(req)) return false;
                        }
                        return true;
                  } else {
                      // OR Logic: Does trade have ANY rule matching the expanded list?
                      // We need to check if ANY of the trade's rules match ANY of the selected definitions
                      // Expand selected defs to ALL possible IDs first
                      const expandedIds = new Set<string>();
                      strategies.forEach(s => {
                          s.rules?.forEach(g => {
                              if(typeof g === 'string') return;
                              g.items.forEach(i => {
                                  const key = `${g.name.trim()}::${i.text.trim()}`;
                                  if (selectedDefs.has(key)) {
                                      expandedIds.add(i.id);
                                  }
                              });
                          });
                      });
                      return tradeRules.some(id => expandedIds.has(id));
                  }
              }

              // Standard ID Matching (No Cross)
              // If Global Logic is OR, we treat multiple selected rules as OR (Match Any of selected)
              // If Global Logic is AND, we treat multiple selected rules as AND (Match All of selected)
              if (filters.filterLogic === 'AND') {
                  return filters.ruleIds.every(id => tradeRules.includes(id));
              } else {
                  return filters.ruleIds.some(id => tradeRules.includes(id));
              }
          }});
      }

      // Tags: Trade can have MULTIPLE values.
      if (filters.tagIds.length > 0) 
          activeCategories.push({ key: 'tags', check: (t) => {
              const tradeTags = t.tags || [];
              if (filters.filterLogic === 'AND') {
                  return filters.tagIds.every(id => tradeTags.includes(id));
              } else {
                  return filters.tagIds.some(id => tradeTags.includes(id));
              }
          }});

      // Helper for Numeric Comparison Logic
      const checkRange = (val: number, min?: number, max?: number) => {
          if (min !== undefined && max !== undefined) return val >= min && val <= max;
          if (min !== undefined) return val >= min;
          if (max !== undefined) return val <= max;
          return true;
      };

      if (filters.minVolume !== undefined || filters.maxVolume !== undefined)
          activeCategories.push({ key: 'vol', check: (t) => checkRange(t.quantity, filters.minVolume, filters.maxVolume) });

      if (filters.minPnL !== undefined || filters.maxPnL !== undefined)
          activeCategories.push({ key: 'pnl', check: (t) => checkRange(calculatePnL(t, userSettings.commissionPerUnit), filters.minPnL, filters.maxPnL) });

      if (filters.minRR !== undefined || filters.maxRR !== undefined)
          activeCategories.push({ key: 'rr', check: (t) => checkRange(calculateRMultiple(t) || 0, filters.minRR, filters.maxRR) });

      if (filters.minSLSize !== undefined || filters.maxSLSize !== undefined)
          activeCategories.push({ key: 'slSize', check: (t) => checkRange(Math.abs(t.entryPrice - t.initialStopLoss), filters.minSLSize, filters.maxSLSize) });

      if (filters.minActualRisk !== undefined || filters.maxActualRisk !== undefined)
          activeCategories.push({ key: 'actualRisk', check: (t) => {
              const actualRisk = t.direction === TradeDirection.LONG 
                ? t.entryPrice - (t.lowestPriceReached ?? t.entryPrice)
                : (t.highestPriceReached ?? t.entryPrice) - t.entryPrice;
              return checkRange(actualRisk, filters.minActualRisk, filters.maxActualRisk);
          }});

      if (filters.minActualRiskPct !== undefined || filters.maxActualRiskPct !== undefined)
          activeCategories.push({ key: 'actualRiskPct', check: (t) => {
              const slSize = Math.abs(t.entryPrice - t.initialStopLoss);
              if (slSize === 0) return false;
              const actualRisk = t.direction === TradeDirection.LONG 
                ? t.entryPrice - (t.lowestPriceReached ?? t.entryPrice)
                : (t.highestPriceReached ?? t.entryPrice) - t.entryPrice;
              const pct = (actualRisk / slSize) * 100;
              return checkRange(pct, filters.minActualRiskPct, filters.maxActualRiskPct);
          }});

      if (filters.daysOfWeek.length > 0)
          activeCategories.push({ key: 'days', check: (t) => filters.daysOfWeek.includes(new Date(t.entryDate).getDay()) });

      if (filters.startTime || filters.endTime)
          activeCategories.push({ key: 'entryTime', check: (t) => {
              const tradeDate = new Date(t.entryDate);
              const taiwanTime = new Date(tradeDate.getTime() + (8 * 60 * 60 * 1000));
              const timeStr = `${taiwanTime.getUTCHours().toString().padStart(2, '0')}:${taiwanTime.getUTCMinutes().toString().padStart(2, '0')}`;
              if (filters.startTime && timeStr < filters.startTime) return false;
              if (filters.endTime && timeStr > filters.endTime) return false;
              return true;
          }});

      if ((filters.exitStartTime || filters.exitEndTime))
          activeCategories.push({ key: 'exitTime', check: (t) => {
              if (!t.exitDate) return false;
              const tradeDate = new Date(t.exitDate);
              const taiwanTime = new Date(tradeDate.getTime() + (8 * 60 * 60 * 1000));
              const timeStr = `${taiwanTime.getUTCHours().toString().padStart(2, '0')}:${taiwanTime.getUTCMinutes().toString().padStart(2, '0')}`;
              if (filters.exitStartTime && timeStr < filters.exitStartTime) return false;
              if (filters.exitEndTime && timeStr > filters.exitEndTime) return false;
              return true;
          }});

      if (filters.minDuration !== undefined || filters.maxDuration !== undefined)
          activeCategories.push({ key: 'duration', check: (t) => {
              if (!t.exitDate) return false;
              const durationMins = Math.floor((new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 60000);
              return checkRange(durationMins, filters.minDuration, filters.maxDuration);
          }});

      if (activeCategories.length === 0) return result;

      // 2. Combine Categories based on Logic Toggle
      result = result.filter(t => {
          let matches = false;
          
          if (filters.filterLogic === 'AND') {
              // Strictly must match every single category rule
              matches = activeCategories.every(cat => cat.check(t));
          } else {
              // OR Logic: Matches at least one category
              matches = activeCategories.some(cat => cat.check(t));
          }

          return filters.excludeMode ? !matches : matches;
      });

      return result;
  }, [trades, dateRange, filters, userSettings.commissionPerUnit, strategies]);

  const activeFilterCount = useMemo(() => {
      let count = 0;
      if (filters.status.length > 0) count++;
      if (filters.direction.length > 0) count++;
      if (filters.strategyIds.length > 0) count++;
      if (filters.includeRules && filters.ruleIds.length > 0) count++;
      if (filters.tagIds.length > 0) count++;
      if (filters.daysOfWeek.length > 0) count++;
      if (filters.startTime || filters.endTime) count++;
      if (filters.exitStartTime || filters.exitEndTime) count++;
      if (filters.minDuration !== undefined || filters.maxDuration !== undefined) count++;
      if (filters.minVolume !== undefined || filters.maxVolume !== undefined) count++;
      if (filters.minPnL !== undefined || filters.maxPnL !== undefined) count++;
      if (filters.minRR !== undefined || filters.maxRR !== undefined) count++;
      if (filters.minSLSize !== undefined || filters.maxSLSize !== undefined) count++;
      if (filters.minActualRisk !== undefined || filters.maxActualRisk !== undefined) count++;
      if (filters.minActualRiskPct !== undefined || filters.maxActualRiskPct !== undefined) count++;
      return count;
  }, [filters]);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // --- Fetch/CRUD ---
  const fetchTradesSupabase = async () => {
    try {
        const { data, error } = await supabase.from('trades').select('*').order('entryDate', { ascending: false });
        if (error) throw error;
        if (data) setTrades(data.map((t: any) => ({ ...t, id: String(t.id), tags: t.tags || [], rulesFollowed: t.rulesFollowed || [] })));
    } catch (err) { console.error("Error fetching trades:", err); }
  };
  const fetchStrategiesSupabase = async () => {
      try {
          const { data, error } = await supabase.from('strategies').select('*');
          if (error) throw error;
          if (data) setStrategies(data.map((s: any) => ({ ...s, id: String(s.id), rules: s.rules || [] })));
      } catch (err) { console.warn('Strategy fetch error', err); }
  };
  const fetchTagCategoriesSupabase = async () => {
      try {
          const { data, error } = await supabase.from('tag_categories').select('*');
          if (error) throw error;
          if (data) setTagCategories(data.map((c: any) => ({ ...c, id: String(c.id) })));
      } catch (err) { console.warn('Tag Cat fetch error', err); }
  };
  const fetchTagsSupabase = async () => {
      try {
          const { data, error } = await supabase.from('tags').select('*');
          if (error) throw error;
          if (data) setTags(data.map((i: any) => ({ id: String(i.id), name: i.name, categoryId: i.category_id })));
      } catch (err) { console.warn('Tag fetch error', err); }
  };

  const addTrade = useCallback(async (trade: Trade) => {
    if (isSupabaseConfigured) {
        // Remove 'id' so Supabase generates it. Remove 'tags' and 'rulesFollowed' from top level to put in proper fields.
        const { tags: tradeTags, rulesFollowed, id, ...tradeData } = trade;
        const dbPayload: any = { ...tradeData, tags: tradeTags || [], rulesFollowed: rulesFollowed || [] };
        
        // Remove calculated fields
        delete dbPayload.netPnL; 
        delete dbPayload.rMultiple; 
        delete dbPayload.mfe; 
        delete dbPayload.mae;
        
        const { data, error } = await supabase.from('trades').insert([dbPayload]).select();
        
        if (error) throw new Error(error.message || 'Failed to add trade');
        
        if (data) {
            setTrades((prev) => [{ 
                ...data[0], 
                id: String(data[0].id), 
                tags: data[0].tags || [], 
                rulesFollowed: data[0].rulesFollowed || [] 
            }, ...prev]);
        }
    } else {
        setTrades((prev) => { const newTrades = [trade, ...prev]; saveLocal(LS_TRADES, newTrades); return newTrades; });
    }
  }, []);

  const updateTrade = useCallback(async (updatedTrade: Trade) => {
    if (isSupabaseConfigured) {
        const { tags: tradeTags, rulesFollowed, ...tradeData } = updatedTrade;
        const dbPayload: any = { ...tradeData, tags: tradeTags || [], rulesFollowed: rulesFollowed || [] };
        delete dbPayload.netPnL; delete dbPayload.rMultiple; delete dbPayload.mfe; delete dbPayload.mae;
        const { error } = await supabase.from('trades').update(dbPayload).eq('id', updatedTrade.id);
        if (error) throw new Error(error.message);
        setTrades((prev) => prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t)));
    } else {
        setTrades((prev) => { const newTrades = prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t)); saveLocal(LS_TRADES, newTrades); return newTrades; });
    }
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    const previousTrades = [...trades];
    setTrades((prev) => prev.filter((t) => String(t.id) !== String(id)));
    if (isSupabaseConfigured) {
        const { error } = await supabase.from('trades').delete().eq('id', id);
        if (error) { alert('刪除失敗: ' + error.message); setTrades(previousTrades); }
    } else {
        saveLocal(LS_TRADES, previousTrades.filter((t) => t.id !== id));
    }
  }, [trades]);

  const addStrategy = useCallback(async (strategy: Strategy) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('strategies').insert([{ name: strategy.name, description: strategy.description, rules: strategy.rules, color: strategy.color }]).select();
          if (error) alert('Error: ' + error.message);
          else if (data) setStrategies(prev => [...prev, { ...data[0], id: String(data[0].id) }]);
      } else {
          setStrategies(prev => { const next = [...prev, strategy]; saveLocal(LS_STRATEGIES, next); return next; });
      }
  }, []);

  const updateStrategy = useCallback(async (strategy: Strategy) => {
      if (isSupabaseConfigured) {
          const { error } = await supabase.from('strategies').update({ name: strategy.name, description: strategy.description, rules: strategy.rules, color: strategy.color }).eq('id', strategy.id);
          if (error) alert('Error: ' + error.message);
          else setStrategies(prev => prev.map(s => s.id === strategy.id ? strategy : s));
      } else {
          setStrategies(prev => { const next = prev.map(s => s.id === strategy.id ? strategy : s); saveLocal(LS_STRATEGIES, next); return next; });
      }
  }, []);

  const deleteStrategy = useCallback(async (id: string) => {
      if (isSupabaseConfigured) {
          const { error } = await supabase.from('strategies').delete().eq('id', id);
          if (error) alert('Error: ' + error.message);
          else setStrategies(prev => prev.filter(s => s.id !== id));
      } else {
          setStrategies(prev => { const next = prev.filter(s => s.id !== id); saveLocal(LS_STRATEGIES, next); return next; });
      }
  }, []);

  const addTagCategory = useCallback(async (cat: TagCategory) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('tag_categories').insert([{ name: cat.name, color: cat.color }]).select();
          if (error) { alert(error.message); return; }
          if (data) setTagCategories(prev => [...prev, { ...data[0], id: String(data[0].id) }]);
      } else {
          setTagCategories(prev => { const next = [...prev, cat]; saveLocal(LS_TAG_CATS, next); return next; });
      }
  }, []);

  const deleteTagCategory = useCallback(async (id: string) => {
      const prevCats = [...tagCategories]; const prevItems = [...tags];
      setTagCategories(prev => prev.filter(c => c.id !== id)); setTags(prev => prev.filter(i => i.categoryId !== id));
      if (isSupabaseConfigured) {
          try {
              const { error: itemError } = await supabase.from('tags').delete().eq('category_id', id);
              if (itemError) throw new Error(itemError.message);
              const { error: catError } = await supabase.from('tag_categories').delete().eq('id', id);
              if (catError) throw new Error(catError.message);
          } catch (err: any) { 
              setTagCategories(prevCats); setTags(prevItems); 
              alert(`刪除失敗: ${err.message}`);
          }
      } else {
          const nextCats = tagCategories.filter(c => c.id !== id);
          const nextItems = tags.filter(i => i.categoryId !== id);
          saveLocal(LS_TAG_CATS, nextCats); saveLocal(LS_TAGS, nextItems);
      }
  }, [tagCategories, tags]);

  const addTag = useCallback(async (tag: Tag) => {
      if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('tags').insert([{ name: tag.name, category_id: tag.categoryId }]).select();
          if (error) { alert(error.message); return; }
          if (data) setTags(prev => [...prev, { id: String(data[0].id), name: data[0].name, categoryId: data[0].category_id }]);
      } else {
          setTags(prev => { const next = [...prev, tag]; saveLocal(LS_TAGS, next); return next; });
      }
  }, []);

  const deleteTag = useCallback(async (id: string) => {
      const prevItems = [...tags]; setTags(prev => prev.filter(i => i.id !== id));
      if (isSupabaseConfigured) {
          try { const { error } = await supabase.from('tags').delete().eq('id', id); if (error) throw error; } 
          catch(err: any) { alert(err.message); setTags(prevItems); }
      } else {
          const next = tags.filter(i => i.id !== id); saveLocal(LS_TAGS, next);
      }
  }, [tags]);

  return (
    <TradeContext.Provider value={{ 
        trades, filteredTrades, strategies, loading, 
        dateRange, setDateRange, 
        filters, setFilters, resetFilters, activeFilterCount,
        userSettings, updateUserSettings,
        addTrade, updateTrade, deleteTrade, addStrategy, updateStrategy, deleteStrategy,
        tagCategories, tags, addTagCategory, deleteTagCategory, addTag, deleteTag
    }}>
      {children}
    </TradeContext.Provider>
  );
};
