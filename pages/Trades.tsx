import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTrades } from '../contexts/TradeContext';
import { 
    calculatePnL, formatCurrency, calculateRMultiple, calculateProfitFactor, 
    calculateAvgWinLoss, calculateGrossStats, calculateStreaks
} from '../utils/calculations';
import { Settings, X, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, Trash2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { Trade, TradeStatus } from '../types';
import { TopWidgets } from '../components/Dashboard/TopWidgets';
import { TradeInfoModal } from '../components/TradeInfoModal';

// Column Definition
interface ColumnDef {
    id: string;
    label: string;
}

// Sorted Alphabetically for the Column Selector Modal
// Removed 'screenshot' (Img) as requested
const ALL_COLUMNS: ColumnDef[] = [
    { id: 'actualRisk', label: 'Actual Risk' },
    { id: 'actualRiskPct', label: 'Actual Risk %' },
    { id: 'bestExitPrice', label: 'Best Exit' },
    { id: 'bestPnL', label: 'Best P&L' },
    { id: 'bestRR', label: 'Best RR' },
    { id: 'closeDate', label: 'Close Date' },
    { id: 'closeTime', label: 'Close Time' },
    { id: 'duration', label: 'Duration' },
    { id: 'entryPrice', label: 'Entry Price' },
    { id: 'exitPrice', label: 'Exit Price' },
    { id: 'netPnL', label: 'Net P&L' },
    { id: 'openDate', label: 'Open Date' },
    { id: 'openTime', label: 'Open Time' },
    { id: 'rMultiple', label: 'RR' },
    { id: 'side', label: 'Side' },
    { id: 'status', label: 'Status' },
    { id: 'initialStopLoss', label: 'Stop Loss' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'quantity', label: 'Volume' },
];

// Adjusted default order: openTime next to openDate
const DEFAULT_COLUMNS = ['openDate', 'openTime', 'side', 'status', 'entryPrice', 'exitPrice', 'netPnL', 'rMultiple', 'actualRisk', 'duration'];

type SortDirection = 'asc' | 'desc' | null;

export const Trades: React.FC = () => {
  const { filteredTrades, deleteTrade, strategies } = useTrades(); 
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: SortDirection }>({ key: null, direction: null });

  // Scroll Sync Refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  // --- Sync Scroll Logic ---
  useEffect(() => {
    // Set initial width for top scroll spacer
    if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth);
    }

    const handleTopScroll = () => {
        if (tableContainerRef.current && topScrollRef.current) {
            tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleTableScroll = () => {
        if (topScrollRef.current && tableContainerRef.current) {
             topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
        }
    };

    const topScroll = topScrollRef.current;
    const tableScroll = tableContainerRef.current;

    if (topScroll && tableScroll) {
        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
    }

    // Observer to update width if table content changes
    const observer = new ResizeObserver(() => {
        if (tableContainerRef.current) {
            setTableScrollWidth(tableContainerRef.current.scrollWidth);
        }
    });
    if (tableContainerRef.current) observer.observe(tableContainerRef.current);

    return () => {
        if (topScroll) topScroll.removeEventListener('scroll', handleTopScroll);
        if (tableScroll) tableScroll.removeEventListener('scroll', handleTableScroll);
        observer.disconnect();
    };
  }, [visibleColumns, filteredTrades]);


  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const closedTrades = filteredTrades.filter(t => t.exitPrice !== undefined);
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t), 0);
    const profitFactor = calculateProfitFactor(closedTrades);
    const { avgWin, avgLoss } = calculateAvgWinLoss(closedTrades);
    const { grossProfit, grossLoss } = calculateGrossStats(closedTrades);
    const { 
        currentDayStreak, maxDayWinStreak, maxDayLossStreak,
        currentTradeStreak, maxTradeWinStreak, maxTradeLossStreak 
    } = calculateStreaks(closedTrades);

    const winsCount = closedTrades.filter(t => calculatePnL(t) > 0).length;
    const lossesCount = closedTrades.filter(t => calculatePnL(t) < 0).length;
    const breakEvenCount = closedTrades.filter(t => calculatePnL(t) === 0).length;
    
    const totalMeaningfulTrades = winsCount + lossesCount;
    const adjustedWinRate = totalMeaningfulTrades > 0 ? Math.round((winsCount / totalMeaningfulTrades) * 100) : 0;

    return { 
        totalPnL, count: closedTrades.length, profitFactor, avgWin, avgLoss,
        winsCount, lossesCount, breakEvenCount,
        grossProfit, grossLoss,
        adjustedWinRate,
        currentDayStreak, maxDayWinStreak, maxDayLossStreak,
        currentTradeStreak, maxTradeWinStreak, maxTradeLossStreak 
    };
  }, [filteredTrades]);

  // --- Selection Logic ---
  const handleSelectAll = () => {
      if (selectedIds.size === sortedTrades.length && sortedTrades.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(sortedTrades.map(t => t.id)));
      }
  };

  const toggleSelectRow = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
      // Create a copy of IDs to delete to avoid state issues during iteration
      const idsToDelete = Array.from(selectedIds);
      
      // Perform deletions
      for (const id of idsToDelete) {
          await deleteTrade(id);
      }
      
      // Reset state
      setSelectedIds(new Set());
      setIsDeleteConfirmOpen(false);
  };

  const handleRowClick = (e: React.MouseEvent, trade: Trade) => {
      // Prevent editing if clicking on checkbox or links
      if ((e.target as HTMLElement).closest('.no-row-click')) return;
      
      setEditingTrade(trade);
      setIsEditModalOpen(true);
  };

  const toggleColumn = (colId: string) => {
      setVisibleColumns(prev => 
          prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
      );
  };

  // --- Sorting Logic ---
  const handleSort = (colId: string) => {
    let direction: SortDirection = 'desc';
    
    // Cycle: null -> desc -> asc -> null (default)
    if (sortConfig.key === colId) {
        if (sortConfig.direction === 'desc') direction = 'asc';
        else if (sortConfig.direction === 'asc') direction = null;
    }

    setSortConfig({ key: direction ? colId : null, direction });
  };

  // Custom sort weight for Status
  const getStatusWeight = (s: string) => {
      switch(s) {
          case TradeStatus.WIN: return 5;
          case TradeStatus.SMALL_WIN: return 4;
          case TradeStatus.BREAK_EVEN: return 3;
          case TradeStatus.SMALL_LOSS: return 2;
          case TradeStatus.LOSS: return 1;
          default: return 0;
      }
  };

  // Local calculation helper for multiplier
  const getMultiplier = (symbol: string) => {
      const s = symbol.toUpperCase();
      if (s.includes('MES')) return 5;
      if (s.includes('MNQ')) return 2;
      if (s === 'ES') return 50;
      if (s === 'NQ') return 20;
      return 1;
  };

  // Helper to calculate derived metrics per trade
  const getTradeMetrics = (trade: Trade) => {
      const mult = getMultiplier(trade.symbol);
      const qty = trade.quantity;
      const entry = trade.entryPrice;
      
      // 1. Initial Risk Amount
      let initialRiskAmt = 0;
      if (trade.initialStopLoss) {
          initialRiskAmt = Math.abs(entry - trade.initialStopLoss) * qty * mult;
      }

      // 2. Actual Risk Amount
      let actualRiskAmt = 0;
      if (trade.direction === 'Long') {
          // If lowestPriceReached is missing, assume entry price (no draw down) or handle logic
          const low = trade.lowestPriceReached ?? entry; 
          actualRiskAmt = (entry - low) * qty * mult;
      } else {
          const high = trade.highestPriceReached ?? entry;
          actualRiskAmt = (high - entry) * qty * mult;
      }
      
      if (actualRiskAmt < 0) actualRiskAmt = 0;

      // 3. Best P&L
      let bestPnL = 0;
      if (trade.direction === 'Long') {
          const exit = trade.bestExitPrice ?? trade.highestPriceReached ?? entry;
          bestPnL = (exit - entry) * qty * mult;
      } else {
          const exit = trade.bestExitPrice ?? trade.lowestPriceReached ?? entry;
          bestPnL = (entry - exit) * qty * mult;
      }

      return {
          initialRiskAmt,
          actualRiskAmt,
          bestPnL,
          actualRiskPct: initialRiskAmt > 0 ? (actualRiskAmt / initialRiskAmt) * 100 : 0,
          bestRR: initialRiskAmt > 0 ? bestPnL / initialRiskAmt : 0
      };
  };

  const getSortableValue = (trade: Trade, colId: string): number | string => {
      const metrics = getTradeMetrics(trade);

      switch(colId) {
          case 'openDate': return new Date(trade.entryDate).getTime();
          case 'openTime': return new Date(trade.entryDate).getTime();
          case 'closeDate': return trade.exitDate ? new Date(trade.exitDate).getTime() : 0;
          case 'closeTime': return trade.exitDate ? new Date(trade.exitDate).getTime() : 0;
          case 'symbol': return trade.symbol;
          case 'side': return trade.direction;
          case 'status': return getStatusWeight(trade.status);
          case 'quantity': return trade.quantity;
          case 'entryPrice': return trade.entryPrice;
          case 'exitPrice': return trade.exitPrice || 0;
          case 'bestExitPrice': return trade.bestExitPrice || 0;
          case 'initialStopLoss': return trade.initialStopLoss || 0;
          case 'netPnL': return calculatePnL(trade);
          case 'rMultiple': return calculateRMultiple(trade) || -999;
          case 'strategy': return strategies.find(p => p.id === trade.playbookId)?.name || '';
          case 'duration': 
              if (!trade.exitDate) return 0;
              return new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
          
          // New Columns
          case 'bestPnL': return metrics.bestPnL;
          case 'bestRR': return metrics.bestRR;
          case 'actualRisk': return metrics.actualRiskAmt;
          case 'actualRiskPct': return metrics.actualRiskPct;
          
          default: return 0;
      }
  };

  const sortedTrades = useMemo(() => {
    let sortableItems = [...filteredTrades];
    
    if (sortConfig.key && sortConfig.direction) {
        sortableItems.sort((a, b) => {
            const valA = getSortableValue(a, sortConfig.key!);
            const valB = getSortableValue(b, sortConfig.key!);

            if (valA < valB) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    } else {
        // Default: Sort by entry date descending
        sortableItems.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    }
    
    return sortableItems;
  }, [filteredTrades, sortConfig, strategies]);

  // Helper to render cell content based on column ID
  const renderCell = (trade: Trade, colId: string) => {
      const pnl = calculatePnL(trade);
      const entryDt = new Date(trade.entryDate);
      const exitDt = trade.exitDate ? new Date(trade.exitDate) : null;
      const metrics = getTradeMetrics(trade);

      // Timezone Helper: America/New_York (EST/EDT)
      const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
      const formatDate = (date: Date) => date.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

      switch(colId) {
          case 'openDate': return formatDate(entryDt);
          case 'openTime': return formatTime(entryDt);
          case 'closeDate': return exitDt ? formatDate(exitDt) : '-';
          case 'closeTime': return exitDt ? formatTime(exitDt) : '-';
          case 'symbol': 
            return (
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{trade.symbol}</span>
                    {trade.screenshotUrl && <ImageIcon size={14} className="text-slate-500" />}
                </div>
            );
          case 'side': return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.direction === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {trade.direction === 'Long' ? 'Long' : 'Short'}
            </span>
          );
          case 'status': 
            let statusClass = "bg-slate-700 text-slate-300";
            if (trade.status === TradeStatus.WIN) statusClass = "bg-emerald-600 text-white";
            else if (trade.status === TradeStatus.SMALL_WIN) statusClass = "bg-emerald-500/20 text-emerald-400";
            else if (trade.status === TradeStatus.BREAK_EVEN) statusClass = "bg-slate-500/20 text-slate-300";
            else if (trade.status === TradeStatus.SMALL_LOSS) statusClass = "bg-red-500/20 text-red-400";
            else if (trade.status === TradeStatus.LOSS) statusClass = "bg-red-600 text-white";

            return (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${statusClass}`}>
                    {trade.status}
                </span>
            );
          case 'quantity': return trade.quantity;
          case 'entryPrice': return <span className="text-slate-300">{trade.entryPrice}</span>;
          case 'exitPrice': return <span className="text-slate-300">{trade.exitPrice || '-'}</span>;
          case 'bestExitPrice': 
                const bestExit = trade.bestExitPrice ?? (trade.direction === 'Long' ? trade.highestPriceReached : trade.lowestPriceReached);
                return <span className="text-slate-400 text-xs">{bestExit || '-'}</span>;
          case 'initialStopLoss': return <span className="text-amber-500/80">{trade.initialStopLoss || '-'}</span>;
          case 'netPnL': return <span className={`font-bold text-base ${pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(pnl)}</span>;
          case 'rMultiple': 
              const r = calculateRMultiple(trade);
              return r !== undefined ? `${r}R` : '-';
          case 'strategy': 
              const stName = strategies.find(p => p.id === trade.playbookId)?.name;
              return stName || '-';
          case 'duration': 
              if (exitDt) {
                  const diffMs = exitDt.getTime() - entryDt.getTime();
                  if (diffMs > 0) {
                      const diffMins = Math.floor(diffMs / 60000);
                      const hours = Math.floor(diffMins / 60);
                      const mins = diffMins % 60;
                      return <span className="text-slate-400">{hours}h {mins}m</span>;
                  }
              }
              return '-';
          
          // New Columns Renders
          case 'bestPnL':
              return <span className={metrics.bestPnL > 0 ? 'text-green-400' : ''}>{formatCurrency(metrics.bestPnL)}</span>;
          case 'bestRR':
              return <span className="text-slate-300">{metrics.bestRR.toFixed(2)}R</span>;
          case 'actualRisk':
              return <span className="text-red-400">-{formatCurrency(metrics.actualRiskAmt)}</span>;
          case 'actualRiskPct':
              return <span className="text-slate-300">{metrics.actualRiskPct.toFixed(1)}%</span>;

          default: return '-';
      }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Top Stats (Reused from Dashboard) */}
      <TopWidgets stats={stats} />

      <div className="flex justify-between items-center mt-8">
         <h2 className="text-2xl font-bold text-white">交易資料庫 (Trades Database)</h2>
         <div className="flex gap-2">
            {/* Settings Button */}
            <button 
                onClick={() => setIsColumnModalOpen(true)}
                className="p-2 bg-surface hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="欄位設定"
            >
                <Settings size={20} />
            </button>

            {/* Trash Button - Activated on Selection */}
            <button 
                onClick={() => selectedIds.size > 0 && setIsDeleteConfirmOpen(true)}
                className={`p-2 border border-slate-700 rounded-lg transition-all ${selectedIds.size > 0 ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border-red-500/30' : 'bg-surface text-slate-600 opacity-50 cursor-not-allowed'}`}
                title={selectedIds.size > 0 ? `Delete ${selectedIds.size} trades` : "Select trades to delete"}
                disabled={selectedIds.size === 0}
            >
                <Trash2 size={20} />
            </button>
         </div>
      </div>

      {/* Main Table Container with Top Scroll */}
      <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden shadow-sm">
         {/* Top Scrollbar */}
         <div 
            ref={topScrollRef} 
            className="overflow-x-auto w-full border-b border-slate-700/30"
            style={{ height: '12px' }} // Small visible height for scrollbar
         >
             <div style={{ width: tableScrollWidth, height: '1px' }}></div>
         </div>

         {/* Actual Table */}
         <div 
            ref={tableContainerRef}
            className="overflow-x-auto min-h-[400px]"
         >
             <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900/50 uppercase text-xs font-semibold tracking-wider text-slate-300">
                    <tr>
                        {/* Select All Checkbox */}
                        <th className="px-4 py-4 w-12 text-center border-b border-slate-700/50">
                            <button 
                                onClick={handleSelectAll}
                                className={`flex items-center justify-center transition-colors ${selectedIds.size > 0 ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
                            >
                                {selectedIds.size > 0 && selectedIds.size === sortedTrades.length ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                        </th>
                        
                        {visibleColumns.map(colId => {
                            const isSorted = sortConfig.key === colId;
                            return (
                                <th key={colId} className="px-6 py-4 whitespace-nowrap border-b border-slate-700/50">
                                    <div className="flex items-center gap-1 group cursor-pointer" onClick={() => handleSort(colId)}>
                                        {ALL_COLUMNS.find(c => c.id === colId)?.label}
                                        <div 
                                            className={`p-0.5 rounded transition-colors ${isSorted ? 'text-primary bg-primary/10' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-400 hover:bg-slate-700'}`}
                                            title="排序"
                                        >
                                            {isSorted && sortConfig.direction === 'asc' && <ArrowUp size={14} />}
                                            {isSorted && sortConfig.direction === 'desc' && <ArrowDown size={14} />}
                                            {!isSorted && <ArrowUpDown size={14} />}
                                        </div>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {sortedTrades.map((trade) => {
                        const rowKey = trade.id || `temp-${Math.random()}`; 
                        const isSelected = selectedIds.has(trade.id);
                        return (
                            <tr 
                                key={rowKey} 
                                onClick={(e) => handleRowClick(e, trade)}
                                className={`transition-colors group cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-700/30'}`}
                            >
                                {/* Row Checkbox */}
                                <td className="px-4 py-4 w-12 text-center no-row-click" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={() => toggleSelectRow(trade.id)}
                                        className={`flex items-center justify-center transition-colors ${isSelected ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
                                    >
                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                </td>

                                {visibleColumns.map(colId => (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                        {renderCell(trade, colId)}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    {sortedTrades.length === 0 && (
                        <tr>
                            <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center text-slate-500">
                                No trades found.
                            </td>
                        </tr>
                    )}
                </tbody>
             </table>
         </div>
      </div>

      {/* Column Selection Modal - Using Portal */}
      {isColumnModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
             <div className="bg-surface w-[600px] max-h-[80vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#1f2937] rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-white">Select Columns</h3>
                        <p className="text-xs text-slate-400">Choose the columns you want to display in the table.</p>
                    </div>
                    <button onClick={() => setIsColumnModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-4 border-b border-slate-700 flex gap-2 bg-[#1f2937]">
                    <button onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.id))} className="px-3 py-1 rounded-full border border-slate-600 text-xs text-white hover:bg-slate-700">All</button>
                    <button onClick={() => setVisibleColumns([])} className="px-3 py-1 rounded-full border border-slate-600 text-xs text-white hover:bg-slate-700">None</button>
                    <button onClick={() => setVisibleColumns(DEFAULT_COLUMNS)} className="px-3 py-1 rounded-full bg-slate-700 text-xs text-white hover:bg-slate-600">Default</button>
                </div>

                <div className="p-6 overflow-y-auto bg-[#1f2937]">
                    {/* Use columns-3 for top-to-bottom filling in 3 columns */}
                    <div className="columns-3 gap-8 space-y-4">
                        {ALL_COLUMNS.map(col => (
                            <label key={col.id} className="flex items-center gap-2 cursor-pointer group break-inside-avoid">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${visibleColumns.includes(col.id) ? 'bg-primary border-primary' : 'border-slate-500 group-hover:border-slate-300'}`}>
                                    {visibleColumns.includes(col.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                </div>
                                <span className={`text-sm ${visibleColumns.includes(col.id) ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{col.label}</span>
                                <input type="checkbox" className="hidden" checked={visibleColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} />
                            </label>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 flex justify-end gap-2 bg-slate-800/50 rounded-b-xl">
                    <button onClick={() => setIsColumnModalOpen(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white">Go back</button>
                    <button onClick={() => setIsColumnModalOpen(false)} className="px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20">Update Table</button>
                </div>
             </div>
          </div>,
          document.body
      )}

      {/* Delete Confirmation Modal - Using Portal */}
      {isDeleteConfirmOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
             <div className="bg-[#1f2937] border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 ring-4 ring-red-500/5">
                    <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Trades?</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Are you sure you want to delete <span className="text-white font-bold">{selectedIds.size}</span> trades?<br/>
                    This action cannot be undone.
                </p>
                <div className="flex gap-4 justify-center">
                    <button 
                        onClick={() => setIsDeleteConfirmOpen(false)} 
                        className="px-6 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:bg-slate-700 transition-all flex-1"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleBulkDelete} 
                        className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-500/20 transition-all flex-1"
                    >
                        Delete
                    </button>
                </div>
             </div>
          </div>,
          document.body
      )}

      {/* New Trade Info Modal (Replacing the Edit Modal for clicking existing trades) */}
      {editingTrade && (
          <TradeInfoModal 
            isOpen={isEditModalOpen}
            onClose={() => {
                setIsEditModalOpen(false);
                setEditingTrade(undefined);
            }}
            trade={editingTrade}
          />
      )}
    </div>
  );
};
