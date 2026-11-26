import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { OfflineDataBanner } from '../common/OfflineDataBanner';
import { CommandCenterModal } from '../command-center/CommandCenterModal';
import { KeyboardShortcutsModal } from '../ux/KeyboardShortcutsModal';
import { ProductTourModal } from '../ux/ProductTourModal';
import { SessionTimeoutManager } from '../auth/SessionTimeoutManager';
import { useOffline } from '../../context/OfflineContext';
import { useAuth } from '../../hooks/useAuth';
import { isEditableTarget, SHORTCUT_DEFINITIONS } from '../../config/shortcuts';
import { uxService } from '../../services/ux.service';

export const AppShell: React.FC = () => {
  const { swUpdateAvailable, applySwUpdate, storageQuotaError, counts } = useOffline();
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const chordPrefixRef = useRef<{ key: string; timestamp: number } | null>(null);

  const { data: prefs } = useQuery({
    queryKey: ['ux', 'preferences'],
    queryFn: () => uxService.getPreferences(),
    enabled: Boolean(user),
    staleTime: 60_000,
    retry: false,
  });

  const completeTourMutation = useMutation({
    mutationFn: () => uxService.updateTourPreference(true),
    onSuccess: updated => {
      queryClient.setQueryData(['ux', 'preferences'], updated);
    },
  });

  useEffect(() => {
    if (!user || !prefs) return;
    const seenLocalKey = `ff_tour_seen_${user.id}`;
    const seenLocally = window.localStorage.getItem(seenLocalKey) === 'true';
    if (!prefs.tourCompleted && !seenLocally) {
      setTourOpen(true);
    }
  }, [user, prefs]);

  const handleFinishTour = () => {
    setTourOpen(false);
    if (user) {
      try {
        window.localStorage.setItem(`ff_tour_seen_${user.id}`, 'true');
      } catch {
        // Ignore storage errors
      }
      completeTourMutation.mutate();
    }
  };

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
        return;
      }

      if (isEditableTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
        return;
      }

      const keyLower = e.key.toLowerCase();
      const now = Date.now();
      const pending = chordPrefixRef.current;

      if (pending && now - pending.timestamp < 1000) {
        const chord = `${pending.key} ${keyLower}`;
        chordPrefixRef.current = null;
        const match = SHORTCUT_DEFINITIONS.find(
          s =>
            s.path &&
            s.keys.includes(chord) &&
            (!s.requiredPermissions?.length || s.requiredPermissions.every(p => hasPermission(p))),
        );
        if (match?.path) {
          e.preventDefault();
          navigate(match.path);
          return;
        }
      }

      if (keyLower === 'g' || keyLower === 'c') {
        chordPrefixRef.current = { key: keyLower, timestamp: now };
      } else {
        chordPrefixRef.current = null;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [hasPermission, navigate]);

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
    <div className="flex h-screen supports-[height:100dvh]:h-dvh flex-col overflow-hidden bg-brand-bg font-sans text-brand-text">
      <div className="shrink-0">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onOpenCommandCenter={() => {
            lastFocusedRef.current = document.activeElement as HTMLElement | null;
            setCommandOpen(true);
          }}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onStartTour={() => setTourOpen(true)}
        />
      </div>
      <CommandCenterModal isOpen={commandOpen} onClose={handleCloseCommand} />
      <SessionTimeoutManager />
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ProductTourModal
        isOpen={tourOpen}
        onComplete={handleFinishTour}
        onSkip={handleFinishTour}
        onEnsureSidebarOpen={setSidebarOpen}
      />
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
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onClose={() => setSidebarOpen(false)}
        />
        <main
          className={`flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col justify-between ${
            sidebarOpen ? 'overflow-hidden md:overflow-y-auto' : 'overflow-y-auto'
          }`}
        >
          <div className="w-full px-4 py-5 sm:px-6 md:px-9 md:py-7">
            <div className="mx-auto max-w-[1440px] space-y-6">
              <OfflineDataBanner pendingCount={counts.pending} />
              <Outlet />
            </div>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
};
