import React, { useState } from 'react';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { labelOf } from '../../utils/formatters';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'MED' | 'LOW';
}

const SAMPLE_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Institutional ETF Inflows Surge to $480M as Spot Volatility Tightens',
    source: 'Bloomberg Terminal',
    time: '8m ago',
    sentiment: 'BULLISH',
    impact: 'HIGH',
  },
  {
    id: '2',
    title: 'Options Expiry Approaching: $4.2B Notional Max-Pain Clustered at Key Gamma Flip',
    source: 'Deribit Insights',
    time: '24m ago',
    sentiment: 'NEUTRAL',
    impact: 'HIGH',
  },
  {
    id: '3',
    title: 'Macro Liquidity Injections Signal Broad Risk-On Appetite in Global Markets',
    source: 'Reuters Financial',
    time: '1h ago',
    sentiment: 'BULLISH',
    impact: 'MED',
  },
  {
    id: '4',
    title: 'Federal Reserve Comments Hint at Neutral Real Rates into Quarter End',
    source: 'CNBC Markets',
    time: '2h ago',
    sentiment: 'BEARISH',
    impact: 'MED',
  },
];

const MONTH_SEASONALITY = [
  { month: 'Jan', winRate: 52 },
  { month: 'Feb', winRate: 64 },
  { month: 'Mar', winRate: 48 },
  { month: 'Apr', winRate: 58 },
  { month: 'May', winRate: 45 },
  { month: 'Jun', winRate: 41 },
  { month: 'Jul', winRate: 60 },
  { month: 'Aug', winRate: 39 },
  { month: 'Sep', winRate: 32 },
  { month: 'Oct', winRate: 68 },
  { month: 'Nov', winRate: 72 },
  { month: 'Dec', winRate: 55 },
];

export default function AnalyticsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const isAnalyticsVisible = useDerivativesStore((s) => s.isAnalyticsVisible);
  const toggleAnalytics = useDerivativesStore((s) => s.toggleAnalytics);

  const [activeTab, setActiveTab] = useState<'TECHNICALS' | 'SEASONALITY' | 'NEWS'>('TECHNICALS');

  if (!isAnalyticsVisible) return null;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-grid bg-panel text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-grid px-3 py-2 bg-bg/50">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-accent" />
          <h3 className="font-bold uppercase tracking-wider text-white">Institutional Analytics</h3>
        </div>
        <button onClick={toggleAnalytics} className="text-muted hover:text-white" aria-label="Close">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-grid bg-bg/30">
        {(['TECHNICALS', 'SEASONALITY', 'NEWS'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-center font-semibold transition ${
              activeTab === tab ? 'border-b-2 border-accent text-white' : 'text-muted hover:text-white'
            }`}
          >
            {tab === 'TECHNICALS' ? 'Technicals' : tab === 'SEASONALITY' ? 'Seasonals' : 'News'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === 'TECHNICALS' && (
          <div className="space-y-4">
            {/* Master Meter Gauge */}
            <div className="rounded-xl border border-grid bg-bg/50 p-4 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted">Summary Gauge</span>
              <div className="my-2 text-lg font-extrabold text-up">STRONG BUY</div>
              <div className="flex h-2 overflow-hidden rounded-full bg-grid">
                <div className="w-[15%] bg-down" />
                <div className="w-[20%] bg-amber-400" />
                <div className="w-[65%] bg-up" />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted font-mono">
                <span>Sell (2)</span>
                <span>Neutral (3)</span>
                <span>Buy (11)</span>
              </div>
            </div>

            {/* Indicator Details */}
            <div className="rounded-xl border border-grid bg-bg/50 p-3">
              <h4 className="text-[11px] font-bold text-white mb-2 uppercase tracking-wider">Oscillators & Trend</h4>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted">RSI (14)</span>
                  <span className="text-amber-300 font-semibold">58.4 (Neutral)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">MACD (12, 26, 9)</span>
                  <span className="text-up font-semibold">+142.5 (Bullish Cross)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">EMA 50 / 200</span>
                  <span className="text-up font-semibold">Golden Cross (Buy)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Bollinger Bands</span>
                  <span className="text-white">Upper Band Expansion</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Pivot Point (R1)</span>
                  <span className="text-white">$96,450</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'SEASONALITY' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-grid bg-bg/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
                  {labelOf(symbol)} Monthly Win Rate
                </h4>
                <span className="text-[10px] text-up font-bold">Oct: 68% | Nov: 72%</span>
              </div>
              <p className="text-[10px] text-muted mb-3">
                Historical monthly probability of positive returns over the past 10 years.
              </p>

              <div className="space-y-1.5 font-mono text-[10px]">
                {MONTH_SEASONALITY.map((m) => {
                  const isGreen = m.winRate >= 50;
                  return (
                    <div key={m.month} className="flex items-center gap-2">
                      <span className="w-7 text-muted">{m.month}</span>
                      <div className="flex-1 h-3 rounded bg-grid overflow-hidden">
                        <div
                          className={`h-full ${isGreen ? 'bg-up' : 'bg-down'}`}
                          style={{ width: `${m.winRate}%` }}
                        />
                      </div>
                      <span className={`w-8 text-right font-bold ${isGreen ? 'text-up' : 'text-down'}`}>
                        {m.winRate}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'NEWS' && (
          <div className="space-y-2.5">
            {SAMPLE_NEWS.map((n) => {
              const isBull = n.sentiment === 'BULLISH';
              const isBear = n.sentiment === 'BEARISH';
              return (
                <div key={n.id} className="rounded-xl border border-grid bg-bg/50 p-2.5 hover:bg-grid/20 transition">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-muted">{n.source} • {n.time}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                        isBull
                          ? 'bg-up/20 text-up'
                          : isBear
                          ? 'bg-down/20 text-down'
                          : 'bg-grid text-muted'
                      }`}
                    >
                      {n.sentiment}
                    </span>
                  </div>
                  <h4 className="mt-1 text-xs font-medium text-white leading-snug">
                    {n.title}
                  </h4>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
