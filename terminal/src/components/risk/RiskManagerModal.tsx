import React from 'react';
import { freeMargin, useTerminalStore } from '../../store/useTerminalStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { fmtPnl, fmtPrice, fmtQty, fmtUsd, labelOf, pnlClass } from '../../utils/formatters';

interface RiskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RiskManagerModal({ isOpen, onClose }: RiskManagerModalProps) {
  const balance = useTerminalStore((s) => s.balance);
  const positions = useTerminalStore((s) => s.positions);
  const prices = useTerminalStore((s) => s.prices);
  const closePosition = useTerminalStore((s) => s.closePosition);
  const free = useTerminalStore((s) => freeMargin(s));

  const riskRules = usePsychologyStore((s) => s.riskRules);
  const updateRiskRules = usePsychologyStore((s) => s.updateRiskRules);
  const triggerLockout = usePsychologyStore((s) => s.triggerLockout);
  const killSwitch = usePsychologyStore((s) => s.killSwitch);

  if (!isOpen) return null;

  const openList = Object.values(positions);
  const totalUnrealizedPnl = openList.reduce((acc, p) => acc + p.unrealizedPnl, 0);
  const totalRealizedPnl = openList.reduce((acc, p) => acc + p.realizedPnl, 0);
  const equity = balance + totalUnrealizedPnl;

  // Margin Calculations
  const usedMargin = openList.reduce(
    (acc, p) => acc + (p.size * p.entryPrice) / p.leverage,
    0
  );
  const marginRatio = equity > 0 ? Math.min(100, Math.round((usedMargin / equity) * 100)) : 0;

  const marginStatus =
    marginRatio > 80
      ? { label: 'CRITICAL (Liquidation Risk)', cls: 'text-red-400 bg-red-500/20 border-red-500/40' }
      : marginRatio > 50
      ? { label: 'ELEVATED (High Utilization)', cls: 'text-amber-400 bg-amber-500/20 border-amber-500/40' }
      : { label: 'HEALTHY (Safe Buffer)', cls: 'text-up bg-up/20 border-up/40' };

  const handlePanicCloseAll = () => {
    if (confirm('EMERGENCY: Close ALL active positions immediately and trigger cooling-off lockout?')) {
      openList.forEach((p) => closePosition(p.symbol));
      triggerLockout('Emergency flatten-all triggered by trader.');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-[10px] border border-white/[0.08] bg-panel shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold text-white">
              Institutional Risk Manager & Portfolio Health
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Account Equity</span>
              <span className="text-base font-bold text-white mt-1 block">{fmtUsd(equity)}</span>
              <span className="text-[10px] text-muted">Wallet: {fmtUsd(balance)}</span>
            </div>

            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Unrealized P&L</span>
              <span className={`text-base font-bold mt-1 block ${pnlClass(totalUnrealizedPnl)}`}>
                {fmtPnl(totalUnrealizedPnl)}
              </span>
              <span className="text-[10px] text-muted">Realized: {fmtPnl(totalRealizedPnl)}</span>
            </div>

            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Used / Free Margin</span>
              <span className="text-base font-bold text-white mt-1 block">{fmtUsd(usedMargin)}</span>
              <span className="text-[10px] text-muted">Free: {fmtUsd(free)}</span>
            </div>

            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Margin Ratio Utilization</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-bold text-white">{marginRatio}%</span>
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${marginStatus.cls}`}>
                  {marginStatus.label}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-grid overflow-hidden">
                <div
                  className={`h-full ${
                    marginRatio > 80 ? 'bg-red-500' : marginRatio > 50 ? 'bg-amber-400' : 'bg-up'
                  }`}
                  style={{ width: `${marginRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Open Positions Table */}
          <div className="rounded-xl border border-grid bg-bg/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Active Open Positions ({openList.length})
              </h3>
              {openList.length > 0 && (
                <button
                  onClick={handlePanicCloseAll}
                  className="rounded bg-red-600/30 border border-red-500/50 px-3 py-1 font-bold text-red-300 hover:bg-red-600/50"
                >
                  Panic Close All Positions
                </button>
              )}
            </div>

            {openList.length === 0 ? (
              <p className="p-4 text-center text-muted">No open positions. Zero active market exposure.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-grid text-[10px] uppercase text-muted">
                    <tr>
                      <th className="py-2">Symbol</th>
                      <th className="py-2">Side</th>
                      <th className="py-2">Size</th>
                      <th className="py-2">Entry</th>
                      <th className="py-2">Mark</th>
                      <th className="py-2">Lev</th>
                      <th className="py-2">Unrealized P&L</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grid/40">
                    {openList.map((p) => {
                      const mark = prices[p.symbol] ?? p.entryPrice;
                      return (
                        <tr key={p.symbol} className="hover:bg-grid/20">
                          <td className="py-2 font-bold text-white">{labelOf(p.symbol)}</td>
                          <td className={`py-2 font-bold ${p.side === 'LONG' ? 'text-up' : 'text-down'}`}>
                            {p.side}
                          </td>
                          <td className="py-2">{fmtQty(p.size)}</td>
                          <td className="py-2">{fmtPrice(p.entryPrice, p.symbol)}</td>
                          <td className="py-2">{fmtPrice(mark, p.symbol)}</td>
                          <td className="py-2">{p.leverage}x</td>
                          <td className={`py-2 font-bold ${pnlClass(p.unrealizedPnl)}`}>
                            {fmtPnl(p.unrealizedPnl)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => closePosition(p.symbol)}
                              className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white"
                            >
                              Close
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* User-Defined Risk Limit Controls */}
          <div className="rounded-xl border border-grid bg-bg/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              User-Defined Session Risk Limits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] text-muted block mb-1">Max Daily Loss ($ USD)</label>
                <input
                  type="number"
                  value={riskRules.maxDailyLoss}
                  onChange={(e) => updateRiskRules({ maxDailyLoss: parseFloat(e.target.value) || 100 })}
                  className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">Max Trades Per Session</label>
                <input
                  type="number"
                  value={riskRules.maxDailyTrades}
                  onChange={(e) => updateRiskRules({ maxDailyTrades: parseInt(e.target.value, 10) || 5 })}
                  className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">Max Consecutive Losses</label>
                <input
                  type="number"
                  value={riskRules.maxConsecutiveLosses}
                  onChange={(e) => updateRiskRules({ maxConsecutiveLosses: parseInt(e.target.value, 10) || 3 })}
                  className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">Cool-down Duration (Minutes)</label>
                <input
                  type="number"
                  value={Math.round(riskRules.coolDownDurationMs / 60000)}
                  onChange={(e) => updateRiskRules({ coolDownDurationMs: (parseInt(e.target.value, 10) || 30) * 60000 })}
                  className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
