
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, ImageIcon } from 'lucide-react';
import { 
    calculatePnL, calculateRMultiple, formatCurrency,
    getMultiplier, getStatusWeight, getTradeMetrics 
} from '../../../utils/calculations';
import { Trade, TradeStatus, TradeDirection } from '../../../types';
import { useTrades } from '../../../contexts/TradeContext';

interface TradesTabProps {
    trades: Trade[];
    commissionPerUnit: number;
    onTradeClick: (trade: Trade) => void;
}

// Column Definition
interface ColumnDef {
    id: string;
    label: string;
}

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

// Updated default columns to include Actual Risk %
const DEFAULT_COLUMNS = ['openDate', 'openTime', 'side', 'status', 'entryPrice', 'exitPrice', 'netPnL', 'rMultiple', 'actualRisk', 'actualRiskPct', 'duration'];

type SortDirection = 'asc' | 'desc' | null;

export const TradesTab: React.FC<TradesTabProps> = ({ trades, commissionPerUnit, onTradeClick }) => {
    const { strategies } = useTrades();
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
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
    }, [visibleColumns, trades]);

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
        const metrics = getTradeMetrics(trade, commissionPerUnit);
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
            case 'netPnL': return calculatePnL(trade, commissionPerUnit);
            case 'rMultiple': return calculateRMultiple(trade, commissionPerUnit) || -999;
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
        let sortableItems = [...trades];
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
    }, [trades, sortConfig, strategies, commissionPerUnit]);

    // --- Column Toggle ---
    const toggleColumn = (colId: string) => {
        setVisibleColumns(prev => 
            prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
        );
    };

    // --- Render Cell ---
    const renderCell = (trade: Trade, colId: string) => {
        const pnl = calculatePnL(trade, commissionPerUnit);
        const metrics = getTradeMetrics(trade, commissionPerUnit);
        
        const getRawDate = (iso: string) => iso ? iso.split('T')[0] : '-';
        const getRawTime = (iso: string) => {
            if (!iso) return '-';
            const t = iso.split('T')[1];
            return t ? t.substring(0, 5) : '-';
        };

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
                <span className={`px-3 py-1.5 rounded text-base font-bold ${trade.direction === TradeDirection.LONG ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {trade.direction === TradeDirection.LONG ? 'Long' : 'Short'}
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
                const bestExit = trade.bestExitPrice ?? (trade.direction === TradeDirection.LONG ? trade.highestPriceReached : trade.lowestPriceReached);
                return <span className="text-slate-400 text-lg font-bold">{bestExit || '-'}</span>;
            case 'initialStopLoss': return <span className="text-amber-500/80 text-lg font-bold">{trade.initialStopLoss || '-'}</span>;
            case 'netPnL': return <span className={`font-bold text-lg ${pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(pnl)}</span>;
            case 'rMultiple': 
                const r = calculateRMultiple(trade, commissionPerUnit);
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
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-end">
                <button 
                    onClick={() => setIsColumnModalOpen(true)}
                    className="p-2 bg-surface hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="欄位設定"
                >
                    <Settings size={20} />
                </button>
            </div>

            <div className="bg-surface rounded-xl border border-slate-600 overflow-hidden shadow-sm">
                {/* Top Scrollbar */}
                <div 
                    ref={topScrollRef} 
                    className="overflow-x-auto w-full border-b border-slate-600/30"
                    style={{ height: '12px' }}
                >
                    <div style={{ width: tableScrollWidth, height: '1px' }}></div>
                </div>

                <div ref={tableContainerRef} className="overflow-x-auto">
                    <table className="w-full text-left text-lg text-slate-400 font-bold">
                        <thead className="bg-slate-800/50 text-lg font-bold tracking-wider text-slate-300">
                            <tr>
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
                            {sortedTrades.map(trade => (
                                <tr 
                                    key={trade.id} 
                                    onClick={() => onTradeClick(trade)} 
                                    className="hover:bg-slate-600/30 transition-colors cursor-pointer"
                                >
                                    {visibleColumns.map(colId => (
                                        <td key={colId} className={`px-6 py-5 whitespace-nowrap ${colId === 'status' ? 'text-center' : ''}`}>
                                            {renderCell(trade, colId)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {sortedTrades.length === 0 && (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-500 text-lg">
                                        No trades linked to this strategy.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Column Selection Modal */}
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
        </div>
    );
};
