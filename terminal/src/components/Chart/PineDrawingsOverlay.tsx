/**
 * Institutional Pine Script Geometry & Drawings Canvas Overlay.
 * Renders:
 * - Pine Script boxes (HTF candles, orderblocks, FVGs, imbalance zones)
 * - Pine Script lines (trace lines, true opens, session separators)
 * - Pine Script labels (price levels, sweeps, swing markers)
 * - Pine Script tables (CRT Model & SMT dashboards)
 * Synchronized with Lightweight Charts timeScale and priceScale.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { useTerminalStore } from '../../store/useTerminalStore';
import type { PineDrawingBox, PineDrawingLine, PineDrawingLabel, PineDrawingTable } from '../../services/pineRunner';

interface PineDrawingsOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
}

export default function PineDrawingsOverlay({ chartApi, seriesApi }: PineDrawingsOverlayProps) {
  const pineDrawings = useTerminalStore((s) => s.pineDrawings);
  const candles = useTerminalStore((s) => s.candles);

  const [, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Force re-render whenever chart pans, zooms, or resizes
  const handleUpdate = useCallback(() => {
    setTick((t) => (t + 1) % 1000000);
  }, []);

  useEffect(() => {
    if (!chartApi) return;
    const timeScale: any = chartApi.timeScale();

    try {
      timeScale.subscribeVisibleLogicalRangeChange(handleUpdate);
      timeScale.subscribeVisibleTimeRangeChange(handleUpdate);
    } catch {}

    window.addEventListener('resize', handleUpdate);

    return () => {
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(handleUpdate);
        timeScale.unsubscribeVisibleTimeRangeChange(handleUpdate);
      } catch {}
      window.removeEventListener('resize', handleUpdate);
    };
  }, [chartApi, handleUpdate]);

  if (!pineDrawings || (!pineDrawings.boxes.length && !pineDrawings.lines.length && !pineDrawings.labels.length && !pineDrawings.tables.length)) {
    return null;
  }

  if (!chartApi || !seriesApi) {
    return null;
  }

  const timeScale: any = chartApi.timeScale();
  const width = containerRef.current?.clientWidth || 800;
  const height = containerRef.current?.clientHeight || 500;

  // Convert logical bar index to coordinate X
  const logicalToX = (barIdx: number): number | null => {
    try {
      if (typeof timeScale.logicalToCoordinate === 'function') {
        const coord = timeScale.logicalToCoordinate(barIdx);
        if (coord !== null && typeof coord === 'number' && Number.isFinite(coord)) {
          return coord;
        }
      }
    } catch {}
    return null;
  };

  // Convert price to coordinate Y
  const priceToY = (price: number): number | null => {
    try {
      if (price !== null && typeof price === 'number' && Number.isFinite(price)) {
        const coord = seriesApi.priceToCoordinate(price);
        if (coord !== null && typeof coord === 'number' && Number.isFinite(coord)) {
          return coord;
        }
      }
    } catch {}
    return null;
  };

  // Parse color strings (e.g. #4caf50FF -> rgba or hex)
  const formatColor = (col?: string, fallback: string = '#38bdf8'): string => {
    if (!col) return fallback;
    if (col.startsWith('#') && col.length === 9) {
      const r = parseInt(col.slice(1, 3), 16);
      const g = parseInt(col.slice(3, 5), 16);
      const b = parseInt(col.slice(5, 7), 16);
      const a = parseInt(col.slice(7, 9), 16) / 255;
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
    return col;
  };

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-15 overflow-hidden font-mono select-none"
    >
      {/* SVG Layer for Boxes, Lines, and Geometry */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        {/* 1. Pine Script Boxes (HTF Candles, FVGs, Order Blocks) */}
        {pineDrawings.boxes.map((b) => {
          const x1 = logicalToX(b.left);
          const x2 = logicalToX(b.right);
          const y1 = priceToY(b.top);
          const y2 = priceToY(b.bottom);

          if (x1 === null || x2 === null || y1 === null || y2 === null) return null;

          const boxX = Math.min(x1, x2);
          const boxY = Math.min(y1, y2);
          const boxW = Math.max(1, Math.abs(x2 - x1));
          const boxH = Math.max(1, Math.abs(y2 - y1));

          return (
            <g key={`pine-box-${b.id}`}>
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                fill={formatColor(b.bgcolor, 'rgba(56, 189, 248, 0.15)')}
                stroke={formatColor(b.border_color, 'rgba(56, 189, 248, 0.6)')}
                strokeWidth={b.border_width || 1}
                strokeDasharray={b.border_style === 'style_dotted' ? '2,2' : b.border_style === 'style_dashed' ? '4,4' : undefined}
                rx={2}
              />
              {b.text && (
                <text
                  x={boxX + boxW / 2}
                  y={boxY + boxH / 2}
                  fill={formatColor(b.text_color, '#ffffff')}
                  fontSize={10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono font-bold select-none"
                >
                  {b.text}
                </text>
              )}
            </g>
          );
        })}

        {/* 2. Pine Script Lines (Separators, True Opens, Trace Lines) */}
        {pineDrawings.lines.map((l) => {
          let x1 = logicalToX(l.x1);
          let x2 = logicalToX(l.x2);
          const y1 = priceToY(Number.isFinite(l.y1) ? l.y1 : (l.y2 || 0));
          const y2 = priceToY(Number.isFinite(l.y2) ? l.y2 : (l.y1 || 0));

          if (x1 === null && x2 === null) return null;
          if (y1 === null && y2 === null) return null;

          const validY1 = y1 !== null ? y1 : (y2 || 0);
          const validY2 = y2 !== null ? y2 : (y1 || 0);

          // Handle infinite/extended vertical or horizontal lines
          if (l.x1 === l.x2 && l.y1 === null && l.y2 !== null) {
            // Vertical separator line
            return (
              <line
                key={`pine-line-${l.id}`}
                x1={x1 || 0}
                y1={0}
                x2={x1 || 0}
                y2={height}
                stroke={formatColor(l.color, 'rgba(255, 255, 255, 0.4)')}
                strokeWidth={l.width || 1}
                strokeDasharray={l.style === 'style_dotted' ? '2,2' : l.style === 'style_dashed' ? '5,5' : undefined}
              />
            );
          }

          if (x1 === null) x1 = 0;
          if (x2 === null) x2 = width;

          return (
            <line
              key={`pine-line-${l.id}`}
              x1={x1}
              y1={validY1}
              x2={x2}
              y2={validY2}
              stroke={formatColor(l.color, 'rgba(255, 255, 255, 0.7)')}
              strokeWidth={l.width || 1}
              strokeDasharray={l.style === 'style_dotted' ? '2,2' : l.style === 'style_dashed' ? '5,5' : undefined}
            />
          );
        })}

        {/* 3. Pine Script Labels & Markers */}
        {pineDrawings.labels.map((lbl) => {
          const x = logicalToX(lbl.x);
          const y = priceToY(lbl.y);

          if (x === null || y === null) return null;

          return (
            <g key={`pine-lbl-${lbl.id}`}>
              <circle
                cx={x}
                cy={y}
                r={3.5}
                fill={formatColor(lbl.textcolor, '#00a2c7')}
                stroke="#000"
                strokeWidth={1}
              />
              {lbl.text && (
                <text
                  x={x}
                  y={y - 8}
                  fill={formatColor(lbl.textcolor, '#ffffff')}
                  fontSize={9}
                  textAnchor="middle"
                  className="font-mono font-bold select-none shadow-sm"
                >
                  {lbl.text}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 4. Pine Script Dashboard Tables (CRT Model Table, SMT Matrix) */}
      {pineDrawings.tables.map((tbl) => (
        <div
          key={`pine-table-${tbl.id}`}
          className="pointer-events-auto absolute top-14 right-4 z-30 clay-card bg-[#0b0c14]/95 border border-white/10 rounded-xl shadow-2xl p-2 font-mono text-[10.5px] backdrop-blur-md max-w-xs transition"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 text-white font-bold tracking-wide">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>CRT Pine Dashboard</span>
            </span>
            <button
              onClick={() => useTerminalStore.getState().setPineDrawings(null)}
              className="text-slate-500 hover:text-white px-1 transition text-xs"
              title="Close Pine Dashboard"
            >
              x
            </button>
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {tbl.cells.map((row, rIdx) => (
                <tr key={`r-${rIdx}`} className="border-b border-white/5 last:border-0">
                  {row.map((cell, cIdx) => (
                    <td
                      key={`c-${cIdx}`}
                      className="px-2 py-1 text-left whitespace-nowrap"
                      style={{
                        backgroundColor: cell.bgcolor ? formatColor(cell.bgcolor, 'transparent') : undefined,
                        color: cell.text_color ? formatColor(cell.text_color, '#ffffff') : '#e2e8f0',
                      }}
                    >
                      {cell.text || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
