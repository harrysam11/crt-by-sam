import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { audioHaptics } from '../../utils/notify';
import TerminalXLogo from '../common/TerminalXLogo';

export default function AuthModal() {
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen);
  const authModalMode = useAuthStore((s) => s.authModalMode);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const twitterAccount = useAuthStore((s) => s.twitterAccount);
  const connectTwitter = useAuthStore((s) => s.connectTwitter);
  const disconnectTwitter = useAuthStore((s) => s.disconnectTwitter);

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confirmTwitterVerification = useAuthStore((s) => s.confirmTwitterVerification);

  // X (Twitter) Connect Drawer
  const [showXConnectInput, setShowXConnectInput] = useState(false);
  const [xHandleInput, setXHandleInput] = useState('');
  const [verificationPending, setVerificationPending] = useState<{ nonce: string; tweetIntentUrl: string } | null>(null);

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

  const handleConnectXSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!xHandleInput.trim()) return;
    const challenge = connectTwitter(xHandleInput);
    setVerificationPending(challenge);
    setShowXConnectInput(false);
    setXHandleInput('');
  };

  const handleConfirmProof = () => {
    confirmTwitterVerification();
    setVerificationPending(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-xl border border-[#282826] bg-[#141413] p-6 shadow-2xl text-slate-200 font-mono">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 rounded hover:bg-white/5"
          title="Close dialog"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <TerminalXLogo size={28} variant="white" />
          <div>
            <h2 className="text-base font-bold text-white font-heading tracking-tight">
              {authModalMode === 'LOGIN' ? 'Sign In to TerminalX' : 'Create TerminalX Account'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {authModalMode === 'LOGIN'
                ? 'Access your cloud workspace, layouts, and drawings'
                : 'Join the institutional grade trading & risk platform'}
            </p>
          </div>
        </div>

        {/* X.com (Twitter) Verified Sign-In Option */}
        <div className="mb-5 space-y-2">
          {twitterAccount ? (
            <div className="p-3 rounded-lg border border-[#282826] bg-[#181817] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-black border border-white/20 flex items-center justify-center text-white font-bold">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>@{twitterAccount.handle}</span>
                      {twitterAccount.verified ? (
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                          VERIFIED OWNER
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-400">
                          PROOF PENDING
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {twitterAccount.verified
                        ? 'Cryptographic ownership verified'
                        : 'Ownership unconfirmed - verification required'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={disconnectTwitter}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition"
                >
                  Disconnect
                </button>
              </div>

              {!twitterAccount.verified && (
                <div className="p-2.5 rounded bg-black/60 border border-amber-500/20 text-[11px] space-y-2">
                  <div className="text-amber-300 font-bold">
                    Ownership Security Challenge:
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    To prevent identity spoofing, post this proof nonce on X:
                  </p>
                  <code className="block bg-[#141413] p-1.5 rounded border border-[#282826] text-white text-[10px] font-mono select-all">
                    {twitterAccount.verificationNonce}
                  </code>
                  <div className="flex gap-2 pt-1">
                    <a
                      href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                        `Verifying my @TerminalX institutional account ownership: ${twitterAccount.verificationNonce}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-white text-black font-bold text-[10px] hover:bg-slate-200 transition"
                    >
                      Post Proof Tweet
                    </a>
                    <button
                      type="button"
                      onClick={handleConfirmProof}
                      className="px-2.5 py-1 rounded border border-white/20 text-white font-bold text-[10px] hover:bg-white/10 transition"
                    >
                      Confirm Verification
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : showXConnectInput ? (
            <form onSubmit={handleConnectXSubmit} className="space-y-2 p-3 rounded-lg border border-white/15 bg-[#181817]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-white block">Link X.com Trader Account</label>
                <span className="text-[9px] text-slate-400">[Challenge Required]</span>
              </div>
              <p className="text-[10px] text-slate-400">
                You will be issued a single-use verification token to cryptographically prove ownership of this handle.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2 text-slate-500">@</span>
                  <input
                    type="text"
                    value={xHandleInput}
                    onChange={(e) => setXHandleInput(e.target.value)}
                    placeholder="username"
                    required
                    autoFocus
                    className="w-full rounded border border-[#282826] bg-black/60 pl-6 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-white text-black font-bold text-xs hover:bg-slate-200"
                >
                  Generate Challenge
                </button>
                <button
                  type="button"
                  onClick={() => setShowXConnectInput(false)}
                  className="px-2 py-1.5 rounded border border-[#282826] text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                audioHaptics.tick();
                setShowXConnectInput(true);
              }}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-black hover:bg-[#1f1f1d] border border-white/20 text-white font-bold text-xs transition cursor-pointer shadow-sm"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Connect with X (Cryptographic Proof)</span>
            </button>
          )}

          <div className="flex items-center gap-3 my-3">
            <div className="h-px bg-[#282826] flex-1" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">or continue with email</span>
            <div className="h-px bg-[#282826] flex-1" />
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg border border-[#282826] p-1 bg-black/40 mb-5">
          <button
            type="button"
            onClick={() => {
              audioHaptics.tick();
              setErrorMessage(null);
              openAuthModal('LOGIN');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
              authModalMode === 'LOGIN'
                ? 'bg-white/15 text-white border border-white/20 font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
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
                ? 'bg-white/15 text-white border border-white/20 font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Error Banner */}
        {errorMessage && (
          <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalMode === 'REGISTER' && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@institutional.com"
                required
                className="w-full rounded border border-[#282826] bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none transition"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {authModalMode === 'LOGIN' ? 'Username or Email' : 'Username'}
            </label>
            <input
              type="text"
              value={authModalMode === 'LOGIN' ? identifier : username}
              onChange={(e) =>
                authModalMode === 'LOGIN' ? setIdentifier(e.target.value) : setUsername(e.target.value)
              }
              placeholder={authModalMode === 'LOGIN' ? 'sam_quant or sam@firm.com' : 'sam_quant'}
              required
              className="w-full rounded border border-[#282826] bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[10px] text-slate-400 hover:text-white"
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
              className="w-full rounded border border-[#282826] bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded bg-white hover:bg-slate-200 py-2.5 text-xs font-bold text-black transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-heading"
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
        <div className="mt-5 pt-4 border-t border-[#282826] text-center">
          <p className="text-[11px] text-slate-400 mb-2">Want to explore without an account?</p>
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
