/**
 * TradingView-Style Interactive In-Chart Trading & Order Drag Overlay.
 * Supports:
 * - Active position lines with live PnL, close (x), reverse, break-even buttons
 * - Draggable Stop Loss (SL) and Take Profit (TP) order lines and badges
 * - Draggable pending Limit and Stop orders (drag to modify order price)
 * - Draggable active price alerts (drag to modify alert level)
 * - In-chart 1-click Quick Trade execution pill (Instant Buy / Sell)
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { ISeriesApi, SeriesType, IChartApi } from 'lightweight-charts';
import { useTerminalStore, positionPnlUsd } from '../../store/useTerminalStore';
import { fmtPrice, fmtQty, fmtUsd, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import { toUsd } from '../../services/instruments';
import type { Order } from '../../types/terminal';

interface ChartTradingOverlayProps {
  symbol: string;
  seriesApi: ISeriesApi<SeriesType> | null;
  chartApi?: IChartApi | null;
  showPositions?: boolean;
  showOrders?: boolean;
  showQuickTrade?: boolean;
}

type DragTarget =
  | { type: 'ORDER'; id: string; initialPrice: number }
  | { type: 'ALERT'; id: string; initialPrice: number }
  | { type: 'SL'; symbol: string; initialPrice: number }
  | { type: 'TP'; symbol: string; initialPrice: number }
  | { type: 'POSITION_DRAG'; symbol: string; isLong: boolean; entryPrice: number };

export default function ChartTradingOverlay({
  symbol,
  seriesApi,
  chartApi,
  showPositions = true,
  showOrders = true,
  showQuickTrade = true,
}: ChartTradingOverlayProps) {
  const currentPrice = useTerminalStore((s) => s.prices[symbol] ?? (s.symbol === symbol ? s.currentPrice : 0));
  const position = useTerminalStore((s) => s.positions[symbol]);
  const orders = useTerminalStore((s) => s.orders.filter((o) => o.status === 'PENDING' && o.symbol === symbol));
  const alerts = useTerminalStore((s) => s.alerts.filter((a) => !a.triggered && a.active !== false && a.symbol === symbol));

  // Dynamic price scale width to keep chart order lines and badges cleanly separated from the price scale axis
  const [priceScaleWidth, setPriceScaleWidth] = useState(68);

  useEffect(() => {
    if (!chartApi) return;
    const updateWidth = () => {
      try {
        const w = chartApi.priceScale('right')?.width();
        if (w && w > 0) setPriceScaleWidth(w);
      } catch {
        // fallback
      }
    };
    updateWidth();
    const interval = setInterval(updateWidth, 500);
    return () => clearInterval(interval);
  }, [chartApi]);

  const closePosition = useTerminalStore((s) => s.closePosition);
  const flipPosition = useTerminalStore((s) => s.flipPosition);
  const snapBreakEven = useTerminalStore((s) => s.snapBreakEven);
  const cancelOrder = useTerminalStore((s) => s.cancelOrder);
  const removeAlert = useTerminalStore((s) => s.removeAlert);
  const updateOrderPrice = useTerminalStore((s) => s.updateOrderPrice);
  const updatePositionBrackets = useTerminalStore((s) => s.updatePositionBrackets);
  const updateAlertPrice = useTerminalStore((s) => s.updateAlertPrice);
  const placeOrder = useTerminalStore((s) => s.placeOrder);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [dragCurrentPrice, setDragCurrentPrice] = useState<number | null>(null);
  const [quickQty, setQuickQty] = useState('0.1');
  const [isQuickTradeCollapsed, setIsQuickTradeCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isPosActionsOpen, setIsPosActionsOpen] = useState(false);
  const [isPosHovered, setIsPosHovered] = useState(false);

  // Horizontal position badge movable offset state
  const [badgeRightOffset, setBadgeRightOffset] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('crt_pos_badge_offset');
      return stored ? Math.max(0, parseInt(stored, 10) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [isDraggingBadgeX, setIsDraggingBadgeX] = useState(false);
  const dragStartXRef = useRef<{ startX: number; initialRight: number } | null>(null);

  // Mouse drag tracking listener (vertical for TP/SL/orders, horizontal for badge positioning)
  useEffect(() => {
    if (!dragTarget && !isDraggingBadgeX) return;

    const onMouseMove = (e: MouseEvent) => {
      // Horizontal badge dragging along the price line
      if (isDraggingBadgeX && dragStartXRef.current) {
        const deltaX = dragStartXRef.current.startX - e.clientX;
        const maxOffset = Math.max(0, (containerRef.current?.clientWidth || 800) - 260);
        const newRight = Math.max(0, Math.min(maxOffset, dragStartXRef.current.initialRight + deltaX));
        setBadgeRightOffset(newRight);
        return;
      }

      if (!containerRef.current || !seriesApi || !dragTarget) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const price = seriesApi.coordinateToPrice(relativeY);
      if (price !== null && Number.isFinite(price) && price > 0) {
        setDragCurrentPrice(price);
      }
    };

    const onMouseUp = () => {
      if (isDraggingBadgeX) {
        setIsDraggingBadgeX(false);
        if (dragStartXRef.current) {
          try {
            localStorage.setItem('crt_pos_badge_offset', String(badgeRightOffset));
          } catch {}
        }
        dragStartXRef.current = null;
      }

      if (dragTarget && dragCurrentPrice !== null) {
        audioHaptics.tick();
        const roundedPrice = +dragCurrentPrice.toFixed(4);
        if (dragTarget.type === 'ORDER') {
          updateOrderPrice(dragTarget.id, roundedPrice);
        } else if (dragTarget.type === 'ALERT') {
          updateAlertPrice(dragTarget.id, roundedPrice);
        } else if (dragTarget.type === 'SL') {
          updatePositionBrackets(dragTarget.symbol, roundedPrice, undefined);
        } else if (dragTarget.type === 'TP') {
          updatePositionBrackets(dragTarget.symbol, undefined, roundedPrice);
        } else if (dragTarget.type === 'POSITION_DRAG') {
          const isUp = roundedPrice > dragTarget.entryPrice;
          const isTp = dragTarget.isLong ? isUp : !isUp;
          if (isTp) {
            updatePositionBrackets(dragTarget.symbol, undefined, roundedPrice);
          } else {
            updatePositionBrackets(dragTarget.symbol, roundedPrice, undefined);
          }
        }
      }
      setDragTarget(null);
      setDragCurrentPrice(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragTarget, isDraggingBadgeX, dragCurrentPrice, badgeRightOffset, seriesApi, updateOrderPrice, updateAlertPrice, updatePositionBrackets]);

  if (!seriesApi) return null;

  // Calculate live position PnL
  const posPnl = position ? positionPnlUsd(position, currentPrice || position.entryPrice) : 0;
  const isPosProfit = posPnl >= 0;

  // Find existing SL and TP orders for current position
  const slOrder = orders.find((o) => o.type === 'STOP_LOSS');
  const tpOrder = orders.find((o) => o.type === 'TAKE_PROFIT');
  const otherOrders = orders.filter((o) => o.type !== 'STOP_LOSS' && o.type !== 'TAKE_PROFIT');

  // Quick Trade handler
  const handleQuickTrade = (side: 'BUY' | 'SELL') => {
    audioHaptics.tick();
    const qtyNum = parseFloat(quickQty);
    if (!qtyNum || qtyNum <= 0) return;
    placeOrder({
      symbol,
      side,
      type: 'MARKET',
      qty: qtyNum,
      leverage: 10,
    });
  };

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono select-none"
    >
      {/* 1. In-Chart 1-Click Quick Trade Buttons (Top Left on desktop, Top Right on mobile) */}
      {showQuickTrade && (
        <div className="pointer-events-auto absolute top-2 right-16 md:top-14 md:left-3 md:right-auto z-30 flex items-center gap-1 clay-card px-2 py-1 bg-[#09090d]/85 backdrop-blur-md border border-white/5 shadow-lg w-fit max-w-fit rounded-lg">
          {isQuickTradeCollapsed ? (
            <button
              onClick={() => setIsQuickTradeCollapsed(false)}
              className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white px-1.5 py-0.5 rounded transition"
              title="Expand Quick Trade"
            >
              <span className="font-bold text-emerald-400">B</span>
              <span className="text-slate-500">/</span>
              <span className="font-bold text-rose-400">S</span>
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <>
              {/* Instant SELL Button */}
              <button
                onClick={() => handleQuickTrade('SELL')}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white transition"
                title="Instant Market SELL"
              >
                SELL {currentPrice ? fmtPrice(currentPrice, symbol) : ''}
              </button>

              {/* Quantity Input */}
              <input
                type="text"
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
                className="clay-inset w-12 px-1 py-0.5 text-center text-[10px] text-white focus:outline-none"
                title="Order Quantity"
              />

              {/* Instant BUY Button */}
              <button
                onClick={() => handleQuickTrade('BUY')}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white transition"
                title="Instant Market BUY"
              >
                BUY {currentPrice ? fmtPrice(currentPrice, symbol) : ''}
              </button>

              {/* Collapse toggle */}
              <button
                onClick={() => setIsQuickTradeCollapsed(true)}
                className="text-slate-500 hover:text-slate-300 px-1 py-0.5 text-[10px] ml-0.5 transition"
                title="Minimize Quick Trade"
              >
                x
              </button>
            </>
          )}
        </div>
      )}

      {/* 2. Active Position Line & Action Pill */}
      {showPositions && position && (() => {
        const y = seriesApi.priceToCoordinate(position.entryPrice);
        if (y === null || !Number.isFinite(y)) return null;

        const isLong = position.side === 'LONG';
        const color = isLong ? '#10b981' : '#f43f5e';
        const containerH = containerRef.current?.clientHeight ?? 500;
        const isNearBottom = containerH - y < 240;

        return (
          <div
            style={{ top: `${y}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center"
            onMouseEnter={() => setIsPosHovered(true)}
            onMouseLeave={() => setIsPosHovered(false)}
          >
            {/* Position Subtle Guideline (non-intrusive dashed line, unobtrusive for chart analysis) */}
            <div
              className={`h-[1px] flex-1 border-t border-dashed transition-opacity duration-200 ${
                isPosHovered ? 'opacity-70' : 'opacity-20'
              }`}
              style={{ borderColor: color }}
            />

            {/* Position Control Badge (Transparent Frosted Glass, Visible on Hover, Movable along line) */}
            <div
              style={{ marginRight: `${badgeRightOffset}px` }}
              className="relative pointer-events-auto flex items-center"
            >
              <div
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('input') || target.closest('[data-drag-target]')) {
                    return;
                  }
                  e.preventDefault();
                  setIsDraggingBadgeX(true);
                  dragStartXRef.current = { startX: e.clientX, initialRight: badgeRightOffset };
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold select-none transition-all duration-200 border cursor-grab active:cursor-grabbing ${
                  isPosHovered
                    ? 'bg-[#0c0d14]/95 border-opacity-80 shadow-2xl opacity-100 text-white scale-100'
                    : 'bg-[#090b10]/40 backdrop-blur-sm border-opacity-30 opacity-45 hover:opacity-100 text-slate-200 hover:bg-[#0c0d14]/90'
                }`}
                style={{
                  borderColor: color,
                  boxShadow: isPosHovered ? `0 4px 20px ${color}33` : 'none',
                }}
                title="Drag horizontally along line to reposition badge away from candles"
              >
                {/* Horizontal Drag Grip Handle */}
                <div
                  className="flex items-center text-slate-400 hover:text-white cursor-grab active:cursor-grabbing -ml-1 pr-0.5"
                  title="Click and drag horizontally to move badge away from candles"
                >
                  <svg className="h-3 w-3 opacity-60 hover:opacity-100" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 100 4 2 2 0 000-4zM7 8a2 2 0 100 4 2 2 0 000-4zM7 14a2 2 0 100 4 2 2 0 000-4zM13 2a2 2 0 100 4 2 2 0 000-4zM13 8a2 2 0 100 4 2 2 0 000-4zM13 14a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                </div>

                {/* Side + Size */}
                <span className={isLong ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {position.side} {fmtQty(position.size)}
                </span>

                {/* Entry Price */}
                <span className="font-mono text-slate-300">@{fmtPrice(position.entryPrice, symbol)}</span>

                {/* Live PnL */}
                <span className={`px-1.5 py-0.2 rounded font-mono ${
                  isPosProfit ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                }`}>
                  {isPosProfit ? `+${fmtUsd(posPnl)}` : `-${fmtUsd(Math.abs(posPnl))}`}
                </span>

                {/* Drag-to-Set TP / SL Handle */}
                <div
                  data-drag-target="true"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    audioHaptics.tick();
                    setDragTarget({
                      type: 'POSITION_DRAG',
                      symbol,
                      isLong,
                      entryPrice: position.entryPrice,
                    });
                    setDragCurrentPrice(position.entryPrice);
                  }}
                  className="flex items-center gap-1 cursor-ns-resize rounded bg-sky-950/70 hover:bg-sky-900/90 px-1.5 py-0.5 text-[9px] font-semibold text-sky-200 border border-sky-500/40 transition ml-0.5"
                  title={
                    isLong
                      ? "Drag UP for Take Profit (TP) • Drag DOWN for Stop Loss (SL)"
                      : "Drag UP for Stop Loss (SL) • Drag DOWN for Take Profit (TP)"
                  }
                >
                  <svg className="h-2.5 w-2.5 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span>Drag TP/SL</span>
                </div>

                {/* Actions Menu Arrow Trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.tick();
                    setIsPosActionsOpen(!isPosActionsOpen);
                  }}
                  className={`p-1 rounded transition flex items-center justify-center ${
                    isPosActionsOpen ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
                  }`}
                  title={isPosActionsOpen ? "Hide Position Options" : "Show Position Options"}
                >
                  <svg
                    className={`h-3 w-3 transition-transform duration-200 ${
                      isPosActionsOpen
                        ? isNearBottom
                          ? 'rotate-0'
                          : 'rotate-180'
                        : isNearBottom
                        ? 'rotate-180'
                        : 'rotate-0'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={isNearBottom ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>

                {/* Quick Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.error();
                    closePosition(symbol);
                  }}
                  className="bg-white/5 hover:bg-rose-600/80 px-1.5 py-0.2 rounded font-bold text-slate-300 hover:text-white transition ml-0.5"
                  title="Close Position at Market"
                >
                  x
                </button>
              </div>

              {/* Hover Quick Action Chips */}
              {isPosHovered && !isPosActionsOpen && (
                <div className="flex items-center gap-1 ml-1 bg-panel/90 backdrop-blur-md px-1.5 py-0.5 rounded border border-grid/60 shadow-lg animate-fadeIn">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      audioHaptics.tick();
                      snapBreakEven(symbol);
                    }}
                    className="bg-black/40 hover:bg-black px-1.5 py-0.5 rounded text-[9px] font-bold text-cyan-300 border border-cyan-400/30"
                    title="Snap Break-Even"
                  >
                    BE
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      audioHaptics.tick();
                      flipPosition(symbol);
                    }}
                    className="bg-black/40 hover:bg-black px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-300 border border-amber-400/30"
                    title="Reverse Direction"
                  >
                    Rev
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      audioHaptics.tick();
                      useTerminalStore.getState().closePartialPosition(symbol, 0.5);
                    }}
                    className="bg-black/40 hover:bg-black px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-300 border border-white/20"
                    title="Close 50%"
                  >
                    50%
                  </button>
                </div>
              )}

              {/* Floating Position Action Menu Popover (Adaptive Upward/Downward Direction) */}
              {isPosActionsOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute right-0 ${
                    isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                  } flex flex-col gap-1 rounded-lg border border-white/10 bg-[#0c0d14]/95 p-2 shadow-2xl backdrop-blur-md z-50 text-[10px] font-mono whitespace-nowrap min-w-[180px]`}
                >
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider pb-1 border-b border-white/10 flex items-center justify-between">
                    <span>Position Commands</span>
                    <button
                      onClick={() => setIsPosActionsOpen(false)}
                      className="text-slate-400 hover:text-white px-1"
                    >
                      x
                    </button>
                  </div>

                  {/* + SL */}
                  {!slOrder ? (
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        const defaultSl = isLong ? position.entryPrice * 0.99 : position.entryPrice * 1.01;
                        updatePositionBrackets(symbol, +defaultSl.toFixed(4), undefined);
                        setIsPosActionsOpen(false);
                      }}
                      className="flex items-center justify-between px-2 py-1 rounded bg-red-950/70 hover:bg-red-800/80 border border-red-500/40 text-red-200 transition text-left"
                    >
                      <span>+ Stop Loss (SL)</span>
                      <span className="text-[9px] text-red-400 font-bold ml-2">-1.0%</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/40 text-slate-400 text-[9px]">
                      <span>SL Active:</span>
                      <span className="font-mono text-red-300 ml-2">{fmtPrice(slOrder.triggerPrice ?? slOrder.price, symbol)}</span>
                    </div>
                  )}

                  {/* + TP */}
                  {!tpOrder ? (
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        const defaultTp = isLong ? position.entryPrice * 1.02 : position.entryPrice * 0.98;
                        updatePositionBrackets(symbol, undefined, +defaultTp.toFixed(4));
                        setIsPosActionsOpen(false);
                      }}
                      className="flex items-center justify-between px-2 py-1 rounded bg-emerald-950/70 hover:bg-emerald-800/80 border border-emerald-500/40 text-emerald-200 transition text-left"
                    >
                      <span>+ Take Profit (TP)</span>
                      <span className="text-[9px] text-emerald-400 font-bold ml-2">+2.0%</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/40 text-slate-400 text-[9px]">
                      <span>TP Active:</span>
                      <span className="font-mono text-emerald-300 ml-2">{fmtPrice(tpOrder.triggerPrice ?? tpOrder.price, symbol)}</span>
                    </div>
                  )}

                  {/* Snap Break-Even */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      snapBreakEven(symbol);
                      setIsPosActionsOpen(false);
                    }}
                    className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700/80 text-white transition text-left"
                  >
                    <span>Snap Break-Even</span>
                    <span className="text-[9px] text-slate-400 ml-2">BE</span>
                  </button>

                  {/* Reverse Position */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      flipPosition(symbol);
                      setIsPosActionsOpen(false);
                    }}
                    className="flex items-center justify-between px-2 py-1 rounded bg-amber-950/70 hover:bg-amber-800/80 border border-amber-500/40 text-amber-200 transition text-left"
                  >
                    <span>Reverse Direction</span>
                    <span className="text-[9px] text-amber-400 font-bold ml-2">Rev</span>
                  </button>

                  {/* Close Partial 50% */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      useTerminalStore.getState().closePartialPosition(symbol, 0.5);
                      setIsPosActionsOpen(false);
                    }}
                    className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 transition text-left"
                  >
                    <span>Close 50%</span>
                    <span className="text-[9px] text-slate-400 ml-2">Half</span>
                  </button>

                  {/* Close All Market */}
                  <button
                    onClick={() => {
                      audioHaptics.error();
                      closePosition(symbol);
                      setIsPosActionsOpen(false);
                    }}
                    className="flex items-center justify-between px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition text-left mt-0.5"
                  >
                    <span>Close All Market</span>
                    <span>x</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right guideline extension from badge to price scale */}
            {badgeRightOffset > 0 && (
              <div
                style={{ width: `${badgeRightOffset}px`, borderColor: color }}
                className={`h-[1px] border-t border-dashed transition-opacity duration-200 ${
                  isPosHovered ? 'opacity-70' : 'opacity-20'
                }`}
              />
            )}
          </div>
        );
      })()}

      {/* Live Projected Drag TP/SL Line & Floating HUD Badge */}
      {dragTarget?.type === 'POSITION_DRAG' && dragCurrentPrice !== null && position && (() => {
        const isLong = position.side === 'LONG';
        const isUp = dragCurrentPrice > position.entryPrice;
        const isTp = isLong ? isUp : !isUp;
        const dragY = seriesApi.priceToCoordinate(dragCurrentPrice);
        if (dragY === null || !Number.isFinite(dragY)) return null;

        const dist = Math.abs(dragCurrentPrice - position.entryPrice);
        const dollarVal = dist * position.size * toUsd(symbol);
        const pctDist = position.entryPrice > 0 ? ((dist / position.entryPrice) * 100).toFixed(2) : '0.00';
        const bracketColor = isTp ? '#10b981' : '#f43f5e';

        return (
          <div
            style={{ top: `${dragY}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center z-50 pointer-events-none"
          >
            {/* Dashed projection line */}
            <div
              className="h-[1px] flex-1 border-t border-dashed"
              style={{ borderColor: bracketColor }}
            />
            {/* Floating HUD Badge */}
            <div
              className="rounded px-2.5 py-1 text-[10px] font-mono font-bold text-white shadow-2xl border"
              style={{
                backgroundColor: isTp ? 'rgba(16, 185, 129, 0.95)' : 'rgba(244, 63, 94, 0.95)',
                borderColor: isTp ? '#34d399' : '#fb7185',
              }}
            >
              <span>{isTp ? 'Take Profit (TP): ' : 'Stop Loss (SL): '}</span>
              <span>{fmtPrice(dragCurrentPrice, symbol)}</span>
              <span className="ml-1.5 bg-black/40 px-1 py-0.2 rounded text-[9px]">
                {isTp ? `+${fmtUsd(dollarVal)} (+${pctDist}%)` : `-${fmtUsd(dollarVal)} (-${pctDist}%)`}
              </span>
            </div>
          </div>
        );
      })()}

      {/* 3. Stop Loss (SL) Order Line (Draggable) */}
      {showOrders && slOrder && (() => {
        const displayPrice =
          dragTarget?.type === 'SL' && dragCurrentPrice !== null
            ? dragCurrentPrice
            : slOrder.triggerPrice ?? slOrder.price;
        const y = seriesApi.priceToCoordinate(displayPrice);
        if (y === null || !Number.isFinite(y)) return null;

        const isDragging = dragTarget?.type === 'SL';
        const dist = position ? Math.abs(position.entryPrice - displayPrice) : 0;
        const riskUsd = position ? dist * position.size * toUsd(symbol) : 0;
        const pctDist = position && position.entryPrice ? ((dist / position.entryPrice) * 100).toFixed(2) : '0.00';

        return (
          <div
            style={{ top: `${y}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center"
          >
            <div className={`h-[1px] flex-1 border-t ${isDragging ? 'border-solid border-red-400' : 'border-dashed border-red-500/40'}`} />
            
            {/* Live Drag Risk Floating Badge */}
            {isDragging && (
              <div className="absolute right-36 -top-8 rounded bg-black/95 px-2 py-1 text-[10px] font-mono text-white shadow-2xl border border-red-400 z-50">
                <div className="text-red-300 font-bold">SL: {fmtPrice(displayPrice, symbol)}</div>
                <div className="text-slate-300">Risk: -${fmtUsd(riskUsd)} (-{pctDist}%)</div>
              </div>
            )}

            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                audioHaptics.tick();
                setDragTarget({ type: 'SL', symbol, initialPrice: displayPrice });
                setDragCurrentPrice(displayPrice);
              }}
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-lg transition-all ${
                isDragging
                  ? 'scale-105 ring-2 ring-white bg-red-600 text-white opacity-100'
                  : 'bg-red-950/60 backdrop-blur-sm border border-red-500/40 text-red-200 opacity-60 hover:opacity-100 hover:bg-red-900/80'
              }`}
              title="Drag to adjust Stop Loss price"
            >
              <span>SL</span>
              <span className="font-mono">{fmtPrice(displayPrice, symbol)}</span>
              {riskUsd > 0 && <span className="bg-black/40 px-1 rounded text-[9px]">-${fmtUsd(riskUsd)}</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  audioHaptics.tick();
                  cancelOrder(slOrder.id);
                }}
                className="hover:text-black ml-1 text-white font-bold"
                title="Cancel SL"
              >
                x
              </button>
            </div>
          </div>
        );
      })()}

      {/* 4. Take Profit (TP) Order Line (Draggable) */}
      {showOrders && tpOrder && (() => {
        const displayPrice =
          dragTarget?.type === 'TP' && dragCurrentPrice !== null
            ? dragCurrentPrice
            : tpOrder.triggerPrice ?? tpOrder.price;
        const y = seriesApi.priceToCoordinate(displayPrice);
        if (y === null || !Number.isFinite(y)) return null;

        const isDragging = dragTarget?.type === 'TP';
        const dist = position ? Math.abs(displayPrice - position.entryPrice) : 0;
        const rewardUsd = position ? dist * position.size * toUsd(symbol) : 0;
        const pctDist = position && position.entryPrice ? ((dist / position.entryPrice) * 100).toFixed(2) : '0.00';

        return (
          <div
            style={{ top: `${y}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center"
          >
            <div className={`h-[1px] flex-1 border-t ${isDragging ? 'border-solid border-emerald-400' : 'border-dashed border-emerald-500/40'}`} />
            
            {/* Live Drag Reward Floating Badge */}
            {isDragging && (
              <div className="absolute right-36 -top-8 rounded bg-black/95 px-2 py-1 text-[10px] font-mono text-white shadow-2xl border border-emerald-400 z-50">
                <div className="text-emerald-300 font-bold">TP: {fmtPrice(displayPrice, symbol)}</div>
                <div className="text-slate-300">Reward: +${fmtUsd(rewardUsd)} (+{pctDist}%)</div>
              </div>
            )}

            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                audioHaptics.tick();
                setDragTarget({ type: 'TP', symbol, initialPrice: displayPrice });
                setDragCurrentPrice(displayPrice);
              }}
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-lg transition-all ${
                isDragging
                  ? 'scale-105 ring-2 ring-white bg-emerald-600 text-white opacity-100'
                  : 'bg-emerald-950/60 backdrop-blur-sm border border-emerald-500/40 text-emerald-200 opacity-60 hover:opacity-100 hover:bg-emerald-900/80'
              }`}
              title="Drag to adjust Take Profit price"
            >
              <span>TP</span>
              <span className="font-mono">{fmtPrice(displayPrice, symbol)}</span>
              {rewardUsd > 0 && <span className="bg-black/40 px-1 rounded text-[9px]">+{fmtUsd(rewardUsd)}</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  audioHaptics.tick();
                  cancelOrder(tpOrder.id);
                }}
                className="hover:text-black ml-1 text-white font-bold"
                title="Cancel TP"
              >
                x
              </button>
            </div>
          </div>
        );
      })()}

      {/* 5. Pending Limit & Stop Orders (Draggable) */}
      {showOrders && otherOrders.map((o) => {
        const isDragging = dragTarget?.type === 'ORDER' && dragTarget.id === o.id;
        const displayPrice = isDragging && dragCurrentPrice !== null ? dragCurrentPrice : o.price;
        const y = seriesApi.priceToCoordinate(displayPrice);
        if (y === null || !Number.isFinite(y)) return null;

        const isBuy = o.side === 'BUY';
        const color = isBuy ? '#3b82f6' : '#f97316';

        return (
          <div
            key={o.id}
            style={{ top: `${y}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center"
          >
            <div
              className={`h-[1px] flex-1 border-t ${isDragging ? 'border-solid' : 'border-dashed opacity-40'}`}
              style={{ borderColor: color }}
            />
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                audioHaptics.tick();
                setDragTarget({ type: 'ORDER', id: o.id, initialPrice: displayPrice });
                setDragCurrentPrice(displayPrice);
              }}
              style={{
                backgroundColor: isDragging ? color : 'rgba(12, 13, 20, 0.7)',
                borderColor: color,
              }}
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg transition-all border ${
                isDragging ? 'scale-105 ring-2 ring-white opacity-100' : 'backdrop-blur-sm opacity-60 hover:opacity-100'
              }`}
              title="Drag to change Limit Order price"
            >
              <span>{o.side} {o.type} ({fmtQty(o.qty)})</span>
              <span className="font-mono">{fmtPrice(displayPrice, symbol)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  audioHaptics.tick();
                  cancelOrder(o.id);
                }}
                className="hover:text-black ml-1 text-white font-bold"
                title="Cancel Order"
              >
                x
              </button>
            </div>
          </div>
        );
      })}

      {/* 6. Active Price Alerts (Draggable) */}
      {alerts.map((a) => {
        const isDragging = dragTarget?.type === 'ALERT' && dragTarget.id === a.id;
        const displayPrice = isDragging && dragCurrentPrice !== null ? dragCurrentPrice : a.price;
        const y = seriesApi.priceToCoordinate(displayPrice);
        if (y === null || !Number.isFinite(y)) return null;

        return (
          <div
            key={a.id}
            style={{ top: `${y}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center"
          >
            <div className={`h-[1px] flex-1 border-t border-dashed ${isDragging ? 'border-amber-300 border-solid' : 'border-amber-400/80'}`} />
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                audioHaptics.tick();
                setDragTarget({ type: 'ALERT', id: a.id, initialPrice: displayPrice });
                setDragCurrentPrice(displayPrice);
              }}
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-l-lg px-2 py-0.5 text-[10px] font-bold text-black shadow-lg bg-amber-400 transition-transform ${
                isDragging ? 'scale-105 ring-2 ring-white' : 'hover:brightness-110'
              }`}
              title="Drag to adjust Alert price"
            >
              <span>Alert</span>
              <span className="font-mono">{fmtPrice(displayPrice, symbol)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  audioHaptics.tick();
                  removeAlert(a.id);
                }}
                className="hover:text-red-700 ml-1 text-black font-bold"
                title="Delete Alert"
              >
                x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
