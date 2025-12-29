
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTrades } from '../contexts/TradeContext';
import { 
    calculatePnL, formatCurrency, calculateRMultiple, calculateProfitFactor, 
    calculateAvgWinLoss, calculateGrossStats, calculateStreaks,
    getMultiplier, getStatusWeight, getTradeMetrics
} from '../utils/calculations';
import { Settings, X, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, Trash2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { Trade, TradeStatus } from '../types';
import { TopWidgets } from '../components/Dashboard/TopWidgets';
import { TradeInfoModal } from '../components/TradeModal';

// Column Definition
interface ColumnDef {
    id: string;
    label: string;
}

// Sorted Alphabetically for the Column Selector Modal
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

const DEFAULT_COLUMNS = ['openDate', 'openTime', 'side', 'status', 'entryPrice', 'exitPrice', 'netPnL', 'rMultiple', 'actualRisk', 'actualRiskPct', 'duration'];

type SortDirection = 'asc' | 'desc' | null;

export const Trades: React.FC = () => {
  const { filteredTrades, deleteTrade, strategies, userSettings } = useTrades(); 
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
    const totalPnL = closedTrades.reduce((acc, t) => acc + calculatePnL(t, userSettings.commissionPerUnit), 0);
    const profitFactor = calculateProfitFactor(closedTrades, userSettings.commissionPerUnit);
    const { avgWin, avgLoss } = calculateAvgWinLoss(closedTrades, userSettings.commissionPerUnit);
    const { grossProfit, grossLoss } = calculateGrossStats(closedTrades, userSettings.commissionPerUnit);
    const { 
        currentDayStreak, maxDayWinStreak, maxDayLossStreak,
        currentTradeStreak, maxTradeWinStreak, maxTradeLossStreak 
    } = calculateStreaks(closedTrades, userSettings.commissionPerUnit);

    // Updated Logic: Count based on Status
    const winsCount = closedTrades.filter(t => t.status === TradeStatus.WIN || t.status === TradeStatus.SMALL_WIN).length;
    const lossesCount = closedTrades.filter(t => t.status === TradeStatus.LOSS || t.status === TradeStatus.SMALL_LOSS).length;
    const breakEvenCount = closedTrades.filter(t => t.status === TradeStatus.BREAK_EVEN).length;
    
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
  }, [filteredTrades, userSettings.commissionPerUnit]);

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
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
          await deleteTrade(id);
      }
      setSelectedIds(new Set());
      setIsDeleteConfirmOpen(false);
  };

  const handleRowClick = (e: React.MouseEvent, trade: Trade) => {
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
    if (sortConfig.key === colId) {
        if (sortConfig.direction === 'desc') direction = 'asc';
        else if (sortConfig.direction === 'asc') direction = null;
    }
    setSortConfig({ key: direction ? colId : null, direction });
  };

  const getSortableValue = (trade: Trade, colId: string): number | string => {
      const metrics = getTradeMetrics(trade, userSettings.commissionPerUnit);
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
          case 'netPnL': return calculatePnL(trade, userSettings.commissionPerUnit);
          case 'rMultiple': return calculateRMultiple(trade, userSettings.commissionPerUnit) || -999;
          case 'strategy': return strategies.find(p => p.id === trade.playbookId)?.name || '';
          case 'duration': 
              if (!trade.exitDate) return 0;
              return new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
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
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        sortableItems.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    }
    return sortableItems;
  }, [filteredTrades, sortConfig, strategies, userSettings.commissionPerUnit]);

  // --- Render Cell (Updated to be BOLD) ---
  const renderCell = (trade: Trade, colId: string) => {
      const pnl = calculatePnL(trade, userSettings.commissionPerUnit);
      // const entryDt = new Date(trade.entryDate); // Deprecated use of Date object for rendering
      // const exitDt = trade.exitDate ? new Date(trade.exitDate) : null;
      const metrics = getTradeMetrics(trade, userSettings.commissionPerUnit);

      // Raw String Parsing Helpers
      const getRawDate = (iso: string) => iso ? iso.split('T')[0] : '-';
      const getRawTime = (iso: string) => {
          if (!iso) return '-';
          const t = iso.split('T')[1];
          return t ? t.substring(0, 5) : '-'; // HH:MM
      };

      // Duration calc still needs Date objects for math, which is fine for relative difference
      const getDuration = () => {
          if (!trade.exitDate) return '-';
          const start = new Date(trade.entryDate);
          const end = new Date(trade.exitDate);
          const diffMs = end.getTime() - start.getTime();
          if (diffMs > 0) {
              const diffMins = Math.floor(diffMs / 60000);
              const hours = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              return `${hours}h ${mins}m`;
          }
          return '-';
      };

      switch(colId) {
          case 'openDate': return <span className="text-lg font-bold">{getRawDate(trade.entryDate)}</span>;
          case 'openTime': return <span className="text-lg font-bold">{getRawTime(trade.entryDate)}</span>;
          case 'closeDate': return <span className="text-lg font-bold">{getRawDate(trade.exitDate || '')}</span>;
          case 'closeTime': return <span className="text-lg font-bold">{getRawTime(trade.exitDate || '')}</span>;
          case 'symbol': 
            return (
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-lg">{trade.symbol}</span>
                    {trade.screenshotUrl && <ImageIcon size={20} className="text-slate-500" />}
                </div>
            );
          case 'side': return (
            <span className={`px-3 py-1.5 rounded text-base font-bold ${trade.direction === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
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
                <div className="flex justify-center">
                    <span className={`px-3 py-1.5 rounded text-base font-bold ${statusClass}`}>
                        {trade.status}
                    </span>
                </div>
            );
          case 'quantity': return <span className="text-lg font-bold">{trade.quantity}</span>;
          case 'entryPrice': return <span className="text-slate-300 text-lg font-bold">{trade.entryPrice}</span>;
          case 'exitPrice': return <span className="text-slate-300 text-lg font-bold">{trade.exitPrice || '-'}</span>;
          case 'bestExitPrice': 
                const bestExit = trade.bestExitPrice ?? (trade.direction === 'Long' ? trade.highestPriceReached : trade.lowestPriceReached);
                return <span className="text-slate-400 text-lg font-bold">{bestExit || '-'}</span>;
          case 'initialStopLoss': return <span className="text-amber-500/80 text-lg font-bold">{trade.initialStopLoss || '-'}</span>;
          case 'netPnL': return <span className={`font-bold text-lg ${pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(pnl)}</span>;
          case 'rMultiple': 
              const r = calculateRMultiple(trade, userSettings.commissionPerUnit);
              return <span className="text-slate-300 text-lg font-bold">{r !== undefined ? `${r}R` : '-'}</span>;
          case 'strategy': 
              const stName = strategies.find(p => p.id === trade.playbookId)?.name;
              return <span className="text-lg font-bold">{stName || '-'}</span>;
          case 'duration': return <span className="text-slate-400 text-lg font-bold">{getDuration()}</span>;
          
          case 'bestPnL':
              return <span className={`text-lg font-bold ${metrics.bestPnL > 0 ? 'text-green-400' : ''}`}>{formatCurrency(metrics.bestPnL)}</span>;
          case 'bestRR':
              return <span className="text-slate-300 text-lg font-bold">{metrics.bestRR.toFixed(2)}R</span>;
          case 'actualRisk':
              return <span className="text-red-400 text-lg font-bold">-{formatCurrency(metrics.actualRiskAmt)}</span>;
          case 'actualRiskPct':
              return <span className="text-slate-300 text-lg font-bold">{metrics.actualRiskPct.toFixed(1)}%</span>;

          default: return <span className="text-lg font-bold">-</span>;
      }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Top Stats */}
      <TopWidgets stats={stats} />

      <div className="flex justify-between items-center mt-8">
         <h2 className="text-3xl font-bold text-white">交易資料庫 (Trades Database)</h2>
         <div className="flex gap-2">
            {/* Settings Button */}
            <button 
                onClick={() => setIsColumnModalOpen(true)}
                className="p-3 bg-surface hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="欄位設定"
            >
                <Settings size={24} />
            </button>

            {/* Trash Button */}
            <button 
                onClick={() => selectedIds.size > 0 && setIsDeleteConfirmOpen(true)}
                className={`p-3 border border-slate-600 rounded-lg transition-all ${selectedIds.size > 0 ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border-red-500/30' : 'bg-surface text-slate-600 opacity-50 cursor-not-allowed'}`}
                disabled={selectedIds.size === 0}
            >
                <Trash2 size={24} />
            </button>
         </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface rounded-xl border border-slate-600 overflow-hidden shadow-sm">
         <div 
            ref={topScrollRef} 
            className="overflow-x-auto w-full border-b border-slate-600/30"
            style={{ height: '12px' }}
         >
             <div style={{ width: tableScrollWidth, height: '1px' }}></div>
         </div>

         <div 
            ref={tableContainerRef}
            className="overflow-x-auto min-h-[400px]"
         >
             <table className="w-full text-left text-lg text-slate-400 font-bold">
                {/* Header Font updated: No uppercase, text-lg */}
                <thead className="bg-slate-800/50 text-lg font-bold tracking-wider text-slate-300">
                    <tr>
                        <th className="px-6 py-5 w-16 text-center border-b border-slate-600">
                            <button 
                                onClick={handleSelectAll}
                                className={`flex items-center justify-center transition-colors ${selectedIds.size > 0 ? 'text-primary' : 'text-slate-500 hover:text-slate-400'}`}
                            >
                                {selectedIds.size > 0 && selectedIds.size === sortedTrades.length ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                        </th>
                        
                        {visibleColumns.map(colId => {
                            const isSorted = sortConfig.key === colId;
                            return (
                                <th key={colId} className={`px-6 py-5 whitespace-nowrap border-b border-slate-600 ${colId === 'status' ? 'text-center' : ''}`}>
                                    <div className={`flex items-center gap-1 group cursor-pointer ${colId === 'status' ? 'justify-center' : ''}`} onClick={() => handleSort(colId)}>
                                        {ALL_COLUMNS.find(c => c.id === colId)?.label}
                                        <div 
                                            className={`p-0.5 rounded transition-colors ${isSorted ? 'text-primary bg-primary/10' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-400 hover:bg-slate-600'}`}
                                        >
                                            {isSorted && sortConfig.direction === 'asc' && <ArrowUp size={16} />}
                                            {isSorted && sortConfig.direction === 'desc' && <ArrowDown size={16} />}
                                            {!isSorted && <ArrowUpDown size={16} />}
                                        </div>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                    {sortedTrades.map((trade) => {
                        const rowKey = trade.id || `temp-${Math.random()}`; 
                        const isSelected = selectedIds.has(trade.id);
                        return (
                            <tr 
                                key={rowKey} 
                                onClick={(e) => handleRowClick(e, trade)}
                                className={`transition-colors group cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-600/30'}`}
                            >
                                <td className="px-6 py-5 w-16 text-center no-row-click" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={() => toggleSelectRow(trade.id)}
                                        className={`flex items-center justify-center transition-colors ${isSelected ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
                                    >
                                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </button>
                                </td>

                                {visibleColumns.map(colId => (
                                    <td key={colId} className={`px-6 py-5 whitespace-nowrap ${colId === 'status' ? 'text-center' : ''}`}>
                                        {renderCell(trade, colId)}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    {sortedTrades.length === 0 && (
                        <tr>
                            <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center text-slate-500 text-lg">
                                No trades found.
                            </td>
                        </tr>
                    )}
                </tbody>
             </table>
         </div>
      </div>

      {/* Column Selection Modal - ENLARGED & REDESIGNED */}
      {isColumnModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
             <div className="bg-surface w-full max-w-5xl h-auto max-h-[95%] rounded-2xl border border-slate-600 shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-600 flex justify-between items-center bg-surface rounded-t-2xl">
                    <div>
                        <h3 className="text-3xl font-bold text-white">Select Columns</h3>
                        <p className="text-lg text-slate-400 mt-1">Choose the columns you want to display in the table.</p>
                    </div>
                    <button onClick={() => setIsColumnModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors"><X size={32}/></button>
                </div>
                
                {/* No top bar buttons, moved to footer */}

                <div className="p-10 overflow-y-auto bg-surface flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
                        {ALL_COLUMNS.map(col => (
                            <button 
                                key={col.id} 
                                onClick={() => toggleColumn(col.id)}
                                className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors group"
                            >
                                <div className={`transition-colors flex-shrink-0 ${visibleColumns.includes(col.id) ? 'text-primary' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                    {visibleColumns.includes(col.id) ? <CheckSquare size={24} /> : <Square size={24} />}
                                </div>
                                <span className={`text-xl font-bold ${visibleColumns.includes(col.id) ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                    {col.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-600 flex justify-between items-center bg-slate-800/20 rounded-b-2xl">
                    <div className="flex gap-3">
                        <button onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.id))} className="px-5 py-3 rounded-xl border border-slate-500 text-lg font-bold text-white hover:bg-slate-700 transition-colors">All</button>
                        <button onClick={() => setVisibleColumns([])} className="px-5 py-3 rounded-xl border border-slate-500 text-lg font-bold text-white hover:bg-slate-700 transition-colors">None</button>
                        <button onClick={() => setVisibleColumns(DEFAULT_COLUMNS)} className="px-5 py-3 rounded-xl bg-slate-600 text-lg font-bold text-white hover:bg-slate-500 transition-colors">Default</button>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setIsColumnModalOpen(false)} className="px-8 py-3 text-lg text-slate-300 hover:text-white font-bold hover:bg-slate-700/50 rounded-xl transition-colors">Go back</button>
                        <button onClick={() => setIsColumnModalOpen(false)} className="px-8 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-lg font-bold shadow-xl shadow-primary/20 transition-all">Update Table</button>
                    </div>
                </div>
             </div>
          </div>,
          document.body
      )}

      {isDeleteConfirmOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
             <div className="bg-surface border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
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
                        className="px-6 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-500 rounded-lg hover:bg-slate-600 transition-all flex-1"
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

      {editingTrade && (
          <TradeInfoModal 
            isOpen={isEditModalOpen}
            onClose={() => {
                setIsEditModalOpen(false);
                setEditingTrade(undefined);
            }}
            trade={editingTrade}
            mode="edit"
          />
      )}
    </div>
  );
};
