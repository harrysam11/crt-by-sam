/**
 * TradingView-Style In-Chart Canvas Right-Click Context Menu.
 * Opens on right-click anywhere on the chart canvas with precise price & time coordinates.
 * Includes Price Scale modes (Normal, Log, Percentage), Chart Styles, Drawing controls, and settings.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useRef, useState } from 'react';
import { fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { ChartStyle, ChartTimezone, PriceScaleType } from '../../types/terminal';
import { useTerminalStore } from '../../store/useTerminalStore';

export interface ChartContextMenuPos {
  x: number;
  y: number;
  price: number;
  time?: number;
}

interface ChartContextMenuProps {
  pos: ChartContextMenuPos | null;
  symbol: string;
  chartStyle: ChartStyle;
  onSetChartStyle: (style: ChartStyle) => void;
  scaleMode: PriceScaleType;
  onSetScaleMode: (mode: PriceScaleType) => void;
  timezone: ChartTimezone;
  onSetTimezone: (tz: ChartTimezone) => void;
  onClose: () => void;
  onResetScale: () => void;
  onAddAlert: (price: number) => void;
  onCreateOrder: (price: number) => void;
  onAddHorizontalLine: (price: number) => void;
  onAddHorizontalRay: (price: number) => void;
  onStartReplayAtTime?: (time: number) => void;
  onOpenRuler: () => void;
  onOpenIndicators: () => void;
  onOpenSettings: () => void;
  onClearDrawings?: () => void;
  onOpenObjectTree?: () => void;
}

export default function ChartContextMenu({
  pos,
  symbol,
  chartStyle,
  onSetChartStyle,
  scaleMode,
  onSetScaleMode,
  timezone,
  onSetTimezone,
  onClose,
  onResetScale,
  onAddAlert,
  onCreateOrder,
  onAddHorizontalLine,
  onAddHorizontalRay,
  onStartReplayAtTime,
  onOpenRuler,
  onOpenIndicators,
  onOpenSettings,
  onClearDrawings,
  onOpenObjectTree,
}: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'STYLE' | 'SCALE' | 'TZ' | null>(null);
  const showPeriodSeparators = useTerminalStore((s) => s.showPeriodSeparators);
  const togglePeriodSeparators = useTerminalStore((s) => s.togglePeriodSeparators);

  // Close on click outside or Escape
  useEffect(() => {
    if (!pos) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pos, onClose]);

  if (!pos) return null;

  // Ensure menu stays within window bounds
  const menuWidth = 250;
  const menuHeight = 440;
  const clampedX = Math.min(pos.x, window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(pos.y, window.innerHeight - menuHeight - 10);
  const submenuOnLeft = clampedX + menuWidth + 215 > window.innerWidth;

  const formattedPrice = fmtPrice(pos.price, symbol);

  return (
    <div
      ref={menuRef}
      style={{ left: clampedX, top: clampedY }}
      className="fixed z-50 w-64 rounded-[8px] border border-grid bg-panel/95 py-1.5 shadow-2xl backdrop-blur-xl select-none font-mono text-[11px] text-white"
    >
      {/* Price Header */}
      <div className="border-b border-grid/60 px-3 py-1.5 flex items-center justify-between text-muted text-[10px]">
        <span className="font-semibold text-white">{symbol}</span>
        <span className="font-bold text-accent">{formattedPrice}</span>
      </div>

      <div className="py-1">
        {/* Reset View */}
        <button
          onClick={() => {
            audioHaptics.tick();
            onResetScale();
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset price scale</span>
          </div>
          <kbd className="text-[9px] text-slate-400 bg-black/60 px-1 py-0.5 rounded border border-white/10">Alt+R</kbd>
        </button>

        {/* Add Alert */}
        <button
          onClick={() => {
            audioHaptics.tick();
            onAddAlert(pos.price);
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Add alert at {formattedPrice}</span>
          </div>
          <kbd className="text-[9px] text-slate-400 bg-black/60 px-1 py-0.5 rounded border border-white/10">Alt+A</kbd>
        </button>

        {/* Create Limit Order */}
        <button
          onClick={() => {
            audioHaptics.tick();
            onCreateOrder(pos.price);
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Trade at {formattedPrice}...</span>
          </div>
        </button>
      </div>

      <div className="my-1 border-t border-grid/60" />

      {/* Scale Mode Switcher */}
      <div className="relative">
        <button
          onMouseEnter={() => setActiveSubmenu('SCALE')}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 18h12l3-18H3z" />
            </svg>
            <span>Scale: {scaleMode}</span>
          </div>
          <span className="text-slate-400">{'>'}</span>
        </button>

        {activeSubmenu === 'SCALE' && (
          <div
            onMouseLeave={() => setActiveSubmenu(null)}
            className={`absolute ${submenuOnLeft ? 'right-full mr-1' : 'left-full ml-1'} top-0 w-48 rounded-[8px] border border-white/[0.08] bg-[#0a0a0f]/95 py-1.5 shadow-2xl backdrop-blur-xl`}
          >
            {(['NORMAL', 'LOGARITHMIC', 'PERCENTAGE'] as PriceScaleType[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  audioHaptics.tick();
                  onSetScaleMode(mode);
                  onClose();
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition ${
                  scaleMode === mode ? 'font-bold text-white bg-white/10' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span>{mode}</span>
                {scaleMode === mode && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart Style Switcher */}
      <div className="relative">
        <button
          onMouseEnter={() => setActiveSubmenu('STYLE')}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Style: {chartStyle}</span>
          </div>
          <span className="text-slate-400">{'>'}</span>
        </button>

        {activeSubmenu === 'STYLE' && (
          <div
            onMouseLeave={() => setActiveSubmenu(null)}
            className={`absolute ${submenuOnLeft ? 'right-full mr-1' : 'left-full ml-1'} top-0 w-52 rounded-[8px] border border-white/[0.08] bg-[#0a0a0f]/95 py-1.5 shadow-2xl backdrop-blur-xl`}
          >
            {(
              [
                { id: 'CANDLE', label: 'Candlestick' },
                { id: 'BAR', label: 'Bar Chart' },
                { id: 'HOLLOW_CANDLE', label: 'Hollow Candles' },
                { id: 'HEIKIN_ASHI', label: 'Heikin-Ashi' },
                { id: 'LINE', label: 'Line Chart' },
                { id: 'AREA', label: 'Area Chart' },
                { id: 'BASELINE', label: 'Baseline Chart' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  audioHaptics.tick();
                  onSetChartStyle(item.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition ${
                  chartStyle === item.id ? 'font-bold text-white bg-white/10' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span>{item.label}</span>
                {chartStyle === item.id && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timezone Switcher */}
      <div className="relative">
        <button
          onMouseEnter={() => setActiveSubmenu('TZ')}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">TZ: {timezone.replace('America/', '').replace('Asia/', '').replace('Europe/', '')}</span>
          </div>
          <span className="text-slate-400">{'>'}</span>
        </button>

        {activeSubmenu === 'TZ' && (
          <div
            onMouseLeave={() => setActiveSubmenu(null)}
            className={`absolute ${submenuOnLeft ? 'right-full mr-1' : 'left-full ml-1'} top-0 w-52 rounded-[8px] border border-grid bg-panel py-1.5 shadow-2xl backdrop-blur-xl`}
          >
            {(
              [
                { id: 'UTC', label: 'UTC (Universal)' },
                { id: 'Asia/Kolkata', label: 'Kolkata (IST +5:30)' },
                { id: 'America/New_York', label: 'New York (EDT/EST)' },
                { id: 'Europe/London', label: 'London (BST/GMT)' },
                { id: 'Asia/Tokyo', label: 'Tokyo (JST +9:00)' },
                { id: 'Asia/Hong_Kong', label: 'Hong Kong (HKT +8:00)' },
              ] as const
            ).map((tz) => (
              <button
                key={tz.id}
                onClick={() => {
                  audioHaptics.tick();
                  onSetTimezone(tz.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition ${
                  timezone === tz.id ? 'font-bold text-white bg-white/10' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span>{tz.label}</span>
                {timezone === tz.id && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Period Separators Toggle */}
      <button
        onClick={() => {
          audioHaptics.tick();
          togglePeriodSeparators();
          onClose();
        }}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Period separators</span>
        </div>
        {showPeriodSeparators && (
          <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="my-1 border-t border-grid/60" />

      {/* Drawings Section */}
      <div className="py-1">
        <button
          onClick={() => {
            audioHaptics.tick();
            onAddHorizontalLine(pos.price);
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
            </svg>
            <span>Horizontal line at price</span>
          </div>
          <kbd className="text-[9px] text-slate-400 bg-black/60 px-1 py-0.5 rounded border border-white/10">Alt+H</kbd>
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            onAddHorizontalRay(pos.price);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h11M9 12a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Horizontal ray</span>
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenRuler();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Measure tool</span>
        </button>

        {onClearDrawings && (
          <button
            onClick={() => {
              audioHaptics.tick();
              onClearDrawings();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-400 hover:bg-red-500/10 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Remove all drawings</span>
          </button>
        )}
      </div>

      <div className="my-1 border-t border-grid/60" />

      {/* Analysis & Tools */}
      <div className="py-1">
        {pos.time && onStartReplayAtTime && (
          <button
            onClick={() => {
              audioHaptics.tick();
              onStartReplayAtTime(pos.time!);
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span>Bar replay from here</span>
          </button>
        )}

        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenIndicators();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <span className="font-bold text-accent text-[12px] w-3.5 text-center">fx</span>
          <span>Indicators & metrics...</span>
        </button>

        {onOpenObjectTree && (
          <button
            onClick={() => {
              audioHaptics.tick();
              onOpenObjectTree();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Object tree & drawings...</span>
          </button>
        )}

        <button
          onClick={() => {
            audioHaptics.tick();
            if ((window as any).__openChartSkinsModal) {
              (window as any).__openChartSkinsModal();
            }
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Chart skins & wallpapers...</span>
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenSettings();
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/10 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Chart settings...</span>
          </div>
        </button>
      </div>
    </div>
  );
}
