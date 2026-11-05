/**
 * Institutional Multi-Market Screener Modal.
 * Live multi-asset market scanner with real-time price updates, volume analysis,
 * RSI momentum signals, and category filtering across Crypto, NSE/BSE, US Equities, and Forex.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fetchScreenerData, type ScreenerItem } from '../../services/screenerService';
import { fmtPct, fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { AssetCategory } from '../../types/terminal';

interface MarketScreenerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PerformanceFilter = 'ALL' | 'GAINERS' | 'TOP_GAINERS' | 'LOSERS' | 'TOP_LOSERS';
type SignalFilter = 'ALL' | 'BULLISH' | 'BEARISH' | 'OVERBOUGHT' | 'OVERSOLD';
type SortField = 'change' | 'rsi' | 'price';

export default function MarketScreenerModal({ isOpen, onClose }: MarketScreenerModalProps) {
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);

  const [category, setCategory] = useState<AssetCategory | 'ALL'>('ALL');
  const [perfFilter, setPerfFilter] = useState<PerformanceFilter>('ALL');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('change');
  const [sortAsc, setSortAsc] = useState(false);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await fetchScreenerData(signal);
      if (!signal?.aborted) {
        setItems(data);
        setLastRefreshed(Date.now());
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const ctl = new AbortController();
    loadData(ctl.signal);
    return () => ctl.abort();
  }, [isOpen]);

  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        // Category filter
        if (category !== 'ALL' && item.category !== category) return false;

        // Search filter
        if (
          search &&
          !item.id.toLowerCase().includes(search.toLowerCase()) &&
          !item.name.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }

        // Performance filter
        if (perfFilter === 'GAINERS' && item.change24h <= 0) return false;
        if (perfFilter === 'TOP_GAINERS' && item.change24h < 3) return false;
        if (perfFilter === 'LOSERS' && item.change24h >= 0) return false;
        if (perfFilter === 'TOP_LOSERS' && item.change24h > -3) return false;

        // Signal filter
        if (signalFilter !== 'ALL' && item.signal !== signalFilter) return false;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'change') diff = b.change24h - a.change24h;
        else if (sortBy === 'rsi') diff = b.rsi - a.rsi;
        else diff = b.price - a.price;
        return sortAsc ? -diff : diff;
      });
  }, [items, category, search, perfFilter, signalFilter, sortBy, sortAsc]);

  if (!isOpen) return null;

  const getSignalBadge = (sig: ScreenerItem['signal']) => {
    switch (sig) {
      case 'BULLISH':
        return 'text-white border-white/40 bg-white/10';
      case 'BEARISH':
        return 'text-zinc-400 border-zinc-600 bg-zinc-900/60';
      case 'OVERBOUGHT':
        return 'text-white border-white font-bold bg-white/15';
      case 'OVERSOLD':
        return 'text-slate-300 border-slate-500 bg-slate-800/40';
      default:
        return 'text-zinc-500 border-zinc-800 bg-black/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] rounded-2xl border border-grid bg-panel p-5 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-grid/60 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Multi-Market Institutional Screener
              </h2>
              <div className="text-[10px] text-slate-400">
                Live Scanner across Crypto, NSE/BSE, US Equities, Forex & Commodities
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                audioHaptics.tick();
                loadData();
              }}
              disabled={loading}
              className="clay-pill px-3 py-1 text-xs text-white hover:text-white flex items-center gap-1.5 transition"
              title="Refresh screener data"
            >
              <svg
                className={`h-3.5 w-3.5 text-white ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={onClose}
              className="clay-btn px-2.5 py-1 text-slate-400 hover:text-white transition"
              title="Close screener (ESC)"
            >
              Close
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col gap-2.5 border-b border-grid/60 py-3 shrink-0">
          {/* Row 1: Asset Category Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'All Markets' },
                  { id: 'CRYPTO', label: 'Crypto' },
                  { id: 'IN_STOCK', label: 'NSE / India' },
                  { id: 'US_STOCK', label: 'US Equities' },
                  { id: 'FOREX', label: 'Forex' },
                  { id: 'COMMODITY', label: 'Commodities' },
                  { id: 'INDEX', label: 'Indices' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setCategory(cat.id as any);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition ${
                    category === cat.id ? 'clay-pill-active' : 'clay-pill text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-grid/60 bg-bg px-3 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/40 w-52"
            />
          </div>

          {/* Row 2: Performance and Signal Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 font-semibold">Change:</span>
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'GAINERS', label: 'Gainers (>0%)' },
                  { id: 'TOP_GAINERS', label: 'Top (>+3%)' },
                  { id: 'LOSERS', label: 'Losers (<0%)' },
                  { id: 'TOP_LOSERS', label: 'Drop (<-3%)' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setPerfFilter(p.id);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    perfFilter === p.id
                      ? 'bg-white text-black font-bold'
                      : 'border border-grid/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <span className="text-zinc-600 ml-1">|</span>
              <span className="text-zinc-500 font-semibold">Signal:</span>
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'BULLISH', label: 'Bullish' },
                  { id: 'BEARISH', label: 'Bearish' },
                  { id: 'OVERBOUGHT', label: 'RSI >70' },
                  { id: 'OVERSOLD', label: 'RSI <30' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setSignalFilter(s.id);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    signalFilter === s.id
                      ? 'bg-white text-black font-bold'
                      : 'border border-grid/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown & Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="rounded border border-grid/60 bg-bg px-2 py-0.5 text-xs text-white focus:outline-none"
              >
                <option value="change">24h Change %</option>
                <option value="rsi">RSI (14)</option>
                <option value="price">Price</option>
              </select>
              <button
                onClick={() => setSortAsc((v) => !v)}
                className="clay-btn px-2 py-0.5 text-[10px] font-bold text-white transition"
                title="Toggle sort direction"
              >
                {sortAsc ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>
        </div>

        {/* Screener Results Table */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-2">
          {items.length === 0 && loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <span className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <span>Fetching live market feeds from exchanges...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-slate-500">
              <span>No instruments match the selected filters.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-panel border-b border-grid text-slate-400 font-semibold text-[11px]">
                <tr>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">24h Change</th>
                  <th className="px-3 py-2 text-right">24h Range</th>
                  <th className="px-3 py-2 text-right">Volume</th>
                  <th className="px-3 py-2 text-center">RSI (14)</th>
                  <th className="px-3 py-2 text-center">Bias</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid/40">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      audioHaptics.tick();
                      setSymbol(item.id);
                      onClose();
                    }}
                    className="hover:bg-white/5 transition cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-white tracking-wide">{item.id}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{item.name}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold border border-grid text-slate-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">
                      {fmtPrice(item.price, item.id)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-bold ${
                        item.change24h >= 0 ? 'text-white' : 'text-zinc-500'
                      }`}
                    >
                      {fmtPct(item.change24h)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[10px] text-zinc-400">
                      <div>H: {fmtPrice(item.high24h, item.id)}</div>
                      <div>L: {fmtPrice(item.low24h, item.id)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                      {item.volume}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded ${
                          item.rsi >= 70
                            ? 'text-white bg-white/20 font-black'
                            : item.rsi <= 30
                            ? 'text-zinc-300 bg-zinc-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.rsi.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSignalBadge(item.signal)}`}>
                        {item.signal}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          audioHaptics.tick();
                          setSymbol(item.id);
                          onClose();
                        }}
                        className="clay-pill-active px-2.5 py-1 text-xs font-bold transition"
                      >
                        Chart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-grid/60 pt-2.5 mt-2 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>
            Displaying {filtered.length} of {items.length} live instruments
          </span>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span>Last updated: {new Date(lastRefreshed).toLocaleTimeString()}</span>
            )}
            <span className="text-zinc-600">|</span>
            <span>Feeds: Binance WS / Yahoo Finance Level-1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
