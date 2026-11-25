import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, RouteObject } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { router } from '../routes/router';
import { NAV_GROUPS, canAccessPath, getModuleIndexPath } from '../config/navigation';
import { UserProfile } from '../services/auth.service';

const makeUser = (roles: string[], permissions: string[]): UserProfile => ({
  id: `user-${roles[0] || 'none'}`,
  email: `${(roles[0] || 'user').toLowerCase()}@foodfactory.com`,
  username: (roles[0] || 'user').toLowerCase(),
  fullName: `Test ${roles[0] || 'User'}`,
  isActive: true,
  roles,
  permissions,
});

function collectPaths(routes: RouteObject[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const r of routes) {
    if (r.path === '*') continue;
    const next = r.path
      ? r.path.startsWith('/')
        ? r.path
        : `${prefix === '/' ? '' : prefix}/${r.path}`
      : prefix || '/';
    if (r.path) {
      paths.push(next);
    }
    if (r.children) {
      paths.push(...collectPaths(r.children, next));
    }
  }
  return paths;
}

function renderRouterAt(
  initialEntry: string,
  user: UserProfile | null,
  overrides: Partial<AuthContextType> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const memoryRouter = createMemoryRouter(router.routes, {
    initialEntries: [initialEntry],
  });
  const authCtx: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: (r: string) => !!user && (user.roles.includes('OWNER') || user.roles.includes(r)),
    hasPermission: (p: string) =>
      !!user && (user.roles.includes('OWNER') || user.permissions.includes(p)),
    ...overrides,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authCtx}>
        <RouterProvider router={memoryRouter} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Application-Wide Route & RBAC Coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Registers every navigation item path in router.tsx (no dead links)', () => {
    const registeredPaths = new Set(collectPaths(router.routes));
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(registeredPaths.has(item.path)).toBe(true);
      }
    }
  });

  it('2. Redirects unauthenticated users from protected routes to /login', async () => {
    renderRouterAt('/sales/orders', null);
    await waitFor(() => {
      expect(screen.getByLabelText(/Username or Email/i)).toBeTruthy();
    });
  });

  it('3. Blocks unauthorized role access on restricted routes and renders Access Restricted', async () => {
    const salesman = makeUser(['SALESMAN'], ['sales.dashboard.read', 'sales.orders.read', 'inventory.read']);

    const { unmount } = renderRouterAt('/inventory/valuation', salesman);
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeTruthy();
    });
    unmount();

    const { unmount: unmount2 } = renderRouterAt('/admin/users', salesman);
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeTruthy();
    });
    unmount2();

    renderRouterAt('/reports/compliance', salesman);
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeTruthy();
    });
  });

  it('4. Blocks AUDITOR from write/manage routes such as /admin/maintenance and /sales/orders/new', async () => {
    const auditor = makeUser(
      ['AUDITOR'],
      ['governance.audit.read', 'sales.orders.read', 'administration.organization.read'],
    );

    const { unmount } = renderRouterAt('/admin/maintenance', auditor);
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeTruthy();
    });
    unmount();

    renderRouterAt('/sales/orders/new', auditor);
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeTruthy();
    });
  });

  it('5. Resolves module index redirects according to user permissions', () => {
    const salesman = makeUser(['SALESMAN'], ['sales.dashboard.read', 'analytics.sales.read']);
    expect(getModuleIndexPath(salesman, '/reports')).toBe('/reports/bi');

    const auditor = makeUser(['AUDITOR'], ['analytics.dashboard.read', 'administration.organization.read']);
    expect(getModuleIndexPath(auditor, '/reports')).toBe('/reports/executive');
    expect(getModuleIndexPath(auditor, '/admin')).toBe('/admin/organization');
  });

  it('6. Validates granular deep-link path authorization via canAccessPath', () => {
    const production = makeUser(
      ['PRODUCTION'],
      ['production.batches.read', 'inventory.read', 'analytics.production.read'],
    );
    expect(canAccessPath(production, '/production/batches/batch-1')).toBe(true);
    expect(canAccessPath(production, '/inventory/valuation')).toBe(false);
    expect(canAccessPath(production, '/reports/executive')).toBe(false);
    expect(canAccessPath(production, '/reports/bi')).toBe(true);
  });

  it('7. Renders 404 NotFoundPage for unknown routes when authenticated', async () => {
    const owner = makeUser(['OWNER'], []);
    renderRouterAt('/unknown/non-existent-route', owner);
    await waitFor(() => {
      expect(screen.getByText('404 — Page Not Found')).toBeTruthy();
    });
  });
});
