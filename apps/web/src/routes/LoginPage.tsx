import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Factory, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService, UserProfile } from '../services/auth.service';
import { canAccessPath, getDefaultDashboardPath } from '../config/navigation';

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().trim().email('Please enter a valid email address').max(150),
    phoneNumber: z
      .string()
      .trim()
      .max(20, 'Phone number must be at most 20 characters')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export interface LoginPageProps {
  initialMode?: 'signin' | 'signup';
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode = 'signin' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();

  const resolvePostLoginDestination = (targetUser: UserProfile | null): string => {
    const state = location.state as { from?: { pathname?: string; search?: string } } | null;
    const requestedPath = state?.from?.pathname;
    if (
      requestedPath &&
      requestedPath !== '/login' &&
      requestedPath !== '/signup' &&
      canAccessPath(targetUser, requestedPath)
    ) {
      return `${requestedPath}${state?.from?.search || ''}`;
    }
    return getDefaultDashboardPath(targetUser);
  };

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  // Sign In state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState<{ email: string } | null>(null);

  // Shared form feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(resolvePostLoginDestination(user), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setFieldErrors({});
    setServerError(null);
    if (nextMode === 'signup') {
      setSignUpSuccess(null);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setServerError(null);

    const parsed = loginSchema.safeParse({ usernameOrEmail, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach(err => {
        if (err.path[0]) errs[String(err.path[0])] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const authenticatedUser = await login(parsed.data.usernameOrEmail, parsed.data.password);
      navigate(resolvePostLoginDestination(authenticatedUser), { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setServerError(null);

    const parsed = signUpSchema.safeParse({
      name: fullName,
      email,
      phoneNumber,
      password: signUpPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach(err => {
        const key = err.path[0] ? String(err.path[0]) : 'form';
        if (!errs[key]) errs[key] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const registered = await authService.register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        phoneNumber: parsed.data.phoneNumber || undefined,
      });
      setSignUpSuccess({ email: registered.email });
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setSignUpPassword('');
      setConfirmPassword('');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Navy Header */}
        <div className="bg-[#172F50] px-6 py-7 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <Factory className="h-7 w-7 text-teal-300" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FoodFactory ERP</h1>
          <p className="mt-1 text-xs text-slate-300">
            Manufacturing, Inventory &amp; Compliance Platform
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`py-3 transition-colors ${
              mode === 'signin'
                ? 'border-b-2 border-[#172F50] bg-white text-[#172F50]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`py-3 transition-colors ${
              mode === 'signup'
                ? 'border-b-2 border-[#172F50] bg-white text-[#172F50]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="p-6">
          {serverError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {mode === 'signin' ? (
            <form onSubmit={handleSignInSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="signin-username"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Username or Email
                </label>
                <input
                  id="signin-username"
                  type="text"
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                />
                {fieldErrors.usernameOrEmail && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.usernameOrEmail}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signin-password"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#172F50] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3d68] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>

              <p className="text-center text-xs text-slate-500">
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-medium text-[#172F50] hover:underline"
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : signUpSuccess ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  Registration Submitted
                </h2>
                <p className="text-xs text-slate-600">
                  Your account for <span className="font-medium">{signUpSuccess.email}</span> has
                  been created and is pending administrator approval. You will be able to sign in
                  once an administrator activates your account and assigns a role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="w-full rounded-lg bg-[#172F50] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3d68]"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5" noValidate>
              <div>
                <label
                  htmlFor="signup-name"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-phone"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Phone Number <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                />
                {fieldErrors.phoneNumber && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showSignUpPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={signUpPassword}
                    onChange={e => setSignUpPassword(e.target.value)}
                    placeholder="Min 8 chars, upper, lower, number, symbol"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(v => !v)}
                    aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-confirm-password"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-[#172F50] focus:outline-none focus:ring-1 focus:ring-[#172F50]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    aria-label={
                      showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                    }
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#172F50] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3d68] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>

              <p className="text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="font-medium text-[#172F50] hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
