import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Menu,
  Factory,
  LogOut,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useApiHealth, useDatabaseHealth } from '../../hooks/useHealth';
import { useAuth } from '../../hooks/useAuth';
import { getDefaultDashboardPath, NAV_GROUPS } from '../../config/navigation';
import { NotificationBell } from './NotificationBell';
import { OfflineStatusBadge } from './OfflineStatusBadge';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { data: apiHealth, isError: apiError } = useApiHealth();
  const { data: dbHealth, isError: dbError } = useDatabaseHealth();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const breadcrumb = useMemo(() => {
    const pathname = location.pathname;
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
          return { group: group.label, page: item.label };
        }
      }
    }
    const matchedGroup = NAV_GROUPS.find(g => pathname.startsWith(`${g.basePath}/`) || pathname === g.basePath);
    if (matchedGroup) {
      const segment = pathname.split('/').filter(Boolean).pop() || matchedGroup.label;
      const formatted = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return { group: matchedGroup.label, page: formatted };
    }
    return { group: 'Operations', page: 'Workspace' };
  }, [location.pathname]);

  const homePath = getDefaultDashboardPath(user);
  const isSystemHealthy =
    apiHealth?.status === 'healthy' && dbHealth?.status === 'connected';
  const isSystemError = apiError || dbError;

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#E1E7DD] bg-white px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-md p-1.5 text-[#66756A] hover:bg-[#EAF1E8] hover:text-[#17452C] md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to={homePath} className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#245C3A] text-[#E8D7AA] border border-[#17452C]">
            <Factory className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-[#17452C] sm:text-base">
            FoodFactory ERP
          </span>
        </Link>

        {/* Current Page Breadcrumb */}
        <div className="hidden md:flex items-center gap-1.5 border-l border-[#E1E7DD] pl-3 text-xs text-[#66756A] min-w-0">
          <span className="truncate">{breadcrumb.group}</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#8A958C] shrink-0" />
          <span className="font-medium text-[#24352A] truncate">{breadcrumb.page}</span>
        </div>
      </div>

      {/* System Status, Offline Indicator & User Profile Menu */}
      <div className="flex items-center gap-2.5">
        <OfflineStatusBadge />

        <div
          className="hidden lg:flex items-center gap-2 rounded-md border border-[#E1E7DD] bg-[#FAFBF8] px-2.5 py-1 text-[11px] text-[#66756A]"
          title={`API: ${apiHealth?.status || (apiError ? 'offline' : 'connecting')} | DB: ${dbHealth?.status || (dbError ? 'offline' : 'checking')}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isSystemHealthy
                ? 'bg-[#27834A]'
                : isSystemError
                  ? 'bg-[#C74440]'
                  : 'bg-[#C58A25]'
            }`}
            aria-hidden="true"
          />
          <span className="font-medium">
            {isSystemHealthy ? 'Systems Operational' : isSystemError ? 'Service Degraded' : 'Connecting'}
          </span>
        </div>

        {user && <NotificationBell />}

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(prev => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1.5 text-left hover:bg-[#EAF1E8]/60 transition-colors"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF1E8] text-[#245C3A]">
                <UserIcon className="h-3.5 w-3.5" />
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-[#24352A] max-w-[140px] truncate">
                  {user.fullName || user.username}
                </div>
                <div className="text-[10px] font-medium text-[#245C3A] uppercase tracking-wider">
                  {user.roles.join(', ')}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#8A958C]" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-60 rounded-lg border border-[#E1E7DD] bg-white py-1.5 shadow-lg z-50"
              >
                <div className="border-b border-[#E1E7DD] px-3.5 py-2.5">
                  <div className="text-xs font-semibold text-[#24352A] truncate">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-[#66756A] truncate">{user.email}</div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    <Shield className="h-3 w-3 text-[#C39A45]" />
                    {user.roles.map(role => (
                      <span
                        key={role}
                        className="rounded border border-[#E1E7DD] bg-[#EAF1E8] px-1.5 py-0.5 text-[10px] font-semibold text-[#17452C]"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#C74440] hover:bg-[#C74440]/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
