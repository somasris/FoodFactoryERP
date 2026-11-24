import React from 'react';
import {
  Menu,
  Factory,
  Server,
  Database,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { useApiHealth, useDatabaseHealth } from '../../hooks/useHealth';
import { useAuth } from '../../hooks/useAuth';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { data: apiHealth, isError: apiError } = useApiHealth();
  const { data: dbHealth, isError: dbError } = useDatabaseHealth();
  const { user, logout } = useAuth();

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
                Phase 1.3 Certified
              </Badge>
            </div>
            <p className="text-xs text-slate-500 hidden md:block">
              Packaged Food Manufacturing Management System
            </p>
          </div>
        </div>
      </div>

      {/* Status pills & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* API Health Pill */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
          <Server className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">API:</span>
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
        <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
          <Database className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">DB:</span>
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

        {/* User Profile & Logout Action */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {user.fullName || user.username}
              </span>
              <span className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">
                {user.roles[0] || 'User'}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
              <UserIcon className="h-4 w-4" />
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
