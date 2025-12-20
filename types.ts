
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
  
  export interface TagCategory {
    id: string;
    name: string;
    color: string; // Tailwind color class (e.g., 'bg-red-500') or hex
  }

  export interface Tag {
    id: string;
    name: string;
    categoryId: string;
  }
  
  export interface Strategy {
    id: string;
    name: string;
    description?: string;
    rules?: string[]; // Array of rules/checklist items
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
    tags: string[]; // Array of Tag IDs
    notes?: string;
    screenshotUrl?: string;
  
    // Calculated Metrics (Optional, can be computed on fly)
    netPnL?: number;
    rMultiple?: number;
    mfe?: number; // Max Favorable Excursion amount
    mae?: number; // Max Adverse Excursion amount
  }
  
  export interface TradeFilter {
    dateRange: 'all' | 'today' | 'week' | 'month';
    strategyId?: string;
  }
