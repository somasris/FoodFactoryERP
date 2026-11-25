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
});
