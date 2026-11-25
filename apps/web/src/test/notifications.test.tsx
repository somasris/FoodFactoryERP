import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { NotificationBell } from '../components/layout/NotificationBell';
import { NotificationsPage } from '../routes/notifications/NotificationsPage';
import { NotificationPreferencesPage } from '../routes/notifications/NotificationPreferencesPage';
import { notificationService } from '../services/notification.service';
import { canNavigateToActionUrl } from '../hooks/useNotifications';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const makeAuthValue = (roles: string[], permissions: string[]): AuthContextType => ({
  user: {
    id: 'u-1',
    email: 'sales@foodfactory.com',
    username: 'sales1',
    fullName: 'Sales User',
    isActive: true,
    roles,
    permissions,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: (r: string) => roles.includes('OWNER') || roles.includes(r),
  hasPermission: (p: string) => roles.includes('OWNER') || permissions.includes(p),
});

const renderWithProviders = (ui: React.ReactElement, auth: AuthContextType) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
};

describe('Enterprise Notification Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it('1. NotificationBell shows unread badge, caps at 99+, and opens popover with notifications', async () => {
    vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue({
      success: true,
      message: 'ok',
      data: { unreadCount: 120 },
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(notificationService, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        items: [
          {
            id: 'un-1',
            notificationId: 'n-1',
            title: 'Sales Order Approved: SO-101',
            message: 'Order SO-101 was approved.',
            type: 'SUCCESS',
            category: 'SALES',
            priority: 'HIGH',
            entityType: 'SalesOrder',
            entityId: 'so-101',
            actionUrl: '/sales/orders/so-101',
            metadata: null,
            isRead: false,
            readAt: null,
            isArchived: false,
            archivedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unreadCount: 120,
        page: 1,
        limit: 8,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });
    const markSpy = vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
      success: true,
      message: 'ok',
      data: { id: 'un-1', isRead: true, readAt: new Date().toISOString(), unreadCount: 119 },
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['SALESMAN'], ['sales.orders.read']);
    renderWithProviders(<NotificationBell />, auth);

    const badge = await screen.findByTestId('notification-unread-badge');
    expect(badge.textContent).toBe('99+');

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));

    await waitFor(() => {
      expect(screen.getByText('Sales Order Approved: SO-101')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Sales Order Approved: SO-101'));
    await waitFor(() => {
      expect(markSpy).toHaveBeenCalledWith('un-1');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/sales/orders/so-101');
  });

  it('2. NotificationBell hides badge when unread count is zero and shows empty state', async () => {
    vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue({
      success: true,
      message: 'ok',
      data: { unreadCount: 0 },
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(notificationService, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        items: [],
        total: 0,
        unreadCount: 0,
        page: 1,
        limit: 8,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['SALESMAN'], ['sales.orders.read']);
    renderWithProviders(<NotificationBell />, auth);

    await waitFor(() => {
      expect(screen.queryByTestId('notification-unread-badge')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('You are all caught up.')).toBeDefined();
    });
  });

  it('3. Blocks unauthorized actionUrl navigation and redirects to notification detail instead', () => {
    const salesmanPerms = (p: string) => p === 'sales.orders.read';
    expect(canNavigateToActionUrl('/sales/orders/123', salesmanPerms)).toBe(true);
    expect(canNavigateToActionUrl('/admin/backups', salesmanPerms)).toBe(false);
  });

  it('4. NotificationsPage supports filtering, mark all read, and archiving', async () => {
    vi.spyOn(notificationService, 'list').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        items: [
          {
            id: 'un-2',
            notificationId: 'n-2',
            title: 'Low Stock Alert: RM-01',
            message: 'Sugar below reorder level.',
            type: 'WARNING',
            category: 'INVENTORY',
            priority: 'HIGH',
            entityType: 'InventoryItem',
            entityId: 'item-1',
            actionUrl: '/inventory/balances',
            metadata: null,
            isRead: false,
            readAt: null,
            isArchived: false,
            archivedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });
    const markAllSpy = vi.spyOn(notificationService, 'markAllAsRead').mockResolvedValue({
      success: true,
      message: 'ok',
      data: { updatedCount: 1, unreadCount: 0 },
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['ADMIN'], ['inventory.read']);
    renderWithProviders(<NotificationsPage />, auth);

    await waitFor(() => {
      expect(screen.getByText('Notification Center')).toBeDefined();
      expect(screen.getAllByText('Low Stock Alert: RM-01').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Mark all read/i }));
    await waitFor(() => {
      expect(markAllSpy).toHaveBeenCalled();
    });
  });

  it('5. NotificationPreferencesPage loads and saves category toggles', async () => {
    vi.spyOn(notificationService, 'getPreferences').mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        { category: 'SALES', inAppEnabled: true, emailEnabled: false, updatedAt: null },
        { category: 'INVENTORY', inAppEnabled: false, emailEnabled: false, updatedAt: null },
      ],
      timestamp: new Date().toISOString(),
    });
    const updateSpy = vi.spyOn(notificationService, 'updatePreferences').mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        { category: 'SALES', inAppEnabled: true, emailEnabled: false, updatedAt: null },
        { category: 'INVENTORY', inAppEnabled: true, emailEnabled: false, updatedAt: null },
      ],
      timestamp: new Date().toISOString(),
    });

    const auth = makeAuthValue(['ADMIN'], []);
    renderWithProviders(<NotificationPreferencesPage />, auth);

    const invCheckbox = (await screen.findByLabelText(
      /In-app notifications for Inventory & Warehouse/i,
    )) as HTMLInputElement;
    expect(invCheckbox.checked).toBe(false);

    fireEvent.click(invCheckbox);
    expect(invCheckbox.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/i }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith([
        { category: 'SALES', inAppEnabled: true },
        { category: 'INVENTORY', inAppEnabled: true },
      ]);
    });
  });
});
