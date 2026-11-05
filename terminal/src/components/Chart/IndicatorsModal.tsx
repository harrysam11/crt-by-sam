/**
 * TradingView-Style Indicators, Metrics & Strategies Modal.
 * Categorized library with search, favorites, and 1-click active toggles.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { audioHaptics } from '../../utils/notify';

export interface IndicatorConfig {
  id: string;
  name: string;
  category: 'Technicals' | 'Oscillators' | 'Moving Averages' | 'Volume & Volatility';
  shortDesc: string;
  active: boolean;
  isFavorite?: boolean;
}

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: {
    sma: boolean;
    ema: boolean;
    vwap: boolean;
    bbands: boolean;
    rsi: boolean;
    macd?: boolean;
    supertrend?: boolean;
    stochastic?: boolean;
    oi: boolean;
    sessionOhl?: boolean;
  };
  onToggleIndicator: (key: string) => void;
}

const AVAILABLE_INDICATORS: Array<{
  id: string;
  key: string;
  name: string;
  category: 'Technicals' | 'Oscillators' | 'Moving Averages' | 'Volume & Volatility';
  desc: string;
}> = [
  {
    id: 'ind-ema',
    key: 'ema',
    name: 'Exponential Moving Average (EMA 9/21/50/200)',
    category: 'Moving Averages',
    desc: 'Weighted moving average giving higher priority to recent price action.',
  },
  {
    id: 'ind-sma',
    key: 'sma',
    name: 'Simple Moving Average (SMA 20/50/200)',
    category: 'Moving Averages',
    desc: 'Unweighted arithmetic mean of closing prices over a specified period.',
  },
  {
    id: 'ind-vwap',
    key: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    category: 'Moving Averages',
    desc: 'Benchmark line representing total dollar volume divided by total volume.',
  },
  {
    id: 'ind-rsi',
    key: 'rsi',
    name: 'Relative Strength Index (RSI 14)',
    category: 'Oscillators',
    desc: 'Momentum oscillator measuring velocity and magnitude of price moves (0-100).',
  },
  {
    id: 'ind-bbands',
    key: 'bbands',
    name: 'Bollinger Bands (BB 20, 2)',
    category: 'Technicals',
    desc: 'Volatility bands placed above and below a moving average by standard deviation.',
  },
  {
    id: 'ind-supertrend',
    key: 'supertrend',
    name: 'Supertrend (10, 3 ATR)',
    category: 'Technicals',
    desc: 'Trend-following overlay based on Average True Range trailing bands.',
  },
  {
    id: 'ind-stoch',
    key: 'stochastic',
    name: 'Stochastic Oscillator (14, 3, 3)',
    category: 'Oscillators',
    desc: 'Compares a particular closing price to a range of its prices over time.',
  },
  {
    id: 'ind-oi',
    key: 'oi',
    name: 'Open Interest Delta (OI Overlay)',
    category: 'Volume & Volatility',
    desc: 'Net institutional contracts open in futures and options markets.',
  },
  {
    id: 'ind-sohl',
    key: 'sessionOhl',
    name: 'Session Open / High / Low / Close Laser Lines',
    category: 'Technicals',
    desc: 'Institutional key intraday reference levels projected horizontally.',
  },
];

export default function IndicatorsModal({
  isOpen,
  onClose,
  activeIndicators,
  onToggleIndicator,
}: IndicatorsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('crt_ind_favs');
      return stored ? JSON.parse(stored) : ['ind-ema', 'ind-vwap', 'ind-rsi'];
    } catch {
      return ['ind-ema', 'ind-vwap', 'ind-rsi'];
    }
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    audioHaptics.tick();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('crt_ind_favs', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();
    return AVAILABLE_INDICATORS.filter((ind) => {
      const matchesSearch =
        ind.name.toLowerCase().includes(query) ||
        ind.key.toLowerCase().includes(query) ||
        ind.desc.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (selectedCategory === 'Favorites') return favorites.includes(ind.id);
      if (selectedCategory !== 'All' && ind.category !== selectedCategory) return false;
      return true;
    });
  }, [search, selectedCategory, favorites]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono select-none">
      <div className="clay-modal flex h-[560px] w-full max-w-3xl flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid/50 px-5 py-3.5 bg-panel/90">
          <div className="flex items-center gap-2">
            <span className="clay-badge font-bold text-xs tracking-wider">fx</span>
            <h2 className="text-sm font-bold text-white tracking-wide">Indicators, Metrics & Strategies</h2>
          </div>
          <button
            onClick={onClose}
            className="clay-btn h-7 w-7 text-muted hover:text-white"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="border-b border-grid/50 px-5 py-2.5 bg-[#09090d]/60">
          <div className="relative flex items-center">
            <svg className="absolute left-3.5 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search indicators (e.g. EMA, VWAP, RSI, Bollinger Bands)..."
              className="w-full clay-inset py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Two-Pane Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Category Sidebar */}
          <div className="w-52 border-r border-grid/50 bg-[#09090d]/60 p-2 space-y-1 text-xs">
            {['All', 'Favorites', 'Technicals', 'Oscillators', 'Moving Averages', 'Volume & Volatility'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  audioHaptics.tick();
                  setSelectedCategory(cat);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left transition ${
                  selectedCategory === cat
                    ? 'clay-pill-active font-bold'
                    : 'clay-pill text-muted hover:text-white'
                }`}
              >
                <span>{cat}</span>
                {cat === 'Favorites' && (
                  <span className="text-[10px] text-muted">{favorites.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Right Indicator List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredList.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                No indicators found matching &quot;{search}&quot;
              </div>
            ) : (
              filteredList.map((ind) => {
                const isActive = !!(activeIndicators as any)[ind.key];
                const isFav = favorites.includes(ind.id);

                return (
                  <div
                    key={ind.id}
                    onClick={() => {
                      audioHaptics.tick();
                      onToggleIndicator(ind.key);
                    }}
                    className={`flex items-start justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                      isActive
                        ? 'border-white/40 bg-white/10 shadow-clay-card'
                        : 'clay-card border-grid/40 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Star Button */}
                      <button
                        onClick={(e) => toggleFavorite(ind.id, e)}
                        className={`mt-0.5 text-xs transition ${
                          isFav ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg className="h-3.5 w-3.5" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>

                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{ind.name}</span>
                          <span className="clay-badge text-[9px] uppercase">
                            {ind.category}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted leading-relaxed">
                          {ind.desc}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="pl-4">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs font-bold transition ${
                          isActive
                            ? 'clay-pill-active'
                            : 'clay-pill text-muted hover:text-white'
                        }`}
                      >
                        {isActive ? 'Active' : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-grid px-5 py-3 bg-panel/90 text-xs text-slate-400">
          <span>Click any indicator to toggle on/off directly on canvas.</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-1.5 font-bold text-black hover:opacity-90 transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
