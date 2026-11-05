/**
 * TradingView-Style Price Scale Hover Action (+) Button and Context Menu.
 * Follows the mouse cursor along the right price scale and allows:
 * - 1-Click Alert Creation at exact price
 * - 1-Click Limit Order at exact price
 * - 1-Click Horizontal Ray / Line at exact price
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ISeriesApi, SeriesType } from 'lightweight-charts';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

interface PriceScaleActionFlyoutProps {
  seriesApi: ISeriesApi<SeriesType> | null;
  containerHeight: number;
  symbol: string;
  onAddHorizontalLine?: (price: number) => void;
}

export default function PriceScaleActionFlyout({
  seriesApi,
  containerHeight,
  symbol,
  onAddHorizontalLine,
}: PriceScaleActionFlyoutProps) {
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ y: number; price: number } | null>(null);

  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const addAlert = useTerminalStore((s) => s.addAlert);
  const currentPrice = useTerminalStore((s) => s.currentPrice);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  if (!seriesApi) return null;

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y >= 10 && y <= containerHeight - 10) {
      setHoverY(y);
    }
  };

  const handleContainerMouseLeave = () => {
    if (!isMenuOpen) {
      setHoverY(null);
    }
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hoverY === null) return;
    const price = seriesApi.coordinateToPrice(hoverY) ?? 0;
    audioHaptics.tick();
    setMenuPos({ y: hoverY, price });
    setIsMenuOpen(true);
  };

  const handleCreateAlert = (price: number) => {
    audioHaptics.tick();
    addAlert(symbol, price, 'PRICE');
    setIsMenuOpen(false);
  };

  const handleCreateLimitOrder = (price: number) => {
    audioHaptics.tick();
    const side = price < currentPrice ? 'BUY' : 'SELL';
    placeOrder({
      symbol,
      side,
      type: 'LIMIT',
      price,
      qty: 0.1,
      leverage: 10,
    });
    setIsMenuOpen(false);
  };

  const handleCreateLine = (price: number) => {
    audioHaptics.tick();
    onAddHorizontalLine?.(price);
    setIsMenuOpen(false);
  };

  const currentHoverPrice = hoverY !== null ? seriesApi.coordinateToPrice(hoverY) : null;

  return (
    <div
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={handleContainerMouseLeave}
      className="pointer-events-auto absolute right-0 top-0 bottom-0 w-14 z-25 font-mono select-none"
    >
      {/* Plus (+) Button Tracking Hover Cursor */}
      {hoverY !== null && !isMenuOpen && currentHoverPrice !== null && (
        <div
          style={{ top: hoverY - 10 }}
          className="absolute right-1 flex items-center gap-1 transition-all"
        >
          <button
            onClick={handlePlusClick}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[#38bdf8] text-black shadow-lg hover:scale-110 active:scale-95 transition font-bold text-xs"
            title={`Quick Action at ${fmtPrice(currentHoverPrice, symbol)}`}
          >
            +
          </button>
        </div>
      )}

      {/* Quick Action Context Menu */}
      {isMenuOpen && menuPos && (
        <div
          ref={menuRef}
          style={{
            top: Math.max(10, Math.min(containerHeight - 120, menuPos.y - 20)),
            right: 28,
          }}
          className="absolute z-50 w-52 rounded-lg border border-grid bg-panel/98 p-1.5 shadow-2xl backdrop-blur-md text-xs divide-y divide-grid/40 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Price Action</span>
            <span className="text-white font-mono">{fmtPrice(menuPos.price, symbol)}</span>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Add Alert */}
            <button
              onClick={() => handleCreateAlert(menuPos.price)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition"
            >
              <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Add Alert at price</span>
            </button>

            {/* Create Limit Order */}
            <button
              onClick={() => handleCreateLimitOrder(menuPos.price)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition"
            >
              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>
                {menuPos.price < currentPrice ? 'Buy Limit (0.1)' : 'Sell Limit (0.1)'}
              </span>
            </button>

            {/* Draw Horizontal Line */}
            <button
              onClick={() => handleCreateLine(menuPos.price)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition"
            >
              <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              <span>Draw Horizontal Ray</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
