import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { audioHaptics } from '../../utils/notify';

export default function AuthModal() {
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen);
  const authModalMode = useAuthStore((s) => s.authModalMode);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (authModalMode === 'LOGIN') {
      if (!identifier.trim() || !password.trim()) {
        setErrorMessage('Username/Email and Password are required.');
        return;
      }
      const res = await login(identifier, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to authenticate');
      }
    } else {
      if (!email.trim() || !username.trim() || !password.trim()) {
        setErrorMessage('All registration fields are required.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      const res = await register(email, username, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to create account');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-xl border border-grid bg-panel p-6 shadow-2xl text-slate-200 font-mono">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-muted hover:text-white transition p-1 rounded hover:bg-white/5"
          title="Close dialog"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded bg-cyan-400 text-black font-black text-xs font-mono shadow-xs">
            TX
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-heading tracking-tight">
              {authModalMode === 'LOGIN' ? 'Sign In to TerminalX' : 'Create TerminalX Account'}
            </h2>
            <p className="text-[11px] text-muted">
              {authModalMode === 'LOGIN'
                ? 'Access your cloud workspace, layouts, and drawings'
                : 'Join the institutional grade trading & risk platform'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg border border-grid p-1 bg-black/40 mb-5">
          <button
            type="button"
            onClick={() => {
              audioHaptics.tick();
              setErrorMessage(null);
              openAuthModal('LOGIN');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
              authModalMode === 'LOGIN'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-muted hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              audioHaptics.tick();
              setErrorMessage(null);
              openAuthModal('REGISTER');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
              authModalMode === 'REGISTER'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-muted hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalMode === 'LOGIN' ? (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1 font-semibold">
                Email or Username
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="trader@terminalx.io or trader_id"
                required
                className="w-full rounded border border-grid bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1 font-semibold">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@terminalx.io"
                  required
                  className="w-full rounded border border-grid bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1 font-semibold">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alpha_trader"
                  required
                  className="w-full rounded border border-grid bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition"
                />
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] uppercase tracking-wider text-muted font-semibold">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-muted hover:text-white transition"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              className="w-full rounded border border-grid bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded bg-cyan-400 hover:bg-cyan-300 py-2.5 text-xs font-bold text-black transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-heading"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : authModalMode === 'LOGIN' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Guest Demo Option */}
        <div className="mt-5 pt-4 border-t border-grid text-center">
          <p className="text-[11px] text-muted mb-2">Want to explore without an account?</p>
          <button
            type="button"
            onClick={() => {
              audioHaptics.tick();
              closeAuthModal();
            }}
            className="w-full rounded border border-white/10 hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.08] py-2 text-xs font-medium text-slate-300 hover:text-white transition"
          >
            Continue as Guest (Local Workspace)
          </button>
        </div>
      </div>
    </div>
  );
}
