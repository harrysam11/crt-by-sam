import React, { useEffect, useState } from 'react';
import { usePsychologyStore } from '../store/usePsychologyStore';

export default function KillSwitchOverlay() {
  const killSwitch = usePsychologyStore((s) => s.killSwitch);
  const unlockWithCode = usePsychologyStore((s) => s.unlockWithCode);
  const clearExpiredLock = usePsychologyStore((s) => s.clearExpiredLock);

  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!killSwitch.isLocked || !killSwitch.lockedUntil) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = (killSwitch.lockedUntil || 0) - now;

      if (diff <= 0) {
        clearExpiredLock();
        setTimeLeft(null);
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeLeft({ minutes, seconds });
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [killSwitch.isLocked, killSwitch.lockedUntil, clearExpiredLock]);

  if (!killSwitch.isLocked) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter an accountability unlock code.');
      return;
    }
    const success = unlockWithCode(code);
    if (success) {
      setCode('');
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid code. Contact your accountability partner.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg rounded-[10px] border border-red-500/30 bg-[#111114] p-8 text-center shadow-2xl">
        {/* Warning Icon Badge */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] border border-red-500/20 bg-red-500/10 text-red-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white">
          Overtrading Kill-Switch Active
        </h2>

        <p className="mt-2 text-sm text-red-300 font-medium">
          {killSwitch.lockReason || 'Trading session locked to preserve capital.'}
        </p>

        {/* Live Countdown Display */}
        {timeLeft && (
          <div className="my-6 rounded-xl border border-grid bg-bg/80 p-4">
            <span className="text-xs uppercase tracking-widest text-muted">Mandatory Cooling-off Lockout</span>
            <div className="mt-1 font-mono text-4xl font-extrabold text-white">
              {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </div>
            <p className="mt-2 text-xs text-muted">
              Step away from the screen. Walk, breathe, or review your trade journal.
            </p>
          </div>
        )}

        {/* Accountability Partner Bypass Form */}
        <form onSubmit={handleUnlock} className="mt-6 border-t border-grid pt-5">
          <label className="block text-xs font-semibold text-muted mb-2">
            Accountability Partner Override Code
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Enter unlock code (e.g. DISCIPLINE_FIRST)"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setErrorMsg('');
              }}
              className="flex-1 rounded-lg border border-grid bg-bg px-3 py-2 text-sm text-white placeholder-muted/50 focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95"
            >
              Unlock
            </button>
          </div>
          {errorMsg && <p className="mt-2 text-xs text-red-400">{errorMsg}</p>}
        </form>

        <div className="mt-4 text-[11px] text-muted">
          Default partner demo code: <span className="font-mono text-slate-300">DISCIPLINE_FIRST</span>
        </div>
      </div>
    </div>
  );
}
