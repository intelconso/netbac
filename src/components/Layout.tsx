import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutGrid, Bell, FileText, Wifi, WifiOff, ShieldCheck, Settings } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';

export default function Layout() {
  const isOffline = useStore((state) => state.isOffline);
  const user = useStore((state) => state.user);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background shadow-2xl overflow-hidden relative border-x border-gray-100">
      {/* Top Status Bar */}
      <div className={cn(
        "h-1 transition-colors duration-500",
        isOffline ? "bg-gray-300" : "bg-primary"
      )} />
      
      {/* Header Branding */}
      <header className="px-6 py-5 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary rounded-[1rem] flex items-center justify-center text-white shadow-xl shadow-primary/20 rotate-3">
            <ShieldCheck size={24} className="-rotate-3" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 leading-none tracking-tighter">NETBAC</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Live Trace</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-900 leading-none uppercase tracking-tight">{user?.name || 'Chef'}</p>
            <p className="text-[8px] font-bold text-primary uppercase tracking-widest mt-0.5">Admin</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shadow-sm">
            {user?.name?.charAt(0) || 'C'}
          </div>
        </div>
      </header>

      {/* Sync Status Bar (Subtle) */}
      <div className="px-6 py-1.5 bg-gray-50/50 flex justify-end">
        {isOffline ? (
          <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest">
            <WifiOff size={10} /> Mode Hors-ligne
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[8px] font-bold text-primary uppercase tracking-widest">
            <Wifi size={10} /> Synchronisé
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-100 flex items-center justify-around px-2 pb-safe h-20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <NavLink 
          to="/" 
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 transition-all duration-300 px-3 py-2 rounded-2xl",
            isActive ? "text-primary bg-primary/5 scale-105" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <LayoutGrid size={20} strokeWidth={2} />
          <span className="text-[8px] font-black uppercase tracking-wider">Dashboard</span>
        </NavLink>
        
        {user?.settings?.enableTemperature && (
          <NavLink 
            to="/alerts" 
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 transition-all duration-300 px-3 py-2 rounded-2xl",
              isActive ? "text-primary bg-primary/5 scale-105" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className="relative">
              <Bell size={20} strokeWidth={2} />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-danger rounded-full border-2 border-white" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-wider">Alertes</span>
          </NavLink>
        )}

        <NavLink 
          to="/export" 
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 transition-all duration-300 px-3 py-2 rounded-2xl",
            isActive ? "text-primary bg-primary/5 scale-105" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <FileText size={20} strokeWidth={2} />
          <span className="text-[8px] font-black uppercase tracking-wider">Rapports</span>
        </NavLink>

        <NavLink 
          to="/settings" 
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 transition-all duration-300 px-3 py-2 rounded-2xl",
            isActive ? "text-primary bg-primary/5 scale-105" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Settings size={20} strokeWidth={2} />
          <span className="text-[8px] font-black uppercase tracking-wider">Admin</span>
        </NavLink>
      </nav>
    </div>
  );
}
