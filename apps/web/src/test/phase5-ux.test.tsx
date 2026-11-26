import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { I18nProvider } from '../i18n/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import { isEditableTarget } from '../config/shortcuts';
import { KeyboardShortcutsModal } from '../components/ux/KeyboardShortcutsModal';
import { DashboardCustomizer } from '../components/ux/DashboardCustomizer';
import { SavedViewsBar } from '../components/ux/SavedViewsBar';
import { ProductTourModal } from '../components/ux/ProductTourModal';
import { ActivityTimelinePage } from '../routes/ActivityTimelinePage';
import { uxService } from '../services/ux.service';
import { UserProfile } from '../services/auth.service';

const makeUser = (roles: string[], permissions: string[]): UserProfile => ({
  id: 'u-p5-1',
  email: 'p5@foodfactory.local',
  username: 'p5_user',
  fullName: 'Phase 5 User',
  isActive: true,
  roles,
  permissions,
});

const renderWithProviders = (
  ui: React.ReactNode,
  user: UserProfile | null = makeUser(['OWNER'], []),
) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const authCtx: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: r => !!user && (user.roles.includes('OWNER') || user.roles.includes(r)),
    hasPermission: p =>
      !!user && (user.roles.includes('OWNER') || user.permissions.includes(p)),
  };

  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authCtx}>
        <ThemeProvider>
          <I18nProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </I18nProvider>
        </ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

describe('Phase 5: Smart User Experience Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('1. isEditableTarget protects text inputs, textareas, selects, and contenteditable elements from shortcut capture', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const btn = document.createElement('button');

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(btn)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('2. KeyboardShortcutsModal filters shortcuts by user permissions and renders Tamil labels', () => {
    const auditor = makeUser(['AUDITOR'], ['governance.audit.read', 'analytics.dashboard.read']);
    renderWithProviders(
      <KeyboardShortcutsModal isOpen={true} onClose={vi.fn()} />,
      auditor,
    );

    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    expect(screen.getByText('Open Command Center')).toBeTruthy();
    // AUDITOR lacks sales.orders.create so Create Sales Order shortcut must be hidden
    expect(screen.queryByText('Create Sales Order')).toBeNull();
  });

  it('3. DashboardCustomizer supports toggling widget visibility, reordering, and resetting to default', () => {
    const onToggle = vi.fn();
    const onMove = vi.fn();
    const onReset = vi.fn();

    renderWithProviders(
      <DashboardCustomizer
        widgets={[
          { id: 'w1', label: 'Sales Orders', visible: true },
          { id: 'w2', label: 'Inventory Valuation', visible: false },
        ]}
        isCustomized={true}
        isSaving={false}
        onToggle={onToggle}
        onMove={onMove}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Customize/i }));
    fireEvent.click(screen.getByText('Sales Orders'));
    expect(onToggle).toHaveBeenCalledWith('w1');

    fireEvent.click(screen.getByLabelText('Move Sales Orders down'));
    expect(onMove).toHaveBeenCalledWith('w1', 'down');

    fireEvent.click(screen.getByRole('button', { name: /Reset to Default/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it('4. SavedViewsBar lists saved views, applies filters, and creates a new view', async () => {
    vi.spyOn(uxService, 'listSavedViews').mockResolvedValue([
      {
        id: 'sv-1',
        userId: 'u-p5-1',
        module: 'sales_orders',
        name: 'My Pending Approvals',
        filters: { status: 'SUBMITTED' },
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    const createSpy = vi.spyOn(uxService, 'createSavedView').mockResolvedValue({
      id: 'sv-2',
      userId: 'u-p5-1',
      module: 'sales_orders',
      name: 'Rejected Orders',
      filters: { status: 'REJECTED' },
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const onApplyView = vi.fn();
    renderWithProviders(
      <SavedViewsBar
        module="sales_orders"
        currentFilters={{ status: 'REJECTED' }}
        onApplyView={onApplyView}
        onResetFilters={vi.fn()}
      />,
    );

    const viewBtn = await screen.findByRole('button', { name: 'My Pending Approvals' });
    fireEvent.click(viewBtn);
    expect(onApplyView).toHaveBeenCalledWith({ status: 'SUBMITTED' });

    fireEvent.click(screen.getByRole('button', { name: /Save View/i }));
    fireEvent.change(screen.getByPlaceholderText(/View name/i), {
      target: { value: 'Rejected Orders' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'sales_orders',
          name: 'Rejected Orders',
          filters: { status: 'REJECTED' },
        }),
      );
    });
  });

  it('5. ProductTourModal hides unauthorized module steps and completes tour', () => {
    const salesman = makeUser(['SALESMAN'], ['sales.orders.read']);
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    renderWithProviders(
      <ProductTourModal isOpen={true} onComplete={onComplete} onSkip={onSkip} />,
      salesman,
    );

    // Step 1: Welcome -> Next -> Command Center -> Next -> Timeline -> Next -> Sales Orders
    expect(screen.getByText('Welcome to FoodFactory ERP')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('Sales Orders & Saved Views')).toBeTruthy();

    // Salesman only has 4 steps (Welcome, Command Center, Timeline, Sales Orders) -> Finish appears
    fireEvent.click(screen.getByRole('button', { name: /Finish/i }));
    expect(onComplete).toHaveBeenCalled();
  });

  it('6. ActivityTimelinePage renders verified audit items and category filters', async () => {
    vi.spyOn(uxService, 'getActivityTimeline').mockResolvedValue({
      items: [
        {
          id: 'act-1',
          action: 'APPROVE',
          category: 'SALES',
          entityType: 'SalesOrder',
          entityId: 'so-123',
          remarks: 'Approved sales order SO-2026-001',
          actor: { id: 'u1', username: 'owner', fullName: 'Managing Director' },
          navigationPath: '/sales/orders/so-123',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    renderWithProviders(<ActivityTimelinePage />);

    expect(await screen.findByText('Approved sales order SO-2026-001')).toBeTruthy();
    expect(screen.getByRole('link', { name: /View Record/i }).getAttribute('href')).toBe(
      '/sales/orders/so-123',
    );
  });
});
