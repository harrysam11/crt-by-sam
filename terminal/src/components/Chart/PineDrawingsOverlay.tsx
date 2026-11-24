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
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
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
      const actualBar = barIdx + (pineDrawings?.barOffset || 0);
      if (typeof timeScale.logicalToCoordinate === 'function') {
        const coord = timeScale.logicalToCoordinate(actualBar);
        if (coord !== null && typeof coord === 'number' && Number.isFinite(coord)) {
          return coord;
        }
        // Continuous linear extrapolation for offscreen/historical bars
        const visibleRange = timeScale.getVisibleLogicalRange();
        if (visibleRange) {
          const fromCoord = timeScale.logicalToCoordinate(visibleRange.from);
          const toCoord = timeScale.logicalToCoordinate(visibleRange.to);
          const span = visibleRange.to - visibleRange.from;
          if (span > 0 && fromCoord !== null && toCoord !== null) {
            const barSpacing = (toCoord - fromCoord) / span;
            return fromCoord + (actualBar - visibleRange.from) * barSpacing;
          }
        }
      }
    } catch {}
    return null;
  };

  // Convert coordinate X supporting bar_index and bar_time (xloc)
  const toX = (val: number, xloc?: string): number | null => {
    try {
      if (xloc === 'bt' || val > 1000000000) {
        const timeSec = val > 10000000000 ? Math.floor(val / 1000) : val;
        if (typeof timeScale.timeToCoordinate === 'function') {
          const coord = timeScale.timeToCoordinate(timeSec as any);
          if (coord !== null && typeof coord === 'number' && Number.isFinite(coord)) {
            return coord;
          }
        }
      }
      return logicalToX(val);
    } catch {
      return null;
    }
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
    const lower = col.toLowerCase();
    if (lower === '#000000' || lower === 'black' || lower === 'rgb(0, 0, 0)' || lower === '#000000ff') {
      return 'rgba(255, 255, 255, 0.4)';
    }
    if (col.startsWith('#') && col.length === 9) {
      const r = parseInt(col.slice(1, 3), 16);
      const g = parseInt(col.slice(3, 5), 16);
      const b = parseInt(col.slice(5, 7), 16);
      const a = parseInt(col.slice(7, 9), 16) / 255;
      if (r < 30 && g < 30 && b < 30 && a > 0.5) {
        return 'rgba(255, 255, 255, 0.4)';
      }
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
    return col;
  };

  return (
    <div
      ref={containerRef}
      style={{ zIndex: 25 }}
      className="pointer-events-none absolute inset-0 z-[25] overflow-hidden font-mono select-none"
    >
      {/* SVG Layer for Boxes, Lines, and Geometry */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        {/* 1. Pine Script Boxes (HTF Candles, FVGs, Order Blocks, Session Highlights) */}
        {pineDrawings.boxes.map((b) => {
          const x1 = toX(b.left, (b as any).xloc);
          const x2 = toX(b.right, (b as any).xloc);
          const isFullScreenHeight = b.top >= 1e8 || b.bottom <= -1e8;
          const y1 = isFullScreenHeight ? 0 : priceToY(b.top);
          const y2 = isFullScreenHeight ? height : priceToY(b.bottom);

          if (x1 === null || x2 === null || y1 === null || y2 === null) return null;

          const boxX = Math.min(x1, x2);
          const boxY = Math.min(y1, y2);
          const boxW = Math.max(1, Math.abs(x2 - x1));
          const boxH = Math.max(1, Math.abs(y2 - y1));

          const isDarkBox = (b.bgcolor || '').toLowerCase().startsWith('#2e2e2e') || (b.bgcolor || '').toLowerCase().startsWith('#000000');
          const rawBg = (b.bgcolor || '').toLowerCase();
          const rawBorder = (b.border_color || '').toLowerCase();
          const isGreenish = rawBorder.includes('089981') || rawBorder.includes('22c55e') || rawBorder.includes('10b981') || rawBorder.includes('4caf50') || rawBg.includes('089981') || rawBg.includes('22c55e');
          const isReddish = rawBorder.includes('f23645') || rawBorder.includes('f43f5e') || rawBorder.includes('ef4444') || rawBg.includes('f23645') || rawBg.includes('f43f5e');

          let boxFill: string;
          let boxStroke: string;

          if (isGreenish) {
            boxFill = 'rgba(16, 185, 129, 0.12)';
            boxStroke = 'rgba(16, 185, 129, 0.65)';
          } else if (isReddish) {
            boxFill = 'rgba(244, 63, 94, 0.12)';
            boxStroke = 'rgba(244, 63, 94, 0.65)';
          } else {
            boxFill = isDarkBox ? 'rgba(56, 189, 248, 0.08)' : formatColor(b.bgcolor, 'rgba(56, 189, 248, 0.08)');
            boxStroke = isDarkBox ? 'rgba(56, 189, 248, 0.45)' : formatColor(b.border_color, 'rgba(56, 189, 248, 0.45)');
          }

          return (
            <g key={`pine-box-${b.id}`}>
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                fill={boxFill}
                stroke={boxStroke}
                strokeWidth={b.border_width || 1}
                strokeDasharray={b.border_style === 'style_dotted' ? '2,2' : b.border_style === 'style_dashed' ? '4,4' : undefined}
                rx={3}
              />
              {b.text && (
                <g>
                  <rect
                    x={boxX + 4}
                    y={boxY + 4}
                    width={b.text.length * 6.2 + 8}
                    height={16}
                    rx={3}
                    fill="rgba(10, 12, 18, 0.65)"
                  />
                  <text
                    x={boxX + 8}
                    y={boxY + 15}
                    fill={formatColor(b.text_color, '#ffffff')}
                    fontSize={9.5}
                    textAnchor="start"
                    className="font-mono font-semibold select-none tracking-wide"
                  >
                    {b.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 2. Pine Script Lines (Separators, True Opens, Trace Lines) */}
        {pineDrawings.lines.map((l) => {
          let x1 = toX(l.x1, (l as any).xloc);
          let x2 = toX(l.x2, (l as any).xloc);
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
                stroke={formatColor(l.color, 'rgba(255, 255, 255, 0.25)')}
                strokeWidth={l.width || 1}
                strokeDasharray={l.style === 'style_dotted' ? '2,2' : l.style === 'style_dashed' ? '4,4' : undefined}
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
              stroke={formatColor(l.color, 'rgba(56, 189, 248, 0.55)')}
              strokeWidth={l.width || 1}
              strokeDasharray={l.style === 'style_dotted' ? '2,2' : l.style === 'style_dashed' ? '4,4' : undefined}
            />
          );
        })}

        {/* 3. Pine Script Labels & Markers */}
        {pineDrawings.labels.map((lbl) => {
          const x = toX(lbl.x, (lbl as any).xloc);
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
      {pineDrawings.tables.map((tbl) => {
        if (isTableCollapsed) {
          return (
            <button
              key={`pine-table-pill-${tbl.id}`}
              onClick={() => setIsTableCollapsed(false)}
              className="pointer-events-auto absolute top-14 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0c14]/90 border border-white/10 shadow-lg text-[10px] text-slate-300 hover:text-white backdrop-blur-md transition hover:scale-105"
              title="Expand CRT Dashboard"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>CRT Dashboard</span>
              <span className="text-slate-400 font-bold ml-1">+</span>
            </button>
          );
        }

        return (
          <div
            key={`pine-table-${tbl.id}`}
            className="pointer-events-auto absolute top-14 right-4 z-30 bg-[#0b0c14]/95 border border-white/15 rounded-xl shadow-2xl p-2.5 font-mono text-[10.5px] backdrop-blur-xl max-w-xs transition"
          >
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 text-white font-bold tracking-wide">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs">CRT Dashboard</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsTableCollapsed(true)}
                  className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 transition text-xs font-bold"
                  title="Minimize Dashboard"
                >
                  –
                </button>
                <button
                  onClick={() => useTerminalStore.getState().setPineDrawings(null)}
                  className="text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-white/10 transition text-xs font-bold"
                  title="Close Pine Dashboard"
                >
                  x
                </button>
              </div>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {tbl.cells.map((row, rIdx) => (
                  <tr key={`r-${rIdx}`} className="border-b border-white/5 last:border-0">
                    {row.map((cell, cIdx) => (
                      <td
                        key={`c-${cIdx}`}
                        className="px-2 py-0.5 text-left whitespace-nowrap"
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
        );
      })}
    </div>
  );
}
