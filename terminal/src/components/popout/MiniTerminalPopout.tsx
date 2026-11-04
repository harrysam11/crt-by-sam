import React, { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { getInstrument } from '../../services/instruments';
import { fmtPnl, fmtPrice, fmtQty, fmtUsd, labelOf, pnlClass } from '../../utils/formatters';

interface MiniTerminalPopoutProps {
  onClose?: () => void;
}

export default function MiniTerminalPopout({ onClose }: MiniTerminalPopoutProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const price = useTerminalStore((s) => s.currentPrice);
  const change = useTerminalStore((s) => s.watchlist[s.symbol]?.change ?? 0);
  const balance = useTerminalStore((s) => s.balance);
  const positions = useTerminalStore((s) => s.positions);
  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const closePosition = useTerminalStore((s) => s.closePosition);

  const [qty, setQty] = useState('0.01');
  const [leverage, setLeverage] = useState(10);
  const [msg, setMsg] = useState<string | null>(null);

  const inst = getInstrument(symbol);
  const pos = positions[symbol];
  const openPnl = pos ? pos.unrealizedPnl : 0;
  const equity = balance + Object.values(positions).reduce((a, p) => a + p.unrealizedPnl, 0);

  const handleOrder = (side: 'BUY' | 'SELL') => {
    const q = parseFloat(qty);
    if (!(q > 0)) {
      setMsg('Invalid quantity');
      return;
    }
    const r = placeOrder({
      symbol,
      side,
      type: 'MARKET',
      qty: q,
      leverage,
    });
    if (r.ok) {
      setMsg(`${side} market order filled`);
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg(r.error || 'Order rejected');
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#0b0e14] text-slate-200 select-none font-mono text-xs p-3">
      {/* Mini Header */}
      <div className="flex items-center justify-between border-b border-grid pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-up animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-white">CRT Mini Terminal</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Symbol Switcher */}
      <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-1">
        {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', '^NSEI', '^NSEBANK', 'EURUSD=X'].map((sym) => (
          <button
            key={sym}
            onClick={() => setSymbol(sym)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
              symbol === sym ? 'bg-accent text-white' : 'bg-grid/60 text-muted hover:text-white'
            }`}
          >
            {labelOf(sym)}
          </button>
        ))}
      </div>

      {/* Live Quote Card */}
      <div className="mt-2.5 rounded-xl border border-grid bg-panel p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-white">{labelOf(symbol)}</span>
          <span className={`text-base font-extrabold ${change >= 0 ? 'text-up' : 'text-down'}`}>
            {fmtPrice(price, symbol)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
          <span>{inst?.name || 'Instrument'}</span>
          <span className={change >= 0 ? 'text-up font-semibold' : 'text-down font-semibold'}>
            {change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`}
          </span>
        </div>
      </div>

      {/* Account Equity & Floating PnL */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-grid bg-panel p-2">
          <span className="text-[10px] text-muted block uppercase">Equity</span>
          <span className="text-xs font-bold text-white mt-0.5 block">{fmtUsd(equity)}</span>
        </div>
        <div className="rounded-lg border border-grid bg-panel p-2">
          <span className="text-[10px] text-muted block uppercase">Active Pos PnL</span>
          <span className={`text-xs font-bold mt-0.5 block ${pnlClass(openPnl)}`}>
            {fmtPnl(openPnl)}
          </span>
        </div>
      </div>

      {/* Active Position Info */}
      {pos && (
        <div className="mt-2.5 rounded-lg border border-accent/40 bg-accent/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white">
              {pos.side} {fmtQty(pos.size)} {labelOf(symbol)}
            </span>
            <span className={`text-xs font-extrabold ${pnlClass(pos.unrealizedPnl)}`}>
              {fmtPnl(pos.unrealizedPnl)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
            <span>Entry: {fmtPrice(pos.entryPrice, symbol)}</span>
            <button
              onClick={() => closePosition(symbol)}
              className="rounded bg-red-600/40 border border-red-500/60 px-2 py-0.5 font-bold text-red-200 hover:bg-red-600/60"
            >
              Flatten Position
            </button>
          </div>
        </div>
      )}

      {/* Quick Order Controls */}
      <div className="mt-3 flex-1 flex flex-col justify-end">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-muted block mb-0.5">Quantity</label>
            <input
              type="text"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded border border-grid bg-bg px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted block mb-0.5">Leverage</label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full rounded border border-grid bg-bg px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
            >
              {[1, 2, 5, 10, 20, 50].map((l) => (
                <option key={l} value={l}>{l}x</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleOrder('BUY')}
            className="rounded-lg bg-up py-2.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
          >
            Market Buy
          </button>
          <button
            onClick={() => handleOrder('SELL')}
            className="rounded-lg bg-down py-2.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
          >
            Market Sell
          </button>
        </div>

        {msg && (
          <div className="mt-2 text-center text-[11px] text-accent animate-fade-in">
            {msg}
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="mt-3 border-t border-grid pt-2 text-[10px] text-muted flex items-center justify-between">
        <span>Feed: Live WebSocket</span>
        <span className="text-emerald-400 font-bold">[SANDBOX MODE]</span>
      </div>
    </div>
  );
}
