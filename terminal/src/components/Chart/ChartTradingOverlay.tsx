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
}

type DragTarget =
  | { type: 'ORDER'; id: string; initialPrice: number }
  | { type: 'ALERT'; id: string; initialPrice: number }
  | { type: 'SL'; symbol: string; initialPrice: number }
  | { type: 'TP'; symbol: string; initialPrice: number };

export default function ChartTradingOverlay({ symbol, seriesApi, chartApi }: ChartTradingOverlayProps) {
  const currentPrice = useTerminalStore((s) => s.currentPrice);
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
  const [isQuickTradeCollapsed, setIsQuickTradeCollapsed] = useState(false);
  const [isPosActionsOpen, setIsPosActionsOpen] = useState(false);

  // Mouse drag tracking listener
  useEffect(() => {
    if (!dragTarget || !seriesApi || !containerRef.current) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !seriesApi) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const price = seriesApi.coordinateToPrice(relativeY);
      if (price !== null && Number.isFinite(price) && price > 0) {
        setDragCurrentPrice(price);
      }
    };

    const onMouseUp = () => {
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
  }, [dragTarget, dragCurrentPrice, seriesApi, updateOrderPrice, updateAlertPrice, updatePositionBrackets]);

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
      {/* 1. In-Chart 1-Click Quick Trade Buttons (Top Left) */}
      <div className="pointer-events-auto absolute top-14 left-3 z-30 flex items-center gap-1 clay-card px-2 py-1 bg-[#09090d]/85 backdrop-blur-md border border-white/5 shadow-lg">
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

      {/* 2. Active Position Line & Action Pill */}
      {position && (() => {
        const y = seriesApi.priceToCoordinate(position.entryPrice);
        if (y === null || !Number.isFinite(y)) return null;

        const isLong = position.side === 'LONG';
        const color = isLong ? '#10b981' : '#f43f5e';

        return (
          <div
            style={{ top: `${y}px`, right: `${priceScaleWidth}px` }}
            className="absolute left-0 flex items-center"
          >
            {/* Position Horizontal Line */}
            <div
              className="h-[1px] flex-1 border-t border-solid"
              style={{ borderColor: color }}
            />

            {/* Position Control Badge (Compact with Action Menu) */}
            <div className="relative pointer-events-auto">
              <div
                className="flex items-center gap-1.5 rounded-l-lg px-2.5 py-1 text-[10px] font-bold text-white shadow-xl select-none"
                style={{ backgroundColor: color }}
              >
                <span>{position.side} {fmtQty(position.size)}</span>
                <span className="font-mono">@{fmtPrice(position.entryPrice, symbol)}</span>
                <span className="bg-black/40 px-1.5 py-0.2 rounded font-mono">
                  {isPosProfit ? `+${fmtUsd(posPnl)}` : `-${fmtUsd(Math.abs(posPnl))}`}
                </span>

                {/* Actions Menu Trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.tick();
                    setIsPosActionsOpen(!isPosActionsOpen);
                  }}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold transition ${
                    isPosActionsOpen ? 'bg-white text-black' : 'bg-black/30 hover:bg-black/60 text-white'
                  }`}
                  title="Position Commands (SL, TP, BE, Rev, Close)"
                >
                  ...
                </button>

                {/* Quick Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.error();
                    closePosition(symbol);
                  }}
                  className="bg-black/40 hover:bg-black/80 px-1.5 py-0.2 rounded font-bold text-white transition ml-0.5"
                  title="Close Position at Market"
                >
                  x
                </button>
              </div>

              {/* Floating Position Action Menu Popover */}
              {isPosActionsOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 flex flex-col gap-1 rounded-lg border border-white/10 bg-[#0c0d14]/95 p-2 shadow-2xl backdrop-blur-md z-50 text-[10px] font-mono whitespace-nowrap min-w-[170px]"
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
          </div>
        );
      })()}

      {/* 3. Stop Loss (SL) Order Line (Draggable) */}
      {slOrder && (() => {
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
            <div className={`h-[1px] flex-1 border-t ${isDragging ? 'border-solid border-red-400' : 'border-dashed border-red-500'}`} />
            
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
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-l-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-lg bg-red-600 transition-transform ${
                isDragging ? 'scale-105 ring-2 ring-white' : 'hover:brightness-110'
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
      {tpOrder && (() => {
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
            <div className={`h-[1px] flex-1 border-t ${isDragging ? 'border-solid border-emerald-400' : 'border-dashed border-emerald-500'}`} />
            
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
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-l-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-lg bg-emerald-600 transition-transform ${
                isDragging ? 'scale-105 ring-2 ring-white' : 'hover:brightness-110'
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
      {otherOrders.map((o) => {
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
              className={`h-[1px] flex-1 border-t ${isDragging ? 'border-solid' : 'border-dashed'}`}
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
              style={{ backgroundColor: color }}
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-l-lg px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg transition-transform ${
                isDragging ? 'scale-105 ring-2 ring-white' : 'hover:brightness-110'
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
