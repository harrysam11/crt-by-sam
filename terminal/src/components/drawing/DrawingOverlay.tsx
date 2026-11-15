/**
 * TradingView-Style Drawing Overlay Layer.
 * Powered by BaseDrawingTool framework: anchor points, hit-testing, drag/resize,
 * magnet snapping, select/lock/hide/delete, z-ordering, undo/redo stack,
 * per-tool style panel, templates, multi-selection marquee, and per-symbol persistence.
 * Features:
 * - Shift + Drag: Instant Measure Ruler (distance, %, bars, time)
 * - Alt + Drag: Temporary Demonstration Line with live price & pip badge
 * - Alt Hotkeys: Alt+T (Trendline), Alt+H (Horizontal), Alt+V (Vertical), Alt+F (Fib), Alt+R (Rect), Alt+P (Long), Alt+S (Short), Alt+C (Crosshair)
 * - Shift Angle Lock: Snaps lines to 0°, 45°, 90°
 * - Ctrl + Drag: Instant Duplicate / Clone of selected drawing
 * - Auto-revert to Crosshair on completion
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { ToolType, DrawingItem, Point2D, MagnetConfig } from './types';
import type { Candle } from '../../types/terminal';
import { audioHaptics } from '../../utils/notify';
import DrawingContextBar from './DrawingContextBar';
import DrawingSettingsModal from './DrawingSettingsModal';
import { CoordinateHelper } from './framework/CoordinateHelper';
import { ToolFactory } from './framework/ToolFactory';
import { drawingEvents } from './framework/DrawingEvents';
import { useDrawingStore } from '../../store/useDrawingStore';

interface DrawingOverlayProps {
  symbol: string;
  activeTool: ToolType;
  onSelectTool?: (tool: ToolType) => void;
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
  onSelectTool,
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

  // Dynamic price scale offset so price scale and bottom time scale are never blocked by drawing overlay
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

  // Drawing Store Integration
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const stayInDrawingMode = useDrawingStore((s) => s.stayInDrawingMode);
  const selectedDrawingIds = useDrawingStore((s) => s.selectedDrawingIds);
  const setSelectedDrawingIds = useDrawingStore((s) => s.setSelectedDrawingIds);
  const toggleSelectDrawingId = useDrawingStore((s) => s.toggleSelectDrawingId);

  // Load symbol-persisted drawings
  const [drawings, setDrawings] = useState<DrawingItem[]>(() => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Drawing Settings Modal & Hover Notes State
  const [editingDrawing, setEditingDrawing] = useState<DrawingItem | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hoveredNotes, setHoveredNotes] = useState<{ text: string; x: number; y: number } | null>(null);

  const [activeDrawing, setActiveDrawing] = useState<DrawingItem | null>(null);
  const [creationStep, setCreationStep] = useState<number>(0);

  // Modifier Key States
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [isAltHeld, setIsAltHeld] = useState(false);

  // Demonstration Line State (Alt + Hold)
  const [demonstrationDrawing, setDemonstrationDrawing] = useState<{
    start: Point2D;
    current: Point2D;
  } | null>(null);

  // Marquee Selection Box State
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const rightClickDragRef = useRef<{ startX: number; startY: number; didMove: boolean } | null>(null);

  // Dragging state
  const [draggingHandle, setDraggingHandle] = useState<{
    drawingId: string;
    handleId: string;
  } | null>(null);

  const [draggingBody, setDraggingBody] = useState<{
    startPoint: Point2D;
    items: Array<{
      drawingId: string;
      initialP1: Point2D;
      initialP2?: Point2D;
      initialP3?: Point2D;
      initialPoints?: Point2D[];
    }>;
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
      setSelectedDrawingIds([]);
    }
  }, [historyIdx, history, setSelectedDrawingIds]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      audioHaptics.tick();
      const next = history[historyIdx + 1];
      setHistoryIdx((idx) => idx + 1);
      setDrawings(next);
      setSelectedDrawingIds([]);
    }
  }, [historyIdx, history, setSelectedDrawingIds]);

  // Hook into drawingEvents event bus
  useEffect(() => {
    const unsubUndo = drawingEvents.onUndo(undo);
    const unsubRedo = drawingEvents.onRedo(redo);
    return () => {
      unsubUndo();
      unsubRedo();
    };
  }, [undo, redo]);

  // Auto revert to crosshair helper
  const autoRevertToCrosshair = useCallback(() => {
    if (!stayInDrawingMode) {
      setActiveTool('CURSOR_CROSSHAIR');
      onSelectTool?.('CURSOR_CROSSHAIR');
    }
  }, [stayInDrawingMode, setActiveTool, onSelectTool]);

  // Track modifier keys & TradingView keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlHeld(true);
      if (e.key === 'Shift') setIsShiftHeld(true);
      if (e.key === 'Alt') setIsAltHeld(true);

      // TradingView Alt Shortcuts
      if (e.altKey) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('TRENDLINE');
          onSelectTool?.('TRENDLINE');
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('HORIZONTAL_LINE');
          onSelectTool?.('HORIZONTAL_LINE');
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('VERTICAL_LINE');
          onSelectTool?.('VERTICAL_LINE');
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('FIBONACCI');
          onSelectTool?.('FIBONACCI');
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('RECTANGLE');
          onSelectTool?.('RECTANGLE');
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('POSITION_LONG');
          onSelectTool?.('POSITION_LONG');
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('POSITION_SHORT');
          onSelectTool?.('POSITION_SHORT');
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          audioHaptics.tick();
          setActiveTool('CURSOR_CROSSHAIR');
          onSelectTool?.('CURSOR_CROSSHAIR');
        }
      }

      // History & Deletion
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingIds.length > 0) {
          e.preventDefault();
          audioHaptics.tick();
          const next = drawings.filter((d) => !selectedDrawingIds.includes(d.id));
          setDrawings(next);
          pushState(next);
          setSelectedDrawingIds([]);
        }
      } else if (e.key === 'Escape') {
        setSelectedDrawingIds([]);
        setActiveDrawing(null);
        setCreationStep(0);
        setSelectionBox(null);
        setDemonstrationDrawing(null);
        autoRevertToCrosshair();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlHeld(false);
      if (e.key === 'Shift') setIsShiftHeld(false);
      if (e.key === 'Alt') {
        setIsAltHeld(false);
        setDemonstrationDrawing(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedDrawingIds, drawings, undo, redo, pushState, setSelectedDrawingIds, setActiveTool, onSelectTool, autoRevertToCrosshair]);

  // Persist drawings per symbol to localStorage & sync with useDrawingStore
  useEffect(() => {
    try {
      localStorage.setItem(`crt_drawings_${symbol}`, JSON.stringify(drawings));
    } catch {}
    onDrawingsCountChange?.(drawings.length);
    useDrawingStore.getState().setActiveSymbolDrawings(drawings);
  }, [drawings, symbol, onDrawingsCountChange]);

  // Synchronize with external drawing events (from Object Tree, Context Menu, etc.)
  useEffect(() => {
    const unsubUpdate = drawingEvents.onUpdateDrawing((id, patch) => {
      updateDrawing(id, patch);
    });
    const unsubDelete = drawingEvents.onDeleteDrawing((id) => {
      deleteDrawing(id);
    });
    const unsubOpenSettings = drawingEvents.onOpenDrawingSettings((drawing) => {
      setEditingDrawing(drawing);
      setIsSettingsModalOpen(true);
    });
    return () => {
      unsubUpdate();
      unsubDelete();
      unsubOpenSettings();
    };
  }, [drawings]);

  // Reload drawings when symbol switches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      const loaded: DrawingItem[] = stored ? JSON.parse(stored) : [];
      setDrawings(loaded);
      setHistory([loaded]);
      setHistoryIdx(0);
      setSelectedDrawingIds([]);
      setActiveDrawing(null);
      setCreationStep(0);
    } catch {
      setDrawings([]);
    }
  }, [symbol, setSelectedDrawingIds]);

  // Handle clear trigger
  useEffect(() => {
    if (clearTrigger) {
      setDrawings([]);
      pushState([]);
      setSelectedDrawingIds([]);
      setActiveDrawing(null);
    }
  }, [clearTrigger, pushState, setSelectedDrawingIds]);

  // Live viewport update tick (synchronizes SVG drawings on chart zoom, pan, and price scale drag)
  const [viewportTick, setViewportTick] = useState(0);

  useEffect(() => {
    if (!chartApi) return;
    const timeScale = chartApi.timeScale();
    let rafId: number | null = null;
    const triggerUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        setViewportTick((v) => (v + 1) % 1000000);
        rafId = null;
      });
    };

    timeScale.subscribeVisibleLogicalRangeChange(triggerUpdate);
    timeScale.subscribeVisibleTimeRangeChange(triggerUpdate);
    chartApi.subscribeCrosshairMove(triggerUpdate);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(triggerUpdate);
        timeScale.unsubscribeVisibleTimeRangeChange(triggerUpdate);
        chartApi.unsubscribeCrosshairMove(triggerUpdate);
      } catch {}
    };
  }, [chartApi]);

  // Coordinate helper
  const coordHelper = useMemo(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 500;
    return new CoordinateHelper(chartApi, seriesApi, width, height);
  }, [chartApi, seriesApi, containerRef.current?.clientWidth, containerRef.current?.clientHeight, viewportTick]);

  // Magnet snapping helper
  const snapToCandle = useCallback(
    (rawX: number, rawY: number): Point2D => {
      const rawPrice = coordHelper.yToPrice(rawY);
      const rawTime = coordHelper.xToTime(rawX);

      if (!magnetConfig.enabled || !candles.length || !chartApi || !seriesApi) {
        return { x: rawX, y: rawY, price: rawPrice, time: rawTime };
      }

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

      const candidates = [
        { price: closestCandle.high, y: coordHelper.priceToY(closestCandle.high) },
        { price: closestCandle.low, y: coordHelper.priceToY(closestCandle.low) },
        { price: closestCandle.open, y: coordHelper.priceToY(closestCandle.open) },
        { price: closestCandle.close, y: coordHelper.priceToY(closestCandle.close) },
      ];

      let closestCandidate = candidates[0];
      let minYDist = Infinity;

      for (const cand of candidates) {
        const dist = Math.abs(rawY - cand.y);
        if (dist < minYDist) {
          minYDist = dist;
          closestCandidate = cand;
        }
      }

      const threshold = magnetConfig.mode === 'STRONG' ? 60 : 25;
      if (minXDist <= threshold && minYDist <= threshold) {
        return {
          x: candleX,
          y: closestCandidate.y,
          price: closestCandidate.price,
          time: closestCandle.time,
        };
      }

      return { x: rawX, y: rawY, price: rawPrice, time: rawTime };
    },
    [magnetConfig, candles, chartApi, seriesApi, coordHelper]
  );

  // Handle external line triggers (from PriceScaleActionFlyout)
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
    setSelectedDrawingIds([newDrawing.id]);
    autoRevertToCrosshair();
  }, [externalLineTrigger, seriesApi]);

  // Pointer interactions
  const isDrawingTool =
    activeTool !== 'CURSOR_CROSSHAIR' &&
    activeTool !== 'CURSOR_ARROW' &&
    activeTool !== 'CURSOR_DOT' &&
    activeTool !== 'CURSOR_ERASER';

  // Native chart container listener for right-click drag selection
  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const onMouseDown = (e: MouseEvent) => {
      // Marquee selector only activates when Ctrl (or Cmd) is held AND right mouse button is dragged
      if ((e.ctrlKey || e.metaKey) && e.button === 2) {
        const rect = parent.getBoundingClientRect();
        rightClickDragRef.current = {
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          didMove: false,
        };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!rightClickDragRef.current) return;
      const rect = parent.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const dx = Math.abs(currentX - rightClickDragRef.current.startX);
      const dy = Math.abs(currentY - rightClickDragRef.current.startY);

      if (dx > 4 || dy > 4) {
        rightClickDragRef.current.didMove = true;
        setSelectionBox({
          startX: rightClickDragRef.current.startX,
          startY: rightClickDragRef.current.startY,
          currentX,
          currentY,
        });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (rightClickDragRef.current && rightClickDragRef.current.didMove) {
        const rect = parent.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const minX = Math.min(rightClickDragRef.current.startX, currentX);
        const maxX = Math.max(rightClickDragRef.current.startX, currentX);
        const minY = Math.min(rightClickDragRef.current.startY, currentY);
        const maxY = Math.max(rightClickDragRef.current.startY, currentY);

        if (maxX - minX > 5 || maxY - minY > 5) {
          const matchedIds: string[] = [];
          for (const d of drawings) {
            const tool = ToolFactory.create(d);
            const handles = tool.getHandles(coordHelper);
            const handleMatch = handles.some((h) => h.x >= minX && h.x <= maxX && h.y >= minY && h.y <= maxY);
            if (handleMatch) {
              matchedIds.push(d.id);
            } else {
              const p1X = coordHelper.timeToX(d.p1.time, d.p1.x);
              const p1Y = coordHelper.priceToY(d.p1.price, d.p1.y);
              if (p1X >= minX && p1X <= maxX && p1Y >= minY && p1Y <= maxY) {
                matchedIds.push(d.id);
              }
            }
          }
          if (matchedIds.length > 0) {
            audioHaptics.tick();
            setSelectedDrawingIds(matchedIds);
          }
        }
        setSelectionBox(null);
      }
      setTimeout(() => {
        rightClickDragRef.current = null;
      }, 50);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (rightClickDragRef.current?.didMove) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    parent.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    parent.addEventListener('contextmenu', onContextMenu, true);

    return () => {
      parent.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      parent.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [drawings, coordHelper, setSelectedDrawingIds]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const point = snapToCandle(rawX, rawY);

    // 1. Shift + Drag: Instant TradingView Measure Ruler
    if (e.shiftKey && e.button === 0) {
      audioHaptics.tick();
      const measureDrawing: DrawingItem = {
        id: `measure_${Date.now()}`,
        type: 'MEASURE_RULER',
        p1: point,
        p2: point,
        color: '#22c55e',
        lineWidth: 1.5,
      };
      setActiveDrawing(measureDrawing);
      setCreationStep(1);
      return;
    }

    // 2. Alt + Drag: Temporary Demonstration Line
    if (e.altKey && e.button === 0) {
      audioHaptics.tick();
      setDemonstrationDrawing({ start: point, current: point });
      return;
    }

    // 3. Eraser mode deletes on click
    if (activeTool === 'CURSOR_ERASER' && e.button === 0) {
      for (let i = drawings.length - 1; i >= 0; i--) {
        const tool = ToolFactory.create(drawings[i]);
        if (tool.hitTest(rawX, rawY, coordHelper)) {
          deleteDrawing(drawings[i].id);
          return;
        }
      }
      return;
    }

    // 4. Ctrl + drag Marquee selection
    if (isCtrlHeld && e.button === 0) {
      setSelectionBox({
        startX: rawX,
        startY: rawY,
        currentX: rawX,
        currentY: rawY,
      });
      return;
    }

    if (e.button !== 0) return;

    // Check handle hit testing on currently selected drawings
    if (selectedDrawingIds.length > 0) {
      for (const selId of selectedDrawingIds) {
        const selected = drawings.find((d) => d.id === selId);
        if (selected && !selected.locked && !isLockedAll) {
          const tool = ToolFactory.create(selected);
          const handles = tool.getHandles(coordHelper);
          const hitHandle = handles.find((h) => Math.hypot(rawX - h.x, rawY - h.y) <= 8);
          if (hitHandle) {
            audioHaptics.tick();
            setDraggingHandle({ drawingId: selected.id, handleId: hitHandle.id });
            return;
          }
        }
      }

      // Check if clicking inside body of any selected drawing
      for (const selId of selectedDrawingIds) {
        const selected = drawings.find((d) => d.id === selId);
        if (selected && !selected.locked && !isLockedAll) {
          const tool = ToolFactory.create(selected);
          if (tool.hitTest(rawX, rawY, coordHelper)) {
            audioHaptics.tick();

            // Ctrl + Drag: Instant Duplicate
            if (e.ctrlKey || e.metaKey) {
              const clonedId = `draw_${Date.now()}`;
              const cloned: DrawingItem = {
                ...selected,
                id: clonedId,
                p1: { ...selected.p1 },
                p2: selected.p2 ? { ...selected.p2 } : undefined,
                p3: selected.p3 ? { ...selected.p3 } : undefined,
              };
              const next = [...drawings, cloned];
              setDrawings(next);
              pushState(next);
              setSelectedDrawingIds([clonedId]);
              setDraggingBody({
                startPoint: point,
                items: [{
                  drawingId: clonedId,
                  initialP1: { ...cloned.p1 },
                  initialP2: cloned.p2 ? { ...cloned.p2 } : undefined,
                  initialP3: cloned.p3 ? { ...cloned.p3 } : undefined,
                }],
              });
              return;
            }

            const items = selectedDrawingIds.map((id) => {
              const d = drawings.find((x) => x.id === id)!;
              return {
                drawingId: id,
                initialP1: { ...d.p1 },
                initialP2: d.p2 ? { ...d.p2 } : undefined,
                initialP3: d.p3 ? { ...d.p3 } : undefined,
                initialPoints: d.points ? d.points.map((p) => ({ ...p })) : undefined,
              };
            });
            setDraggingBody({ startPoint: point, items });
            return;
          }
        }
      }
    }

    // Hit testing on any existing drawing to select it
    if (!isDrawingTool) {
      for (let i = drawings.length - 1; i >= 0; i--) {
        const tool = ToolFactory.create(drawings[i]);
        if (tool.hitTest(rawX, rawY, coordHelper)) {
          audioHaptics.tick();
          if (e.ctrlKey || e.metaKey) {
            toggleSelectDrawingId(drawings[i].id, true);
          } else {
            setSelectedDrawingIds([drawings[i].id]);
          }
          return;
        }
      }
      // Clicked empty space
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedDrawingIds([]);
      }
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
          setSelectedDrawingIds([newDrawing.id]);
          autoRevertToCrosshair();
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
          setSelectedDrawingIds([newDrawing.id]);
          autoRevertToCrosshair();
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
        setSelectedDrawingIds([finalized.id]);
        setActiveDrawing(null);
        setCreationStep(0);
        autoRevertToCrosshair();
      } else if (creationStep === 2) {
        // Finalize 3-point tool
        if (!activeDrawing) return;
        audioHaptics.tick();
        const finalized = { ...activeDrawing, p3: point };
        const next = [...drawings, finalized];
        setDrawings(next);
        pushState(next);
        setSelectedDrawingIds([finalized.id]);
        setActiveDrawing(null);
        setCreationStep(0);
        autoRevertToCrosshair();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    let point = snapToCandle(rawX, rawY);

    // Demonstration line update
    if (demonstrationDrawing) {
      setDemonstrationDrawing({ ...demonstrationDrawing, current: point });
      return;
    }

    // Shift Angle Lock (snap to nearest 45 degrees)
    if (e.shiftKey && activeDrawing && creationStep === 1) {
      const p1XY = coordHelper.pointToXY(activeDrawing.p1);
      const dx = rawX - p1XY.x;
      const dy = rawY - p1XY.y;
      const angle = Math.atan2(dy, dx);
      const snapStep = Math.PI / 4;
      const snappedAngle = Math.round(angle / snapStep) * snapStep;
      const dist = Math.hypot(dx, dy);
      const snapX = p1XY.x + dist * Math.cos(snappedAngle);
      const snapY = p1XY.y + dist * Math.sin(snappedAngle);
      point = {
        x: snapX,
        y: snapY,
        price: coordHelper.yToPrice(snapY),
        time: coordHelper.xToTime(snapX),
      };
    }

    // Marquee selection box dragging
    if (selectionBox) {
      setSelectionBox({ ...selectionBox, currentX: rawX, currentY: rawY });
      return;
    }

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

    // Translating entire drawing bodies together
    if (draggingBody) {
      const deltaPrice = point.price - draggingBody.startPoint.price;
      const deltaTime = point.time && draggingBody.startPoint.time ? point.time - draggingBody.startPoint.time : 0;

      setDrawings((prev) =>
        prev.map((d) => {
          const item = draggingBody.items.find((x) => x.drawingId === d.id);
          if (!item) return d;

          const tool = ToolFactory.create(d);
          tool.p1 = {
            ...item.initialP1,
            price: item.initialP1.price + deltaPrice,
            time: item.initialP1.time !== undefined ? item.initialP1.time + deltaTime : undefined,
          };
          if (item.initialP2) {
            tool.p2 = {
              ...item.initialP2,
              price: item.initialP2.price + deltaPrice,
              time: item.initialP2.time !== undefined ? item.initialP2.time + deltaTime : undefined,
            };
          }
          if (item.initialP3) {
            tool.p3 = {
              ...item.initialP3,
              price: item.initialP3.price + deltaPrice,
              time: item.initialP3.time !== undefined ? item.initialP3.time + deltaTime : undefined,
            };
          }
          if (item.initialPoints) {
            (tool as any).points = item.initialPoints.map((pt) => ({
              ...pt,
              price: pt.price + deltaPrice,
              time: pt.time !== undefined ? pt.time + deltaTime : undefined,
            }));
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
    // Clear demonstration drawing
    if (demonstrationDrawing) {
      setDemonstrationDrawing(null);
    }

    // Finalize marquee selection box
    if (selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.currentX);
      const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
      const minY = Math.min(selectionBox.startY, selectionBox.currentY);
      const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

      if (maxX - minX > 5 || maxY - minY > 5) {
        const matchedIds: string[] = [];
        for (const d of drawings) {
          const tool = ToolFactory.create(d);
          const handles = tool.getHandles(coordHelper);
          const handleMatch = handles.some((h) => h.x >= minX && h.x <= maxX && h.y >= minY && h.y <= maxY);
          if (handleMatch) {
            matchedIds.push(d.id);
          } else {
            const p1X = coordHelper.timeToX(d.p1.time, d.p1.x);
            const p1Y = coordHelper.priceToY(d.p1.price, d.p1.y);
            if (p1X >= minX && p1X <= maxX && p1Y >= minY && p1Y <= maxY) {
              matchedIds.push(d.id);
            }
          }
        }
        if (matchedIds.length > 0) {
          audioHaptics.tick();
          setSelectedDrawingIds(matchedIds);
        }
      }
      setSelectionBox(null);
      return;
    }

    if (draggingHandle) {
      setDraggingHandle(null);
      pushState(drawings);
      autoRevertToCrosshair();
    }
    if (draggingBody) {
      setDraggingBody(null);
      pushState(drawings);
      autoRevertToCrosshair();
    }
    if (activeDrawing && activeDrawing.type === 'BRUSH') {
      audioHaptics.tick();
      const next = [...drawings, activeDrawing];
      setDrawings(next);
      pushState(next);
      setSelectedDrawingIds([activeDrawing.id]);
      setActiveDrawing(null);
      setCreationStep(0);
      autoRevertToCrosshair();
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
    setSelectedDrawingIds(selectedDrawingIds.filter((selId) => selId !== id));
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

  // Bulk actions on multiple selected drawings
  const handleBulkDelete = () => {
    if (selectedDrawingIds.length === 0) return;
    audioHaptics.tick();
    const next = drawings.filter((d) => !selectedDrawingIds.includes(d.id));
    setDrawings(next);
    pushState(next);
    setSelectedDrawingIds([]);
  };

  const handleBulkToggleLock = () => {
    if (selectedDrawingIds.length === 0) return;
    audioHaptics.tick();
    const anyUnlocked = drawings.some((d) => selectedDrawingIds.includes(d.id) && !d.locked);
    const next = drawings.map((d) =>
      selectedDrawingIds.includes(d.id) ? { ...d, locked: anyUnlocked } : d
    );
    setDrawings(next);
    pushState(next);
  };

  const handleBulkToggleHide = () => {
    if (selectedDrawingIds.length === 0) return;
    audioHaptics.tick();
    const anyVisible = drawings.some((d) => selectedDrawingIds.includes(d.id) && !d.hidden);
    const next = drawings.map((d) =>
      selectedDrawingIds.includes(d.id) ? { ...d, hidden: anyVisible } : d
    );
    setDrawings(next);
    pushState(next);
  };

  // Direct interaction on an SVG drawing item
  const handleDrawingPointerDown = (e: React.PointerEvent, item: DrawingItem) => {
    // Eraser mode deletes on click
    if (activeTool === 'CURSOR_ERASER') {
      audioHaptics.tick();
      deleteDrawing(item.id);
      return;
    }

    if (e.button !== 0) return;

    audioHaptics.tick();
    const isMulti = e.ctrlKey || e.metaKey;

    if (isMulti) {
      toggleSelectDrawingId(item.id, true);
    } else {
      if (!selectedDrawingIds.includes(item.id)) {
        setSelectedDrawingIds([item.id]);
      }
    }

    // Ctrl + Drag: Instant Duplicate
    if ((e.ctrlKey || e.metaKey) && !item.locked && !isLockedAll) {
      const clonedId = `draw_${Date.now()}`;
      const cloned: DrawingItem = {
        ...item,
        id: clonedId,
        p1: { ...item.p1 },
        p2: item.p2 ? { ...item.p2 } : undefined,
        p3: item.p3 ? { ...item.p3 } : undefined,
      };
      const next = [...drawings, cloned];
      setDrawings(next);
      pushState(next);
      setSelectedDrawingIds([clonedId]);

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const startPoint = snapToCandle(rawX, rawY);

      setDraggingBody({
        startPoint,
        items: [{
          drawingId: clonedId,
          initialP1: { ...cloned.p1 },
          initialP2: cloned.p2 ? { ...cloned.p2 } : undefined,
          initialP3: cloned.p3 ? { ...cloned.p3 } : undefined,
        }],
      });
      return;
    }

    // Start dragging drawing body if not locked
    if (!item.locked && !isLockedAll) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const startPoint = snapToCandle(rawX, rawY);

      const targetIds = selectedDrawingIds.includes(item.id) ? selectedDrawingIds : [item.id];
      const items = targetIds.map((id) => {
        const d = drawings.find((x) => x.id === id) || item;
        return {
          drawingId: d.id,
          initialP1: { ...d.p1 },
          initialP2: d.p2 ? { ...d.p2 } : undefined,
          initialP3: d.p3 ? { ...d.p3 } : undefined,
          initialPoints: d.points ? d.points.map((p) => ({ ...p })) : undefined,
        };
      });

      setDraggingBody({ startPoint, items });
    }
  };

  // Window-level dragging listener for handles and drawing bodies
  useEffect(() => {
    if (!draggingHandle && !draggingBody) return;

    const onGlobalPointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const point = snapToCandle(rawX, rawY);

      if (draggingHandle) {
        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== draggingHandle.drawingId) return d;
            const tool = ToolFactory.create(d);
            tool.onDragHandle(draggingHandle.handleId, point);
            return tool.toJSON();
          })
        );
      } else if (draggingBody) {
        const deltaPrice = point.price - draggingBody.startPoint.price;
        const deltaTime = point.time && draggingBody.startPoint.time ? point.time - draggingBody.startPoint.time : 0;
        const deltaX = point.x - draggingBody.startPoint.x;
        const deltaY = point.y - draggingBody.startPoint.y;

        setDrawings((prev) =>
          prev.map((d) => {
            const item = draggingBody.items.find((x) => x.drawingId === d.id);
            if (!item) return d;

            const tool = ToolFactory.create(d);
            tool.p1 = {
              ...item.initialP1,
              x: item.initialP1.x + deltaX,
              y: item.initialP1.y + deltaY,
              price: item.initialP1.price + deltaPrice,
              time: item.initialP1.time !== undefined ? item.initialP1.time + deltaTime : undefined,
            };
            if (item.initialP2) {
              tool.p2 = {
                ...item.initialP2,
                x: item.initialP2.x + deltaX,
                y: item.initialP2.y + deltaY,
                price: item.initialP2.price + deltaPrice,
                time: item.initialP2.time !== undefined ? item.initialP2.time + deltaTime : undefined,
              };
            }
            if (item.initialP3) {
              tool.p3 = {
                ...item.initialP3,
                x: item.initialP3.x + deltaX,
                y: item.initialP3.y + deltaY,
                price: item.initialP3.price + deltaPrice,
                time: item.initialP3.time !== undefined ? item.initialP3.time + deltaTime : undefined,
              };
            }
            if (item.initialPoints) {
              (tool as any).points = item.initialPoints.map((pt: Point2D) => ({
                ...pt,
                x: pt.x + deltaX,
                y: pt.y + deltaY,
                price: pt.price + deltaPrice,
                time: pt.time !== undefined ? pt.time + deltaTime : undefined,
              }));
            }
            return tool.toJSON();
          })
        );
      }
    };

    const onGlobalPointerUp = () => {
      if (draggingHandle) {
        setDraggingHandle(null);
        pushState(drawings);
      }
      if (draggingBody) {
        setDraggingBody(null);
        pushState(drawings);
      }
    };

    window.addEventListener('pointermove', onGlobalPointerMove);
    window.addEventListener('pointerup', onGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', onGlobalPointerMove);
      window.removeEventListener('pointerup', onGlobalPointerUp);
    };
  }, [draggingHandle, draggingBody, snapToCandle, drawings, pushState]);

  // Window-level listener to deselect drawings when clicking empty chart space
  useEffect(() => {
    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (isDrawingTool || activeDrawing || creationStep > 0) return;
      if (selectedDrawingIds.length === 0) return;

      const target = e.target as HTMLElement | SVGElement | null;
      if (!target) return;

      if (
        target.closest('[data-drawing-element]') ||
        target.closest('.clay-popover') ||
        target.closest('.clay-btn') ||
        target.closest('button') ||
        target.closest('input')
      ) {
        return;
      }

      if (containerRef.current?.parentElement?.contains(target)) {
        setSelectedDrawingIds([]);
      }
    };

    window.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => window.removeEventListener('pointerdown', handleGlobalPointerDown);
  }, [selectedDrawingIds, isDrawingTool, activeDrawing, creationStep, setSelectedDrawingIds]);

  const singleSelectedDrawing =
    selectedDrawingIds.length === 1 ? drawings.find((d) => d.id === selectedDrawingIds[0]) ?? null : null;

  const allDrawings = isHiddenAll
    ? []
    : activeDrawing
    ? [...drawings.filter((d) => !d.hidden), activeDrawing]
    : drawings.filter((d) => !d.hidden);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ right: `${priceScaleWidth}px`, bottom: '26px' }}
      className={`absolute left-0 top-0 z-20 ${
        isDrawingTool || activeDrawing || selectionBox || isCtrlHeld || isShiftHeld || isAltHeld
          ? 'cursor-crosshair pointer-events-auto'
          : activeTool === 'CURSOR_ERASER'
          ? 'cursor-not-allowed pointer-events-auto'
          : 'pointer-events-none'
      }`}
    >
      <svg
        className="h-full w-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {/* Selection Marquee Box */}
        {selectionBox && (
          <rect
            x={Math.min(selectionBox.startX, selectionBox.currentX)}
            y={Math.min(selectionBox.startY, selectionBox.currentY)}
            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
            fill="rgba(56, 189, 248, 0.12)"
            stroke="#38bdf8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Temporary Demonstration Drawing (Alt + Hold) */}
        {demonstrationDrawing && (
          <g>
            <line
              x1={demonstrationDrawing.start.x}
              y1={demonstrationDrawing.start.y}
              x2={demonstrationDrawing.current.x}
              y2={demonstrationDrawing.current.y}
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <circle cx={demonstrationDrawing.start.x} cy={demonstrationDrawing.start.y} r={3} fill="#38bdf8" />
            <circle cx={demonstrationDrawing.current.x} cy={demonstrationDrawing.current.y} r={3} fill="#38bdf8" />
            <rect
              x={demonstrationDrawing.current.x + 8}
              y={demonstrationDrawing.current.y - 12}
              width={120}
              height={20}
              rx={3}
              fill="#090a0f"
              stroke="#38bdf8"
              strokeWidth={1}
            />
            <text
              x={demonstrationDrawing.current.x + 14}
              y={demonstrationDrawing.current.y + 2}
              fill="#ffffff"
              fontSize={10}
              fontFamily="monospace"
            >
              ${demonstrationDrawing.current.price.toFixed(2)} ({((demonstrationDrawing.current.price - demonstrationDrawing.start.price) / demonstrationDrawing.start.price * 100).toFixed(2)}%)
            </text>
          </g>
        )}

        {/* Render all drawings via BaseDrawingTool instances */}
        {allDrawings.map((item) => {
          const isSelected = selectedDrawingIds.includes(item.id);
          const isHovered = false;
          const tool = ToolFactory.create(item);

          return (
            <g
              key={item.id}
              data-drawing-id={item.id}
              data-drawing-element="true"
              className={`pointer-events-auto ${item.locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ pointerEvents: 'all' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                audioHaptics.tick();
                setEditingDrawing(item);
                setIsSettingsModalOpen(true);
              }}
              onPointerEnter={(e) => {
                if (item.notes && item.notes.trim()) {
                  setHoveredNotes({ text: item.notes, x: e.clientX, y: e.clientY });
                }
              }}
              onPointerMove={(e) => {
                if (item.notes && item.notes.trim()) {
                  setHoveredNotes({ text: item.notes, x: e.clientX, y: e.clientY });
                }
              }}
              onPointerLeave={() => {
                setHoveredNotes(null);
              }}
              onPointerDown={(e) => {
                if (isDrawingTool) return;
                e.stopPropagation();
                handleDrawingPointerDown(e, item);
              }}
            >
              {tool.renderSVG(isSelected, isHovered, coordHelper, symbol)}

              {/* Custom In-Chart Text Label Badge for non-TEXT drawings */}
              {item.type !== 'TEXT' && item.text && (
                <g className="pointer-events-none select-none font-mono">
                  {(() => {
                    const p1Coord = coordHelper.pointToXY(item.p1);
                    const p2Coord = item.p2 ? coordHelper.pointToXY(item.p2) : p1Coord;
                    let tx = (p1Coord.x + p2Coord.x) / 2;
                    let ty = (p1Coord.y + p2Coord.y) / 2;
                    if (item.textPosition === 'top') ty -= 14;
                    else if (item.textPosition === 'bottom') ty += 20;
                    const fSize = item.fontSize || 11;
                    const textWidth = Math.max(36, item.text.length * (fSize * 0.65) + 12);
                    return (
                      <>
                        <rect
                          x={tx - textWidth / 2}
                          y={ty - 11}
                          width={textWidth}
                          height={18}
                          rx={3}
                          fill="#0b0e14"
                          fillOpacity={0.88}
                          stroke={item.color || '#38bdf8'}
                          strokeWidth={1}
                        />
                        <text
                          x={tx}
                          y={ty + 2}
                          fill={item.textColor || '#ffffff'}
                          fontSize={fSize}
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {item.text}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Render anchor handles for selected drawings */}
              {isSelected &&
                !item.locked &&
                !isLockedAll &&
                tool.getHandles(coordHelper).map((h) => (
                  <circle
                    key={h.id}
                    data-drawing-element="true"
                    cx={h.x}
                    cy={h.y}
                    r={6}
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    className="cursor-crosshair pointer-events-auto hover:scale-125 transition-transform"
                    style={{ pointerEvents: 'all' }}
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

      {/* Floating Notes Tooltip on Hover */}
      {hoveredNotes && (
        <div
          style={{ left: hoveredNotes.x + 12, top: hoveredNotes.y + 12 }}
          className="fixed z-50 pointer-events-none bg-[#0e1118]/95 border border-sky-500/40 px-3 py-2 rounded shadow-2xl text-xs max-w-xs font-mono text-slate-200 backdrop-blur"
        >
          <div className="text-[10px] uppercase font-bold text-sky-400 mb-0.5 flex items-center gap-1">
            <span>Drawing Note</span>
          </div>
          <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-100">
            {hoveredNotes.text}
          </div>
        </div>
      )}

      {/* Multi-Selection Action Bar (when > 1 drawing selected) */}
      {selectedDrawingIds.length > 1 && !isHiddenAll && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#101015]/95 border border-[#272730] px-3 py-1.5 rounded-lg shadow-xl text-xs backdrop-blur font-mono pointer-events-auto">
          <span className="text-[#38bdf8] font-semibold">{selectedDrawingIds.length} drawings selected</span>
          <span className="text-[#3a3e52]">|</span>
          <button
            onClick={handleBulkToggleLock}
            className="px-2 py-0.5 rounded hover:bg-[#202028] text-[#a0a5b5] hover:text-[#f0f2f8] transition-colors"
            title="Lock / Unlock selected"
          >
            Lock/Unlock
          </button>
          <button
            onClick={handleBulkToggleHide}
            className="px-2 py-0.5 rounded hover:bg-[#202028] text-[#a0a5b5] hover:text-[#f0f2f8] transition-colors"
            title="Hide / Unhide selected"
          >
            Hide/Show
          </button>
          <button
            onClick={handleBulkDelete}
            className="px-2 py-0.5 rounded hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 transition-colors"
            title="Delete selected (Del)"
          >
            Delete ({selectedDrawingIds.length})
          </button>
          <button
            onClick={() => setSelectedDrawingIds([])}
            className="px-1.5 py-0.5 rounded hover:bg-[#202028] text-[#6b7280] hover:text-[#f0f2f8] transition-colors"
            title="Deselect all (Esc)"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating style panel for single selected drawing */}
      {singleSelectedDrawing && !isHiddenAll && (
        <DrawingContextBar
          selectedDrawing={singleSelectedDrawing}
          onUpdateDrawing={updateDrawing}
          onDeleteDrawing={deleteDrawing}
          onClose={() => setSelectedDrawingIds([])}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onOpenSettings={() => {
            setEditingDrawing(singleSelectedDrawing);
            setIsSettingsModalOpen(true);
          }}
        />
      )}

      {/* TradingView-Style Drawing Settings Modal */}
      <DrawingSettingsModal
        isOpen={isSettingsModalOpen}
        drawing={editingDrawing}
        symbol={symbol}
        onClose={() => {
          setIsSettingsModalOpen(false);
          setEditingDrawing(null);
        }}
        onSave={(id, patch) => {
          updateDrawing(id, patch);
          setIsSettingsModalOpen(false);
          setEditingDrawing(null);
        }}
        onDelete={(id) => {
          deleteDrawing(id);
          setIsSettingsModalOpen(false);
          setEditingDrawing(null);
        }}
      />
    </div>
  );
}
