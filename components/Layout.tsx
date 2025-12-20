import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, PieChart, FilePlus2, Database, Filter, Calendar as CalendarIcon, BookMarked, Tag as TagIcon } from 'lucide-react';
import { useTrades } from '../contexts/TradeContext';
import { DateRangePicker } from './DateRangePicker';
import { format, isSameDay } from 'date-fns';

interface LayoutProps {
  children: React.ReactNode;
  onOpenAddModal: () => void;
  onOpenTagManager: () => void;
}

const SidebarItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-primary/20 text-primary border-r-2 border-primary'
            : 'text-muted hover:bg-surface hover:text-white'
        }`
      }
    >
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children, onOpenAddModal, onOpenTagManager }) => {
  const { trades, dateRange, setDateRange } = useTrades();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Helper to display date label logic
  const getDisplayLabel = () => {
      if (dateRange.label) return dateRange.label;
      if (dateRange.startDate) {
          if (dateRange.endDate && isSameDay(dateRange.startDate, dateRange.endDate)) {
              return format(dateRange.startDate, 'MM/dd');
          }
          return `${format(dateRange.startDate, 'MM/dd')} - ${dateRange.endDate ? format(dateRange.endDate, 'MM/dd') : '...'}`;
      }
      return 'All Time';
  };

  return (
    <div className="flex h-screen bg-background text-text overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-slate-700 flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Trade<span className="text-primary">Zella</span>Clone
          </h1>
          <p className="text-xs text-muted mt-1">專業版交易分析</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem to="/" icon={LayoutDashboard} label="儀表板 (Dashboard)" />
          <SidebarItem to="/trades" icon={Database} label="交易資料庫 (Trades)" />
          <SidebarItem to="/journal" icon={BookOpen} label="交易日誌 (Journal)" />
          <SidebarItem to="/reports" icon={PieChart} label="詳細報表 (Reports)" />
          <SidebarItem to="/strategy" icon={BookMarked} label="交易策略 (Strategy)" />
        </nav>

        <div className="p-4 border-t border-slate-700">
           <div className="bg-slate-900/50 rounded p-3">
             <p className="text-xs text-muted mb-1">總交易數</p>
             <p className="text-lg font-bold text-white">{trades.length}</p>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-surface/50 border-b border-slate-700 flex items-center justify-between px-6 backdrop-blur-md">
           {/* Filters moved here */}
           <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-surface border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg text-sm text-slate-300 transition-all">
                  <Filter size={14} /> Filters
              </button>
              <button 
                  onClick={() => setIsDatePickerOpen(true)}
                  className="flex items-center gap-2 bg-surface border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg text-sm text-slate-300 transition-all"
              >
                  <CalendarIcon size={14} /> 
                  {getDisplayLabel()}
              </button>
              
              <div className="ml-2 text-xs text-slate-500">
                  Last import: {new Date().toLocaleString()}
              </div>
           </div>

           <div className="flex items-center gap-3">
               <button 
                 onClick={onOpenTagManager}
                 className="flex items-center gap-2 bg-surface hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 px-4 py-2 rounded-md text-sm font-medium transition-colors"
               >
                 <TagIcon size={18} />
                 Manage Tags
               </button>

               <button 
                 onClick={onOpenAddModal}
                 className="flex items-center gap-2 bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
               >
                 <FilePlus2 size={18} />
                 新增交易
               </button>
           </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {children}
        </div>
      </main>

      {/* Date Picker Modal */}
      <DateRangePicker 
         isOpen={isDatePickerOpen}
         onClose={() => setIsDatePickerOpen(false)}
         initialStart={dateRange.startDate}
         initialEnd={dateRange.endDate}
         onApply={(start, end, label) => setDateRange({ startDate: start, endDate: end, label })}
      />
    </div>
  );
};