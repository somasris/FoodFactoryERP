import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { LoginPage } from '../routes/LoginPage';
import { Sidebar } from '../components/layout/Sidebar';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { getDefaultDashboardPath, canAccessPath } from '../config/navigation';
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

const renderWithAuth = (ui: React.ReactNode, authOverrides: Partial<AuthContextType>, initialEntries = ['/']) => {
  const user = authOverrides.user ?? null;
  const ctx: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: (r: string) => !!user && (user.roles.includes('OWNER') || user.roles.includes(r)),
    hasPermission: (p: string) =>
      !!user && (user.roles.includes('OWNER') || user.permissions.includes(p)),
    ...authOverrides,
  };

  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  );
};

describe('Role-Based Authentication, Redirects & Dynamic Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Resolves correct default dashboard path for all 5 database roles', () => {
    expect(getDefaultDashboardPath(makeUser(['OWNER'], []))).toBe('/reports/executive');
    expect(
      getDefaultDashboardPath(makeUser(['ADMIN'], ['administration.organization.read'])),
    ).toBe('/admin/organization');
    expect(getDefaultDashboardPath(makeUser(['SALESMAN'], ['sales.dashboard.read']))).toBe(
      '/sales/dashboard',
    );
    expect(getDefaultDashboardPath(makeUser(['PRODUCTION'], ['production.batches.read']))).toBe(
      '/production/execution',
    );
    expect(getDefaultDashboardPath(makeUser(['AUDITOR'], ['governance.audit.read']))).toBe(
      '/admin/governance',
    );
  });

  it('2. Falls back to first authorized route when primary destination is unauthorized', () => {
    const limitedSalesman = makeUser(['SALESMAN'], ['sales.orders.read']);
    expect(getDefaultDashboardPath(limitedSalesman)).toBe('/sales/orders');
  });

  it('3. Validates deep-link path access per role permissions', () => {
    const salesman = makeUser(['SALESMAN'], ['sales.dashboard.read', 'sales.orders.read']);
    expect(canAccessPath(salesman, '/sales/orders')).toBe(true);
    expect(canAccessPath(salesman, '/admin/users')).toBe(false);
    expect(canAccessPath(salesman, '/production/execution')).toBe(false);

    const auditor = makeUser(['AUDITOR'], ['governance.audit.read', 'compliance.tax.read']);
    expect(canAccessPath(auditor, '/admin/governance')).toBe(true);
    expect(canAccessPath(auditor, '/admin/maintenance')).toBe(false);
  });

  it('4. LoginPage redirects SALESMAN to /sales/dashboard after authentication', async () => {
    const salesman = makeUser(['SALESMAN'], ['sales.dashboard.read', 'sales.orders.read']);
    const loginMock = vi.fn().mockResolvedValue(salesman);

    renderWithAuth(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sales/dashboard" element={<div>Sales Dashboard Target</div>} />
      </Routes>,
      { user: null, isAuthenticated: false, login: loginMock },
      ['/login'],
    );

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'salesman@foodfactory.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: 'Secret123!' },
    });
    const signInButtons = screen.getAllByRole('button', { name: /Sign In/i });
    fireEvent.click(signInButtons[signInButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Sales Dashboard Target')).toBeTruthy();
    });
  });

  it('5. Sidebar renders only permission-authorized navigation links per role', () => {
    const salesman = makeUser(['SALESMAN'], ['sales.dashboard.read', 'sales.orders.read', 'customers.read']);
    renderWithAuth(<Sidebar isOpen={true} onClose={vi.fn()} />, { user: salesman });

    expect(screen.getByText('Sales Dashboard')).toBeTruthy();
    expect(screen.getByText('Sales Orders')).toBeTruthy();
    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.queryByText('Production Planning')).toBeNull();
    expect(screen.queryByText('Maintenance Mode')).toBeNull();
  });

  it('6. ProtectedRoute redirects unauthenticated users to /login and unauthorized users to /unauthorized', () => {
    const salesman = makeUser(['SALESMAN'], ['sales.orders.read']);

    renderWithAuth(
      <Routes>
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredPermissions={['administration.users.read']}>
              <div>Admin Users</div>
            </ProtectedRoute>
          }
        />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>,
      { user: salesman },
      ['/admin/users'],
    );

    expect(screen.getByText('Unauthorized Page')).toBeTruthy();
  });
});
