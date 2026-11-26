import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { authService } from '../../services/auth.service';
import {
  broadcastSessionEvent,
  subscribeSessionEvents,
} from '../../services/session-sync';
import { Button } from '../common/Button';

const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_WARNING_MS = 2 * 60_000;
const ACTIVITY_THROTTLE_MS = 1000;

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SessionTimeoutManager: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [warningOpen, setWarningOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(DEFAULT_WARNING_MS);
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const timeoutMsRef = useRef(DEFAULT_TIMEOUT_MS);
  const warningMsRef = useRef(DEFAULT_WARNING_MS);
  const lastActivityRef = useRef(Date.now());
  const serverExpiryRef = useRef<number>(Date.now() + DEFAULT_TIMEOUT_MS);
  const warningOpenRef = useRef(false);
  const terminatingRef = useRef(false);

  warningOpenRef.current = warningOpen;

  const terminateSession = useCallback(
    async (expired: boolean) => {
      if (terminatingRef.current) return;
      terminatingRef.current = true;
      setWarningOpen(false);

      if (expired) {
        try {
          window.sessionStorage.setItem('ff_session_expired', '1');
        } catch {
          // Ignore storage error
        }
        broadcastSessionEvent({ type: 'SESSION_EXPIRED' });
      }

      await queryClient.cancelQueries().catch(() => undefined);
      queryClient.clear();
      await logout().catch(() => undefined);
      navigate('/login', { replace: true });
    },
    [logout, navigate, queryClient],
  );

  const syncFromServer = useCallback(async () => {
    if (!isAuthenticated || terminatingRef.current) return;
    try {
      const status = await authService.getSessionStatus();
      timeoutMsRef.current = status.timeoutMinutes * 60_000;
      warningMsRef.current = status.warningMinutes * 60_000;
      const serverNow = new Date(status.serverTime).getTime();
      const serverExp = new Date(status.inactivityExpiresAt).getTime();
      const serverRemaining = serverExp - serverNow;
      serverExpiryRef.current = Date.now() + serverRemaining;

      if (serverRemaining <= 0) {
        await terminateSession(true);
      }
    } catch {
      // If 401/session invalid, apiClient handles auth failure cleanly
    }
  }, [isAuthenticated, terminateSession]);

  // Initial server policy sync
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    terminatingRef.current = false;
    lastActivityRef.current = Date.now();
    void syncFromServer();
  }, [isAuthenticated, user, syncFromServer]);

  // Cross-tab synchronization
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeSessionEvents(event => {
      if (event.type === 'SESSION_EXTENDED') {
        timeoutMsRef.current = event.timeoutMinutes * 60_000;
        warningMsRef.current = event.warningMinutes * 60_000;
        lastActivityRef.current = Date.now();
        serverExpiryRef.current = new Date(event.inactivityExpiresAt).getTime();
        setExtendError(null);
        setWarningOpen(false);
      } else if (event.type === 'SESSION_EXPIRED') {
        void terminateSession(true);
      }
    });
  }, [isAuthenticated, terminateSession]);

  // Centralized throttled activity listeners (disabled while warning dialog is open)
  useEffect(() => {
    if (!isAuthenticated) return;
    let lastHandled = 0;

    const handleActivity = () => {
      if (warningOpenRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastHandled < ACTIVITY_THROTTLE_MS) return;
      lastHandled = now;
      lastActivityRef.current = now;
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    events.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }));

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncFromServer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, syncFromServer]);

  // Single centralized countdown & expiry check interval
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      const idleMs = now - lastActivityRef.current;
      const timeoutMs = timeoutMsRef.current;
      const warningMs = warningMsRef.current;
      const msUntilExpiry = timeoutMs - idleMs;

      if (msUntilExpiry <= 0) {
        void terminateSession(true);
        return;
      }

      if (msUntilExpiry <= warningMs) {
        if (!warningOpenRef.current) {
          setWarningOpen(true);
        }
        setRemainingMs(msUntilExpiry);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, terminateSession]);

  const handleContinue = async () => {
    if (extending) return;
    setExtending(true);
    setExtendError(null);
    try {
      const res = await authService.extendSession();
      timeoutMsRef.current = res.timeoutMinutes * 60_000;
      warningMsRef.current = res.warningMinutes * 60_000;
      lastActivityRef.current = Date.now();
      serverExpiryRef.current = new Date(res.inactivityExpiresAt).getTime();
      setWarningOpen(false);
      broadcastSessionEvent({
        type: 'SESSION_EXTENDED',
        inactivityExpiresAt: res.inactivityExpiresAt,
        absoluteExpiresAt: res.absoluteExpiresAt,
        timeoutMinutes: res.timeoutMinutes,
        warningMinutes: res.warningMinutes,
      });
    } catch {
      setExtendError(
        t('session.extendFailed', 'Unable to extend session. Please sign in again.'),
      );
      await terminateSession(true);
    } finally {
      setExtending(false);
    }
  };

  if (!isAuthenticated || !warningOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-desc"
    >
      <div className="w-full max-w-md rounded-xl border border-[#E1E7DD] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="session-warning-title"
              className="text-base font-semibold text-[#17452C]"
            >
              {t('session.warningTitle', 'Your session is about to expire')}
            </h2>
            <p
              id="session-warning-desc"
              className="mt-1 text-sm leading-relaxed text-[#66756A]"
            >
              {t(
                'session.warningBody',
                'You have been inactive for some time. For your security, you will be automatically signed out soon.',
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] px-4 py-3 text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-[#66756A]">
            {t('session.expiresIn', 'Session expires in')}
          </span>
          <div
            aria-live="polite"
            className="mt-1 font-mono text-2xl font-bold text-[#17452C] tabular-nums"
          >
            {formatCountdown(remainingMs)}
          </div>
        </div>

        {extendError && (
          <p role="alert" className="mt-3 text-xs font-medium text-[#C74440]">
            {extendError}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void terminateSession(false)}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            {t('session.logoutNow', 'Logout Now')}
          </Button>
          <Button
            type="button"
            disabled={extending}
            onClick={() => void handleContinue()}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${extending ? 'animate-spin' : ''}`} />
            {extending
              ? t('session.extending', 'Extending...')
              : t('session.continueSession', 'Continue Session')}
          </Button>
        </div>
      </div>
    </div>
  );
};
