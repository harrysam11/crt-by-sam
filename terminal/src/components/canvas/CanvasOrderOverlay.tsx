import React, { useEffect, useRef, useState } from 'react';
import type { ISeriesApi } from 'lightweight-charts';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { toUsd } from '../../services/instruments';
import { fmtPrice, fmtUsd } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { CanvasOrderLine } from '../../types/derivatives';

interface CanvasOrderOverlayProps {
  seriesApi: ISeriesApi<'Candlestick'> | null;
  onExecuteOrders?: (entry: CanvasOrderLine, sl?: CanvasOrderLine, tp?: CanvasOrderLine) => void;
}

export default function CanvasOrderOverlay({ seriesApi, onExecuteOrders }: CanvasOrderOverlayProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const canvasOrderLines = useDerivativesStore((s) => s.canvasOrderLines);
  const updateCanvasOrderLine = useDerivativesStore((s) => s.updateCanvasOrderLine);
  const clearCanvasOrderLines = useDerivativesStore((s) => s.clearCanvasOrderLines);
  const activeDragId = useDerivativesStore((s) => s.activeDragId);
  const setActiveDragId = useDerivativesStore((s) => s.setActiveDragId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragLineId, setDragLineId] = useState<string | null>(null);

  const fx = toUsd(symbol);

  // Dragging event listeners
  useEffect(() => {
    if (!dragLineId || !seriesApi || !containerRef.current) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !seriesApi) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newPrice = seriesApi.coordinateToPrice(relativeY);
      if (newPrice != null && Number.isFinite(newPrice) && newPrice > 0) {
        updateCanvasOrderLine(dragLineId, newPrice);
      }
    };

    const onMouseUp = () => {
      audioHaptics.tick();
      setDragLineId(null);
      setActiveDragId(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragLineId, seriesApi, updateCanvasOrderLine, setActiveDragId]);

  if (!seriesApi || !canvasOrderLines.length) return null;

  const entryLine = canvasOrderLines.find((l) => l.type === 'ENTRY');
  const slLine = canvasOrderLines.find((l) => l.type === 'STOP_LOSS');
  const tpLine = canvasOrderLines.find((l) => l.type === 'TAKE_PROFIT');

  const entryPrice = entryLine ? entryLine.price : currentPrice;
  const qty = entryLine ? entryLine.qty : 0.1;
  const side = entryLine ? entryLine.side : 'BUY';

  // Calculate live risk & reward metrics based on line positions
  const slDist = slLine ? Math.abs(entryPrice - slLine.price) : 0;
  const tpDist = tpLine ? Math.abs(tpLine.price - entryPrice) : 0;
  const riskAmount = slDist * qty * fx;
  const rewardAmount = tpDist * qty * fx;
  const rrRatio = riskAmount > 0 ? (rewardAmount / riskAmount).toFixed(2) : '—';

  // Ghost Order Risk-Reward Zones Coordinates
  const entryY = entryLine ? seriesApi.priceToCoordinate(entryLine.price) : null;
  const slY = slLine ? seriesApi.priceToCoordinate(slLine.price) : null;
  const tpY = tpLine ? seriesApi.priceToCoordinate(tpLine.price) : null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono"
    >
      {/* Ghost Order Risk-Reward Preview Shaded Zones */}
      {entryY != null && tpY != null && (
        <div
          style={{
            top: `${Math.min(entryY, tpY)}px`,
            height: `${Math.abs(entryY - tpY)}px`,
          }}
          className="absolute left-0 right-28 bg-emerald-500/10 border-r-2 border-emerald-400/60 pointer-events-none flex items-center px-4"
        >
          <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            Target Reward: +{fmtUsd(rewardAmount)} ({rrRatio}R)
          </span>
        </div>
      )}

      {entryY != null && slY != null && (
        <div
          style={{
            top: `${Math.min(entryY, slY)}px`,
            height: `${Math.abs(entryY - slY)}px`,
          }}
          className="absolute left-0 right-28 bg-rose-500/10 border-r-2 border-rose-400/60 pointer-events-none flex items-center px-4"
        >
          <span className="rounded bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
            Stop Risk: -{fmtUsd(riskAmount)}
          </span>
        </div>
      )}

      {/* Interactive Order Lines */}
      {canvasOrderLines.map((line) => {
        const y = seriesApi.priceToCoordinate(line.price);
        if (y == null || !Number.isFinite(y)) return null;

        const isEntry = line.type === 'ENTRY';
        const isSL = line.type === 'STOP_LOSS';
        const isTP = line.type === 'TAKE_PROFIT';

        const color = isEntry ? '#4c8dff' : isSL ? '#ef5350' : '#26a69a';
        const label = isEntry
          ? `${line.side} Entry (${line.qty})`
          : isSL
          ? `SL: -${fmtUsd(riskAmount)}`
          : `TP: +${fmtUsd(rewardAmount)} (${rrRatio}R)`;

        const isDragging = dragLineId === line.id;

        return (
          <div
            key={line.id}
            style={{ top: `${y}px` }}
            className="absolute left-0 right-0 flex items-center select-none"
          >
            {/* Horizontal Guide Line */}
            <div
              className={`h-[1px] flex-1 border-t ${
                isDragging ? 'border-solid' : 'border-dashed'
              }`}
              style={{ borderColor: color }}
            />

            {/* Draggable Price Tag & Handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                audioHaptics.tick();
                setDragLineId(line.id);
                setActiveDragId(line.id);
              }}
              style={{ backgroundColor: color }}
              className={`pointer-events-auto flex cursor-ns-resize items-center gap-1.5 rounded-l px-2.5 py-1 text-[11px] font-bold text-white shadow-lg transition-transform ${
                isDragging ? 'scale-105 ring-2 ring-white/50' : 'hover:brightness-110'
              }`}
            >
              <span>{label}</span>
              <span className="font-mono">{fmtPrice(line.price, symbol)}</span>
              <svg className="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
          </div>
        );
      })}

      {/* Floating Confirm / Clear Execution Bar */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full border border-grid bg-panel/95 px-4 py-1.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Canvas Order Mode:</span>
          <span className="font-semibold text-white">
            {side} {qty} {symbol}
          </span>
          <span className="text-muted">|</span>
          <span className="text-down font-mono">Risk -{fmtUsd(riskAmount)}</span>
          <span className="text-muted">|</span>
          <span className="text-up font-mono">Reward +{fmtUsd(rewardAmount)} ({rrRatio}R)</span>
        </div>

        <button
          onClick={() => {
            audioHaptics.fill();
            if (onExecuteOrders && entryLine) {
              onExecuteOrders(entryLine, slLine, tpLine);
            }
            clearCanvasOrderLines();
          }}
          className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white hover:brightness-110 active:scale-95 transition"
        >
          Confirm & Place
        </button>

        <button
          onClick={() => {
            audioHaptics.tick();
            clearCanvasOrderLines();
          }}
          className="rounded-full bg-grid px-2.5 py-1 text-xs text-muted hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
