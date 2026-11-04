/**
 * Institutional Footprint / Cluster Chart Canvas Overlay.
 * Renders real-time Bid x Ask volume clusters, Point of Control (POC),
 * and diagonal imbalance markers directly on the candlestick coordinates.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useMemo } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
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
  mode = 'BID_ASK',
}: FootprintChartOverlayProps) {
  if (!chartApi || !seriesApi || !candles.length) return null;

  // Generate footprint data for the most recent 25 candles to maximize rendering performance
  const displayCandles = useMemo(() => {
    return candles.slice(-25).map((c) => generateFootprintCandle(c, 7));
  }, [candles]);

  const renderedClusters = useMemo(() => {
    const timeScale = chartApi.timeScale();
    const clusters: Array<{
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

    for (const fp of displayCandles) {
      const x = timeScale.timeToCoordinate(fp.time as UTCTimestamp);
      if (x === null || x < -50 || x > containerWidth + 50) continue;

      const topY = seriesApi.priceToCoordinate(fp.high);
      const bottomY = seriesApi.priceToCoordinate(fp.low);
      if (topY === null || bottomY === null) continue;

      let maxVol = 1;
      for (const l of fp.priceLevels) {
        if (l.bidVolume + l.askVolume > maxVol) maxVol = l.bidVolume + l.askVolume;
      }

      const levels = fp.priceLevels.map((l) => {
        const y = seriesApi.priceToCoordinate(l.price) ?? 0;
        const isPOC = Math.abs(l.price - fp.pointOfControl) < (fp.high - fp.low) / (fp.priceLevels.length * 1.5);
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

      clusters.push({
        footprint: fp,
        x,
        topY,
        bottomY,
        levels,
      });
    }

    return clusters;
  }, [chartApi, seriesApi, displayCandles, containerWidth]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono text-[9px] select-none">
      <svg className="h-full w-full">
        {renderedClusters.map((cluster) => {
          const colW = 54;
          const halfW = colW / 2;
          const startX = cluster.x - halfW;
          const isBull = cluster.footprint.close >= cluster.footprint.open;

          return (
            <g key={cluster.footprint.time}>
              {/* High-Low Wick Center Line */}
              <line
                x1={cluster.x}
                y1={cluster.topY}
                x2={cluster.x}
                y2={cluster.bottomY}
                stroke={isBull ? '#26a69a' : '#ef5350'}
                strokeWidth={1.5}
                strokeOpacity={0.4}
              />

              {/* Price Levels Grid */}
              {cluster.levels.map((lvl, idx) => {
                const rowH = 14;
                const rowY = lvl.y - rowH / 2;
                const totalVol = lvl.bid + lvl.ask;
                const bidRatio = Math.min(1, lvl.bid / (lvl.maxVol * 0.7));
                const askRatio = Math.min(1, lvl.ask / (lvl.maxVol * 0.7));

                return (
                  <g key={idx}>
                    {/* Background Bar Fill - Bid (Left) */}
                    <rect
                      x={startX}
                      y={rowY}
                      width={halfW}
                      height={rowH - 1}
                      fill="rgba(239, 83, 80, 0.22)"
                      opacity={bidRatio}
                    />

                    {/* Background Bar Fill - Ask (Right) */}
                    <rect
                      x={cluster.x}
                      y={rowY}
                      width={halfW}
                      height={rowH - 1}
                      fill="rgba(38, 166, 154, 0.22)"
                      opacity={askRatio}
                    />

                    {/* POC Highlight Border */}
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

                    {/* Divider between Bid and Ask */}
                    <line
                      x1={cluster.x}
                      y1={rowY}
                      x2={cluster.x}
                      y2={rowY + rowH - 1}
                      stroke="rgba(255, 255, 255, 0.15)"
                      strokeWidth={1}
                    />

                    {/* Bid Volume Text (Left) */}
                    <text
                      x={cluster.x - 3}
                      y={rowY + rowH - 4}
                      textAnchor="end"
                      fill={lvl.bidImbalance ? '#f43f5e' : '#e2e8f0'}
                      fontWeight={lvl.bidImbalance ? 'bold' : 'normal'}
                      fontSize="8px"
                    >
                      {lvl.bid}
                    </text>

                    {/* Ask Volume Text (Right) */}
                    <text
                      x={cluster.x + 3}
                      y={rowY + rowH - 4}
                      textAnchor="start"
                      fill={lvl.askImbalance ? '#22d3ee' : '#e2e8f0'}
                      fontWeight={lvl.askImbalance ? 'bold' : 'normal'}
                      fontSize="8px"
                    >
                      {lvl.ask}
                    </text>
                  </g>
                );
              })}

              {/* Cluster Footer: Candle Delta & Volume */}
              <g transform={`translate(${cluster.x - 25}, ${Math.min(containerHeight - 35, cluster.bottomY + 8)})`}>
                {/* Delta Badge */}
                <rect
                  x={0}
                  y={0}
                  width={50}
                  height={13}
                  rx={2}
                  fill={cluster.footprint.candleDelta >= 0 ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)'}
                  stroke={cluster.footprint.candleDelta >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={0.8}
                />
                <text
                  x={25}
                  y={10}
                  textAnchor="middle"
                  fill={cluster.footprint.candleDelta >= 0 ? '#4ade80' : '#f87171'}
                  fontWeight="bold"
                  fontSize="8px"
                >
                  {cluster.footprint.candleDelta >= 0 ? `+${cluster.footprint.candleDelta}` : cluster.footprint.candleDelta}
                </text>

                {/* Total Volume Badge */}
                <rect
                  x={0}
                  y={15}
                  width={50}
                  height={12}
                  rx={2}
                  fill="rgba(15, 23, 42, 0.8)"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth={0.5}
                />
                <text
                  x={25}
                  y={24}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="7.5px"
                >
                  {cluster.footprint.totalVolume > 1000
                    ? `${(cluster.footprint.totalVolume / 1000).toFixed(1)}k`
                    : cluster.footprint.totalVolume}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
