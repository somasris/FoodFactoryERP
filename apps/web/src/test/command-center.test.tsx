import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CommandCenterModal } from '../components/command-center/CommandCenterModal';
import { searchService } from '../services/search.service';
import { SHORTCUT_DEFINITIONS } from '../config/shortcuts';
import { ROUTES } from '../config/routes';

describe('Sprint 1: Command Center Frontend', () => {
  const user = {
    id: 'cmd-user-1',
    email: 'cmd@foodfactory.local',
    username: 'cmduser',
    fullName: 'Command User',
    isActive: true,
    roles: ['ADMIN'],
    permissions: [
      'sales.orders.read',
      'sales.orders.create',
      'production.batches.read',
      'inventory.read',
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders search results, supports keyboard navigation, and closes on Escape', async () => {
    vi.spyOn(searchService, 'search').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        query: 'PB-2026',
        total: 1,
        results: [
          {
            category: 'Production',
            entityType: 'PRODUCTION_BATCH',
            entityId: 'batch-1',
            title: 'PB-2026-001',
            subtitle: 'Mango Pulp 500ml',
            documentNumber: 'PB-2026-001',
            status: 'IN_PROGRESS',
            navigationPath: '/production/batches/batch-1',
          },
        ],
      },
    });

    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: r => r === 'ADMIN',
            hasPermission: p => user.permissions.includes(p),
          }}
        >
          <CommandCenterModal isOpen={true} onClose={onClose} />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const input = screen.getByLabelText('Command Center search');
    fireEvent.change(input, { target: { value: 'PB-2026' } });

    await waitFor(() => {
      expect(screen.getByText('Mango Pulp 500ml')).toBeTruthy();
    });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates Open Inventory to /inventory/dashboard and View Expiring Stock to /inventory/batches', async () => {
    const onClose = vi.fn();

    render(
      <MemoryRouter initialEntries={['/reports/executive']}>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: r => r === 'ADMIN',
            hasPermission: p => user.permissions.includes(p),
          }}
        >
          <CommandCenterModal isOpen={true} onClose={onClose} />
          <Routes>
            <Route path="/reports/executive" element={<div>Exec Home</div>} />
            <Route path={ROUTES.INVENTORY_DASHBOARD} element={<div>Inventory Dashboard Target</div>} />
            <Route path={ROUTES.INVENTORY_BATCH_EXPIRY} element={<div>Batch Expiry Target</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Open Inventory'));
    expect(await screen.findByText('Inventory Dashboard Target')).toBeTruthy();

    fireEvent.click(screen.getByText('View Expiring Stock'));
    expect(await screen.findByText('Batch Expiry Target')).toBeTruthy();
  });

  it('hides Open Inventory and View Expiring Stock when user lacks inventory.read', () => {
    const salesman = {
      ...user,
      roles: ['SALESMAN'],
      permissions: ['sales.orders.read', 'sales.orders.create'],
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: salesman,
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: r => r === 'SALESMAN',
            hasPermission: p => salesman.permissions.includes(p),
          }}
        >
          <CommandCenterModal isOpen={true} onClose={vi.fn()} />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Open Inventory')).toBeNull();
    expect(screen.queryByText('View Expiring Stock')).toBeNull();
    expect(SHORTCUT_DEFINITIONS.find(s => s.id === 'act:open-inventory')?.path).toBe(
      '/inventory/dashboard',
    );
    expect(SHORTCUT_DEFINITIONS.find(s => s.id === 'act:expiring-stock')?.path).toBe(
      '/inventory/batches',
    );
  });
});
