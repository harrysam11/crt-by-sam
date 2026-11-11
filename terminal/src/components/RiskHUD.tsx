import React, { useState } from 'react';
import { useTerminalStore } from '../store/useTerminalStore';
import { toUsd } from '../services/instruments';
import { fmtPrice, fmtQty, fmtUsd } from '../utils/formatters';

interface RiskHUDProps {
  onApplySize?: (qty: number, slPrice?: number, tpPrice?: number) => void;
  onClose?: () => void;
}

export default function RiskHUD({ onApplySize, onClose }: RiskHUDProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const balance = useTerminalStore((s) => s.balance);
  const equity = useTerminalStore((s) => s.balance + Object.values(s.positions).reduce((a, p) => a + p.unrealizedPnl, 0));

  const [riskPct, setRiskPct] = useState<number>(1.0); // 1%
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [stopLoss, setStopLoss] = useState<string>(() => {
    if (!currentPrice) return '';
    const dist = currentPrice * 0.01;
    return String(Math.round((currentPrice - dist) * 100) / 100);
  });
  const [targetR, setTargetR] = useState<number>(2.5); // 2.5R reward

  const fx = toUsd(symbol);
  const slNum = parseFloat(stopLoss);
  const validStop = Number.isFinite(slNum) && slNum > 0 && currentPrice > 0;

  // Formula: Quantity = (Account Balance * (Risk % / 100)) / (|Current Price - Stop Loss Price| * fx)
  const riskDollar = (equity * (riskPct / 100));
  const priceDistance = validStop ? Math.abs(currentPrice - slNum) : 0;
  const calculatedQty = validStop && priceDistance > 0 ? (riskDollar / (priceDistance * fx)) : 0;

  const targetProfitPrice = validStop
    ? side === 'BUY'
      ? currentPrice + priceDistance * targetR
      : currentPrice - priceDistance * targetR
    : 0;

  const estimatedReward = riskDollar * targetR;

  const handleApply = () => {
    if (calculatedQty > 0 && onApplySize) {
      const formattedQty = Number(calculatedQty.toPrecision(3));
      onApplySize(formattedQty, validStop ? slNum : undefined, validStop ? targetProfitPrice : undefined);
    }
  };

  return (
    <div className="absolute right-3 top-12 z-20 w-80 rounded-[8px] border border-white/[0.08] bg-[#0f0f13]/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-white" />
          <h3 className="text-xs font-semibold text-white">Risk-Bot Position Sizing</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Side Toggle & Risk % presets */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => {
            setSide('BUY');
            if (currentPrice) setStopLoss(String(Math.round((currentPrice * 0.99) * 100) / 100));
          }}
          className={`flex-1 rounded py-1 text-xs font-bold transition ${side === 'BUY' ? 'bg-up text-white' : 'bg-grid text-muted'}`}
        >
          LONG / BUY
        </button>
        <button
          onClick={() => {
            setSide('SELL');
            if (currentPrice) setStopLoss(String(Math.round((currentPrice * 1.01) * 100) / 100));
          }}
          className={`flex-1 rounded py-1 text-xs font-bold transition ${side === 'SELL' ? 'bg-down text-white' : 'bg-grid text-muted'}`}
        >
          SHORT / SELL
        </button>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Account Risk %</span>
          <span className="font-mono text-white">{riskPct}% ({fmtUsd(riskDollar)})</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[0.5, 1.0, 1.5, 2.0].map((pct) => (
            <button
              key={pct}
              onClick={() => setRiskPct(pct)}
              className={`rounded py-1 text-xs font-medium ${riskPct === pct ? 'bg-accent text-white' : 'bg-grid text-muted hover:text-white'}`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Stop Loss Price Input */}
      <div className="mt-3">
        <label className="flex justify-between text-xs text-muted mb-1">
          <span>Stop Loss Price</span>
          <span className="text-[10px] text-accent">Δ {validStop ? fmtPrice(priceDistance, symbol) : '—'}</span>
        </label>
        <input
          type="number"
          step="any"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          placeholder={fmtPrice(currentPrice, symbol)}
          className="num w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-xs text-white placeholder-muted/50 focus:border-accent focus:outline-none"
        />
      </div>

      {/* Reward R-Multiple */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>Target Reward Multiple</span>
        <div className="flex gap-1">
          {[1.5, 2.0, 2.5, 3.0].map((r) => (
            <button
              key={r}
              onClick={() => setTargetR(r)}
              className={`rounded px-1.5 py-0.5 text-[11px] ${targetR === r ? 'bg-grid text-up font-bold' : 'text-muted hover:text-white'}`}
            >
              {r}R
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Card */}
      <div className="mt-3 rounded-lg border border-grid/60 bg-bg/70 p-2.5 text-xs font-mono">
        <div className="flex justify-between text-muted">
          <span>Recommended Qty:</span>
          <span className="font-bold text-white text-sm">
            {calculatedQty > 0 ? fmtQty(calculatedQty) : '0.00'}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-muted">
          <span>Target Exit ({targetR}R):</span>
          <span className="text-up">{validStop ? fmtPrice(targetProfitPrice, symbol) : '—'}</span>
        </div>
        <div className="mt-1 flex justify-between text-muted">
          <span>Max Loss / Gain:</span>
          <span>
            <span className="text-down">-{fmtUsd(riskDollar)}</span> / <span className="text-up">+{fmtUsd(estimatedReward)}</span>
          </span>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleApply}
        disabled={calculatedQty <= 0}
        className="mt-3 w-full rounded-lg bg-accent py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        Push Size to Execution Panel
      </button>
    </div>
  );
}
