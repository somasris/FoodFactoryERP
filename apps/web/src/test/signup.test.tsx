import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { LoginPage } from '../routes/LoginPage';
import { authService } from '../services/auth.service';

const makeUnauthenticatedAuth = (loginMock = vi.fn()): AuthContextType => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: loginMock,
  logout: vi.fn(),
  hasRole: () => false,
  hasPermission: () => false,
});

const renderLoginPage = (
  initialMode: 'signin' | 'signup' = 'signin',
  auth = makeUnauthenticatedAuth(),
) => {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <LoginPage initialMode={initialMode} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

describe('Public Sign Up UI Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renders Sign In and Sign Up tabs and switches between forms', () => {
    renderLoginPage('signin');

    expect(screen.getAllByRole('button', { name: 'Sign In' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeTruthy();
    expect(screen.getByLabelText('Username or Email')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(screen.getByLabelText(/^Full Name/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Email Address/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Confirm Password/i)).toBeTruthy();
  });

  it('2. Validates required fields and password mismatch on Sign Up without calling API', async () => {
    const registerSpy = vi.spyOn(authService, 'register');
    renderLoginPage('signup');

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), { target: { value: 'bad-email' } });
    fireEvent.click(screen.getByRole('radio', { name: /SALESMAN/i }));
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
      target: { value: 'DifferentPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText(/Full name must be at least 2 characters/i)).toBeTruthy();
      expect(screen.getByText(/Please enter a valid email address/i)).toBeTruthy();
      expect(screen.getByText(/Passwords do not match/i)).toBeTruthy();
    });
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('3. Submits valid registration and displays pending approval confirmation', async () => {
    const registerSpy = vi.spyOn(authService, 'register').mockResolvedValue({
      id: 'user-123',
      email: 'jane.doe@foodfactory.com',
      fullName: 'Jane Doe',
      isActive: false,
      registrationStatus: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
    });

    renderLoginPage('signup');

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), {
      target: { value: 'jane.doe@foodfactory.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Phone Number/i), {
      target: { value: '+91 9876543210' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /SALESMAN/i }));
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
      target: { value: 'StrongPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane.doe@foodfactory.com',
        password: 'StrongPass1!',
        phoneNumber: '+91 9876543210',
        requestedRole: 'SALESMAN',
      });
      expect(screen.getByText('Registration Submitted')).toBeTruthy();
      expect(screen.getByText(/pending administrator approval/i)).toBeTruthy();
    });
  });

  it('4. Displays server error notification on duplicate email or API failure', async () => {
    vi.spyOn(authService, 'register').mockRejectedValue(
      new Error('An account with this email address already exists'),
    );

    renderLoginPage('signup');

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), {
      target: { value: 'jane.doe@foodfactory.com' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /SALESMAN/i }));
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
      target: { value: 'StrongPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'An account with this email address already exists',
      );
    });
  });

  it('5. Toggles password visibility and preserves Sign In functionality', async () => {
    const loginMock = vi.fn().mockResolvedValue(undefined);
    renderLoginPage('signin', makeUnauthenticatedAuth(loginMock));

    const pwdInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(pwdInput.type).toBe('password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(pwdInput.type).toBe('text');

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'owner' } });
    fireEvent.change(pwdInput, { target: { value: 'OwnerPass2026!' } });

    const signInButtons = screen.getAllByRole('button', { name: 'Sign In' });
    fireEvent.click(signInButtons[signInButtons.length - 1]);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('owner', 'OwnerPass2026!');
    });
  });

  it('6. Sign Up requires role selection and does not offer OWNER', async () => {
    const registerSpy = vi.spyOn(authService, 'register');
    renderLoginPage('signup');

    expect(screen.getByRole('radio', { name: /ADMIN/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /SALESMAN/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /PRODUCTION/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /AUDITOR/i })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /OWNER/i })).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), {
      target: { value: 'jane.doe@foodfactory.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
      target: { value: 'StrongPass1!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByText(/Please select a role/i)).toBeTruthy();
    });
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('7. Renders 5 demo accounts when enabled, autofills without auto-submit, and hides when disabled', async () => {
    const demoAccounts = [
      {
        role: 'OWNER' as const,
        label: 'OWNER Demo',
        description: 'Executive oversight',
        email: 'demo.owner@foodfactory.local',
        password: 'DemoPassword1!',
      },
      {
        role: 'ADMIN' as const,
        label: 'ADMIN Demo',
        description: 'System administration',
        email: 'demo.admin@foodfactory.local',
        password: 'DemoPassword1!',
      },
      {
        role: 'SALESMAN' as const,
        label: 'SALESMAN Demo',
        description: 'Sales & invoicing',
        email: 'demo.salesman@foodfactory.local',
        password: 'DemoPassword1!',
      },
      {
        role: 'PRODUCTION' as const,
        label: 'PRODUCTION Demo',
        description: 'Production & inventory',
        email: 'demo.production@foodfactory.local',
        password: 'DemoPassword1!',
      },
      {
        role: 'AUDITOR' as const,
        label: 'AUDITOR Demo',
        description: 'Read-only audit',
        email: 'demo.auditor@foodfactory.local',
        password: 'DemoPassword1!',
      },
    ];

    vi.spyOn(authService, 'getDemoAccounts').mockResolvedValueOnce({
      enabled: true,
      accounts: demoAccounts,
    });

    const loginMock = vi.fn().mockResolvedValue(undefined);
    renderLoginPage('signin', makeUnauthenticatedAuth(loginMock));

    await waitFor(() => {
      expect(screen.getByText('Try Demo Accounts')).toBeTruthy();
    });

    for (const demo of demoAccounts) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(demo.label, 'i') }));
      expect((screen.getByLabelText('Username or Email') as HTMLInputElement).value).toBe(
        demo.email,
      );
      expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(demo.password);
      expect(loginMock).not.toHaveBeenCalled();
    }

    cleanup();
    vi.spyOn(authService, 'getDemoAccounts').mockResolvedValueOnce({
      enabled: false,
      accounts: [],
    });
    renderLoginPage('signin', makeUnauthenticatedAuth(loginMock));

    await waitFor(() => {
      expect(screen.queryByText('Try Demo Accounts')).toBeNull();
    });
  });

  it('8. Shows clear configuration warning when demo mode is enabled but accounts are missing', async () => {
    vi.spyOn(authService, 'getDemoAccounts').mockResolvedValueOnce({
      enabled: true,
      accounts: [],
      configError: true,
    });

    renderLoginPage('signin', makeUnauthenticatedAuth(vi.fn()));

    await waitFor(() => {
      expect(screen.getByText('Try Demo Accounts')).toBeTruthy();
      expect(
        screen.getByText(/Demo mode is enabled, but demo credentials are not configured/i),
      ).toBeTruthy();
    });
  });
});
