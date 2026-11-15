/**
 * Quantum Terminal-Style Institutional Bulk TP & SL Bracket Modification Modal.
 * Enables setting, shifting, and synchronizing Stop Loss and Take Profit orders
 * across multiple open positions simultaneously with live risk-reward calculation.
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { useTerminalStore, positionPnlUsd } from '../../store/useTerminalStore';
import { fmtPrice, fmtPnl, fmtQty, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import { toUsd } from '../../services/instruments';

interface BulkBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbols: string[];
}

type SlMode = 'PERCENT' | 'BREAK_EVEN' | 'PRICE';
type TpMode = 'PERCENT' | 'RISK_REWARD' | 'PRICE';

export default function BulkBracketModal({ isOpen, onClose, selectedSymbols }: BulkBracketModalProps) {
  const positions = useTerminalStore((s) => s.positions);
  const prices = useTerminalStore((s) => s.prices);
  const bulkModifyBrackets = useTerminalStore((s) => s.bulkModifyBrackets);

  const [slMode, setSlMode] = useState<SlMode>('PERCENT');
  const [slOffsetPct, setSlOffsetPct] = useState<number>(1.5);
  const [slExactPrice, setSlExactPrice] = useState<string>('');

  const [tpMode, setTpMode] = useState<TpMode>('RISK_REWARD');
  const [tpOffsetPct, setTpOffsetPct] = useState<number>(3.0);
  const [riskReward, setRiskReward] = useState<number>(2.0);
  const [tpExactPrice, setTpExactPrice] = useState<string>('');

  const [activeSymbols, setActiveSymbols] = useState<string[]>(
    selectedSymbols.length > 0 ? selectedSymbols : Object.keys(positions)
  );

  if (!isOpen) return null;

  const allPositions = Object.values(positions);
  if (allPositions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px] font-mono">
        <div className="w-full max-w-md rounded-2xl bg-[#0e0e14] border border-[#272736] p-6 text-center text-slate-300">
          <p className="text-sm font-semibold mb-4">No open positions found to modify.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#38bdf8] text-black font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const toggleSymbol = (sym: string) => {
    audioHaptics.tick();
    setActiveSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const selectAll = () => {
    audioHaptics.tick();
    setActiveSymbols(Object.keys(positions));
  };

  const deselectAll = () => {
    audioHaptics.tick();
    setActiveSymbols([]);
  };

  const handleApply = () => {
    if (activeSymbols.length === 0) return;
    audioHaptics.tick();

    bulkModifyBrackets({
      symbols: activeSymbols,
      isBreakEven: slMode === 'BREAK_EVEN',
      slOffsetPct: slMode === 'PERCENT' ? slOffsetPct : undefined,
      slPrice: slMode === 'PRICE' && parseFloat(slExactPrice) > 0 ? parseFloat(slExactPrice) : undefined,
      riskRewardRatio: tpMode === 'RISK_REWARD' ? riskReward : undefined,
      tpOffsetPct: tpMode === 'PERCENT' ? tpOffsetPct : undefined,
      tpPrice: tpMode === 'PRICE' && parseFloat(tpExactPrice) > 0 ? parseFloat(tpExactPrice) : undefined,
    });

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-[3px] font-mono select-none"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0e0e14] border border-[#272736] p-6 shadow-2xl shadow-black text-xs text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#20202e] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171722] border border-[#2c2c3e] text-[#38bdf8]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Quantum Bulk TP & SL Manager
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Batch calculate and modify brackets across {activeSymbols.length} of {allPositions.length} position{allPositions.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1a26] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Position Target Selector */}
        <div className="mb-4 bg-[#12121a] p-3 rounded-xl border border-[#222230]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Target Positions ({activeSymbols.length})
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={selectAll}
                className="text-[#38bdf8] hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={deselectAll}
                className="text-slate-400 hover:text-white hover:underline cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {allPositions.map((p) => {
              const isSelected = activeSymbols.includes(p.symbol);
              return (
                <button
                  key={p.symbol}
                  onClick={() => toggleSymbol(p.symbol)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                    isSelected
                      ? 'bg-[#38bdf8]/15 border-[#38bdf8]/40 text-white'
                      : 'bg-black/30 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.side === 'LONG' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>{labelOf(p.symbol)}</span>
                  <span className="text-[10px] text-slate-500">({p.side})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid: Stop Loss (Left) & Take Profit (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Stop Loss Configuration */}
          <div className="rounded-xl bg-[#12121a] p-3.5 border border-[#242432]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Stop Loss (SL)
              </span>
              <div className="flex items-center gap-1">
                {(['PERCENT', 'BREAK_EVEN', 'PRICE'] as SlMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      audioHaptics.tick();
                      setSlMode(m);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                      slMode === m
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m === 'PERCENT' ? '% Offset' : m === 'BREAK_EVEN' ? 'Snap BE' : 'Price'}
                  </button>
                ))}
              </div>
            </div>

            {slMode === 'PERCENT' && (
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  Risk Distance from Entry:
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={slOffsetPct}
                    onChange={(e) => setSlOffsetPct(parseFloat(e.target.value) || 1)}
                    className="w-24 rounded-lg bg-[#181824] px-2.5 py-1.5 text-xs text-white border border-[#2d2d3e] focus:border-rose-400 focus:outline-none"
                  />
                  <span className="text-slate-400 text-xs">%</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSlOffsetPct(v)}
                      className={`px-1.5 py-0.5 rounded transition ${
                        slOffsetPct === v
                          ? 'bg-rose-500/30 text-rose-200 font-bold'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {slMode === 'BREAK_EVEN' && (
              <div className="py-2 text-[11px] text-slate-300">
                <p className="text-emerald-400 font-semibold mb-1">Zero Risk Break-Even</p>
                <p className="text-slate-400 text-[10.5px]">
                  Sets Stop Loss of each target position exactly at its Entry Price to eliminate downside risk.
                </p>
              </div>
            )}

            {slMode === 'PRICE' && (
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  Exact Stop Price (for single asset):
                </label>
                <input
                  type="text"
                  placeholder="e.g. 91500"
                  value={slExactPrice}
                  onChange={(e) => setSlExactPrice(e.target.value)}
                  className="w-full rounded-lg bg-[#181824] px-2.5 py-1.5 text-xs text-white border border-[#2d2d3e] focus:border-rose-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Take Profit Configuration */}
          <div className="rounded-xl bg-[#12121a] p-3.5 border border-[#242432]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Take Profit (TP)
              </span>
              <div className="flex items-center gap-1">
                {(['RISK_REWARD', 'PERCENT', 'PRICE'] as TpMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      audioHaptics.tick();
                      setTpMode(m);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                      tpMode === m
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m === 'RISK_REWARD' ? 'R:R Ratio' : m === 'PERCENT' ? '% Gain' : 'Price'}
                  </button>
                ))}
              </div>
            </div>

            {tpMode === 'RISK_REWARD' && (
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  Risk / Reward Multiplier (R:R):
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="20"
                    value={riskReward}
                    onChange={(e) => setRiskReward(parseFloat(e.target.value) || 1)}
                    className="w-24 rounded-lg bg-[#181824] px-2.5 py-1.5 text-xs text-white border border-[#2d2d3e] focus:border-emerald-400 focus:outline-none"
                  />
                  <span className="text-slate-400 text-xs">R (e.g. 1:{riskReward})</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  {[1.0, 1.5, 2.0, 2.5, 3.0, 5.0].map((v) => (
                    <button
                      key={v}
                      onClick={() => setRiskReward(v)}
                      className={`px-1.5 py-0.5 rounded transition ${
                        riskReward === v
                          ? 'bg-emerald-500/30 text-emerald-200 font-bold'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      1:{v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tpMode === 'PERCENT' && (
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  Profit Target from Entry:
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    value={tpOffsetPct}
                    onChange={(e) => setTpOffsetPct(parseFloat(e.target.value) || 1)}
                    className="w-24 rounded-lg bg-[#181824] px-2.5 py-1.5 text-xs text-white border border-[#2d2d3e] focus:border-emerald-400 focus:outline-none"
                  />
                  <span className="text-slate-400 text-xs">%</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  {[1.0, 2.0, 3.0, 5.0, 10.0].map((v) => (
                    <button
                      key={v}
                      onClick={() => setTpOffsetPct(v)}
                      className={`px-1.5 py-0.5 rounded transition ${
                        tpOffsetPct === v
                          ? 'bg-emerald-500/30 text-emerald-200 font-bold'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      +{v}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tpMode === 'PRICE' && (
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  Exact Target Price (for single asset):
                </label>
                <input
                  type="text"
                  placeholder="e.g. 96000"
                  value={tpExactPrice}
                  onChange={(e) => setTpExactPrice(e.target.value)}
                  className="w-full rounded-lg bg-[#181824] px-2.5 py-1.5 text-xs text-white border border-[#2d2d3e] focus:border-emerald-400 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Live Preview Table */}
        <div className="rounded-xl bg-[#12121a] p-3 border border-[#222230] mb-5">
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Bracket Preview Calculation
          </div>
          <div className="max-h-36 overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/5 text-slate-500">
                  <th className="py-1">Symbol</th>
                  <th className="py-1">Side</th>
                  <th className="py-1">Entry</th>
                  <th className="py-1 text-rose-400">Projected SL</th>
                  <th className="py-1 text-emerald-400">Projected TP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeSymbols.map((sym) => {
                  const p = positions[sym];
                  if (!p) return null;
                  const isLong = p.side === 'LONG';

                  let slEst = p.entryPrice;
                  if (slMode === 'PERCENT') {
                    slEst = isLong
                      ? p.entryPrice * (1 - slOffsetPct / 100)
                      : p.entryPrice * (1 + slOffsetPct / 100);
                  } else if (slMode === 'BREAK_EVEN') {
                    slEst = p.entryPrice;
                  }

                  let tpEst = p.entryPrice;
                  if (tpMode === 'RISK_REWARD') {
                    const dist = Math.abs(p.entryPrice - slEst);
                    tpEst = isLong
                      ? p.entryPrice + dist * riskReward
                      : p.entryPrice - dist * riskReward;
                  } else if (tpMode === 'PERCENT') {
                    tpEst = isLong
                      ? p.entryPrice * (1 + tpOffsetPct / 100)
                      : p.entryPrice * (1 - tpOffsetPct / 100);
                  }

                  return (
                    <tr key={sym} className="hover:bg-white/[0.02]">
                      <td className="py-1 font-semibold text-white">{labelOf(sym)}</td>
                      <td className={`py-1 ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {p.side}
                      </td>
                      <td className="py-1 text-slate-300">{fmtPrice(p.entryPrice, sym)}</td>
                      <td className="py-1 text-rose-300 font-semibold">{fmtPrice(slEst, sym)}</td>
                      <td className="py-1 text-emerald-300 font-semibold">{fmtPrice(tpEst, sym)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-[#20202e] pt-3">
          <div className="text-[11px] text-slate-400">
            Applying will replace any existing pending SL/TP on selected positions.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={activeSymbols.length === 0}
              className="px-5 py-2 rounded-lg bg-[#38bdf8] text-black font-bold text-xs hover:bg-[#7dd3fc] disabled:opacity-40 transition shadow-sm cursor-pointer"
            >
              Apply to {activeSymbols.length} Position{activeSymbols.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
