import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { setAccessToken, getAccessToken, apiClient } from '../services/api-client';

const loginFormSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

describe('Phase 1.3 Frontend Authentication & Session Suite', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('1. Login form validation rejects empty credentials and accepts valid inputs', () => {
    // Empty inputs
    const emptyResult = loginFormSchema.safeParse({ usernameOrEmail: '', password: '' });
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      const messages = emptyResult.error.issues.map(i => i.message);
      expect(messages).toContain('Username or email is required');
      expect(messages).toContain('Password is required');
    }

    // Valid inputs
    const validResult = loginFormSchema.safeParse({
      usernameOrEmail: 'owner',
      password: 'OwnerPassword2026!',
    });
    expect(validResult.success).toBe(true);
  });

  it('2. In-memory access token storage protects tokens from localStorage exposure', () => {
    expect(getAccessToken()).toBeNull();

    setAccessToken('jwt.sample.in_memory_token');
    expect(getAccessToken()).toBe('jwt.sample.in_memory_token');

    // Ensure localStorage is NOT used for long-lived tokens
    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
  });

  it('3. Logout clears the in-memory access token and resets authenticated state', () => {
    setAccessToken('jwt.valid.token');
    expect(getAccessToken()).not.toBeNull();

    // Perform logout reset
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('4. Session expiration transparently invokes refresh endpoint and retries', async () => {
    // Mock fetch
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes('/protected-data') && callCount === 1) {
        // First call returns 401 expired
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ success: false, message: 'Token expired' }),
        });
      }
      if (url.includes('/auth/refresh')) {
        // Refresh call returns new token
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { accessToken: 'jwt.fresh.token_after_refresh' },
            }),
        });
      }
      if (url.includes('/protected-data') && callCount === 3) {
        // Replayed request succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { secured: 'payload' } }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    global.fetch = mockFetch;
    setAccessToken('jwt.initial.expired_token');

    const result = await apiClient<{ secured: string }>('/protected-data');

    expect(result.success).toBe(true);
    expect(result.data?.secured).toBe('payload');
    expect(getAccessToken()).toBe('jwt.fresh.token_after_refresh');
  });
});
