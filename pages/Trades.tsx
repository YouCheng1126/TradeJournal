import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTrades } from '../contexts/TradeContext';
import { 
    calculatePnL, formatCurrency, calculateRMultiple, calculateProfitFactor, 
    calculateAvgWinLoss, calculateGrossStats, calculateStreaks
} from '../utils/calculations';
import { Edit, Trash2, Settings, X, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';
import { TradeFormModal } from '../components/TradeFormModal';
import { Trade, TradeStatus } from '../types';
import { SemiCircleGauge, ProfitFactorGauge, AvgWinLossBar, StreakWidget } from '../components/StatWidgets';

// Column Definition
interface ColumnDef {
    id: string;
    label: string;
}

// Removed tags, notes, status from ALL_COLUMNS as requested
const ALL_COLUMNS: ColumnDef[] = [
    { id: 'openDate', label: 'Open Date' },
    { id: 'openTime', label: 'Open Time' },
    { id: 'closeDate', label: 'Close Date' },
    { id: 'closeTime', label: 'Close Time' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'screenshot', label: 'Img' }, // New Column
    { id: 'side', label: 'Side' },
    { id: 'status', label: 'Status' }, // Re-added status column
    { id: 'quantity', label: 'Volume' }, 
    { id: 'entryPrice', label: 'Entry Price' },
    { id: 'exitPrice', label: 'Exit Price' },
    { id: 'bestExitPrice', label: 'Best Exit' }, // Added Best Exit
    { id: 'initialStopLoss', label: 'Stop Loss' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'netPnL', label: 'Net P&L' },
    { id: 'grossPnL', label: 'Gross P&L' },
    { id: 'rMultiple', label: 'R-Multiple' },
    { id: 'strategy', label: 'Strategy' }, // Renamed from Playbook
    { id: 'duration', label: 'Duration' },
];

const DEFAULT_COLUMNS = ['openDate', 'side', 'status', 'entryPrice', 'exitPrice', 'netPnL', 'openTime', 'duration'];

// Card Component 
const Card = ({ title, value, subValue, children, titleColor = "text-slate-400", alignChildren = "center" }: any) => (
    <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col justify-between h-48 relative overflow-hidden shadow-sm">
      <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider mb-2">
          <span className={titleColor}>{title}</span>
      </div>
      <div className="flex items-center justify-between w-full h-full">
          <div className="flex flex-col justify-center h-full">
              <span className={`text-3xl font-bold ${typeof value === 'number' ? (value >= 0 ? 'text-white' : 'text-red-400') : 'text-white'}`}>
                  {value}
              </span>
              {subValue && <span className="text-sm text-slate-500 mt-2">{subValue}</span>}
          </div>
          <div className={`flex items-${alignChildren} justify-center pb-4 w-full h-full pl-4`}>
              {children}
          </div>
      </div>
    </div>
);

type SortDirection = 'asc' | 'desc' | null;

export const Trades: React.FC = () => {
  const { filteredTrades, deleteTrade, strategies } = useTrades(); 
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);

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

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!id) return;
    deleteTrade(id);
  };

  const handleEdit = (e: React.MouseEvent, trade: Trade) => {
    e.stopPropagation();
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

  const getSortableValue = (trade: Trade, colId: string): number | string => {
      switch(colId) {
          case 'openDate': return new Date(trade.entryDate).getTime();
          case 'openTime': return new Date(trade.entryDate).getTime(); // Simplified, sort by full date
          case 'closeDate': return trade.exitDate ? new Date(trade.exitDate).getTime() : 0;
          case 'closeTime': return trade.exitDate ? new Date(trade.exitDate).getTime() : 0;
          case 'symbol': return trade.symbol;
          case 'screenshot': return trade.screenshotUrl ? 1 : 0;
          case 'side': return trade.direction;
          case 'status': return getStatusWeight(trade.status); // Use custom weight
          case 'quantity': return trade.quantity;
          case 'entryPrice': return trade.entryPrice;
          case 'exitPrice': return trade.exitPrice || 0;
          case 'bestExitPrice': return trade.bestExitPrice || 0;
          case 'initialStopLoss': return trade.initialStopLoss || 0;
          case 'commissions': return trade.commission;
          case 'netPnL': return calculatePnL(trade);
          case 'grossPnL': return calculatePnL(trade) + (trade.commission || 0);
          case 'rMultiple': return calculateRMultiple(trade) || -999;
          case 'strategy': return strategies.find(p => p.id === trade.playbookId)?.name || '';
          case 'duration': 
              if (!trade.exitDate) return 0;
              return new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
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

      // Timezone Helper: America/New_York (EST/EDT)
      const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
      const formatDate = (date: Date) => date.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

      switch(colId) {
          case 'openDate': return formatDate(entryDt);
          case 'openTime': return formatTime(entryDt);
          case 'closeDate': return exitDt ? formatDate(exitDt) : '-';
          case 'closeTime': return exitDt ? formatTime(exitDt) : '-';
          case 'symbol': return <span className="font-bold text-white">{trade.symbol}</span>;
          case 'screenshot': return trade.screenshotUrl ? (
              <a href={trade.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block p-1 hover:bg-slate-700 rounded transition-colors w-fit" onClick={e => e.stopPropagation()}>
                  <ImageIcon size={14} className="text-blue-400" />
              </a>
          ) : '';
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
          case 'bestExitPrice': return <span className="text-slate-400 text-xs">{trade.bestExitPrice || '-'}</span>;
          case 'initialStopLoss': return <span className="text-amber-500/80">{trade.initialStopLoss || '-'}</span>;
          case 'commissions': return <span className="text-slate-400">{trade.commission}</span>;
          case 'netPnL': return <span className={`font-bold text-base ${pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(pnl)}</span>;
          case 'grossPnL': 
              const gross = pnl + (trade.commission || 0);
              return <span className={gross > 0 ? 'text-green-400' : gross < 0 ? 'text-red-400' : ''}>{formatCurrency(gross)}</span>;
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
          default: return '-';
      }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col justify-between h-48 relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider mb-2">
                <span className="text-slate-400">Net P&L</span>
            </div>
            <div className="flex items-center justify-between w-full">
                <div className="flex flex-col justify-center h-full mt-4">
                    <span className={`text-3xl font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(stats.totalPnL)}
                    </span>
                    <span className="text-sm text-slate-500 mt-1">{stats.count} trades</span>
                </div>
            </div>
        </div>

        <Card title="Trade win %" value={`${stats.adjustedWinRate}%`} subValue=""><SemiCircleGauge winCount={stats.winsCount} breakEvenCount={stats.breakEvenCount} lossCount={stats.lossesCount} /></Card>
        <Card title="Profit factor" value={stats.profitFactor.toFixed(2)} subValue=""><ProfitFactorGauge grossProfit={stats.grossProfit} grossLoss={stats.grossLoss} /></Card>
        
        <div className="bg-surface rounded-xl border border-slate-700/50 p-5 flex flex-col justify-between h-48 relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider mb-2">
                <span className="text-slate-400">Current Streak</span>
            </div>
            <div className="h-full flex items-center justify-center pb-6"> 
                 <StreakWidget 
                    currentDayStreak={stats.currentDayStreak} 
                    maxDayWinStreak={stats.maxDayWinStreak}
                    maxDayLossStreak={stats.maxDayLossStreak}
                    currentTradeStreak={stats.currentTradeStreak}
                    maxTradeWinStreak={stats.maxTradeWinStreak}
                    maxTradeLossStreak={stats.maxTradeLossStreak}
                 />
            </div>
        </div>

        <Card title="Avg win/loss trade" value={(Math.abs(stats.avgWin) / (Math.abs(stats.avgLoss) || 1)).toFixed(2)} subValue="" alignChildren="end">
            <div className="mb-8"> 
                 <AvgWinLossBar win={stats.avgWin} loss={stats.avgLoss} />
            </div>
        </Card>
      </div>

      <div className="flex justify-between items-center mt-8">
         <h2 className="text-2xl font-bold text-white">交易資料庫 (Trades Database)</h2>
         <div className="relative">
            <button 
                onClick={() => setIsColumnModalOpen(true)}
                className="p-2 bg-surface hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="欄位設定"
            >
                <Settings size={20} />
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
                        {visibleColumns.map(colId => {
                            const isSorted = sortConfig.key === colId;
                            return (
                                <th key={colId} className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-1 group">
                                        {ALL_COLUMNS.find(c => c.id === colId)?.label}
                                        <button 
                                            onClick={() => handleSort(colId)} 
                                            className={`p-0.5 rounded transition-colors ${isSorted ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700'}`}
                                            title="排序"
                                        >
                                            {isSorted && sortConfig.direction === 'asc' && <ArrowUp size={14} />}
                                            {isSorted && sortConfig.direction === 'desc' && <ArrowDown size={14} />}
                                            {!isSorted && <ArrowUpDown size={14} />}
                                        </button>
                                    </div>
                                </th>
                            );
                        })}
                        <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {sortedTrades.map((trade) => {
                        const rowKey = trade.id || `temp-${Math.random()}`; 
                        return (
                            <tr key={rowKey} className="hover:bg-slate-700/30 transition-colors group">
                                {visibleColumns.map(colId => (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                        {renderCell(trade, colId)}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={(e) => handleEdit(e, trade)} className="p-1.5 bg-slate-800 hover:bg-slate-600 rounded text-blue-400 border border-slate-700"><Edit size={16} /></button>
                                        <button onClick={(e) => handleDelete(e, trade.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white rounded text-red-400 border border-red-500/20"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
         </div>
      </div>

      {/* Column Selection Modal */}
      {isColumnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
             <div className="bg-surface w-[600px] max-h-[80vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-white">Select Columns</h3>
                        <p className="text-xs text-slate-400">Choose the columns you want to display in the table.</p>
                    </div>
                    <button onClick={() => setIsColumnModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-4 border-b border-slate-700 flex gap-2">
                    <button onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.id))} className="px-3 py-1 rounded-full border border-slate-600 text-xs text-white hover:bg-slate-700">All</button>
                    <button onClick={() => setVisibleColumns([])} className="px-3 py-1 rounded-full border border-slate-600 text-xs text-white hover:bg-slate-700">None</button>
                    <button onClick={() => setVisibleColumns(DEFAULT_COLUMNS)} className="px-3 py-1 rounded-full bg-slate-700 text-xs text-white hover:bg-slate-600">Default</button>
                </div>

                <div className="p-6 grid grid-cols-3 gap-4 overflow-y-auto">
                    {ALL_COLUMNS.map(col => (
                        <label key={col.id} className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleColumns.includes(col.id) ? 'bg-primary border-primary' : 'border-slate-500 group-hover:border-slate-300'}`}>
                                {visibleColumns.includes(col.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                            </div>
                            <span className={`text-sm ${visibleColumns.includes(col.id) ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{col.label}</span>
                            <input type="checkbox" className="hidden" checked={visibleColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} />
                        </label>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-700 flex justify-end gap-2 bg-slate-800/50 rounded-b-xl">
                    <button onClick={() => setIsColumnModalOpen(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white">Go back</button>
                    <button onClick={() => setIsColumnModalOpen(false)} className="px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20">Update Table</button>
                </div>
             </div>
          </div>
      )}

      {/* Edit Modal */}
      {editingTrade && (
          <TradeFormModal 
            isOpen={isEditModalOpen}
            onClose={() => {
                setIsEditModalOpen(false);
                setEditingTrade(undefined);
            }}
            initialData={editingTrade}
          />
      )}
    </div>
  );
};