import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Factory, Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';

const loginFormSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ usernameOrEmail?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validate with Zod
    const validation = loginFormSchema.safeParse({ usernameOrEmail, password });
    if (!validation.success) {
      const fieldErrors: { usernameOrEmail?: string; password?: string } = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0] === 'usernameOrEmail') fieldErrors.usernameOrEmail = issue.message;
        if (issue.path[0] === 'password') fieldErrors.password = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await login(usernameOrEmail.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      {/* Decorative background grid and industrial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative z-10">
        {/* Header Banner */}
        <div className="bg-[#172F50] px-8 py-8 text-center text-white relative">
          <div className="inline-flex p-3 bg-teal-500/20 rounded-xl mb-3 ring-1 ring-teal-400/30">
            <Factory className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FoodFactory ERP</h1>
          <p className="text-xs text-slate-300 mt-1 font-medium tracking-wide">
            Manufacturing Operations & Relational Database System
          </p>
          <div className="mt-3 inline-block bg-teal-900/60 border border-teal-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-teal-300 uppercase tracking-widest">
            Phase 1.3 Certified
          </div>
        </div>

        {/* Login Form Body */}
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Sign In to Your Workspace</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your enterprise credentials to access the plant portal
            </p>
          </div>

          {serverError && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. owner or sales@foodfactory.com"
                  className={`w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    errors.usernameOrEmail
                      ? 'border-rose-400 focus:ring-rose-200 focus:border-rose-500 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white'
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.usernameOrEmail && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.usernameOrEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    errors.password
                      ? 'border-rose-400 focus:ring-rose-200 focus:border-rose-500 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white'
                  }`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-[#172F50] hover:bg-[#1f3f6b] text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to ERP System</span>
              )}
            </button>
          </form>

          {/* Development / Demo Quick Assist Box */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                Development Credentials Notice
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Initial Owner account provisioned via{' '}
                <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">.env</code>:
                <br />
                User: <span className="font-semibold text-slate-700">owner</span> (or{' '}
                <span className="font-semibold text-slate-700">owner@foodfactory.com</span>)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-3.5 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Centre for Digital Infrastructure, NIT Tiruchirappalli
        </div>
      </div>
    </div>
  );
};
