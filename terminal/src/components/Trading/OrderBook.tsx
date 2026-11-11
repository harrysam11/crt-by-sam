/**
 * Advanced Order Book (DOM - Depth of Market).
 * Real-time 10-20 level L2 book with cumulative volume depth bars, spread indicator,
 * and fully customizable colors & settings with persistent Save and Reset options.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useState } from 'react';
import { wsManager } from '../../services/websocket';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPrice, fmtQty } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { DepthLevel, DepthSnapshot } from '../../types/terminal';

export interface DomColorSettings {
  bidTextColor: string;
  askTextColor: string;
  bidBarColor: string;
  askBarColor: string;
  depthCount: number;
}

export const DEFAULT_DOM_SETTINGS: DomColorSettings = {
  bidTextColor: '#22c55e',
  askTextColor: '#ef4444',
  bidBarColor: 'rgba(34, 197, 94, 0.15)',
  askBarColor: 'rgba(239, 68, 68, 0.15)',
  depthCount: 12,
};

export default function OrderBook() {
  const symbol = useTerminalStore((s) => s.symbol);
  const price = useTerminalStore((s) => s.currentPrice);
  const [book, setBook] = useState<DepthSnapshot | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [settings, setSettings] = useState<DomColorSettings>(() => {
    try {
      const stored = localStorage.getItem('crt_dom_settings');
      return stored ? { ...DEFAULT_DOM_SETTINGS, ...JSON.parse(stored) } : DEFAULT_DOM_SETTINGS;
    } catch {
      return DEFAULT_DOM_SETTINGS;
    }
  });

  const updateSettings = (patch: Partial<DomColorSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('crt_dom_settings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetSettings = () => {
    audioHaptics.tick();
    setSettings(DEFAULT_DOM_SETTINGS);
    try {
      localStorage.setItem('crt_dom_settings', JSON.stringify(DEFAULT_DOM_SETTINGS));
    } catch {}
  };

  useEffect(() => {
    setBook(null);
    return wsManager.onDepth((d) => {
      if (d.symbol === symbol) setBook(d);
    });
  }, [symbol]);

  const count = settings.depthCount || 12;
  const asks = book ? [...book.asks].slice(0, count).reverse() : [];
  const bids = book ? book.bids.slice(0, count) : [];
  const max = Math.max(1, ...asks.map((l) => l.qty), ...bids.map((l) => l.qty));
  const spread = book && book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : 0;

  const row = (l: DepthLevel, side: 'ask' | 'bid') => {
    const isAsk = side === 'ask';
    const barWidth = Math.min(100, (l.qty / max) * 100);

    return (
      <div key={`${side}_${l.price}`} className="relative flex justify-between px-3 py-[2px] hover:bg-white/5 transition-colors">
        <div
          className="absolute inset-y-0 right-0 pointer-events-none transition-all duration-75"
          style={{
            width: `${barWidth}%`,
            backgroundColor: isAsk ? settings.askBarColor : settings.bidBarColor,
          }}
        />
        <span
          className="num relative font-medium text-[11px]"
          style={{ color: isAsk ? settings.askTextColor : settings.bidTextColor }}
        >
          {fmtPrice(l.price)}
        </span>
        <span className="num relative text-zinc-300 text-[11px]">{fmtQty(l.qty)}</span>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-grid/50 px-3 py-1.5 text-muted bg-[#09090d]/60">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white">Price</span>
          <span className="font-semibold text-white">Size</span>
        </div>
        <button
          onClick={() => {
            audioHaptics.tick();
            setShowSettingsModal(true);
          }}
          className="p-1 rounded text-slate-400 hover:text-white transition"
          title="Customize DOM Colors & Settings"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {book ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
          {asks.map((l) => row(l, 'ask'))}
          <div className="num flex items-baseline justify-between border-y border-grid/50 px-3 py-1.5 text-sm text-white bg-white/5 shadow-inner">
            <span className="font-bold text-white text-base tracking-tight">{fmtPrice(price)}</span>
            <span className="text-[10px] text-muted font-normal">Spread: {fmtPrice(spread)}</span>
          </div>
          {bids.map((l) => row(l, 'bid'))}
        </div>
      ) : (
        <div className="p-3 text-muted">Waiting for depth data...</div>
      )}

      {/* DOM Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
          <div className="clay-modal flex h-[400px] w-full max-w-sm flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-grid/50 px-4 py-3 bg-panel">
              <h3 className="font-bold text-white">DOM Colors & Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="clay-btn h-6 w-6 text-muted hover:text-white"
              >
                x
              </button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-grid/50">
                <span className="text-slate-300">Bid (Buy) Text Color</span>
                <input
                  type="color"
                  value={settings.bidTextColor}
                  onChange={(e) => updateSettings({ bidTextColor: e.target.value })}
                  className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-grid/50">
                <span className="text-slate-300">Ask (Sell) Text Color</span>
                <input
                  type="color"
                  value={settings.askTextColor}
                  onChange={(e) => updateSettings({ askTextColor: e.target.value })}
                  className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-grid/50">
                <span className="text-slate-300">Visible Depth Rows</span>
                <select
                  value={settings.depthCount}
                  onChange={(e) => updateSettings({ depthCount: Number(e.target.value) })}
                  className="rounded bg-slate-900 border border-grid px-2 py-1 text-white"
                >
                  <option value={8}>8 Levels</option>
                  <option value={10}>10 Levels</option>
                  <option value={12}>12 Levels</option>
                  <option value={16}>16 Levels</option>
                  <option value={20}>20 Levels</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-grid/50 px-4 py-3 bg-panel">
              <button
                onClick={resetSettings}
                className="text-muted hover:text-white transition underline"
              >
                Reset Defaults
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="clay-pill-active px-4 py-1.5 font-bold"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
