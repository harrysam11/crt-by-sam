import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { audioHaptics } from '../../utils/notify';
import { labelOf, fmtPrice } from '../../utils/formatters';
import {
  calcRSI,
  calcMACD,
  calcEMA,
  calcBollingerBands,
  calcSMA,
} from '../../services/indicators/calculations';

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

import { computeSeasonalsFromCandles, MONTH_NAMES } from '../../services/seasonalsService';

export default function AnalyticsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const candles = useTerminalStore((s) => s.candles);
  const [activeTab, setActiveTab] = useState<'TECHNICALS' | 'SEASONALITY' | 'NEWS'>('TECHNICALS');

  const seasonalsData = useMemo(() => {
    return computeSeasonalsFromCandles(symbol, candles);
  }, [symbol, candles]);

  const technicalData = useMemo(() => {
    if (!candles || candles.length < 20) {
      return null;
    }
    const closes = candles.map((c) => c.close);
    const lastCandle = candles[candles.length - 1];

    // RSI 14
    const rsiArr = calcRSI(closes, 14);
    const rsiVal = rsiArr[rsiArr.length - 1];

    // MACD 12, 26, 9
    const macdData = calcMACD(closes, 12, 26, 9);
    const macdVal = macdData.macd[macdData.macd.length - 1];
    const signalVal = macdData.signal[macdData.signal.length - 1];
    const histVal = macdData.histogram[macdData.histogram.length - 1];

    // EMA 50 & 200
    const ema50Arr = calcEMA(closes, Math.min(50, closes.length));
    const ema200Arr = calcEMA(closes, Math.min(200, closes.length));
    const ema50Val = ema50Arr[ema50Arr.length - 1];
    const ema200Val = ema200Arr[ema200Arr.length - 1];

    // Bollinger Bands 20, 2
    const bbData = calcBollingerBands(closes, 20, 2);
    const bbUpper = bbData.upper[bbData.upper.length - 1];
    const bbLower = bbData.lower[bbData.lower.length - 1];
    const bbMiddle = bbData.middle[bbData.middle.length - 1];

    // SMA 20
    const sma20Arr = calcSMA(closes, 20);
    const sma20Val = sma20Arr[sma20Arr.length - 1];

    // Pivot Points (Classical)
    const pivot = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;
    const r1 = 2 * pivot - lastCandle.low;
    const s1 = 2 * pivot - lastCandle.high;
    const r2 = pivot + (lastCandle.high - lastCandle.low);
    const s2 = pivot - (lastCandle.high - lastCandle.low);

    // Scoring signals: Buy, Neutral, Sell
    let buy = 0;
    let sell = 0;
    let neutral = 0;

    // 1. RSI Signal
    let rsiLabel = 'Neutral';
    let rsiColor = 'text-amber-300';
    if (rsiVal !== null) {
      if (rsiVal > 70) {
        rsiLabel = 'Overbought';
        rsiColor = 'text-down';
        sell++;
      } else if (rsiVal < 30) {
        rsiLabel = 'Oversold';
        rsiColor = 'text-up';
        buy++;
      } else if (rsiVal >= 55) {
        rsiLabel = 'Bullish';
        rsiColor = 'text-up';
        buy++;
      } else if (rsiVal <= 45) {
        rsiLabel = 'Bearish';
        rsiColor = 'text-down';
        sell++;
      } else {
        rsiLabel = 'Neutral';
        rsiColor = 'text-amber-300';
        neutral++;
      }
    }

    // 2. MACD Signal
    let macdLabel = 'Neutral';
    let macdColor = 'text-amber-300';
    if (macdVal !== null && signalVal !== null) {
      if (macdVal > signalVal) {
        macdLabel = histVal !== null && histVal > 0 ? 'Bullish Exp.' : 'Bullish Cross';
        macdColor = 'text-up';
        buy++;
      } else {
        macdLabel = histVal !== null && histVal < 0 ? 'Bearish Exp.' : 'Bearish Cross';
        macdColor = 'text-down';
        sell++;
      }
    }

    // 3. EMA 50 / 200 Cross
    let emaLabel = 'Neutral';
    let emaColor = 'text-amber-300';
    if (ema50Val !== null && ema200Val !== null) {
      if (ema50Val > ema200Val) {
        emaLabel = 'Golden Cross (Bullish)';
        emaColor = 'text-up';
        buy++;
      } else {
        emaLabel = 'Death Cross (Bearish)';
        emaColor = 'text-down';
        sell++;
      }
    }

    // 4. Price vs EMA 50
    if (ema50Val !== null) {
      if (lastCandle.close > ema50Val) buy++;
      else sell++;
    }

    // 5. Price vs BB Middle
    let bbLabel = 'Neutral';
    if (bbUpper !== null && bbLower !== null && bbMiddle !== null) {
      if (lastCandle.close >= bbUpper) {
        bbLabel = 'Upper Expansion';
        buy++;
      } else if (lastCandle.close <= bbLower) {
        bbLabel = 'Lower Compression';
        sell++;
      } else if (lastCandle.close > bbMiddle) {
        bbLabel = 'Above Mid Band';
        buy++;
      } else {
        bbLabel = 'Below Mid Band';
        sell++;
      }
    }

    // 6. Price vs Pivot
    if (lastCandle.close > pivot) buy++;
    else sell++;

    // 7. Price vs SMA 20
    if (sma20Val !== null) {
      if (lastCandle.close > sma20Val) buy++;
      else sell++;
    }

    const total = buy + sell + neutral || 1;
    let gaugeText = 'NEUTRAL';
    let gaugeColor = 'text-amber-400';
    if (buy >= sell + 3) {
      gaugeText = 'STRONG BUY';
      gaugeColor = 'text-up';
    } else if (buy > sell) {
      gaugeText = 'BUY';
      gaugeColor = 'text-up';
    } else if (sell >= buy + 3) {
      gaugeText = 'STRONG SELL';
      gaugeColor = 'text-down';
    } else if (sell > buy) {
      gaugeText = 'SELL';
      gaugeColor = 'text-down';
    }

    const buyPct = Math.round((buy / total) * 100);
    const sellPct = Math.round((sell / total) * 100);
    const neutralPct = Math.max(0, 100 - buyPct - sellPct);

    return {
      lastCandle,
      rsiVal,
      rsiLabel,
      rsiColor,
      macdVal,
      macdLabel,
      macdColor,
      ema50Val,
      ema200Val,
      emaLabel,
      emaColor,
      bbUpper,
      bbLower,
      bbMiddle,
      bbLabel,
      pivot,
      r1,
      s1,
      r2,
      s2,
      buy,
      sell,
      neutral,
      buyPct,
      sellPct,
      neutralPct,
      gaugeText,
      gaugeColor,
    };
  }, [candles]);

  return (
    <div className="flex h-full w-full shrink-0 flex-col bg-panel text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-grid px-3 py-2 bg-bg/50">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-accent" />
          <h3 className="font-bold uppercase tracking-wider text-white">Institutional Analytics</h3>
        </div>
        <button
          onClick={() => {
            audioHaptics.tick();
            useDrawingStore.getState().setActiveRightDrawer(null);
          }}
          className="clay-btn h-7 w-7 text-muted hover:text-white"
          aria-label="Close"
          title="Close Analytics"
        >
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
            onClick={() => {
              audioHaptics.tick();
              setActiveTab(tab);
            }}
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
              <div className={`my-2 text-lg font-extrabold ${technicalData?.gaugeColor || 'text-white'}`}>
                {technicalData?.gaugeText || 'CALCULATING...'}
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-grid">
                <div
                  className="bg-down transition-all duration-300"
                  style={{ width: `${technicalData?.sellPct ?? 0}%` }}
                />
                <div
                  className="bg-amber-400 transition-all duration-300"
                  style={{ width: `${technicalData?.neutralPct ?? 100}%` }}
                />
                <div
                  className="bg-up transition-all duration-300"
                  style={{ width: `${technicalData?.buyPct ?? 0}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted font-mono">
                <span>Sell ({technicalData?.sell ?? 0})</span>
                <span>Neutral ({technicalData?.neutral ?? 0})</span>
                <span>Buy ({technicalData?.buy ?? 0})</span>
              </div>
            </div>

            {/* Indicator Details */}
            <div className="rounded-xl border border-grid bg-bg/50 p-3">
              <h4 className="text-[11px] font-bold text-white mb-2 uppercase tracking-wider">Oscillators & Trend</h4>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-muted">RSI (14)</span>
                  <span className={`font-semibold ${technicalData?.rsiColor || 'text-white'}`}>
                    {technicalData?.rsiVal !== null && technicalData?.rsiVal !== undefined
                      ? `${technicalData.rsiVal.toFixed(1)} (${technicalData.rsiLabel})`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">MACD (12, 26, 9)</span>
                  <span className={`font-semibold ${technicalData?.macdColor || 'text-white'}`}>
                    {technicalData?.macdVal !== null && technicalData?.macdVal !== undefined
                      ? `${technicalData.macdVal >= 0 ? '+' : ''}${technicalData.macdVal.toFixed(1)} (${technicalData.macdLabel})`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">EMA 50 / 200</span>
                  <span className={`font-semibold ${technicalData?.emaColor || 'text-white'}`}>
                    {technicalData?.emaLabel || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Bollinger Bands</span>
                  <span className="text-white font-semibold">
                    {technicalData?.bbLabel || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Pivot Point (R1)</span>
                  <span className="text-white font-semibold">
                    {technicalData?.r1 !== undefined ? fmtPrice(technicalData.r1, symbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Pivot Point (S1)</span>
                  <span className="text-white font-semibold">
                    {technicalData?.s1 !== undefined ? fmtPrice(technicalData.s1, symbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Price reference card */}
            {technicalData?.lastCandle && (
              <div className="rounded-xl border border-grid bg-bg/30 p-2.5 font-mono text-[10px] text-muted space-y-1">
                <div className="flex justify-between">
                  <span>Current Spot</span>
                  <span className="text-white font-bold">{fmtPrice(technicalData.lastCandle.close, symbol)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pivot Center (P)</span>
                  <span className="text-amber-300">{fmtPrice(technicalData.pivot, symbol)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'SEASONALITY' && (
          <div className="space-y-3 font-mono">
            {/* Seasonal Regime Summary Banner */}
            <div className="rounded-xl border border-grid bg-bg/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-muted">Seasonal Tendency Regime</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  EMPIRICAL SAMPLE: {seasonalsData.years.length} YEARS
                </span>
              </div>
              <h4 className="text-xs font-bold text-white mb-1">
                {seasonalsData.summaryHeadline}
              </h4>
              <p className="text-[10px] text-muted leading-relaxed">
                {seasonalsData.summaryDescription}
              </p>
            </div>

            {/* TradingView-Style Multi-Year Composite Seasonal Tendency Chart */}
            <div className="rounded-xl border border-grid bg-bg/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-white">
                  Multi-Year Cumulative Tendency
                </span>
                <span className="text-[9px] text-muted">Jan - Dec Progression</span>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-3 text-[9px] text-muted mb-2">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-full bg-cyan-400" />
                  <span>10Y Trend</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-full bg-indigo-400" />
                  <span>5Y Trend</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-full bg-emerald-400" />
                  <span>Current Year</span>
                </span>
              </div>

              {/* Responsive SVG Tendency Curve */}
              <div className="relative w-full h-32 bg-black/40 rounded border border-grid/40 p-1">
                <svg viewBox="0 0 280 100" className="w-full h-full overflow-visible">
                  {/* Horizontal Gridlines */}
                  <line x1="10" y1="20" x2="270" y2="20" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
                  <line x1="10" y1="50" x2="270" y2="50" stroke="rgba(255,255,255,0.12)" />
                  <line x1="10" y1="80" x2="270" y2="80" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />

                  {/* Baseline 0% indicator */}
                  <text x="12" y="48" fill="#71717a" fontSize="8" fontFamily="monospace">0%</text>

                  {/* 10-Year Composite Trendline (Cyan) */}
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={seasonalsData.tenYearCurvePoints}
                  />

                  {/* 5-Year Composite Trendline (Indigo) */}
                  <polyline
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="3 2"
                    points={seasonalsData.fiveYearCurvePoints}
                  />

                  {/* Current Year Trajectory (Green) */}
                  <polyline
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={seasonalsData.currentYearCurvePoints}
                  />

                  {/* Month X-Axis Ticks */}
                  {MONTH_NAMES.map((m, i) => (
                    <text
                      key={m}
                      x={20 + i * 20}
                      y="96"
                      fill={i === seasonalsData.currentMonthIndex ? '#4ade80' : '#71717a'}
                      fontWeight={i === seasonalsData.currentMonthIndex ? 'bold' : 'normal'}
                      fontSize="7.5"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {m[0]}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            {/* TradingView-Style Monthly Returns Heatmap Matrix */}
            <div className="rounded-xl border border-grid bg-bg/50 p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Monthly Returns Matrix (%)
                </h4>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {labelOf(symbol)} History
                </span>
              </div>

              {/* Scrollable Matrix Table */}
              <div className="overflow-x-auto scrollbar-none border border-grid/40 rounded">
                <table className="w-full text-center border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-white/[0.03] text-muted border-b border-grid/50 font-bold">
                      <th className="py-1 px-1 text-left pl-1.5">Year</th>
                      {MONTH_NAMES.map((m) => (
                        <th key={m} className="py-1 px-0.5">{m}</th>
                      ))}
                      <th className="py-1 px-1 bg-white/[0.02]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonalsData.matrix.map((row) => (
                      <tr key={row.year} className="border-b border-grid/20 hover:bg-white/[0.02]">
                        <td className="py-1 px-1 text-left pl-1.5 font-bold text-slate-300">
                          {row.year}
                        </td>
                        {row.months.map((val, idx) => {
                          const isPos = val !== null && val > 0;
                          const isNeg = val !== null && val < 0;
                          const bg =
                            val === null
                              ? 'text-zinc-600'
                              : val >= 10
                              ? 'bg-emerald-500/25 text-emerald-300 font-bold'
                              : val > 0
                              ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                              : val <= -10
                              ? 'bg-rose-500/25 text-rose-300 font-bold'
                              : 'bg-rose-500/10 text-rose-400 font-medium';
                          return (
                            <td key={idx} className={`py-1 px-0.5 ${bg}`}>
                              {val !== null ? `${isPos ? '+' : ''}${val.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                        <td className={`py-1 px-1 font-bold ${
                          row.yearReturn === null
                            ? 'text-zinc-500'
                            : row.yearReturn >= 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {row.yearReturn !== null ? `${row.yearReturn >= 0 ? '+' : ''}${row.yearReturn.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary Rows (Average and Win Rate) */}
                  <tfoot className="border-t-2 border-grid bg-white/[0.02]">
                    <tr className="font-bold">
                      <td className="py-1 px-1 text-left pl-1.5 text-white">Avg</td>
                      {seasonalsData.monthStats.map((st) => (
                        <td
                          key={st.monthName}
                          className={`py-1 px-0.5 ${st.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {st.avgReturn >= 0 ? '+' : ''}{st.avgReturn.toFixed(1)}%
                        </td>
                      ))}
                      <td className="text-muted">-</td>
                    </tr>
                    <tr className="text-muted font-bold text-[9px]">
                      <td className="py-1 px-1 text-left pl-1.5">Win%</td>
                      {seasonalsData.monthStats.map((st) => (
                        <td
                          key={st.monthName}
                          className={`py-0.5 px-0.5 ${st.winRate >= 50 ? 'text-emerald-300' : 'text-rose-300'}`}
                        >
                          {st.winRate}%
                        </td>
                      ))}
                      <td className="text-muted">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Day of the Week Intraday Tendencies */}
            <div className="rounded-xl border border-grid bg-bg/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Day-of-Week Edge
                </h4>
                <span className="text-[10px] text-muted">Weekly Cycle</span>
              </div>

              <div className="space-y-1.5 text-[10px]">
                {seasonalsData.dayStats.map((d) => {
                  const isBull = d.avgReturn >= 0;
                  return (
                    <div key={d.dayName} className="flex items-center justify-between py-0.5 border-b border-grid/10 last:border-0">
                      <span className="w-8 font-bold text-white">{d.dayName}</span>
                      <span className="text-muted">
                        Win: <b className={d.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{d.winRate}%</b>
                      </span>
                      <span className={`font-semibold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isBull ? '+' : ''}{d.avgReturn.toFixed(2)}%
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        d.bias === 'STRONG BULL'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : d.bias === 'BULLISH'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : d.bias === 'STRONG BEAR'
                          ? 'bg-rose-500/25 text-rose-300'
                          : d.bias === 'BEARISH'
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-white/5 text-muted'
                      }`}>
                        {d.bias}
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
