import { useState, useRef, useEffect } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';

interface ChartRulerOverlayProps {
  isActive: boolean;
  onClose: () => void;
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
}

interface Point {
  x: number;
  y: number;
  price: number;
}

export default function ChartRulerOverlay({
  isActive,
  onClose,
  seriesApi,
}: ChartRulerOverlayProps) {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      setStartPoint(null);
      setCurrentPoint(null);
      setIsLocked(false);
    }
  }, [isActive]);

  if (!isActive) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seriesApi || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = seriesApi.coordinateToPrice(y) ?? 0;

    if (!startPoint || isLocked) {
      // First click: anchor
      setStartPoint({ x, y, price });
      setCurrentPoint({ x, y, price });
      setIsLocked(false);
    } else {
      // Second click: lock
      setCurrentPoint({ x, y, price });
      setIsLocked(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seriesApi || !startPoint || isLocked || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = seriesApi.coordinateToPrice(y) ?? 0;
    setCurrentPoint({ x, y, price });
  };

  const deltaPrice = startPoint && currentPoint ? currentPoint.price - startPoint.price : 0;
  const deltaPct = startPoint && startPoint.price !== 0 && currentPoint
    ? ((currentPoint.price - startPoint.price) / startPoint.price) * 100
    : 0;
  const pixelWidth = startPoint && currentPoint ? Math.abs(currentPoint.x - startPoint.x) : 0;
  const estBars = Math.max(1, Math.round(pixelWidth / 10));

  const isUp = deltaPrice >= 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className="absolute inset-0 z-20 cursor-crosshair font-mono"
    >
      {/* Top Banner Notice */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded border border-accent/60 bg-panel/90 px-3 py-1 text-xs text-white shadow-lg backdrop-blur-sm flex items-center gap-2">
        <span className="font-bold text-accent">[Ruler Active]</span>
        <span>{isLocked ? 'Measurement locked. Click to start new.' : startPoint ? 'Click to anchor endpoint.' : 'Click to anchor start point.'}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-2 rounded border border-grid px-1.5 py-0.5 text-[10px] text-muted hover:text-white"
        >
          Exit (Esc)
        </button>
      </div>

      {startPoint && currentPoint && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Measurement Box */}
          <rect
            x={Math.min(startPoint.x, currentPoint.x)}
            y={Math.min(startPoint.y, currentPoint.y)}
            width={Math.abs(currentPoint.x - startPoint.x)}
            height={Math.abs(currentPoint.y - startPoint.y)}
            fill={isUp ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
            stroke={isUp ? '#22c55e' : '#ef4444'}
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />

          {/* Anchor Points */}
          <circle cx={startPoint.x} cy={startPoint.y} r="4" fill="#38bdf8" />
          <circle cx={currentPoint.x} cy={currentPoint.y} r="4" fill={isUp ? '#22c55e' : '#ef4444'} />
        </svg>
      )}

      {/* Floating Metrics HUD */}
      {startPoint && currentPoint && (
        <div
          style={{
            left: `${Math.max(10, Math.min(window.innerWidth - 220, (startPoint.x + currentPoint.x) / 2 - 90))}px`,
            top: `${Math.max(40, Math.min(startPoint.y, currentPoint.y) - 34)}px`,
          }}
          className={`absolute rounded border px-2.5 py-1 text-xs font-semibold shadow-xl backdrop-blur-md pointer-events-none ${
            isUp
              ? 'border-up/60 bg-slate-900/90 text-up'
              : 'border-down/60 bg-slate-900/90 text-down'
          }`}
        >
          <span>
            {isUp ? '+' : ''}
            {deltaPrice.toFixed(2)} ({isUp ? '+' : ''}
            {deltaPct.toFixed(2)}%)
          </span>
          <span className="text-muted font-normal ml-2">| {estBars} bars</span>
        </div>
      )}
    </div>
  );
}
