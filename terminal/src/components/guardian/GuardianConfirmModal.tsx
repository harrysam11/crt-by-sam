/**
 * TradeXGuardian Risk Confirmation Modal.
 * Pops up before order execution when Guardian detects warnings, confirmations, or blocks.
 * User sees exact reason, risk details, and suggested SL/TP.
 * Hard blocks cannot be overridden. CONFIRM items require explicit acknowledgement.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React from 'react';
import { audioHaptics } from '../../utils/notify';
import type { GuardianCheckResult } from '../../store/useGuardianStore';
import { fmtPrice } from '../../utils/formatters';

interface GuardianConfirmModalProps {
  isOpen: boolean;
  result: GuardianCheckResult;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  onProceed: () => void;   // user confirms / overrides warnings
  onCancel: () => void;
}

export default function GuardianConfirmModal({
  isOpen,
  result,
  symbol,
  side,
  qty,
  onProceed,
  onCancel,
}: GuardianConfirmModalProps) {
  if (!isOpen) return null;

  const hasBlock = result.blocked;
  const hasConfirm = result.confirmations.length > 0;
  const hasWarn = result.warnings.length > 0;

  const headerColor = hasBlock
    ? 'border-red-500/40 bg-red-500/10'
    : hasConfirm
    ? 'border-amber-500/40 bg-amber-500/10'
    : 'border-yellow-500/40 bg-yellow-500/10';

  const headerLabel = hasBlock ? 'TRADE BLOCKED' : hasConfirm ? 'CONFIRM REQUIRED' : 'RISK WARNING';
  const headerTextColor = hasBlock ? 'text-red-400' : hasConfirm ? 'text-amber-400' : 'text-yellow-400';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-md mx-4 clay-panel rounded-xl border border-grid/80 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${headerColor}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${hasBlock ? 'bg-red-400 animate-pulse' : hasConfirm ? 'bg-amber-400' : 'bg-yellow-400'}`} />
            <span className={`text-sm font-bold font-mono ${headerTextColor}`}>
              [GUARDIAN] {headerLabel}
            </span>
          </div>
          <button
            onClick={() => { audioHaptics.tick(); onCancel(); }}
            className="text-muted hover:text-white text-xs clay-btn px-2 py-0.5"
          >
            x
          </button>
        </div>

        {/* Order Summary */}
        <div className="px-4 py-2 border-b border-grid/40 bg-white/[0.02] flex items-center gap-3 text-xs font-mono">
          <span className={`font-bold px-2 py-0.5 rounded ${side === 'BUY' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
            {side}
          </span>
          <span className="text-white font-semibold">{qty} {symbol}</span>
          {result.riskUsd !== undefined && (
            <span className="text-muted">Risk: <strong className="text-red-400">${result.riskUsd.toFixed(2)}</strong></span>
          )}
          {result.actualRR !== undefined && (
            <span className="text-muted">RR: <strong className={result.actualRR >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}>1:{result.actualRR.toFixed(2)}</strong></span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

          {/* Hard Blocks */}
          {result.violations.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Blocked — Cannot Proceed</span>
              {result.violations.map((v, i) => (
                <div key={i} className="flex gap-2 items-start bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-red-400 text-xs mt-0.5 shrink-0">[X]</span>
                  <span className="text-red-300 text-xs">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Confirmations */}
          {result.confirmations.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Requires Your Confirmation</span>
              {result.confirmations.map((c, i) => (
                <div key={i} className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span className="text-amber-400 text-xs mt-0.5 shrink-0">[!]</span>
                  <span className="text-amber-200 text-xs">{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-yellow-400 tracking-wider">Risk Warnings</span>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 items-start bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <span className="text-yellow-400 text-xs mt-0.5 shrink-0">[W]</span>
                  <span className="text-yellow-200 text-xs">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested SL/TP */}
          {(result.suggestedSl !== undefined || result.suggestedTp !== undefined) && (
            <div className="bg-zinc-800/60 border border-zinc-600/40 rounded-lg px-3 py-2 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Suggested Levels (1% risk / {`1:${1.5}`} RR)</span>
              {result.suggestedSl !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Stop Loss</span>
                  <span className="text-red-300 font-mono font-bold">{fmtPrice(result.suggestedSl, symbol)}</span>
                </div>
              )}
              {result.suggestedTp !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Take Profit</span>
                  <span className="text-emerald-300 font-mono font-bold">{fmtPrice(result.suggestedTp, symbol)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-grid/40">
          <button
            onClick={() => { audioHaptics.tick(); onCancel(); }}
            className="flex-1 clay-btn px-3 py-2 text-sm font-semibold text-white hover:text-white"
          >
            Cancel Trade
          </button>
          {!hasBlock && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onProceed();
              }}
              className={`flex-1 px-3 py-2 text-sm font-bold rounded-lg border transition ${
                hasConfirm
                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'clay-pill-active'
              }`}
            >
              {hasConfirm ? 'I Confirm — Proceed' : 'Proceed Anyway'}
            </button>
          )}
        </div>

        {/* Discipline reminder for hard blocks */}
        {hasBlock && (
          <div className="px-4 pb-3 text-center text-[10px] text-muted">
            Hard blocks cannot be overridden. Modify your order or adjust rules in the Guardian settings.
          </div>
        )}
      </div>
    </div>
  );
}
