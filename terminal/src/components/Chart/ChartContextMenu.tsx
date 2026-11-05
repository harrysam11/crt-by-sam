/**
 * TradingView-Style In-Chart Canvas Right-Click Context Menu.
 * Opens on right-click anywhere on the chart canvas with precise price & time coordinates.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useRef } from 'react';
import { fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

export interface ChartContextMenuPos {
  x: number;
  y: number;
  price: number;
  time?: number;
}

interface ChartContextMenuProps {
  pos: ChartContextMenuPos | null;
  symbol: string;
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
}

export default function ChartContextMenu({
  pos,
  symbol,
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
}: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
  const menuWidth = 240;
  const menuHeight = 360;
  const clampedX = Math.min(pos.x, window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(pos.y, window.innerHeight - menuHeight - 10);

  const formattedPrice = fmtPrice(pos.price, symbol);

  return (
    <div
      ref={menuRef}
      style={{ left: clampedX, top: clampedY }}
      className="fixed z-50 w-60 rounded-lg border border-grid/90 bg-panel/95 py-1.5 shadow-2xl backdrop-blur-md select-none font-mono text-[11px] text-slate-200"
    >
      {/* Price Header */}
      <div className="border-b border-grid/60 px-3 py-1.5 flex items-center justify-between text-muted text-[10px]">
        <span>{symbol}</span>
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
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset chart view</span>
          </div>
          <kbd className="text-[9px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-grid">Alt+R</kbd>
        </button>

        {/* Add Alert */}
        <button
          onClick={() => {
            audioHaptics.tick();
            onAddAlert(pos.price);
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Add alert at {formattedPrice}</span>
          </div>
          <kbd className="text-[9px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-grid">Alt+A</kbd>
        </button>

        {/* Create Limit Order */}
        <button
          onClick={() => {
            audioHaptics.tick();
            onCreateOrder(pos.price);
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
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

      {/* Drawings Section */}
      <div className="py-1">
        <button
          onClick={() => {
            audioHaptics.tick();
            onAddHorizontalLine(pos.price);
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
            </svg>
            <span>Horizontal Line at price</span>
          </div>
          <kbd className="text-[9px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-grid">Alt+H</kbd>
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            onAddHorizontalRay(pos.price);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
        >
          <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h11M9 12a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Horizontal Ray</span>
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenRuler();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
        >
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Measure (Ruler)</span>
        </button>
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
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span>Bar Replay from this bar</span>
          </button>
        )}

        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenIndicators();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
        >
          <span className="font-bold text-accent text-[12px] w-3.5 text-center">fx</span>
          <span>Indicators & Strategies...</span>
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenSettings();
            onClose();
          }}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent/15 hover:text-white transition"
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
