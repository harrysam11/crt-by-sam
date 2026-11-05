/**
 * TradingView-Style Drawing Overlay Layer.
 * Powered by BaseDrawingTool framework: anchor points, hit-testing, drag/resize,
 * magnet snapping, select/lock/hide/delete, z-ordering, undo/redo stack,
 * per-tool style panel, templates, and per-symbol persistence.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { ToolType, DrawingItem, Point2D, MagnetConfig, DrawingHandle } from './types';
import type { Candle } from '../../types/terminal';
import { audioHaptics } from '../../utils/notify';
import DrawingContextBar from './DrawingContextBar';
import { CoordinateHelper } from './framework/CoordinateHelper';
import { ToolFactory } from './framework/ToolFactory';
import { drawingEvents } from './framework/DrawingEvents';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Load symbol-persisted drawings
  const [drawings, setDrawings] = useState<DrawingItem[]>(() => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeDrawing, setActiveDrawing] = useState<DrawingItem | null>(null);
  const [creationStep, setCreationStep] = useState<number>(0);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  // Dragging state
  const [draggingHandle, setDraggingHandle] = useState<{
    drawingId: string;
    handleId: string;
  } | null>(null);

  const [draggingBody, setDraggingBody] = useState<{
    drawingId: string;
    startPoint: Point2D;
    initialP1: Point2D;
    initialP2?: Point2D;
    initialP3?: Point2D;
  } | null>(null);

  // Undo / Redo history stack
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

  // Hook into drawingEvents event bus
  useEffect(() => {
    const unsubUndo = drawingEvents.onUndo(undo);
    const unsubRedo = drawingEvents.onRedo(redo);
    return () => {
      unsubUndo();
      unsubRedo();
    };
  }, [undo, redo]);

  // Global hotkeys (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        e.preventDefault();
        deleteDrawing(selectedDrawingId);
      } else if (e.key === 'Escape') {
        setSelectedDrawingId(null);
        setActiveDrawing(null);
        setCreationStep(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, undo, redo]);

  // Persist drawings per symbol to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`crt_drawings_${symbol}`, JSON.stringify(drawings));
    } catch {}
    onDrawingsCountChange?.(drawings.length);
  }, [drawings, symbol, onDrawingsCountChange]);

  // Reload drawings when symbol switches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      const loaded: DrawingItem[] = stored ? JSON.parse(stored) : [];
      setDrawings(loaded);
      setHistory([loaded]);
      setHistoryIdx(0);
      setSelectedDrawingId(null);
      setActiveDrawing(null);
      setCreationStep(0);
    } catch {
      setDrawings([]);
    }
  }, [symbol]);

  // Handle clear trigger
  useEffect(() => {
    if (clearTrigger) {
      setDrawings([]);
      pushState([]);
      setSelectedDrawingId(null);
      setActiveDrawing(null);
    }
  }, [clearTrigger]);

  // Coordinate helper
  const coordHelper = useMemo(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 500;
    return new CoordinateHelper(chartApi, seriesApi, width, height);
  }, [chartApi, seriesApi, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  // Magnet snapping helper
  const snapToCandle = useCallback(
    (rawX: number, rawY: number): Point2D => {
      const rawPrice = coordHelper.yToPrice(rawY);
      const rawTime = coordHelper.xToTime(rawX);

      if (!magnetConfig.enabled || !candles.length || !chartApi || !seriesApi) {
        return { x: rawX, y: rawY, price: rawPrice, time: rawTime };
      }

      // Find closest candle by pixel X
      let closestIdx = 0;
      let minXDist = Infinity;

      for (let i = 0; i < candles.length; i++) {
        const cX = coordHelper.timeToX(candles[i].time, -999);
        const dist = Math.abs(rawX - cX);
        if (dist < minXDist) {
          minXDist = dist;
          closestIdx = i;
        }
      }

      const closestCandle = candles[closestIdx];
      if (!closestCandle) {
        return { x: rawX, y: rawY, price: rawPrice, time: rawTime };
      }

      const candleX = coordHelper.timeToX(closestCandle.time, rawX);

      // Snap candidates: Open, High, Low, Close
      const candidates = [
        { price: closestCandle.high, y: coordHelper.priceToY(closestCandle.high) },
        { price: closestCandle.low, y: coordHelper.priceToY(closestCandle.low) },
        { price: closestCandle.open, y: coordHelper.priceToY(closestCandle.open) },
        { price: closestCandle.close, y: coordHelper.priceToY(closestCandle.close) },
      ];

      let bestCand = candidates[0];
      let minYDist = Infinity;
      for (const cand of candidates) {
        const d = Math.abs(rawY - cand.y);
        if (d < minYDist) {
          minYDist = d;
          bestCand = cand;
        }
      }

      // Strong mode snaps always; Weak mode snaps within 20px
      if (magnetConfig.mode === 'STRONG' || minYDist <= 20) {
        return {
          x: candleX,
          y: bestCand.y,
          price: bestCand.price,
          time: closestCandle.time,
        };
      }

      return { x: rawX, y: rawY, price: rawPrice, time: rawTime };
    },
    [magnetConfig, candles, chartApi, seriesApi, coordHelper]
  );

  // External line trigger from Price Scale hover actions
  useEffect(() => {
    if (!externalLineTrigger || !seriesApi) return;
    const { price, type } = externalLineTrigger;
    const y = coordHelper.priceToY(price, 100);
    const newDrawing: DrawingItem = {
      id: `ext_${Date.now()}`,
      type: type === 'LINE' ? 'HORIZONTAL_LINE' : 'HORIZONTAL_RAY',
      p1: { x: 50, y, price },
      color: '#38bdf8',
      lineWidth: 1.5,
      lineStyle: 'dashed',
    };
    audioHaptics.tick();
    const next = [...drawings, newDrawing];
    setDrawings(next);
    pushState(next);
    setSelectedDrawingId(newDrawing.id);
  }, [externalLineTrigger, seriesApi]);

  // Pointer interactions
  const isDrawingTool =
    activeTool !== 'CURSOR_CROSSHAIR' &&
    activeTool !== 'CURSOR_ARROW' &&
    activeTool !== 'CURSOR_DOT' &&
    activeTool !== 'CURSOR_ERASER';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const point = snapToCandle(rawX, rawY);

    // Eraser mode deletes on click
    if (activeTool === 'CURSOR_ERASER') {
      for (let i = drawings.length - 1; i >= 0; i--) {
        const tool = ToolFactory.create(drawings[i]);
        if (tool.hitTest(rawX, rawY, coordHelper)) {
          deleteDrawing(drawings[i].id);
          return;
        }
      }
      return;
    }

    // Check handle hit testing on currently selected drawing
    if (selectedDrawingId) {
      const selected = drawings.find((d) => d.id === selectedDrawingId);
      if (selected && !selected.locked && !isLockedAll) {
        const tool = ToolFactory.create(selected);
        const handles = tool.getHandles(coordHelper);
        const hitHandle = handles.find(
          (h) => Math.hypot(rawX - h.x, rawY - h.y) <= 8
        );
        if (hitHandle) {
          audioHaptics.tick();
          setDraggingHandle({ drawingId: selected.id, handleId: hitHandle.id });
          return;
        }

        // If clicked inside body of selected drawing, start translating it
        if (tool.hitTest(rawX, rawY, coordHelper)) {
          audioHaptics.tick();
          setDraggingBody({
            drawingId: selected.id,
            startPoint: point,
            initialP1: { ...selected.p1 },
            initialP2: selected.p2 ? { ...selected.p2 } : undefined,
            initialP3: selected.p3 ? { ...selected.p3 } : undefined,
          });
          return;
        }
      }
    }

    // Check hit testing on any existing drawing to select it
    if (!isDrawingTool) {
      for (let i = drawings.length - 1; i >= 0; i--) {
        const tool = ToolFactory.create(drawings[i]);
        if (tool.hitTest(rawX, rawY, coordHelper)) {
          audioHaptics.tick();
          setSelectedDrawingId(drawings[i].id);
          return;
        }
      }
      setSelectedDrawingId(null);
      return;
    }

    // Multi-step tool creation
    if (isDrawingTool) {
      if (creationStep === 0) {
        audioHaptics.tick();

        // 1-point instant tools
        if (activeTool === 'HORIZONTAL_LINE' || activeTool === 'VERTICAL_LINE' || activeTool === 'PRICE_LABEL') {
          const newDrawing: DrawingItem = {
            id: `draw_${Date.now()}`,
            type: activeTool,
            p1: point,
            color: '#38bdf8',
            lineWidth: 2,
            lineStyle: 'solid',
          };
          const next = [...drawings, newDrawing];
          setDrawings(next);
          pushState(next);
          setSelectedDrawingId(newDrawing.id);
          return;
        }

        if (activeTool === 'TEXT' || activeTool === 'CALLOUT') {
          const newDrawing: DrawingItem = {
            id: `draw_${Date.now()}`,
            type: activeTool,
            p1: point,
            text: 'Text Note',
            color: '#ffffff',
            fillColor: '#181820',
            lineWidth: 1,
            fontSize: 12,
          };
          const next = [...drawings, newDrawing];
          setDrawings(next);
          pushState(next);
          setSelectedDrawingId(newDrawing.id);
          return;
        }

        if (activeTool === 'BRUSH') {
          const newDrawing: DrawingItem = {
            id: `draw_${Date.now()}`,
            type: 'BRUSH',
            p1: point,
            points: [point],
            color: '#38bdf8',
            lineWidth: 2,
          };
          setActiveDrawing(newDrawing);
          setCreationStep(1);
          return;
        }

        // 2-point and 3-point tools
        const newDrawing: DrawingItem = {
          id: `draw_${Date.now()}`,
          type: activeTool,
          p1: point,
          p2: point,
          color: activeTool === 'POSITION_LONG' ? '#22c55e' : activeTool === 'POSITION_SHORT' ? '#ef4444' : '#38bdf8',
          lineWidth: 2,
          lineStyle: 'solid',
        };
        setActiveDrawing(newDrawing);
        setCreationStep(1);
      } else if (creationStep === 1) {
        if (!activeDrawing) return;

        // 3-point tools (Parallel Channel, Fib Extension) require a 3rd click
        if (activeTool === 'PARALLEL_CHANNEL' || activeTool === 'FIB_EXTENSION') {
          audioHaptics.tick();
          setActiveDrawing({ ...activeDrawing, p2: point, p3: point });
          setCreationStep(2);
          return;
        }

        // Finalize 2-point tool
        audioHaptics.tick();
        const finalized = { ...activeDrawing, p2: point };
        const next = [...drawings, finalized];
        setDrawings(next);
        pushState(next);
        setSelectedDrawingId(finalized.id);
        setActiveDrawing(null);
        setCreationStep(0);
      } else if (creationStep === 2) {
        // Finalize 3-point tool
        if (!activeDrawing) return;
        audioHaptics.tick();
        const finalized = { ...activeDrawing, p3: point };
        const next = [...drawings, finalized];
        setDrawings(next);
        pushState(next);
        setSelectedDrawingId(finalized.id);
        setActiveDrawing(null);
        setCreationStep(0);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const point = snapToCandle(rawX, rawY);

    // Dragging an anchor handle
    if (draggingHandle) {
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== draggingHandle.drawingId) return d;
          const tool = ToolFactory.create(d);
          tool.onDragHandle(draggingHandle.handleId, point);
          return tool.toJSON();
        })
      );
      return;
    }

    // Translating an entire drawing body
    if (draggingBody) {
      const deltaPrice = point.price - draggingBody.startPoint.price;
      const deltaTime = point.time && draggingBody.startPoint.time ? point.time - draggingBody.startPoint.time : 0;

      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== draggingBody.drawingId) return d;
          const tool = ToolFactory.create(d);
          tool.p1 = {
            ...draggingBody.initialP1,
            price: draggingBody.initialP1.price + deltaPrice,
            time: draggingBody.initialP1.time !== undefined ? draggingBody.initialP1.time + deltaTime : undefined,
          };
          if (draggingBody.initialP2) {
            tool.p2 = {
              ...draggingBody.initialP2,
              price: draggingBody.initialP2.price + deltaPrice,
              time: draggingBody.initialP2.time !== undefined ? draggingBody.initialP2.time + deltaTime : undefined,
            };
          }
          if (draggingBody.initialP3) {
            tool.p3 = {
              ...draggingBody.initialP3,
              price: draggingBody.initialP3.price + deltaPrice,
              time: draggingBody.initialP3.time !== undefined ? draggingBody.initialP3.time + deltaTime : undefined,
            };
          }
          return tool.toJSON();
        })
      );
      return;
    }

    // Updating active drawing in progress
    if (activeDrawing) {
      if (activeDrawing.type === 'BRUSH') {
        const pts = activeDrawing.points ? [...activeDrawing.points, point] : [point];
        setActiveDrawing({ ...activeDrawing, points: pts });
      } else if (creationStep === 1) {
        setActiveDrawing({ ...activeDrawing, p2: point });
      } else if (creationStep === 2) {
        setActiveDrawing({ ...activeDrawing, p3: point });
      }
    }
  };

  const handlePointerUp = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
      pushState(drawings);
    }
    if (draggingBody) {
      setDraggingBody(null);
      pushState(drawings);
    }
    if (activeDrawing && activeDrawing.type === 'BRUSH') {
      audioHaptics.tick();
      const next = [...drawings, activeDrawing];
      setDrawings(next);
      pushState(next);
      setSelectedDrawingId(activeDrawing.id);
      setActiveDrawing(null);
      setCreationStep(0);
    }
  };

  // Drawing modifiers
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

  const bringToFront = (id: string) => {
    setDrawings((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const target = prev[idx];
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1), target];
      pushState(next);
      return next;
    });
  };

  const sendToBack = (id: string) => {
    setDrawings((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx <= 0) return prev;
      const target = prev[idx];
      const next = [target, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      pushState(next);
      return next;
    });
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
        {/* Render all drawings via BaseDrawingTool instances */}
        {allDrawings.map((item) => {
          const isSelected = selectedDrawingId === item.id;
          const isHovered = false;
          const tool = ToolFactory.create(item);

          return (
            <g key={item.id} className="pointer-events-auto">
              {tool.renderSVG(isSelected, isHovered, coordHelper, symbol)}

              {/* Render anchor handles for selected drawing */}
              {isSelected &&
                !item.locked &&
                !isLockedAll &&
                tool.getHandles(coordHelper).map((h) => (
                  <circle
                    key={h.id}
                    cx={h.x}
                    cy={h.y}
                    r={5}
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    className="cursor-pointer pointer-events-auto hover:scale-125 transition-transform"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      audioHaptics.tick();
                      setDraggingHandle({ drawingId: item.id, handleId: h.id });
                    }}
                  />
                ))}
            </g>
          );
        })}
      </svg>

      {/* Floating style panel for selected drawing */}
      {selectedDrawing && !isHiddenAll && (
        <DrawingContextBar
          selectedDrawing={selectedDrawing}
          onUpdateDrawing={updateDrawing}
          onDeleteDrawing={deleteDrawing}
          onClose={() => setSelectedDrawingId(null)}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
        />
      )}
    </div>
  );
}
