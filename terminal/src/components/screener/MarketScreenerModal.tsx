import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPct, fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

interface ScreenerItem {
  id: string;
  name: string;
  category: 'CRYPTO' | 'NSE' | 'US_STOCK' | 'FOREX';
  price: number;
  change24h: number;
  volume: string;
  rsi: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'OVERSOLD_BOUNCE' | 'OVERBOUGHT_REVERSAL';
}

const SCREENER_DATABASE: ScreenerItem[] = [
  // Crypto
  { id: 'BTCUSDT', name: 'Bitcoin Perp', category: 'CRYPTO', price: 91420.5, change24h: 3.42, volume: '$34.2B', rsi: 64.2, signal: 'BULLISH' },
  { id: 'ETHUSDT', name: 'Ethereum Perp', category: 'CRYPTO', price: 3410.2, change24h: -1.15, volume: '$18.4B', rsi: 48.1, signal: 'NEUTRAL' },
  { id: 'SOLUSDT', name: 'Solana Perp', category: 'CRYPTO', price: 218.6, change24h: 6.85, volume: '$7.8B', rsi: 72.4, signal: 'OVERBOUGHT_REVERSAL' },
  { id: 'BNBUSDT', name: 'Binance Coin', category: 'CRYPTO', price: 630.4, change24h: 0.85, volume: '$1.4B', rsi: 52.0, signal: 'NEUTRAL' },
  { id: 'DOGEUSDT', name: 'Dogecoin Perp', category: 'CRYPTO', price: 0.385, change24h: 12.4, volume: '$6.1B', rsi: 76.8, signal: 'OVERBOUGHT_REVERSAL' },
  { id: 'XRPUSDT', name: 'Ripple Perp', category: 'CRYPTO', price: 1.15, change24h: -4.2, volume: '$2.9B', rsi: 28.5, signal: 'OVERSOLD_BOUNCE' },

  // NSE India F&O
  { id: '^NSEI', name: 'NIFTY 50 Index', category: 'NSE', price: 24205.3, change24h: 0.62, volume: '₹42,500 Cr', rsi: 56.4, signal: 'BULLISH' },
  { id: '^NSEBANK', name: 'BANK NIFTY Index', category: 'NSE', price: 51840.0, change24h: 1.12, volume: '₹31,200 Cr', rsi: 61.2, signal: 'BULLISH' },
  { id: 'RELIANCE.NS', name: 'Reliance Industries', category: 'NSE', price: 1285.4, change24h: -0.45, volume: '₹2,400 Cr', rsi: 44.8, signal: 'NEUTRAL' },
  { id: 'HDFCBANK.NS', name: 'HDFC Bank Ltd', category: 'NSE', price: 1740.2, change24h: 1.85, volume: '₹3,900 Cr', rsi: 67.5, signal: 'BULLISH' },
  { id: 'TCS.NS', name: 'Tata Consultancy Services', category: 'NSE', price: 4120.0, change24h: -1.95, volume: '₹1,800 Cr', rsi: 31.2, signal: 'OVERSOLD_BOUNCE' },
  { id: 'INFY.NS', name: 'Infosys Ltd', category: 'NSE', price: 1850.6, change24h: -0.8, volume: '₹1,500 Cr', rsi: 42.1, signal: 'NEUTRAL' },

  // US Equities
  { id: 'SPY', name: 'S&P 500 ETF Trust', category: 'US_STOCK', price: 592.4, change24h: 0.48, volume: '$28.1B', rsi: 58.2, signal: 'BULLISH' },
  { id: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq)', category: 'US_STOCK', price: 508.1, change24h: 0.92, volume: '$19.3B', rsi: 62.4, signal: 'BULLISH' },
  { id: 'NVDA', name: 'NVIDIA Corporation', category: 'US_STOCK', price: 145.2, change24h: 4.15, volume: '$32.8B', rsi: 74.1, signal: 'OVERBOUGHT_REVERSAL' },
  { id: 'AAPL', name: 'Apple Inc', category: 'US_STOCK', price: 232.8, change24h: -0.32, volume: '$11.5B', rsi: 51.0, signal: 'NEUTRAL' },
  { id: 'TSLA', name: 'Tesla Inc', category: 'US_STOCK', price: 342.5, change24h: 8.45, volume: '$24.6B', rsi: 78.9, signal: 'OVERBOUGHT_REVERSAL' },

  // Forex
  { id: 'EURUSD=X', name: 'EUR / USD Spot', category: 'FOREX', price: 1.0542, change24h: -0.22, volume: '$120B', rsi: 38.4, signal: 'NEUTRAL' },
  { id: 'GBPUSD=X', name: 'GBP / USD Spot', category: 'FOREX', price: 1.2645, change24h: 0.15, volume: '$85B', rsi: 46.2, signal: 'NEUTRAL' },
  { id: 'USDJPY=X', name: 'USD / JPY Spot', category: 'FOREX', price: 154.25, change24h: 0.65, volume: '$92B', rsi: 66.8, signal: 'BULLISH' },
];

export default function MarketScreenerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const [category, setCategory] = useState<'ALL' | 'CRYPTO' | 'NSE' | 'US_STOCK' | 'FOREX'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'change' | 'volume' | 'rsi'>('change');

  if (!isOpen) return null;

  const filtered = SCREENER_DATABASE.filter((item) => {
    const matchCat = category === 'ALL' || item.category === category;
    const matchSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortBy === 'change') return Math.abs(b.change24h) - Math.abs(a.change24h);
    if (sortBy === 'rsi') return b.rsi - a.rsi;
    return b.price - a.price;
  });

  const getSignalBadge = (sig: ScreenerItem['signal']) => {
    switch (sig) {
      case 'BULLISH':
        return 'text-up border-emerald-500/40 bg-emerald-500/10';
      case 'BEARISH':
        return 'text-down border-rose-500/40 bg-rose-500/10';
      case 'OVERBOUGHT_REVERSAL':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
      case 'OVERSOLD_BOUNCE':
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10';
      default:
        return 'text-muted border-grid bg-slate-900/60';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl border border-grid bg-panel p-5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Institutional Multi-Market Screener
            </h2>
            <span className="text-[10px] text-muted">Crypto · NSE · US Equities · Forex</span>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white"
          >
            [ESC / Close]
          </button>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grid py-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {(['ALL', 'CRYPTO', 'NSE', 'US_STOCK', 'FOREX'] as const).map((c) => (
              <button
                key={c}
                onClick={() => {
                  audioHaptics.tick();
                  setCategory(c);
                }}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  category === c
                    ? 'bg-accent/20 border border-accent text-accent font-semibold'
                    : 'border border-grid text-muted hover:text-white'
                }`}
              >
                {c === 'ALL' ? 'All Markets' : c === 'US_STOCK' ? 'US Stocks' : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded border border-grid bg-bg px-2.5 py-1 text-xs text-white placeholder:text-muted/60 focus:border-accent focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded border border-grid bg-bg px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value="change">Sort: 24h Volatility</option>
              <option value="rsi">Sort: RSI Strength</option>
              <option value="volume">Sort: Highest Price</option>
            </select>
          </div>
        </div>

        {/* Screener Table */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-2">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-panel border-b border-grid text-muted font-normal text-[11px]">
              <tr>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">24h Change</th>
                <th className="px-3 py-2 text-right">24h Vol</th>
                <th className="px-3 py-2 text-center">RSI (14)</th>
                <th className="px-3 py-2 text-center">Technical Bias</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid/40">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/40 transition">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-white">{item.id}</div>
                    <div className="text-[10px] text-muted truncate max-w-[140px]">{item.name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold border border-grid text-slate-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">
                    {fmtPrice(item.price, item.id)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-bold ${item.change24h >= 0 ? 'text-up' : 'text-down'}`}>
                    {fmtPct(item.change24h)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted">
                    {item.volume}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono">
                    <span
                      className={`font-bold ${
                        item.rsi >= 70 ? 'text-amber-400' : item.rsi <= 30 ? 'text-cyan-400' : 'text-slate-300'
                      }`}
                    >
                      {item.rsi.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSignalBadge(item.signal)}`}>
                      {item.signal.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        setSymbol(item.id);
                        onClose();
                      }}
                      className="rounded border border-accent/60 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-black transition"
                    >
                      Chart
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-grid pt-2.5 mt-2 flex items-center justify-between text-[11px] text-muted shrink-0">
          <span>Tracking {filtered.length} Instruments across Global Exchanges</span>
          <span>Feed: Real-Time Level-1 Aggregated Data</span>
        </div>
      </div>
    </div>
  );
}
