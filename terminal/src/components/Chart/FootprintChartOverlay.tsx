/**
 * Institutional Footprint / Cluster Chart Overlay (Exocharts / Sierra Chart Grade).
 * Dynamically adapts to chart zoom level:
 * - When zoomed in (barSpacing >= 38px): renders razor-sharp Bid x Ask numbers, POC, and diagonal imbalances.
 * - When zoomed out (barSpacing < 38px): auto-collapses to a micro delta-volume profile that NEVER overlaps.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp, LogicalRange } from 'lightweight-charts';
import type { Candle } from '../../types/terminal';
import type { FootprintCandle } from '../../types/derivatives';
import { generateFootprintCandle } from '../../services/footprintMath';

interface FootprintChartOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<'Candlestick'> | null;
  candles: Candle[];
  containerWidth: number;
  containerHeight: number;
  mode?: 'BID_ASK' | 'DELTA' | 'VOLUME';
}

export default function FootprintChartOverlay({
  chartApi,
  seriesApi,
  candles,
  containerWidth,
  containerHeight,
}: FootprintChartOverlayProps) {
  const [visibleRange, setVisibleRange] = useState<LogicalRange | null>(null);
  const [, setRerenderKey] = useState(0);

  // Subscribe to timeScale range changes (zoom & pan)
  useEffect(() => {
    if (!chartApi) return;
    const timeScale = chartApi.timeScale();
    const handleRangeChange = (range: LogicalRange | null) => {
      setVisibleRange(range);
    };
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    setVisibleRange(timeScale.getVisibleLogicalRange());

    // Also trigger on window resize
    const handleResize = () => setRerenderKey((k) => k + 1);
    window.addEventListener('resize', handleResize);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [chartApi]);

  // Compute footprint structures for all candles
  const footprintCache = useMemo(() => {
    const map = new Map<number, FootprintCandle>();
    for (const c of candles) {
      map.set(c.time, generateFootprintCandle(c, 8));
    }
    return map;
  }, [candles]);

  // Calculate visible clusters and candle spacing
  const { renderedClusters, barSpacing, isZoomedIn } = useMemo(() => {
    if (!chartApi || !seriesApi || !candles.length) {
      return { renderedClusters: [], barSpacing: 10, isZoomedIn: false };
    }

    const timeScale = chartApi.timeScale();

    // Determine candle spacing by checking coordinate distance of two recent candles
    let spacing = 12;
    if (candles.length >= 2) {
      const c1 = candles[candles.length - 1];
      const c2 = candles[candles.length - 2];
      const x1 = timeScale.timeToCoordinate(c1.time as UTCTimestamp);
      const x2 = timeScale.timeToCoordinate(c2.time as UTCTimestamp);
      if (x1 !== null && x2 !== null) {
        spacing = Math.max(4, Math.abs(x1 - x2));
      }
    }

    const zoomedIn = spacing >= 38;

    // Filter only candles that are inside the visible container viewport
    const visibleFpList: Array<{
      footprint: FootprintCandle;
      x: number;
      topY: number;
      bottomY: number;
      levels: Array<{
        price: number;
        y: number;
        bid: number;
        ask: number;
        delta: number;
        isPOC: boolean;
        askImbalance: boolean;
        bidImbalance: boolean;
        maxVol: number;
      }>;
    }> = [];

    // Render from visible range or recent visible window
    const startIndex = visibleRange ? Math.max(0, Math.floor(visibleRange.from) - 2) : Math.max(0, candles.length - 40);
    const endIndex = visibleRange ? Math.min(candles.length - 1, Math.ceil(visibleRange.to) + 2) : candles.length - 1;

    for (let i = startIndex; i <= endIndex; i++) {
      const c = candles[i];
      if (!c) continue;
      const x = timeScale.timeToCoordinate(c.time as UTCTimestamp);
      if (x === null || x < -80 || x > containerWidth + 80) continue;

      const topY = seriesApi.priceToCoordinate(c.high);
      const bottomY = seriesApi.priceToCoordinate(c.low);
      if (topY === null || bottomY === null) continue;

      const fp = footprintCache.get(c.time) ?? generateFootprintCandle(c, 8);
      let maxVol = 1;
      for (const l of fp.priceLevels) {
        if (l.bidVolume + l.askVolume > maxVol) maxVol = l.bidVolume + l.askVolume;
      }

      const levels = fp.priceLevels.map((l) => {
        const y = seriesApi.priceToCoordinate(l.price) ?? 0;
        const isPOC = Math.abs(l.price - fp.pointOfControl) < (fp.high - fp.low) / Math.max(1, fp.priceLevels.length * 1.5);
        return {
          price: l.price,
          y,
          bid: l.bidVolume,
          ask: l.askVolume,
          delta: l.delta,
          isPOC,
          askImbalance: !!l.askImbalance,
          bidImbalance: !!l.bidImbalance,
          maxVol,
        };
      });

      visibleFpList.push({
        footprint: fp,
        x,
        topY,
        bottomY,
        levels,
      });
    }

    return { renderedClusters: visibleFpList, barSpacing: spacing, isZoomedIn: zoomedIn };
  }, [chartApi, seriesApi, candles, footprintCache, visibleRange, containerWidth]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono select-none">
      <svg className="h-full w-full">
        {renderedClusters.map((cluster) => {
          // Dynamic width that NEVER exceeds available bar spacing (prevents any overlapping)
          const colW = isZoomedIn
            ? Math.min(100, Math.max(36, barSpacing * 0.90))
            : Math.max(3, barSpacing * 0.70);
          const halfW = colW / 2;
          const startX = cluster.x - halfW;
          const isBull = cluster.footprint.close >= cluster.footprint.open;

          // If zoomed out, render clean micro-delta profile bars (like Exocharts / Sierra Chart)
          if (!isZoomedIn) {
            return (
              <g key={cluster.footprint.time}>
                {/* Thin Center Wick */}
                <line
                  x1={cluster.x}
                  y1={cluster.topY}
                  x2={cluster.x}
                  y2={cluster.bottomY}
                  stroke={isBull ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)'}
                  strokeWidth={1}
                />
                {/* Micro Level Heatmap Bars */}
                {cluster.levels.map((lvl, idx) => {
                  const barH = Math.max(2, Math.abs(cluster.bottomY - cluster.topY) / cluster.levels.length);
                  const isDeltaPositive = lvl.delta >= 0;
                  const ratio = Math.min(1, Math.abs(lvl.delta) / Math.max(1, lvl.maxVol * 0.6));
                  const barWidth = Math.max(2, halfW * ratio);

                  return (
                    <rect
                      key={idx}
                      x={isDeltaPositive ? cluster.x : cluster.x - barWidth}
                      y={lvl.y - barH / 2}
                      width={barWidth}
                      height={Math.max(1, barH - 0.5)}
                      fill={isDeltaPositive ? 'rgba(38, 166, 154, 0.75)' : 'rgba(239, 83, 80, 0.75)'}
                    />
                  );
                })}
              </g>
            );
          }

          // Zoomed-in mode: Full Bid x Ask text clusters
          const totalLevels = cluster.levels.length;
          const avgLevelH = totalLevels > 1 ? Math.abs(cluster.bottomY - cluster.topY) / totalLevels : 14;
          const rowH = Math.min(18, Math.max(11, avgLevelH));
          const showText = rowH >= 11;

          return (
            <g key={cluster.footprint.time}>
              {/* Wick */}
              <line
                x1={cluster.x}
                y1={cluster.topY}
                x2={cluster.x}
                y2={cluster.bottomY}
                stroke={isBull ? '#26a69a' : '#ef5350'}
                strokeWidth={1}
                strokeOpacity={0.3}
              />

              {/* Cluster Price Levels */}
              {cluster.levels.map((lvl, idx) => {
                const rowY = lvl.y - rowH / 2;
                const bidRatio = Math.min(1, lvl.bid / Math.max(1, lvl.maxVol * 0.75));
                const askRatio = Math.min(1, lvl.ask / Math.max(1, lvl.maxVol * 0.75));

                return (
                  <g key={idx}>
                    {/* Background Cell - Bid (Left) */}
                    <rect
                      x={startX}
                      y={rowY}
                      width={halfW}
                      height={rowH - 1}
                      fill="rgba(239, 83, 80, 0.25)"
                      opacity={0.15 + bidRatio * 0.85}
                    />

                    {/* Background Cell - Ask (Right) */}
                    <rect
                      x={cluster.x}
                      y={rowY}
                      width={halfW}
                      height={rowH - 1}
                      fill="rgba(38, 166, 154, 0.25)"
                      opacity={0.15 + askRatio * 0.85}
                    />

                    {/* POC Golden Outline */}
                    {lvl.isPOC && (
                      <rect
                        x={startX}
                        y={rowY}
                        width={colW}
                        height={rowH - 1}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                      />
                    )}

                    {/* Center Column Divider */}
                    <line
                      x1={cluster.x}
                      y1={rowY}
                      x2={cluster.x}
                      y2={rowY + rowH - 1}
                      stroke="rgba(255, 255, 255, 0.12)"
                      strokeWidth={1}
                    />

                    {/* Bid Volume Text */}
                    {showText && (
                      <text
                        x={cluster.x - 3}
                        y={rowY + rowH - 3.5}
                        textAnchor="end"
                        fill={lvl.bidImbalance ? '#f87171' : '#cbd5e1'}
                        fontWeight={lvl.bidImbalance ? 'bold' : 'normal'}
                        fontSize="8px"
                      >
                        {lvl.bid}
                      </text>
                    )}

                    {/* Ask Volume Text */}
                    {showText && (
                      <text
                        x={cluster.x + 3}
                        y={rowY + rowH - 3.5}
                        textAnchor="start"
                        fill={lvl.askImbalance ? '#38bdf8' : '#cbd5e1'}
                        fontWeight={lvl.askImbalance ? 'bold' : 'normal'}
                        fontSize="8px"
                      >
                        {lvl.ask}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Bottom Candle Delta Metric */}
              <g transform={`translate(${cluster.x - Math.min(22, halfW)}, ${Math.min(containerHeight - 25, cluster.bottomY + 6)})`}>
                <rect
                  x={0}
                  y={0}
                  width={Math.min(44, colW)}
                  height={12}
                  rx={2}
                  fill="rgba(11, 14, 20, 0.85)"
                  stroke={cluster.footprint.candleDelta >= 0 ? '#26a69a' : '#ef5350'}
                  strokeWidth={0.8}
                />
                <text
                  x={Math.min(22, halfW)}
                  y={9}
                  textAnchor="middle"
                  fill={cluster.footprint.candleDelta >= 0 ? '#4ade80' : '#f87171'}
                  fontWeight="bold"
                  fontSize="7.5px"
                >
                  {cluster.footprint.candleDelta >= 0 ? `+${cluster.footprint.candleDelta}` : cluster.footprint.candleDelta}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Floating Status Indicator when zoomed out */}
      {!isZoomedIn && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-grid bg-panel/90 px-3 py-1 text-[10px] text-slate-400 backdrop-blur-md shadow-lg pointer-events-none">
          Scroll to zoom in for Bid x Ask clusters
        </div>
      )}
    </div>
  );
}
