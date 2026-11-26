import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { I18nProvider } from '../i18n/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';

const salesmanAuth: AuthContextType = {
  user: {
    id: 'u-sales',
    email: 'sales@foodfactory.com',
    username: 'sales',
    fullName: 'Sales User',
    isActive: true,
    roles: ['SALESMAN'],
    permissions: ['sales.dashboard.read', 'sales.orders.read'],
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: (r) => r === 'SALESMAN',
  hasPermission: (p) => ['sales.dashboard.read', 'sales.orders.read'].includes(p),
};

describe('UI Simplification & Spacious Enterprise Redesign', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('1. Sidebar renders collapsible groups, auto-expands active group, and respects role permissions', () => {
    render(
      <AuthContext.Provider value={salesmanAuth}>
        <I18nProvider>
          <MemoryRouter initialEntries={['/sales/orders']}>
            <Sidebar isOpen={true} onClose={vi.fn()} />
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>,
    );

    // Sales & Orders group is active and auto-expanded
    expect(screen.getByText('Sales Orders')).toBeTruthy();
    // Unauthorized Administration group is hidden for SALESMAN
    expect(screen.queryByText('Administration')).toBeNull();

    // Collapse Sales & Orders group
    const groupBtn = screen.getByRole('button', { name: /Sales & Orders/i });
    fireEvent.click(groupBtn);
    expect(screen.queryByText('Sales Orders')).toBeNull();

    // Re-expand Sales & Orders group
    fireEvent.click(groupBtn);
    expect(screen.getByText('Sales Orders')).toBeTruthy();
  });

  it('2. Navbar keeps header minimal and places Shortcuts/Tour inside user profile menu', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={salesmanAuth}>
          <ThemeProvider>
            <I18nProvider>
              <MemoryRouter initialEntries={['/sales/orders']}>
                <Navbar
                  onToggleSidebar={vi.fn()}
                  onOpenCommandCenter={vi.fn()}
                  onOpenShortcuts={vi.fn()}
                  onStartTour={vi.fn()}
                />
              </MemoryRouter>
            </I18nProvider>
          </ThemeProvider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    // Command center is visible in header
    expect(screen.getByLabelText('Open Command Center')).toBeTruthy();
    // Shortcuts menuitem is inside profile dropdown, not cluttering top bar
    expect(screen.queryByRole('menuitem', { name: /Keyboard Shortcuts/i })).toBeNull();

    fireEvent.click(screen.getByText('Sales User'));
    expect(screen.getByRole('menuitem', { name: /Keyboard Shortcuts/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Restart Product Tour/i })).toBeTruthy();
  });

  it('3. Sidebar keeps header/footer fixed and scrolls only its navigation list independently', () => {
    render(
      <AuthContext.Provider value={salesmanAuth}>
        <I18nProvider>
          <MemoryRouter initialEntries={['/sales/orders']}>
            <Sidebar isOpen={false} onToggleCollapse={vi.fn()} onClose={vi.fn()} />
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>,
    );

    const aside = document.querySelector('aside[data-tour="sidebar"]')!;
    expect(aside.className).toContain('h-full');
    expect(aside.className).toContain('min-h-0');
    expect(aside.className).toContain('overflow-hidden');

    const navScroll = aside.querySelector('.ff-sidebar-scroll')!;
    expect(navScroll.className).toContain('flex-1');
    expect(navScroll.className).toContain('min-h-0');
    expect(navScroll.className).toContain('overflow-y-auto');
    expect(navScroll.className).toContain('overflow-x-hidden');
  });
});
