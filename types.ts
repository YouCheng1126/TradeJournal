
// Enums for standardizing choices
export enum TradeDirection {
    LONG = 'Long',
    SHORT = 'Short',
  }
  
  // Updated Status Enum
  export enum TradeStatus {
    WIN = 'Win',
    SMALL_WIN = 'Small Win',
    BREAK_EVEN = 'Break Even',
    SMALL_LOSS = 'Small Loss',
    LOSS = 'Loss',
  }

  // --- TAG SYSTEM (Renamed from Bag) ---
  export interface TagCategory {
      id: string;
      name: string;
      color: string;
  }

  export interface Tag {
      id: string;
      name: string;
      categoryId: string;
  }
  
  // --- New Rule Structure ---
  export interface RuleItem {
      id: string;
      text: string;
  }

  export interface StrategyRuleGroup {
      id: string;
      name: string;
      items: RuleItem[];
  }

  export interface Strategy {
    id: string;
    name: string;
    description?: string;
    // Updated: rules is now an array of groups, or undefined/empty array for legacy/new
    rules?: StrategyRuleGroup[]; 
    color?: string;
  }
  
  // The core Trade object (The "Aggregated" View)
  export interface Trade {
    id: string;
    symbol: string;
    direction: TradeDirection;
    status: TradeStatus;
    
    // Time
    entryDate: string; // ISO String
    exitDate?: string; // ISO String
  
    // Execution Data (Aggregated averages for manual entry)
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    bestExitPrice?: number; // New Field: Best Possible Exit Price
    commission: number;
  
    // Risk Management (Business Logic Core)
    initialStopLoss: number;
    takeProfitTarget?: number;
  
    // MFE/MAE Input (For advanced analytics)
    highestPriceReached?: number; // During the trade
    lowestPriceReached?: number;  // During the trade
  
    // Context
    playbookId?: string; // Kept as playbookId for DB compatibility, but represents Strategy
    rulesFollowed?: string[]; // New: Array of Rule Item IDs that were checked
    tags?: string[]; // Renamed from bagItems: Array of Tag IDs
    notes?: string;
    screenshotUrl?: string;
  
    // Calculated Metrics (Optional, can be computed on fly)
    netPnL?: number;
    rMultiple?: number;
    mfe?: number; // Max Favorable Excursion amount
    mae?: number; // Max Adverse Excursion amount
  }
  
  // Advanced Filter State
  export interface GlobalFilterState {
      status: TradeStatus[];
      direction: TradeDirection[];
      strategyIds: string[];
      ruleIds: string[]; // Added: Specific rules selected
      tagIds: string[];
      daysOfWeek: number[]; // 0 (Sun) - 6 (Sat)
      
      // Time Range (HH:MM string, 24h)
      startTime?: string;
      endTime?: string;
      exitStartTime?: string;
      exitEndTime?: string;

      // Duration Range (Minutes)
      minDuration?: number;
      maxDuration?: number;

      // Numeric Ranges
      minVolume?: number;
      maxVolume?: number;
      minPnL?: number;
      maxPnL?: number;

      // NEW: Additional Numeric Ranges
      minRR?: number;
      maxRR?: number;
      minSLSize?: number;
      maxSLSize?: number;
      minActualRisk?: number;
      maxActualRisk?: number;
      minActualRiskPct?: number;
      maxActualRiskPct?: number;

      includeRules: boolean; // New toggle for rule-specific filtering
      excludeMode: boolean; // NEW: Toggle to exclude selected items
      filterLogic: 'AND' | 'OR'; // NEW: Logic for combining filter categories
  }

  export interface TradeFilter {
    dateRange: 'all' | 'today' | 'week' | 'month';
    strategyId?: string;
  }
