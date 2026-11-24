import React from 'react';
import { Menu, Factory, Server, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '../common/Badge';
import { useApiHealth, useDatabaseHealth } from '../../hooks/useHealth';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { data: apiHealth, isError: apiError } = useApiHealth();
  const { data: dbHealth, isError: dbError } = useDatabaseHealth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-navy text-white shadow-sm">
            <Factory className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-brand-navy">
                FoodFactory ERP
              </span>
              <Badge variant="teal" className="hidden sm:inline-flex text-[10px] py-0">
                Phase 1.1 Foundation
              </Badge>
            </div>
            <p className="text-xs text-slate-500 hidden md:block">
              Packaged Food Manufacturing Management System
            </p>
          </div>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-3">
        {/* API Health Pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
          <Server className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden sm:inline text-slate-600 font-medium">API:</span>
          {apiHealth?.status === 'healthy' ? (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Online</span>
            </span>
          ) : apiError ? (
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Offline</span>
            </span>
          ) : (
            <span className="text-amber-600">Connecting...</span>
          )}
        </div>

        {/* Database Health Pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
          <Database className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden sm:inline text-slate-600 font-medium">DB:</span>
          {dbHealth?.status === 'connected' ? (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Connected</span>
            </span>
          ) : dbError ? (
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Offline</span>
            </span>
          ) : (
            <span className="text-amber-600">Checking...</span>
          )}
        </div>
      </div>
    </header>
  );
};
