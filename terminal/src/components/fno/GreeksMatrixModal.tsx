import React, { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { calculateGreeks } from '../../services/greeksMath';
import { fmtPrice, labelOf } from '../../utils/formatters';

interface GreeksMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GreeksMatrixModal({ isOpen, onClose }: GreeksMatrixModalProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const mark = currentPrice > 0 ? currentPrice : 95000;

  const [daysToExpiry, setDaysToExpiry] = useState<number>(7);
  const [baseIV, setBaseIV] = useState<number>(45); // 45%

  if (!isOpen) return null;

  const t = daysToExpiry / 365;
  const ivDecimal = baseIV / 100;
  const step = mark > 1000 ? 500 : 25;
  const atm = Math.round(mark / step) * step;

  const strikes = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((offset) => {
    const k = atm + offset * step;
    const callGreeks = calculateGreeks(mark, k, t, ivDecimal, 0.05, 'CALL');
    const putGreeks = calculateGreeks(mark, k, t, ivDecimal, 0.05, 'PUT');
    return {
      strike: k,
      isATM: offset === 0,
      call: callGreeks,
      put: putGreeks,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Institutional Options Greeks Matrix & Sensitivity Engine
            </h2>
            <span className="rounded bg-grid px-2 py-0.5 text-xs text-muted">
              {labelOf(symbol)} Spot: {fmtPrice(mark, symbol)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">Expiry DTE:</span>
              <input
                type="number"
                min="1"
                max="90"
                value={daysToExpiry}
                onChange={(e) => setDaysToExpiry(parseInt(e.target.value, 10) || 1)}
                className="w-14 rounded border border-grid bg-bg px-2 py-1 text-center text-white"
              />
              <span className="text-muted">Days</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">Model IV:</span>
              <input
                type="number"
                min="10"
                max="250"
                value={baseIV}
                onChange={(e) => setBaseIV(parseFloat(e.target.value) || 20)}
                className="w-14 rounded border border-grid bg-bg px-2 py-1 text-center text-white"
              />
              <span className="text-muted">%</span>
            </div>

            <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 z-10 border-b border-grid bg-[#10141c] text-[10px] uppercase text-muted">
              <tr>
                <th colSpan={4} className="border-r border-grid py-2 text-center bg-down/5 text-down">
                  Calls (CE) Greeks
                </th>
                <th className="py-2 text-center bg-grid/40 text-white font-bold">
                  Strike Price
                </th>
                <th colSpan={4} className="border-l border-grid py-2 text-center bg-up/5 text-up">
                  Puts (PE) Greeks
                </th>
              </tr>
              <tr className="border-t border-grid text-muted">
                <th className="px-3 py-1 text-left">Delta</th>
                <th className="px-2 py-1">Gamma</th>
                <th className="px-2 py-1">Theta/1d</th>
                <th className="px-3 py-1 border-r border-grid">Vega/1%</th>
                <th className="px-4 py-1 text-center bg-grid/20 text-white">Strike</th>
                <th className="px-3 py-1 border-l border-grid text-left">Vega/1%</th>
                <th className="px-2 py-1">Theta/1d</th>
                <th className="px-2 py-1">Gamma</th>
                <th className="px-3 py-1 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid/40">
              {strikes.map((row) => (
                <tr
                  key={row.strike}
                  className={`transition ${
                    row.isATM ? 'bg-amber-400/10 font-bold' : 'hover:bg-grid/20'
                  }`}
                >
                  {/* Call Delta */}
                  <td className="px-3 py-2 text-left text-up font-semibold">
                    {row.call.delta.toFixed(3)}
                  </td>
                  {/* Call Gamma */}
                  <td className="px-2 py-2 text-muted">{row.call.gamma.toFixed(4)}</td>
                  {/* Call Theta */}
                  <td className="px-2 py-2 text-down font-semibold">{row.call.theta.toFixed(2)}</td>
                  {/* Call Vega */}
                  <td className="px-3 py-2 text-white border-r border-grid">{row.call.vega.toFixed(2)}</td>

                  {/* Strike */}
                  <td className={`px-4 py-2 text-center font-bold text-white ${row.isATM ? 'bg-amber-400/20 text-amber-300' : 'bg-grid/30'}`}>
                    {fmtPrice(row.strike, symbol)}
                    {row.isATM && <span className="ml-1 text-[9px] text-amber-300 uppercase">ATM</span>}
                  </td>

                  {/* Put Vega */}
                  <td className="px-3 py-2 text-white border-l border-grid text-left">{row.put.vega.toFixed(2)}</td>
                  {/* Put Theta */}
                  <td className="px-2 py-2 text-down font-semibold">{row.put.theta.toFixed(2)}</td>
                  {/* Put Gamma */}
                  <td className="px-2 py-2 text-muted">{row.put.gamma.toFixed(4)}</td>
                  {/* Put Delta */}
                  <td className="px-3 py-2 text-right text-down font-semibold">
                    {row.put.delta.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Greeks Legend */}
        <div className="border-t border-grid px-6 py-2.5 bg-bg/50 text-[10px] text-muted flex items-center justify-between">
          <span>Delta = Directional exposure • Gamma = Delta acceleration • Theta = Time decay per day • Vega = IV sensitivity</span>
          <span>Pricing Model: Black-Scholes Analytical PDE</span>
        </div>
      </div>
    </div>
  );
}
