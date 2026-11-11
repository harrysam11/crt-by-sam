/**
 * Institutional TradingView-Grade In-Chart Legend HUD.
 * Renders live symbol details, OHLC metrics, and interactive indicator layers.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import type { Timeframe } from '../../types/terminal';
import { fmtPrice, fmtQty, labelOf } from '../../utils/formatters';

export interface ActiveIndicatorInfo {
  id: string;
  name: string;
  color: string;
  value?: string | number | null;
  visible: boolean;
  onToggleVisible: () => void;
  onOpenSettings?: () => void;
  onRemove: () => void;
}

export interface ChartLegendHUDProps {
  symbol: string;
  timeframe: Timeframe;
  currentOhlc: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  } | null;
  indicators: ActiveIndicatorInfo[];
  onOpenSymbolSearch?: () => void;
}

export default function ChartLegendHUD({
  symbol,
  timeframe,
  currentOhlc,
  indicators,
  onOpenSymbolSearch,
}: ChartLegendHUDProps) {
  const [isIndicatorsCollapsed, setIsIndicatorsCollapsed] = useState(false);

  const diff = currentOhlc ? currentOhlc.close - currentOhlc.open : 0;
  const diffPct = currentOhlc && currentOhlc.open ? ((diff / currentOhlc.open) * 100).toFixed(2) : '0.00';
  const isUp = diff >= 0;
  const diffColor = isUp ? '#089981' : '#f23645';
  const diffSign = isUp ? '+' : '';

  return (
    <div className="pointer-events-auto absolute left-3 top-2.5 z-20 flex flex-col gap-1 select-none font-mono text-[11px] leading-tight max-w-[85%]">
      {/* Symbol & Market Status Header */}
      <div className="flex flex-wrap items-center gap-1.5 bg-panel/75 backdrop-blur-sm px-2 py-1 rounded border border-grid/60 w-fit">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        <button
          onClick={onOpenSymbolSearch}
          className="font-bold text-slate-100 tracking-wide text-xs hover:text-accent flex items-center gap-1 transition cursor-pointer"
          title="Search symbols (/ or Ctrl+K)"
        >
          {labelOf(symbol)}
          <svg className="h-3 w-3 text-slate-400 hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <span className="text-slate-400 font-semibold">{timeframe}</span>
        <span className="text-[10px] text-slate-400 px-1 py-0.2 rounded bg-slate-800/80 border border-grid">BINANCE</span>

        {/* OHLC Bar Metrics */}
        {currentOhlc && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-grid/80 text-[11px]">
            <span className="text-slate-400 font-semibold">O</span>
            <span className={isUp ? 'text-[#089981]' : 'text-[#f23645]'}>{fmtPrice(currentOhlc.open, symbol)}</span>

            <span className="text-slate-400 font-semibold">H</span>
            <span className={isUp ? 'text-[#089981]' : 'text-[#f23645]'}>{fmtPrice(currentOhlc.high, symbol)}</span>

            <span className="text-slate-400 font-semibold">L</span>
            <span className={isUp ? 'text-[#089981]' : 'text-[#f23645]'}>{fmtPrice(currentOhlc.low, symbol)}</span>

            <span className="text-slate-400 font-semibold">C</span>
            <span className={isUp ? 'text-[#089981]' : 'text-[#f23645]'}>{fmtPrice(currentOhlc.close, symbol)}</span>

            <span style={{ color: diffColor }} className="font-bold">
              {diffSign}{fmtPrice(diff, symbol)} ({diffSign}{diffPct}%)
            </span>

            {currentOhlc.volume !== undefined && (
              <>
                <span className="text-slate-400 font-semibold">Vol</span>
                <span className="text-slate-300 font-medium">{fmtQty(currentOhlc.volume)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Interactive Indicators List */}
      {indicators.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsIndicatorsCollapsed((v) => !v)}
              className="text-slate-400 hover:text-slate-200 transition p-0.5"
              title={isIndicatorsCollapsed ? 'Expand indicators' : 'Collapse indicators'}
            >
              <svg
                className={`h-3 w-3 transition-transform ${isIndicatorsCollapsed ? '-rotate-90' : 'rotate-0'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Indicators ({indicators.filter((i) => i.visible).length})
            </span>
          </div>

          {!isIndicatorsCollapsed && (
            <div className="flex flex-col gap-0.5 pl-1">
              {indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-900/80 transition w-fit"
                >
                  {/* Indicator Color Dot */}
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: ind.color, opacity: ind.visible ? 1 : 0.3 }}
                  />

                  {/* Indicator Title & Value */}
                  <span className={`text-[10.5px] font-medium ${ind.visible ? 'text-slate-300' : 'text-slate-400 line-through'}`}>
                    {ind.name}
                  </span>
                  {ind.value !== undefined && ind.value !== null && ind.visible && (
                    <span className="text-[10.5px] font-bold" style={{ color: ind.color }}>
                      {typeof ind.value === 'number' ? fmtPrice(ind.value, symbol) : ind.value}
                    </span>
                  )}

                  {/* Hover Control Strip */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-1 transition">
                    {/* Toggle Visibility Eye */}
                    <button
                      onClick={ind.onToggleVisible}
                      className="text-slate-400 hover:text-white p-0.5"
                      title={ind.visible ? 'Hide indicator' : 'Show indicator'}
                    >
                      {ind.visible ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      )}
                    </button>

                    {/* Settings Cog */}
                    {ind.onOpenSettings && (
                      <button
                        onClick={ind.onOpenSettings}
                        className="text-slate-400 hover:text-white p-0.5"
                        title="Indicator Settings"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    )}

                    {/* Remove Cross */}
                    <button
                      onClick={ind.onRemove}
                      className="text-slate-400 hover:text-rose-400 p-0.5"
                      title="Remove Indicator"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
