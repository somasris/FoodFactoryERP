import React, { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { OfflineDataBanner } from '../common/OfflineDataBanner';
import { CommandCenterModal } from '../command-center/CommandCenterModal';
import { useOffline } from '../../context/OfflineContext';

export const AppShell: React.FC = () => {
  const { swUpdateAvailable, applySwUpdate, storageQuotaError, counts } = useOffline();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(prev => {
          if (!prev) {
            lastFocusedRef.current = document.activeElement as HTMLElement | null;
          }
          return !prev;
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleCloseCommand = () => {
    setCommandOpen(false);
    lastFocusedRef.current?.focus?.();
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('ff_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem('ff_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg font-sans text-brand-text">
      <Navbar
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onOpenCommandCenter={() => {
          lastFocusedRef.current = document.activeElement as HTMLElement | null;
          setCommandOpen(true);
        }}
      />
      <CommandCenterModal isOpen={commandOpen} onClose={handleCloseCommand} />
      {swUpdateAvailable && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-[#245C3A]/20 bg-[#EAF1E8] px-4 py-2 text-xs text-[#17452C] md:px-6"
        >
          <span className="font-medium">
            A new version of FoodFactory ERP is ready. Update now to ensure compatibility.
          </span>
          <button
            type="button"
            onClick={() => void applySwUpdate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#245C3A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#17452C] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Update Now</span>
          </button>
        </div>
      )}
      {storageQuotaError && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-[#C74440]/20 bg-[#C74440]/10 px-4 py-2 text-xs text-[#C74440] md:px-6"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Offline storage warning: {storageQuotaError}</span>
        </div>
      )}
      <div className="flex flex-1 min-w-0">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">
          <div className="mx-auto max-w-[1440px]">
            <OfflineDataBanner pendingCount={counts.pending} className="mb-4" />
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};
