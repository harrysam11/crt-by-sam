/**
 * TradingView-Style Period Separators & Session Breaks Canvas Overlay.
 * Automatically computes day/week/month period boundaries based on chart timeframe.
 * Synchronized with Lightweight Charts timeScale and coordinates.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { useTerminalStore } from '../../store/useTerminalStore';
import type { Candle } from '../../types/terminal';

interface PeriodSeparatorsOverlayProps {
  chartApi: IChartApi | null;
}

interface PeriodBreak {
  time: number;
  label: string;
  isMajor: boolean;
}

export default function PeriodSeparatorsOverlay({ chartApi }: PeriodSeparatorsOverlayProps) {
  const showPeriodSeparators = useTerminalStore((s) => s.showPeriodSeparators);
  const periodSeparatorInterval = useTerminalStore((s) => s.periodSeparatorInterval);
  const candles = useTerminalStore((s) => s.candles);
  const timeframe = useTerminalStore((s) => s.timeframe);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [, setTick] = useState(0);

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

  // Compute session period break points
  const periodBreaks = useMemo<PeriodBreak[]>(() => {
    if (!showPeriodSeparators || !candles || candles.length < 2) return [];

    const breaks: PeriodBreak[] = [];
    const interval = periodSeparatorInterval || 'AUTO';

    for (let i = 1; i < candles.length; i++) {
      const prevC = candles[i - 1];
      const currC = candles[i];

      const prevTime = prevC.time > 10000000000 ? Math.floor(prevC.time / 1000) : prevC.time;
      const currTime = currC.time > 10000000000 ? Math.floor(currC.time / 1000) : currC.time;

      const prevDate = new Date(prevTime * 1000);
      const currDate = new Date(currTime * 1000);

      const isNewDay = currDate.getUTCDate() !== prevDate.getUTCDate() || currDate.getUTCMonth() !== prevDate.getUTCMonth();
      const isNewHour = currDate.getUTCHours() !== prevDate.getUTCHours() || isNewDay;
      const isNew4H = Math.floor(currDate.getUTCHours() / 4) !== Math.floor(prevDate.getUTCHours() / 4) || isNewDay;
      const isNewWeek = currDate.getUTCDay() < prevDate.getUTCDay() || currTime - prevTime >= 4 * 86400;
      const isNewMonth = currDate.getUTCMonth() !== prevDate.getUTCMonth();

      let shouldBreak = false;
      let label = '';
      let isMajor = false;

      if (interval === '1h') {
        if (isNewHour) {
          shouldBreak = true;
          isMajor = isNewDay;
          label = isNewDay
            ? `${currDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${currDate.getUTCDate()}`
            : `${String(currDate.getUTCHours()).padStart(2, '0')}:00`;
        }
      } else if (interval === '4h') {
        if (isNew4H) {
          shouldBreak = true;
          isMajor = isNewDay;
          label = isNewDay
            ? `${currDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${currDate.getUTCDate()}`
            : `${String(currDate.getUTCHours()).padStart(2, '0')}:00`;
        }
      } else if (interval === '1D') {
        if (isNewDay) {
          shouldBreak = true;
          isMajor = isNewWeek;
          label = `${currDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${currDate.getUTCDate()} ${currDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
        }
      } else if (interval === '1W') {
        if (isNewWeek) {
          shouldBreak = true;
          isMajor = isNewMonth;
          label = `Wk ${currDate.getUTCDate()} ${currDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
        }
      } else {
        // AUTO (Matching CRT HTF mapping and TradingView standards)
        // 1s, 1m, 3m, 5m -> 1H separators + Day breaks
        if (['1s', '1m', '3m', '5m'].includes(timeframe)) {
          if (isNewHour) {
            shouldBreak = true;
            isMajor = isNewDay;
            label = isNewDay
              ? `${currDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${currDate.getUTCDate()} ${currDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`
              : `${String(currDate.getUTCHours()).padStart(2, '0')}:00`;
          }
        }
        // 15m, 30m -> 4H separators + Day breaks
        else if (['15m', '30m'].includes(timeframe)) {
          if (isNew4H) {
            shouldBreak = true;
            isMajor = isNewDay;
            label = isNewDay
              ? `${currDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${currDate.getUTCDate()} ${currDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`
              : `${String(currDate.getUTCHours()).padStart(2, '0')}:00`;
          }
        }
        // 1h, 2h, 4h -> Day breaks + Week breaks
        else if (['1h', '2h', '4h'].includes(timeframe)) {
          if (isNewDay) {
            shouldBreak = true;
            isMajor = isNewWeek;
            label = `${currDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${currDate.getUTCDate()} ${currDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
          }
        }
        // 1D and above -> Month & Week separators
        else {
          if (isNewMonth) {
            shouldBreak = true;
            isMajor = true;
            label = `${currDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} '${String(currDate.getUTCFullYear()).slice(2)}`;
          } else if (isNewWeek) {
            shouldBreak = true;
            isMajor = false;
            label = `Wk ${currDate.getUTCDate()}`;
          }
        }
      }

      if (shouldBreak) {
        breaks.push({
          time: currTime,
          label,
          isMajor,
        });
      }
    }

    return breaks;
  }, [candles, timeframe, showPeriodSeparators, periodSeparatorInterval]);

  if (!showPeriodSeparators || !chartApi || periodBreaks.length === 0) {
    return null;
  }

  const timeScale: any = chartApi.timeScale();
  const width = containerRef.current?.clientWidth || 800;
  const height = containerRef.current?.clientHeight || 500;
  const isLight = document.documentElement.classList.contains('theme-light');

  // Calculate coordinates
  const renderedLines: Array<{ x: number; label: string; isMajor: boolean }> = [];

  for (const b of periodBreaks) {
    try {
      const coord = timeScale.timeToCoordinate(b.time as any);
      if (coord !== null && typeof coord === 'number' && Number.isFinite(coord)) {
        if (coord >= -50 && coord <= width + 50) {
          renderedLines.push({ x: coord, label: b.label, isMajor: b.isMajor });
        }
      }
    } catch {}
  }

  if (renderedLines.length === 0) return null;

  const majorStroke = isLight ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.20)';
  const minorStroke = isLight ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.08)';
  const badgeBg = isLight ? '#ffffff' : '#141722';
  const badgeBorder = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const textColor = isLight ? '#0f172a' : '#cbd5e1';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-[5] overflow-hidden"
    >
      <svg className="w-full h-full" width={width} height={height}>
        {renderedLines.map((line, idx) => {
          const badgeWidth = Math.max(48, line.label.length * 6.5 + 14);
          return (
            <g key={`period-sep-${line.x}-${idx}`}>
              {/* Vertical Separator Line */}
              <line
                x1={line.x}
                y1={0}
                x2={line.x}
                y2={height}
                stroke={line.isMajor ? majorStroke : minorStroke}
                strokeWidth={line.isMajor ? 1.25 : 1}
                strokeDasharray={line.isMajor ? '4 3' : '2 3'}
              />

              {/* Bottom Date / Time Pill Badge */}
              <g transform={`translate(${line.x}, ${height - 18})`}>
                <rect
                  x={-badgeWidth / 2}
                  y={-8}
                  width={badgeWidth}
                  height={16}
                  rx={3}
                  fill={badgeBg}
                  stroke={badgeBorder}
                  strokeWidth={0.75}
                  opacity={0.94}
                />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={line.isMajor ? 700 : 500}
                  fill={textColor}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {line.label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
