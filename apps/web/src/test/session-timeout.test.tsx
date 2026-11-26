import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { I18nProvider } from '../i18n/I18nContext';
import { SessionTimeoutManager } from '../components/auth/SessionTimeoutManager';
import { authService } from '../services/auth.service';

const mockLogout = vi.fn().mockResolvedValue(undefined);

const authStub: AuthContextType = {
  user: {
    id: 'u-1',
    email: 'prod@foodfactory.com',
    username: 'prod',
    fullName: 'Prod User',
    isActive: true,
    roles: ['PRODUCTION'],
    permissions: ['production.batches.read'],
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: mockLogout,
  hasRole: () => true,
  hasPermission: () => true,
};

function renderManager() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authStub}>
        <I18nProvider>
          <MemoryRouter initialEntries={['/production']}>
            <Routes>
              <Route path="/production" element={<SessionTimeoutManager />} />
              <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Session Timeout & Inactivity Warning Frontend Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    const now = Date.now();
    vi.spyOn(authService, 'getSessionStatus').mockResolvedValue({
      sessionId: 'sess-1',
      lastActivityAt: new Date(now).toISOString(),
      inactivityExpiresAt: new Date(now + 15 * 60_000).toISOString(),
      absoluteExpiresAt: new Date(now + 12 * 3_600_000).toISOString(),
      timeoutMinutes: 15,
      warningMinutes: 2,
      serverTime: new Date(now).toISOString(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Shows warning dialog at 13m, resets on activity before warning, and extends only on backend confirmation', async () => {
    const extendSpy = vi.spyOn(authService, 'extendSession').mockImplementation(async () => {
      const now = Date.now();
      return {
        sessionId: 'sess-1',
        lastActivityAt: new Date(now).toISOString(),
        inactivityExpiresAt: new Date(now + 15 * 60_000).toISOString(),
        absoluteExpiresAt: new Date(now + 12 * 3_600_000).toISOString(),
        timeoutMinutes: 15,
        warningMinutes: 2,
        serverTime: new Date(now).toISOString(),
        accessToken: 'fresh-token',
      };
    });

    renderManager();

    // Flush initial getSessionStatus promise
    await act(async () => {
      await Promise.resolve();
    });

    // Advance 10 minutes -> user moves mouse -> resets inactivity timer
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await act(async () => {
      fireEvent.mouseMove(window);
    });

    // Advance 12 minutes -> still under 13m since last activity
    await act(async () => {
      vi.advanceTimersByTime(12 * 60_000);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    // Advance 1m5s more -> hits warning window (13m05s)
    await act(async () => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Your session is about to expire')).toBeTruthy();

    // Mouse movement while warning is open must NOT dismiss warning
    await act(async () => {
      fireEvent.mouseMove(window);
    });
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    // Click Continue Session -> calls backend and closes dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue Session/i }));
      await Promise.resolve();
    });
    expect(extendSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('2. Automatically terminates session and redirects to /login when inactivity countdown expires', async () => {
    renderManager();

    await act(async () => {
      await Promise.resolve();
    });

    // Advance full 15 minutes without activity
    await act(async () => {
      vi.advanceTimersByTime(15 * 60_000 + 1000);
      await Promise.resolve();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('ff_session_expired')).toBe('1');
    expect(screen.getByText('Login Page')).toBeTruthy();
  });
});
