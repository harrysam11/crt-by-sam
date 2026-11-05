import React, { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import type { Candle } from '../../types/terminal';

interface GhostOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
}

interface AggregatedBox {
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Aggregate 1m candles into higher-timeframe boxes (1h, 4h, 1d)
 */
function aggregateToHTF(candles: Candle[], tf: '1h' | '4h' | '1d'): AggregatedBox[] {
  if (!candles.length) return [];
  const secPerBar = tf === '1h' ? 3600 : tf === '4h' ? 14400 : 86400;

  const boxes: Record<number, AggregatedBox> = {};

  for (const c of candles) {
    const bucket = Math.floor(c.time / secPerBar) * secPerBar;
    if (!boxes[bucket]) {
      boxes[bucket] = {
        startTime: bucket,
        endTime: bucket + secPerBar,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    } else {
      const b = boxes[bucket];
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
    }
  }

  return Object.values(boxes);
}

export default function GhostOverlay({ chartApi, seriesApi }: GhostOverlayProps) {
  const isGhostVisible = useDerivativesStore((s) => s.isGhostVisible);
  const ghostConfig = useDerivativesStore((s) => s.ghostConfig);
  const candles = useTerminalStore((s) => s.candles);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    if (!isGhostVisible || !chartApi || !seriesApi || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const redraw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const htfBoxes = aggregateToHTF(candles, ghostConfig.higherTimeframe);
      const timeScale = chartApi.timeScale();

      htfBoxes.forEach((box) => {
        // Map time to X coordinate
        const x1 = timeScale.timeToCoordinate(box.startTime as any);
        const x2 = timeScale.timeToCoordinate(box.endTime as any);

        // Map price to Y coordinate
        const yHigh = seriesApi.priceToCoordinate(box.high);
        const yLow = seriesApi.priceToCoordinate(box.low);
        const yOpen = seriesApi.priceToCoordinate(box.open);
        const yClose = seriesApi.priceToCoordinate(box.close);

        if (x1 == null && x2 == null) return;
        if (yHigh == null || yLow == null || yOpen == null || yClose == null) return;

        const left = x1 != null ? x1 : 0;
        const right = x2 != null ? x2 : width;
        const boxWidth = Math.max(8, right - left);
        const boxHeight = Math.max(2, yLow - yHigh);

        const isBull = box.close >= box.open;
        const fillColor = isBull
          ? `rgba(38, 166, 154, ${ghostConfig.transparency})`
          : `rgba(239, 83, 80, ${ghostConfig.transparency})`;
        const borderColor = isBull
          ? `rgba(38, 166, 154, ${Math.min(1, ghostConfig.transparency * 2)})`
          : `rgba(239, 83, 80, ${Math.min(1, ghostConfig.transparency * 2)})`;

        // Draw translucent HTF Range Box
        if (ghostConfig.showHighLowBoxes) {
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          ctx.fillRect(left, yHigh, boxWidth, boxHeight);
          ctx.strokeRect(left, yHigh, boxWidth, boxHeight);
          ctx.setLineDash([]);
        }

        // Draw HTF Open/Close internal body
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillStyle = isBull ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)';
        ctx.fillRect(left + 2, bodyTop, boxWidth - 4, bodyHeight);

        // Watermark badge on the HTF candle box
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px monospace';
        ctx.fillText(`${ghostConfig.higherTimeframe.toUpperCase()} Ghost`, left + 4, yHigh + 12);
      });
    };

    // Subscribe to chart visible range change & pan/zoom
    const onRangeChanged = () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(redraw);
    };

    chartApi.timeScale().subscribeVisibleTimeRangeChange(onRangeChanged);
    redraw();

    return () => {
      chartApi.timeScale().unsubscribeVisibleTimeRangeChange(onRangeChanged);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [isGhostVisible, ghostConfig, chartApi, seriesApi, candles]);

  if (!isGhostVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
