import React, { useState, useRef, useEffect } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { ToolType, DrawingItem, Point2D } from './types';
import { fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

interface DrawingOverlayProps {
  symbol: string;
  activeTool: ToolType;
  seriesApi: ISeriesApi<'Candlestick'> | null;
  chartApi: IChartApi | null;
  onDrawingsCountChange?: (count: number) => void;
  clearTrigger?: number;
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export default function DrawingOverlay({
  symbol,
  activeTool,
  seriesApi,
  onDrawingsCountChange,
  clearTrigger,
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync count to parent
  useEffect(() => {
    onDrawingsCountChange?.(drawings.length);
    try {
      localStorage.setItem(`crt_drawings_${symbol}`, JSON.stringify(drawings));
    } catch {}
  }, [drawings, symbol, onDrawingsCountChange]);

  // Handle clear trigger
  useEffect(() => {
    if (clearTrigger) {
      setDrawings([]);
    }
  }, [clearTrigger]);

  const isDrawingTool =
    activeTool === 'TRENDLINE' ||
    activeTool === 'HORIZONTAL_LINE' ||
    activeTool === 'FIBONACCI' ||
    activeTool === 'RECTANGLE' ||
    activeTool === 'POSITION_TOOL';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seriesApi || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = seriesApi.coordinateToPrice(y) ?? 0;

    if (activeTool === 'CURSOR_ERASER') {
      // Find closest drawing within 15px radius and remove it
      audioHaptics.tick();
      setDrawings((prev) =>
        prev.filter((d) => {
          const dist1 = Math.hypot(d.p1.x - x, d.p1.y - y);
          const dist2 = d.p2 ? Math.hypot(d.p2.x - x, d.p2.y - y) : Infinity;
          return dist1 > 20 && dist2 > 20;
        })
      );
      return;
    }

    if (!isDrawingTool) return;

    audioHaptics.tick();
    const p1: Point2D = { x, y, price };

    if (activeTool === 'HORIZONTAL_LINE') {
      const newDrawing: DrawingItem = {
        id: `draw-${Date.now()}`,
        type: 'HORIZONTAL_LINE',
        p1,
        color: '#f0b90b',
        lineWidth: 1.5,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      return;
    }

    // Two-point drawing in progress
    const color =
      activeTool === 'FIBONACCI'
        ? '#38bdf8'
        : activeTool === 'RECTANGLE'
        ? '#a855f7'
        : activeTool === 'POSITION_TOOL'
        ? '#22c55e'
        : '#4c8dff';

    setActiveDrawing({
      id: `draw-${Date.now()}`,
      type: activeTool,
      p1,
      p2: { x, y, price },
      color,
      lineWidth: 1.5,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeDrawing || !seriesApi || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = seriesApi.coordinateToPrice(y) ?? 0;

    setActiveDrawing((prev) => (prev ? { ...prev, p2: { x, y, price } } : null));
  };

  const handlePointerUp = () => {
    if (activeDrawing && activeDrawing.p2) {
      audioHaptics.tick();
      setDrawings((prev) => [...prev, activeDrawing]);
      setActiveDrawing(null);
    }
  };

  const allDrawings = activeDrawing ? [...drawings, activeDrawing] : drawings;

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

          if (type === 'HORIZONTAL_LINE') {
            return (
              <g key={id}>
                <line x1="0" y1={p1.y} x2="100%" y2={p1.y} stroke={color} strokeWidth={lineWidth} strokeDasharray="4 2" />
                <rect x="6" y={p1.y - 10} width="80" height="20" rx="3" fill="#1e222d" />
                <text x="10" y={p1.y + 4} fill="#ffffff" fontSize="10" fontFamily="monospace">
                  {fmtPrice(p1.price, symbol)}
                </text>
              </g>
            );
          }

          if (!p2) return null;

          if (type === 'TRENDLINE') {
            return (
              <g key={id}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={lineWidth} />
                <circle cx={p1.x} cy={p1.y} r="3" fill={color} />
                <circle cx={p2.x} cy={p2.y} r="3" fill={color} />
              </g>
            );
          }

          if (type === 'RECTANGLE') {
            const rx = Math.min(p1.x, p2.x);
            const ry = Math.min(p1.y, p2.y);
            const rw = Math.abs(p2.x - p1.x);
            const rh = Math.abs(p2.y - p1.y);
            return (
              <g key={id}>
                <rect x={rx} y={ry} width={rw} height={rh} fill="rgba(168, 85, 247, 0.15)" stroke={color} strokeWidth={lineWidth} />
              </g>
            );
          }

          if (type === 'FIBONACCI') {
            const deltaY = p2.y - p1.y;
            const deltaPrice = p2.price - p1.price;
            return (
              <g key={id}>
                {FIB_LEVELS.map((lvl) => {
                  const yLevel = p1.y + deltaY * lvl;
                  const priceLevel = p1.price + deltaPrice * lvl;
                  return (
                    <g key={lvl}>
                      <line x1={Math.min(p1.x, p2.x)} y1={yLevel} x2="100%" y2={yLevel} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
                      <text x="10" y={yLevel - 3} fill="#94a3b8" fontSize="9" fontFamily="monospace">
                        {(lvl * 100).toFixed(1)}% ({fmtPrice(priceLevel, symbol)})
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          }

          if (type === 'POSITION_TOOL') {
            const entryY = p1.y;
            const targetY = p2.y;
            const isLong = targetY < entryY;
            const height = Math.abs(targetY - entryY);
            const stopDist = height * 0.5;
            const stopY = isLong ? entryY + stopDist : entryY - stopDist;
            const width = Math.max(120, Math.abs(p2.x - p1.x));

            return (
              <g key={id}>
                {/* Reward Zone */}
                <rect
                  x={Math.min(p1.x, p2.x)}
                  y={Math.min(entryY, targetY)}
                  width={width}
                  height={height}
                  fill="rgba(34, 197, 94, 0.18)"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />
                {/* Risk Zone */}
                <rect
                  x={Math.min(p1.x, p2.x)}
                  y={Math.min(entryY, stopY)}
                  width={width}
                  height={stopDist}
                  fill="rgba(239, 68, 68, 0.18)"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                />
                <text x={Math.min(p1.x, p2.x) + 6} y={entryY - 4} fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  Entry: {fmtPrice(p1.price, symbol)} (Target 2.0R)
                </text>
              </g>
            );
          }

          return null;
        })}
      </svg>
    </div>
  );
}
