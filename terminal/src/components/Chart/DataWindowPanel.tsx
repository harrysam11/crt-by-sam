/**
 * TradingView-Style Data Window Panel.
 * Slideout inspector panel for live candle metrics and indicator values:
 * - Symbol & Timeframe
 * - Timestamp
 * - Open, High, Low, Close, Change, Range, Volume
 * - Active Indicators Telemetry (SMA, EMA, VWAP, RSI, BB, MACD, etc.)
 * - Drawing Objects Count
 * ZERO EMOJI POLICY strictly enforced.
 */

import React from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { fmtPrice, fmtQty, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

interface DataWindowPanelProps {
  onClose?: () => void;
}

export default function DataWindowPanel({ onClose }: DataWindowPanelProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const candles = useTerminalStore((s) => s.candles);
  const currentPrice = useTerminalStore((s) => s.currentPrice);

  const activeCandle = useDrawingStore((s) => s.activeCandleOhlc);
  const activeIndicators = useDrawingStore((s) => s.activeIndicatorsTelemetry);
  const drawings = useDrawingStore((s) => s.activeSymbolDrawings);

  // Fallback to the latest available candle if activeCandle is null
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  const o = activeCandle ? activeCandle.open : latestCandle ? latestCandle.open : currentPrice;
  const h = activeCandle ? activeCandle.high : latestCandle ? latestCandle.high : currentPrice;
  const l = activeCandle ? activeCandle.low : latestCandle ? latestCandle.low : currentPrice;
  const c = activeCandle ? activeCandle.close : latestCandle ? latestCandle.close : currentPrice;
  const vol = activeCandle?.volume !== undefined ? activeCandle.volume : latestCandle?.volume;

  const diff = c - o;
  const diffPct = o > 0 ? (diff / o) * 100 : 0;
  const range = h - l;
  const isUp = diff >= 0;
  const changeColor = isUp ? 'text-emerald-400' : 'text-rose-400';
  const changeSign = isUp ? '+' : '';

  // Formatted date/time
  const timestamp = activeCandle?.time || latestCandle?.time || Math.floor(Date.now() / 1000);
  const dateStr = new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-panel text-slate-200 select-none font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-grid bg-panel/90">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="font-bold tracking-wider text-slate-100 text-[11px] uppercase">
            Data Window
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onClose();
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Hide Side Pane"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Telemetry Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Symbol & Time Card */}
        <div className="p-2.5 rounded border border-grid/60 bg-[#0c0f17] flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-100 text-[12px]">{labelOf(symbol)}</span>
              <span className="text-[10px] text-slate-400">({timeframe})</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-grid/50">
              BINANCE
            </span>
          </div>
          <div className="text-[10.5px] text-slate-400 font-medium">{dateStr}</div>
        </div>

        {/* Bar OHLC Section */}
        <div className="rounded border border-grid/60 bg-[#0c0f17] overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#141824] text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">
            Price Action & OHLC
          </div>
          <div className="p-2.5 grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold">OPEN</span>
              <span className="font-semibold text-slate-200">{fmtPrice(o, symbol)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold">HIGH</span>
              <span className="font-semibold text-slate-200">{fmtPrice(h, symbol)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold">LOW</span>
              <span className="font-semibold text-slate-200">{fmtPrice(l, symbol)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold">CLOSE</span>
              <span className={`font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtPrice(c, symbol)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold">CHANGE</span>
              <span className={`font-semibold ${changeColor}`}>
                {changeSign}
                {fmtPrice(diff, symbol)} ({changeSign}
                {diffPct.toFixed(2)}%)
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold">RANGE (H - L)</span>
              <span className="font-semibold text-slate-200">
                {fmtPrice(range, symbol)} ({o > 0 ? ((range / o) * 100).toFixed(2) : '0.00'}%)
              </span>
            </div>
            {vol !== undefined && (
              <div className="flex flex-col col-span-2 pt-1 border-t border-grid/40">
                <span className="text-[10px] text-slate-500 font-semibold">VOLUME</span>
                <span className="font-semibold text-slate-200">{fmtQty(vol)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Indicators Telemetry Section */}
        <div className="rounded border border-grid/60 bg-[#0c0f17] overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#141824] flex items-center justify-between text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">
            <span>Indicators Telemetry</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {activeIndicators.length} active
            </span>
          </div>

          <div className="p-2.5 flex flex-col gap-1.5 text-[11px]">
            {activeIndicators.length === 0 ? (
              <div className="text-center py-2 text-slate-500 text-[10.5px]">
                No active indicators running on this chart.
              </div>
            ) : (
              activeIndicators.map((ind) => (
                <div
                  key={ind.id}
                  className="flex items-center justify-between py-1 border-b border-grid/30 last:border-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: ind.color || '#38bdf8' }}
                    />
                    <span className="text-slate-300 font-medium truncate">{ind.name}</span>
                  </div>
                  <span
                    className="font-bold text-slate-100 ml-2"
                    style={{ color: ind.color || '#38bdf8' }}
                  >
                    {ind.value !== undefined && ind.value !== null ? ind.value : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Objects & Drawings Telemetry */}
        <div className="rounded border border-grid/60 bg-[#0c0f17] overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#141824] text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">
            Chart Objects & Drawings
          </div>
          <div className="p-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Total Drawings</span>
            <span className="font-bold text-[#38bdf8]">{drawings.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
