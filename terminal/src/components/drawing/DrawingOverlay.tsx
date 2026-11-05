/**
 * TradingView-Style Drawing Overlay Layer.
 * Supports Vector Trendlines, Channels, Fibonacci Retracements, Shapes, Annotations,
 * interactive Long/Short Position tools with live R:R and draggable handles,
 * and OHLC Magnet Snapping.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { ToolType, DrawingItem, Point2D, MagnetConfig } from './types';
import type { Candle } from '../../types/terminal';
import { fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import DrawingContextBar from './DrawingContextBar';

interface DrawingOverlayProps {
  symbol: string;
  activeTool: ToolType;
  seriesApi: ISeriesApi<SeriesType> | null;
  chartApi: IChartApi | null;
  candles?: Candle[];
  magnetConfig?: MagnetConfig;
  isLockedAll?: boolean;
  isHiddenAll?: boolean;
  onDrawingsCountChange?: (count: number) => void;
  clearTrigger?: number;
  externalLineTrigger?: { price: number; type: 'LINE' | 'RAY' } | null;
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export default function DrawingOverlay({
  symbol,
  activeTool,
  seriesApi,
  chartApi,
  candles = [],
  magnetConfig = { enabled: false, mode: 'WEAK' },
  isLockedAll = false,
  isHiddenAll = false,
  onDrawingsCountChange,
  clearTrigger,
  externalLineTrigger,
}: DrawingOverlayProps) {
  const [drawings, setDrawings] = useState<DrawingItem[]>(() => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeDrawing, setActiveDrawing] = useState<DrawingItem | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{
    drawingId: string;
    handle: 'target' | 'stop' | 'p1' | 'p2';
  } | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<DrawingItem[][]>(() => [drawings]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const pushState = useCallback((newDrawings: DrawingItem[]) => {
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), newDrawings]);
    setHistoryIdx((prev) => prev + 1);
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      audioHaptics.tick();
      const prev = history[historyIdx - 1];
      setHistoryIdx((idx) => idx - 1);
      setDrawings(prev);
      setSelectedDrawingId(null);
    }
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      audioHaptics.tick();
      const next = history[historyIdx + 1];
      setHistoryIdx((idx) => idx + 1);
      setDrawings(next);
      setSelectedDrawingId(null);
    }
  }, [historyIdx, history]);

  // Global hotkeys (Ctrl+Z to Undo, Ctrl+Y or Ctrl+Shift+Z to Redo)
  useEffect(() => {
    const handleUndoRedo = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, [undo, redo]);

  // Bind global undo/redo handlers for toolbar buttons
  useEffect(() => {
    (window as any).__undoDrawing = undo;
    (window as any).__redoDrawing = redo;
    return () => {
      delete (window as any).__undoDrawing;
      delete (window as any).__redoDrawing;
    };
  }, [undo, redo]);

  const [, setRerenderKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle external line trigger from PriceScaleActionFlyout
  useEffect(() => {
    if (!externalLineTrigger || !seriesApi) return;
    const { price, type } = externalLineTrigger;
    const y = seriesApi.priceToCoordinate(price) ?? 100;
    const newId = `draw_${Date.now()}`;
    const newDrawing: DrawingItem = {
      id: newId,
      type: type === 'LINE' ? 'HORIZONTAL_LINE' : 'HORIZONTAL_RAY',
      p1: { x: 50, y, price },
      color: '#38bdf8',
      lineWidth: 1.5,
    };
    audioHaptics.tick();
    setDrawings((prev) => [...prev, newDrawing]);
    setSelectedDrawingId(newId);
  }, [externalLineTrigger, seriesApi]);

  // Subscribe to timeScale range changes so drawings lock to price and time
  useEffect(() => {
    if (!chartApi) return;
    const timeScale = chartApi.timeScale();
    const handleRangeChange = () => setRerenderKey((k) => k + 1);
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
  }, [chartApi]);

  // Sync count to parent
  useEffect(() => {
    onDrawingsCountChange?.(drawings.length);
    try {
      localStorage.setItem(`crt_drawings_${symbol}`, JSON.stringify(drawings));
    } catch {}
  }, [drawings, symbol, onDrawingsCountChange]);

  // Dynamic coordinate projection helpers (locks drawings to chart candles)
  const getDrawX = useCallback(
    (p: Point2D) => {
      if (chartApi && p.time) {
        const cx = chartApi.timeScale().timeToCoordinate(p.time as any);
        if (cx !== null) return cx;
      }
      return p.x;
    },
    [chartApi]
  );

  const getDrawY = useCallback(
    (p: Point2D) => {
      if (seriesApi && p.price !== undefined) {
        const cy = seriesApi.priceToCoordinate(p.price);
        if (cy !== null) return cy;
      }
      return p.y;
    },
    [seriesApi]
  );

  // Handle clear trigger
  useEffect(() => {
    if (clearTrigger) {
      setDrawings([]);
      pushState([]);
      setSelectedDrawingId(null);
    }
  }, [clearTrigger, pushState]);

  // Magnet snapping helper to snap to nearest OHLC
  const snapPoint = useCallback(
    (rawX: number, rawY: number): Point2D => {
      const rawPrice = seriesApi?.coordinateToPrice(rawY) ?? 0;
      const timeVal = chartApi?.timeScale().coordinateToTime(rawX);
      const curTime = typeof timeVal === 'number' ? timeVal : undefined;

      if (!magnetConfig.enabled || !candles.length || !chartApi || !seriesApi) {
        return { x: rawX, y: rawY, price: rawPrice, time: curTime };
      }

      // Find closest candle by X coordinate
      let closestCandle: Candle | null = null;
      let minXDist = Infinity;
      let snapX = rawX;

      for (const c of candles) {
        const coordX = chartApi.timeScale().timeToCoordinate(c.time as any);
        if (coordX !== null) {
          const dist = Math.abs(coordX - rawX);
          if (dist < minXDist) {
            minXDist = dist;
            closestCandle = c;
            snapX = coordX;
          }
        }
      }

      if (!closestCandle) return { x: rawX, y: rawY, price: rawPrice, time: curTime };

      // Find closest OHLC price point
      const ohlcLevels = [
        { price: closestCandle.high, coord: seriesApi.priceToCoordinate(closestCandle.high) ?? rawY },
        { price: closestCandle.low, coord: seriesApi.priceToCoordinate(closestCandle.low) ?? rawY },
        { price: closestCandle.open, coord: seriesApi.priceToCoordinate(closestCandle.open) ?? rawY },
        { price: closestCandle.close, coord: seriesApi.priceToCoordinate(closestCandle.close) ?? rawY },
      ];

      let closestLevel = ohlcLevels[0];
      let minYDist = Infinity;
      for (const lvl of ohlcLevels) {
        const dist = Math.abs(lvl.coord - rawY);
        if (dist < minYDist) {
          minYDist = dist;
          closestLevel = lvl;
        }
      }

      const totalDist = Math.hypot(snapX - rawX, closestLevel.coord - rawY);
      if (magnetConfig.mode === 'WEAK' && totalDist > 30) {
        return { x: rawX, y: rawY, price: rawPrice, time: curTime ?? closestCandle.time };
      }

      return {
        x: snapX,
        y: closestLevel.coord,
        price: closestLevel.price,
        time: closestCandle.time,
      };
    },
    [magnetConfig, candles, chartApi, seriesApi]
  );

  const isDrawingTool =
    activeTool === 'TRENDLINE' ||
    activeTool === 'RAY' ||
    activeTool === 'HORIZONTAL_LINE' ||
    activeTool === 'HORIZONTAL_RAY' ||
    activeTool === 'VERTICAL_LINE' ||
    activeTool === 'PARALLEL_CHANNEL' ||
    activeTool === 'FIBONACCI' ||
    activeTool === 'RECTANGLE' ||
    activeTool === 'CIRCLE' ||
    activeTool === 'TEXT' ||
    activeTool === 'CALLOUT' ||
    activeTool === 'PRICE_LABEL' ||
    activeTool === 'POSITION_LONG' ||
    activeTool === 'POSITION_SHORT' ||
    activeTool === 'POSITION_TOOL' ||
    activeTool === 'MEASURE_RULER';

  // Keyboard shortcuts (Del/Backspace = delete selected, Esc = deselect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          audioHaptics.tick();
          setDrawings((prev) => prev.filter((d) => d.id !== selectedDrawingId));
          setSelectedDrawingId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedDrawingId(null);
        setActiveDrawing(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seriesApi || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    if (activeTool === 'CURSOR_ERASER') {
      audioHaptics.tick();
      setDrawings((prev) =>
        prev.filter((d) => {
          const dist1 = Math.hypot(d.p1.x - rawX, d.p1.y - rawY);
          const dist2 = d.p2 ? Math.hypot(d.p2.x - rawX, d.p2.y - rawY) : Infinity;
          return dist1 > 20 && dist2 > 20;
        })
      );
      return;
    }

    if (!isDrawingTool) return;

    audioHaptics.tick();
    const p1 = snapPoint(rawX, rawY);

    if (activeTool === 'HORIZONTAL_LINE') {
      const newDrawing: DrawingItem = {
        id: `draw-${Date.now()}`,
        type: 'HORIZONTAL_LINE',
        p1,
        color: '#f0b90b',
        lineWidth: 1.5,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setSelectedDrawingId(newDrawing.id);
      return;
    }

    if (activeTool === 'HORIZONTAL_RAY') {
      const newDrawing: DrawingItem = {
        id: `draw-${Date.now()}`,
        type: 'HORIZONTAL_RAY',
        p1,
        color: '#38bdf8',
        lineWidth: 1.5,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setSelectedDrawingId(newDrawing.id);
      return;
    }

    if (activeTool === 'VERTICAL_LINE') {
      const newDrawing: DrawingItem = {
        id: `draw-${Date.now()}`,
        type: 'VERTICAL_LINE',
        p1,
        color: '#c084fc',
        lineWidth: 1.5,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setSelectedDrawingId(newDrawing.id);
      return;
    }

    if (activeTool === 'PRICE_LABEL') {
      const newDrawing: DrawingItem = {
        id: `draw-${Date.now()}`,
        type: 'PRICE_LABEL',
        p1,
        color: '#22c55e',
        lineWidth: 1.5,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setSelectedDrawingId(newDrawing.id);
      return;
    }

    if (activeTool === 'TEXT') {
      const textVal = window.prompt('Enter annotation text:', 'Key Level');
      if (textVal) {
        const newDrawing: DrawingItem = {
          id: `draw-${Date.now()}`,
          type: 'TEXT',
          p1,
          text: textVal,
          color: '#ffffff',
          lineWidth: 1,
        };
        setDrawings((prev) => [...prev, newDrawing]);
        setSelectedDrawingId(newDrawing.id);
      }
      return;
    }

    // Two-point drawing setup
    const isLong = activeTool === 'POSITION_LONG';
    const isShort = activeTool === 'POSITION_SHORT';
    const isPos = isLong || isShort || activeTool === 'POSITION_TOOL';

    const color =
      isLong
        ? '#22c55e'
        : isShort
        ? '#ef4444'
        : activeTool === 'FIBONACCI'
        ? '#38bdf8'
        : activeTool === 'RECTANGLE'
        ? '#a855f7'
        : activeTool === 'CIRCLE'
        ? '#ec4899'
        : '#4c8dff';

    const newDrawing: DrawingItem = {
      id: `draw-${Date.now()}`,
      type: activeTool,
      p1,
      p2: { ...p1 },
      color,
      lineWidth: 1.5,
      entryPrice: p1.price,
      targetPrice: isLong ? p1.price * 1.02 : isShort ? p1.price * 0.98 : undefined,
      stopPrice: isLong ? p1.price * 0.99 : isShort ? p1.price * 1.01 : undefined,
      riskReward: isPos ? 2.0 : undefined,
    };

    setActiveDrawing(newDrawing);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Handle dragging an existing drawing or position handle
    if (draggingHandle && seriesApi) {
      const snapped = snapPoint(rawX, rawY);
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== draggingHandle.drawingId) return d;
          if (draggingHandle.handle === 'p1') {
            return { ...d, p1: snapped };
          }
          if (draggingHandle.handle === 'p2') {
            return { ...d, p2: snapped };
          }
          if (draggingHandle.handle === 'target') {
            const entry = d.entryPrice ?? d.p1.price;
            const stop = d.stopPrice ?? d.p1.price;
            const rr = Math.abs(snapped.price - entry) / Math.max(0.0001, Math.abs(entry - stop));
            return {
              ...d,
              targetPrice: snapped.price,
              p2: d.p2 ? { ...d.p2, y: rawY, price: snapped.price, time: snapped.time } : undefined,
              riskReward: Number(rr.toFixed(2)),
            };
          }
          if (draggingHandle.handle === 'stop') {
            const entry = d.entryPrice ?? d.p1.price;
            const target = d.targetPrice ?? d.p1.price;
            const rr = Math.abs(target - entry) / Math.max(0.0001, Math.abs(entry - snapped.price));
            return {
              ...d,
              stopPrice: snapped.price,
              riskReward: Number(rr.toFixed(2)),
            };
          }
          return d;
        })
      );
      return;
    }

    if (!activeDrawing || !seriesApi) return;
    const p2 = snapPoint(rawX, rawY);

    // Update live active drawing
    setActiveDrawing((prev) => {
      if (!prev) return null;
      let targetPrice = prev.targetPrice;
      let stopPrice = prev.stopPrice;
      let rr = prev.riskReward;

      if (prev.type === 'POSITION_LONG') {
        targetPrice = p2.price;
        const entry = prev.p1.price;
        const stopDist = Math.abs(targetPrice - entry) * 0.5;
        stopPrice = entry - stopDist;
        rr = 2.0;
      } else if (prev.type === 'POSITION_SHORT') {
        targetPrice = p2.price;
        const entry = prev.p1.price;
        const stopDist = Math.abs(targetPrice - entry) * 0.5;
        stopPrice = entry + stopDist;
        rr = 2.0;
      }

      return {
        ...prev,
        p2,
        targetPrice,
        stopPrice,
        riskReward: rr,
      };
    });
  };

  const handlePointerUp = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
      return;
    }

    if (activeDrawing && activeDrawing.p2) {
      audioHaptics.tick();
      const next = [...drawings, activeDrawing];
      setDrawings(next);
      pushState(next);
      setSelectedDrawingId(activeDrawing.id);
      setActiveDrawing(null);
    }
  };

  const updateDrawing = (id: string, patch: Partial<DrawingItem>) => {
    setDrawings((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, ...patch } : d));
      pushState(next);
      return next;
    });
  };

  const deleteDrawing = (id: string) => {
    audioHaptics.tick();
    const next = drawings.filter((d) => d.id !== id);
    setDrawings(next);
    pushState(next);
    if (selectedDrawingId === id) setSelectedDrawingId(null);
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId) ?? null;
  const allDrawings = isHiddenAll ? [] : activeDrawing ? [...drawings, activeDrawing] : drawings;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute inset-0 z-10 ${
        isDrawingTool
          ? 'cursor-crosshair pointer-events-auto'
          : activeTool === 'CURSOR_ERASER'
          ? 'cursor-not-allowed pointer-events-auto'
          : 'pointer-events-none'
      }`}
    >
      <svg className="h-full w-full pointer-events-none">
        {allDrawings.map((d) => {
          const { p1, p2, color, lineWidth, type, id } = d;
          const isSelected = selectedDrawingId === id;
          const x1 = getDrawX(p1);
          const y1 = getDrawY(p1);
          const x2 = p2 ? getDrawX(p2) : x1;
          const y2 = p2 ? getDrawY(p2) : y1;

          if (type === 'HORIZONTAL_LINE') {
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <line
                  x1="0"
                  y1={y1}
                  x2="100%"
                  y2={y1}
                  stroke={color}
                  strokeWidth={lineWidth}
                  strokeDasharray="4 2"
                />
                <rect x="6" y={y1 - 10} width="84" height="20" rx="3" fill="#1e222d" stroke={isSelected ? '#38bdf8' : 'none'} strokeWidth="1" />
                <text x="10" y={y1 + 4} fill="#ffffff" fontSize="10" fontFamily="monospace">
                  {fmtPrice(p1.price, symbol)}
                </text>
                {isSelected && (
                  <circle
                    cx="50%"
                    cy={y1}
                    r="5"
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="cursor-ns-resize pointer-events-auto"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ drawingId: id, handle: 'p1' });
                    }}
                  />
                )}
              </g>
            );
          }

          if (type === 'HORIZONTAL_RAY') {
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <line x1={x1} y1={y1} x2="100%" y2={y1} stroke={color} strokeWidth={lineWidth} />
                <circle cx={x1} cy={y1} r="3.5" fill={color} />
                <rect x={x1 + 8} y={y1 - 10} width="84" height="20" rx="3" fill="#1e222d" stroke={isSelected ? '#38bdf8' : 'none'} strokeWidth="1" />
                <text x={x1 + 12} y={y1 + 4} fill="#ffffff" fontSize="10" fontFamily="monospace">
                  {fmtPrice(p1.price, symbol)}
                </text>
                {isSelected && (
                  <circle
                    cx={x1}
                    cy={y1}
                    r="5"
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="cursor-move pointer-events-auto"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ drawingId: id, handle: 'p1' });
                    }}
                  />
                )}
              </g>
            );
          }

          if (type === 'VERTICAL_LINE') {
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <line x1={x1} y1="0" x2={x1} y2="100%" stroke={color} strokeWidth={lineWidth} strokeDasharray="4 2" />
                <circle cx={x1} cy={y1} r="3.5" fill={color} />
                {isSelected && (
                  <circle
                    cx={x1}
                    cy="50%"
                    r="5"
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="cursor-ew-resize pointer-events-auto"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ drawingId: id, handle: 'p1' });
                    }}
                  />
                )}
              </g>
            );
          }

          if (type === 'PRICE_LABEL') {
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <circle cx={x1} cy={y1} r="4" fill={color} />
                <rect x={x1 + 8} y={y1 - 12} width="80" height="24" rx="4" fill="#1e222d" stroke={isSelected ? '#38bdf8' : color} strokeWidth="1" />
                <text x={x1 + 12} y={y1 + 4} fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  {fmtPrice(p1.price, symbol)}
                </text>
                {isSelected && (
                  <circle
                    cx={x1}
                    cy={y1}
                    r="5"
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="cursor-move pointer-events-auto"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ drawingId: id, handle: 'p1' });
                    }}
                  />
                )}
              </g>
            );
          }

          if (type === 'TEXT') {
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <rect x={x1 - 4} y={y1 - 16} width={(d.text?.length ?? 8) * 8 + 12} height="22" rx="4" fill="#0b0e14" stroke={isSelected ? '#38bdf8' : '#334155'} strokeWidth="1" />
                <text x={x1 + 2} y={y1 - 1} fill={color} fontSize="12" fontWeight="600" fontFamily="monospace">
                  {d.text ?? ''}
                </text>
                {isSelected && (
                  <circle
                    cx={x1}
                    cy={y1}
                    r="5"
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="cursor-move pointer-events-auto"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ drawingId: id, handle: 'p1' });
                    }}
                  />
                )}
              </g>
            );
          }

          if (!p2) return null;

          if (type === 'TRENDLINE') {
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={lineWidth} />
                <circle cx={x1} cy={y1} r={isSelected ? 4 : 3} fill={isSelected ? '#ffffff' : color} stroke={color} strokeWidth="1.5" />
                <circle cx={x2} cy={y2} r={isSelected ? 4 : 3} fill={isSelected ? '#ffffff' : color} stroke={color} strokeWidth="1.5" />
                {isSelected && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p1' });
                      }}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p2' });
                      }}
                    />
                  </>
                )}
              </g>
            );
          }

          if (type === 'RAY') {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const factor = 100;
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <line x1={x1} y1={y1} x2={x1 + dx * factor} y2={y1 + dy * factor} stroke={color} strokeWidth={lineWidth} />
                <circle cx={x1} cy={y1} r="3" fill={color} />
                <circle cx={x2} cy={y2} r="3" fill={color} />
                {isSelected && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p1' });
                      }}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p2' });
                      }}
                    />
                  </>
                )}
              </g>
            );
          }

          if (type === 'RECTANGLE') {
            const rx = Math.min(x1, x2);
            const ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1);
            const rh = Math.abs(y2 - y1);
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <rect x={rx} y={ry} width={rw} height={rh} fill="rgba(168, 85, 247, 0.15)" stroke={color} strokeWidth={lineWidth} />
                {isSelected && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p1' });
                      }}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p2' });
                      }}
                    />
                  </>
                )}
              </g>
            );
          }

          if (type === 'CIRCLE') {
            const cx = x1;
            const cy = y1;
            const r = Math.hypot(x2 - x1, y2 - y1);
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                <circle cx={cx} cy={cy} r={r} fill="rgba(236, 72, 153, 0.12)" stroke={color} strokeWidth={lineWidth} />
                {isSelected && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p1' });
                      }}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p2' });
                      }}
                    />
                  </>
                )}
              </g>
            );
          }

          if (type === 'FIBONACCI') {
            const deltaY = y2 - y1;
            const deltaPrice = (p2.price ?? 0) - p1.price;
            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                {FIB_LEVELS.map((lvl) => {
                  const yLevel = y1 + deltaY * lvl;
                  const priceLevel = p1.price + deltaPrice * lvl;
                  return (
                    <g key={lvl}>
                      <line
                        x1={Math.min(x1, x2)}
                        y1={yLevel}
                        x2="100%"
                        y2={yLevel}
                        stroke={color}
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.8"
                      />
                      <text x="10" y={yLevel - 3} fill="#94a3b8" fontSize="9" fontFamily="monospace">
                        {(lvl * 100).toFixed(1)}% ({fmtPrice(priceLevel, symbol)})
                      </text>
                    </g>
                  );
                })}
                {isSelected && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p1' });
                      }}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      className="cursor-move pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ drawingId: id, handle: 'p2' });
                      }}
                    />
                  </>
                )}
              </g>
            );
          }

          if (type === 'POSITION_LONG' || type === 'POSITION_SHORT' || type === 'POSITION_TOOL') {
            const isLong = type !== 'POSITION_SHORT';
            const entryPrice = d.entryPrice ?? p1.price;
            const targetPrice = d.targetPrice ?? (isLong ? entryPrice * 1.02 : entryPrice * 0.98);
            const stopPrice = d.stopPrice ?? (isLong ? entryPrice * 0.99 : entryPrice * 1.01);

            const entryY = y1;
            const targetY = seriesApi?.priceToCoordinate(targetPrice) ?? (isLong ? entryY - 60 : entryY + 60);
            const stopY = seriesApi?.priceToCoordinate(stopPrice) ?? (isLong ? entryY + 30 : entryY - 30);

            const rx = Math.min(x1, x2);
            const rw = Math.max(140, Math.abs(x2 - x1));

            const rewardH = Math.abs(targetY - entryY);
            const riskH = Math.abs(stopY - entryY);
            const rewardY = Math.min(entryY, targetY);
            const riskY = Math.min(entryY, stopY);

            const rrRatio = d.riskReward ?? Number((Math.abs(targetPrice - entryPrice) / Math.max(0.0001, Math.abs(entryPrice - stopPrice))).toFixed(2));
            const targetPct = (((targetPrice - entryPrice) / entryPrice) * 100).toFixed(2);
            const stopPct = (((stopPrice - entryPrice) / entryPrice) * 100).toFixed(2);

            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(id);
                }}
                className="pointer-events-auto cursor-pointer"
              >
                {/* Reward Zone Box */}
                <rect
                  x={rx}
                  y={rewardY}
                  width={rw}
                  height={rewardH}
                  fill="rgba(34, 197, 94, 0.20)"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />
                {/* Risk Zone Box */}
                <rect
                  x={rx}
                  y={riskY}
                  width={rw}
                  height={riskH}
                  fill="rgba(239, 68, 68, 0.20)"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                />

                {/* Entry Separator Line */}
                <line x1={rx} y1={entryY} x2={rx + rw} y2={entryY} stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />

                {/* Target Label */}
                <text x={rx + 6} y={rewardY + 14} fill="#22c55e" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  Target: {fmtPrice(targetPrice, symbol)} ({targetPct}%)
                </text>

                {/* Stop Label */}
                <text x={rx + 6} y={riskY + riskH - 6} fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  Stop: {fmtPrice(stopPrice, symbol)} ({stopPct}%)
                </text>

                {/* Center Badge: Risk/Reward Ratio */}
                <rect x={rx + rw / 2 - 45} y={entryY - 10} width="90" height="20" rx="4" fill="#0b0e14" stroke="#ffffff" strokeWidth="1" />
                <text x={rx + rw / 2} y={entryY + 4} fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  R:R {rrRatio}
                </text>

                {/* Draggable Target Handle */}
                <circle
                  cx={rx + rw}
                  cy={targetY}
                  r="5"
                  fill="#22c55e"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="cursor-ns-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle({ drawingId: id, handle: 'target' });
                  }}
                />

                {/* Draggable Stop Handle */}
                <circle
                  cx={rx + rw}
                  cy={stopY}
                  r="5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="cursor-ns-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle({ drawingId: id, handle: 'stop' });
                  }}
                />
              </g>
            );
          }

          return null;
        })}
      </svg>

      {/* Floating Drawing Context Action Bar */}
      <DrawingContextBar
        selectedDrawing={selectedDrawing}
        onUpdateDrawing={updateDrawing}
        onDeleteDrawing={deleteDrawing}
        onClose={() => setSelectedDrawingId(null)}
      />
    </div>
  );
}
