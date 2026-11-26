import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CommandCenterModal } from '../components/command-center/CommandCenterModal';
import { searchService } from '../services/search.service';

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
});
