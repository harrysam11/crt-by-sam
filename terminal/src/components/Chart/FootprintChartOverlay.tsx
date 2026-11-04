/**
 * Institutional Footprint / Cluster Chart Overlay (Exocharts / Sierra Chart Parity).
 * Provides multi-mode Order Flow visualization:
 * - BID_ASK: Tabular dual-column Bid x Ask ladder with volume heatmap & 300% diagonal imbalances
 * - DELTA: Price-level net delta profile with directional color gradients
 * - VOLUME: Price-level total volume profile with 70% Value Area (VAH/VAL) and golden Point of Control (POC)
 * - Dynamic Level-of-Detail (LOD): High-density zoomed-in clusters and auto-collapsing micro-profiles
 * - Institutional 3-tier footer: Bar Delta, Delta %, and Volume
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp, LogicalRange } from 'lightweight-charts';
import type { Candle } from '../../types/terminal';
import type { FootprintCandle, FootprintMode } from '../../types/derivatives';
import { generateFootprintCandle } from '../../services/footprintMath';
import { fmtQty } from '../../utils/formatters';

interface FootprintChartOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<'Candlestick'> | null;
  candles: Candle[];
  containerWidth: number;
  containerHeight: number;
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

  // Exocharts Display Controls
  const [mode, setMode] = useState<FootprintMode>('BID_ASK');
  const [imbalanceThreshold, setImbalanceThreshold] = useState<number>(3); // 3x = 300%
  const [tickMultiplier, setTickMultiplier] = useState<number>(1);
  const [showSummaryFooter, setShowSummaryFooter] = useState<boolean>(true);
  const [showValueArea, setShowValueArea] = useState<boolean>(true);

  // Subscribe to timeScale range changes (zoom & pan)
  useEffect(() => {
    if (!chartApi) return;
    const timeScale = chartApi.timeScale();
    const handleRangeChange = (range: LogicalRange | null) => {
      setVisibleRange(range);
    };
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    setVisibleRange(timeScale.getVisibleLogicalRange());

    const handleResize = () => setRerenderKey((k) => k + 1);
    window.addEventListener('resize', handleResize);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [chartApi]);

  // Compute footprint structures for candles respecting tickMultiplier and imbalanceThreshold
  const footprintCache = useMemo(() => {
    const map = new Map<number, FootprintCandle>();
    for (const c of candles) {
      map.set(c.time, generateFootprintCandle(c, tickMultiplier, imbalanceThreshold));
    }
    return map;
  }, [candles, tickMultiplier, imbalanceThreshold]);

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

    const zoomedIn = spacing >= 44;

    // Filter only candles that are inside the visible container viewport
    const visibleFpList: Array<{
      footprint: FootprintCandle;
      x: number;
      topY: number;
      bottomY: number;
      vahY: number | null;
      valY: number | null;
      levels: Array<{
        price: number;
        y: number;
        rowHeight: number;
        bid: number;
        ask: number;
        totalVol: number;
        delta: number;
        isPOC: boolean;
        isValueArea: boolean;
        askImbalance: boolean;
        bidImbalance: boolean;
        maxVol: number;
      }>;
    }> = [];

    const startIndex = visibleRange ? Math.max(0, Math.floor(visibleRange.from) - 2) : Math.max(0, candles.length - 40);
    const endIndex = visibleRange ? Math.min(candles.length - 1, Math.ceil(visibleRange.to) + 2) : candles.length - 1;

    for (let i = startIndex; i <= endIndex; i++) {
      const c = candles[i];
      if (!c) continue;
      const x = timeScale.timeToCoordinate(c.time as UTCTimestamp);
      if (x === null || x < -100 || x > containerWidth + 100) continue;

      const topY = seriesApi.priceToCoordinate(c.high);
      const bottomY = seriesApi.priceToCoordinate(c.low);
      if (topY === null || bottomY === null) continue;

      const fp = footprintCache.get(c.time) ?? generateFootprintCandle(c, tickMultiplier, imbalanceThreshold);
      const vahY = fp.vah ? seriesApi.priceToCoordinate(fp.vah) : null;
      const valY = fp.val ? seriesApi.priceToCoordinate(fp.val) : null;

      let maxVol = 1;
      for (const l of fp.priceLevels) {
        const v = l.bidVolume + l.askVolume;
        if (v > maxVol) maxVol = v;
      }

      const totalLvls = fp.priceLevels.length;
      const avgRowHeight = totalLvls > 1 ? Math.max(10, Math.abs(bottomY - topY) / totalLvls) : 14;

      const levels = fp.priceLevels.map((l) => {
        const y = seriesApi.priceToCoordinate(l.price) ?? 0;
        return {
          price: l.price,
          y,
          rowHeight: avgRowHeight,
          bid: l.bidVolume,
          ask: l.askVolume,
          totalVol: l.bidVolume + l.askVolume,
          delta: l.delta,
          isPOC: !!l.isPOC,
          isValueArea: !!l.isValueArea,
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
        vahY,
        valY,
        levels,
      });
    }

    return { renderedClusters: visibleFpList, barSpacing: spacing, isZoomedIn: zoomedIn };
  }, [chartApi, seriesApi, candles, footprintCache, visibleRange, containerWidth, tickMultiplier, imbalanceThreshold]);

  const handleZoomIn = () => {
    if (!chartApi) return;
    chartApi.timeScale().applyOptions({ barSpacing: 64 });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono select-none">
      {/* Exocharts Floating Control Ribbon (Top-Right) */}
      <div className="pointer-events-auto absolute right-16 top-2.5 z-30 flex items-center gap-1.5 rounded-md border border-grid bg-panel/90 p-1 text-[10px] text-slate-300 shadow-xl backdrop-blur-md">
        <span className="font-bold text-accent px-1">FOOTPRINT</span>

        {/* Mode Selector */}
        <div className="flex items-center rounded bg-slate-900/80 p-0.5 border border-grid">
          {(['BID_ASK', 'DELTA', 'VOLUME'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-1.5 py-0.5 font-semibold transition ${
                mode === m ? 'bg-accent/20 border border-accent text-accent' : 'text-slate-400 hover:text-white'
              }`}
            >
              {m === 'BID_ASK' ? 'Bid x Ask' : m === 'DELTA' ? 'Delta' : 'Volume'}
            </button>
          ))}
        </div>

        {/* Imbalance Filter */}
        <button
          onClick={() => setImbalanceThreshold((v) => (v === 3 ? 4 : v === 4 ? 0 : 3))}
          className={`rounded border border-grid px-1.5 py-0.5 font-semibold transition ${
            imbalanceThreshold > 0 ? 'bg-amber-500/15 border-amber-500/50 text-amber-400' : 'text-slate-400'
          }`}
          title="Diagonal Volume Imbalance Threshold"
        >
          {imbalanceThreshold > 0 ? `${imbalanceThreshold * 100}% Imb` : 'Imb Off'}
        </button>

        {/* Value Area Toggle */}
        <button
          onClick={() => setShowValueArea((v) => !v)}
          className={`rounded border border-grid px-1.5 py-0.5 font-semibold transition ${
            showValueArea ? 'bg-sky-500/15 border-sky-500/50 text-sky-400' : 'text-slate-400'
          }`}
          title="70% Value Area (VAH / VAL)"
        >
          VA 70%
        </button>

        {/* Summary Footer Toggle */}
        <button
          onClick={() => setShowSummaryFooter((v) => !v)}
          className={`rounded border border-grid px-1.5 py-0.5 font-semibold transition ${
            showSummaryFooter ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400' : 'text-slate-400'
          }`}
          title="Candle Delta & Volume Footer"
        >
          Footer
        </button>
      </div>

      {/* Footprint SVG Canvas Layer */}
      <svg className="h-full w-full">
        <defs>
          <linearGradient id="pocGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {renderedClusters.map((cluster) => {
          const colW = isZoomedIn
            ? Math.min(130, Math.max(48, barSpacing * 0.92))
            : Math.max(4, barSpacing * 0.72);
          const halfW = colW / 2;
          const startX = cluster.x - halfW;
          const isBull = cluster.footprint.close >= cluster.footprint.open;

          // LOD: Zoomed-out mode -> Crisp Micro-Delta Profile
          if (!isZoomedIn) {
            return (
              <g key={cluster.footprint.time}>
                {/* Candle Wick */}
                <line
                  x1={cluster.x}
                  y1={cluster.topY}
                  x2={cluster.x}
                  y2={cluster.bottomY}
                  stroke={isBull ? 'rgba(8, 153, 129, 0.45)' : 'rgba(242, 54, 69, 0.45)'}
                  strokeWidth={1}
                />

                {/* Micro Delta Bars */}
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
                      fill={isDeltaPositive ? '#089981' : '#f23645'}
                      opacity={lvl.isPOC ? 1 : 0.75}
                    />
                  );
                })}

                {/* POC Dot Indicator */}
                {cluster.levels.find((l) => l.isPOC) && (
                  <circle
                    cx={cluster.x}
                    cy={cluster.levels.find((l) => l.isPOC)!.y}
                    r={2}
                    fill="#f59e0b"
                  />
                )}
              </g>
            );
          }

          // Zoomed-In Mode: Full Institutional Footprint Cells
          return (
            <g key={cluster.footprint.time}>
              {/* Background Wick */}
              <line
                x1={cluster.x}
                y1={cluster.topY}
                x2={cluster.x}
                y2={cluster.bottomY}
                stroke={isBull ? '#089981' : '#f23645'}
                strokeWidth={1}
                strokeOpacity={0.35}
              />

              {/* Value Area High/Low Shading Bracket */}
              {showValueArea && cluster.vahY !== null && cluster.valY !== null && (
                <rect
                  x={startX - 1}
                  y={cluster.vahY}
                  width={colW + 2}
                  height={Math.max(4, Math.abs(cluster.valY - cluster.vahY))}
                  fill="rgba(56, 189, 248, 0.04)"
                  stroke="rgba(56, 189, 248, 0.25)"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                  rx={2}
                />
              )}

              {/* Price Level Clusters */}
              {cluster.levels.map((lvl, idx) => {
                const rowH = Math.min(22, Math.max(11, lvl.rowHeight));
                const rowY = lvl.y - rowH / 2;
                const showText = rowH >= 11;
                const bidRatio = Math.min(1, lvl.bid / Math.max(1, lvl.maxVol * 0.75));
                const askRatio = Math.min(1, lvl.ask / Math.max(1, lvl.maxVol * 0.75));

                return (
                  <g key={idx}>
                    {mode === 'BID_ASK' && (
                      <>
                        {/* Bid Cell (Left) */}
                        <rect
                          x={startX}
                          y={rowY}
                          width={halfW}
                          height={rowH - 1}
                          fill="#f23645"
                          opacity={0.12 + bidRatio * 0.75}
                        />

                        {/* Ask Cell (Right) */}
                        <rect
                          x={cluster.x}
                          y={rowY}
                          width={halfW}
                          height={rowH - 1}
                          fill="#089981"
                          opacity={0.12 + askRatio * 0.75}
                        />

                        {/* Center Column Divider */}
                        <line
                          x1={cluster.x}
                          y1={rowY}
                          x2={cluster.x}
                          y2={rowY + rowH - 1}
                          stroke="rgba(255, 255, 255, 0.12)"
                          strokeWidth={1}
                        />

                        {/* Bid Volume Number */}
                        {showText && (
                          <text
                            x={cluster.x - 3}
                            y={rowY + rowH - 3.5}
                            textAnchor="end"
                            fill={lvl.bidImbalance ? '#fca5a5' : '#cbd5e1'}
                            fontWeight={lvl.bidImbalance ? 'bold' : 'normal'}
                            fontSize="8.5px"
                          >
                            {lvl.bid}
                          </text>
                        )}

                        {/* Ask Volume Number */}
                        {showText && (
                          <text
                            x={cluster.x + 3}
                            y={rowY + rowH - 3.5}
                            textAnchor="start"
                            fill={lvl.askImbalance ? '#38bdf8' : '#cbd5e1'}
                            fontWeight={lvl.askImbalance ? 'bold' : 'normal'}
                            fontSize="8.5px"
                          >
                            {lvl.ask}
                          </text>
                        )}
                      </>
                    )}

                    {mode === 'DELTA' && (
                      <>
                        {/* Background Base */}
                        <rect
                          x={startX}
                          y={rowY}
                          width={colW}
                          height={rowH - 1}
                          fill="rgba(15, 23, 42, 0.6)"
                        />

                        {/* Net Delta Horizontal Bar */}
                        {lvl.delta >= 0 ? (
                          <rect
                            x={cluster.x}
                            y={rowY}
                            width={Math.max(2, halfW * Math.min(1, lvl.delta / Math.max(1, lvl.maxVol * 0.6)))}
                            height={rowH - 1}
                            fill="#089981"
                            opacity={0.85}
                          />
                        ) : (
                          <rect
                            x={cluster.x - Math.max(2, halfW * Math.min(1, Math.abs(lvl.delta) / Math.max(1, lvl.maxVol * 0.6)))}
                            y={rowY}
                            width={Math.max(2, halfW * Math.min(1, Math.abs(lvl.delta) / Math.max(1, lvl.maxVol * 0.6)))}
                            height={rowH - 1}
                            fill="#f23645"
                            opacity={0.85}
                          />
                        )}

                        {/* Center Zero Line */}
                        <line
                          x1={cluster.x}
                          y1={rowY}
                          x2={cluster.x}
                          y2={rowY + rowH - 1}
                          stroke="rgba(255, 255, 255, 0.25)"
                          strokeWidth={1}
                        />

                        {/* Delta Text */}
                        {showText && (
                          <text
                            x={lvl.delta >= 0 ? cluster.x + 4 : cluster.x - 4}
                            y={rowY + rowH - 3.5}
                            textAnchor={lvl.delta >= 0 ? 'start' : 'end'}
                            fill={lvl.delta >= 0 ? '#4ade80' : '#f87171'}
                            fontWeight="bold"
                            fontSize="8px"
                          >
                            {lvl.delta >= 0 ? `+${lvl.delta}` : lvl.delta}
                          </text>
                        )}
                      </>
                    )}

                    {mode === 'VOLUME' && (
                      <>
                        {/* Background Base */}
                        <rect
                          x={startX}
                          y={rowY}
                          width={colW}
                          height={rowH - 1}
                          fill="rgba(15, 23, 42, 0.6)"
                        />

                        {/* Total Volume Horizontal Bar */}
                        <rect
                          x={startX}
                          y={rowY}
                          width={colW * Math.min(1, lvl.totalVol / Math.max(1, lvl.maxVol))}
                          height={rowH - 1}
                          fill={lvl.isPOC ? '#f59e0b' : 'rgba(76, 141, 255, 0.7)'}
                        />

                        {/* Volume Text */}
                        {showText && (
                          <text
                            x={cluster.x}
                            y={rowY + rowH - 3.5}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontWeight={lvl.isPOC ? 'bold' : 'normal'}
                            fontSize="8px"
                          >
                            {fmtQty(lvl.totalVol)}
                          </text>
                        )}
                      </>
                    )}

                    {/* Point of Control (POC) Golden Frame */}
                    {lvl.isPOC && (
                      <g>
                        <rect
                          x={startX}
                          y={rowY}
                          width={colW}
                          height={rowH - 1}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={1.8}
                          rx={1}
                        />
                        <rect
                          x={cluster.x + halfW - 14}
                          y={rowY - 1}
                          width={14}
                          height={7}
                          fill="#f59e0b"
                          rx={1}
                        />
                        <text
                          x={cluster.x + halfW - 7}
                          y={rowY + 4.5}
                          textAnchor="middle"
                          fill="#000000"
                          fontWeight="bold"
                          fontSize="5.5px"
                        >
                          POC
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Institutional 3-Tier Summary Footer (Exocharts Standard) */}
              {showSummaryFooter && (
                <g transform={`translate(${cluster.x - Math.min(28, halfW)}, ${Math.min(containerHeight - 44, cluster.bottomY + 6)})`}>
                  {/* Delta Row */}
                  <rect
                    x={0}
                    y={0}
                    width={Math.min(56, colW)}
                    height={11}
                    fill={cluster.footprint.candleDelta >= 0 ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)'}
                    stroke={cluster.footprint.candleDelta >= 0 ? '#089981' : '#f23645'}
                    strokeWidth={0.8}
                  />
                  <text
                    x={Math.min(28, halfW)}
                    y={8}
                    textAnchor="middle"
                    fill={cluster.footprint.candleDelta >= 0 ? '#4ade80' : '#f87171'}
                    fontWeight="bold"
                    fontSize="7.5px"
                  >
                    Δ {cluster.footprint.candleDelta >= 0 ? `+${cluster.footprint.candleDelta}` : cluster.footprint.candleDelta}
                  </text>

                  {/* Delta % Row */}
                  <rect
                    x={0}
                    y={11}
                    width={Math.min(56, colW)}
                    height={10}
                    fill="rgba(11, 14, 20, 0.9)"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={Math.min(28, halfW)}
                    y={18.5}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="7px"
                  >
                    {cluster.footprint.totalVolume > 0
                      ? `${((cluster.footprint.candleDelta / cluster.footprint.totalVolume) * 100).toFixed(1)}%`
                      : '0.0%'}
                  </text>

                  {/* Total Volume Row */}
                  <rect
                    x={0}
                    y={21}
                    width={Math.min(56, colW)}
                    height={10}
                    fill="rgba(11, 14, 20, 0.9)"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={Math.min(28, halfW)}
                    y={28.5}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontWeight="medium"
                    fontSize="7px"
                  >
                    Vol {fmtQty(cluster.footprint.totalVolume)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Zoom Helper Pill when zoomed out */}
      {!isZoomedIn && (
        <div className="pointer-events-auto absolute bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-grid bg-panel/95 px-3 py-1 text-[11px] text-slate-300 shadow-2xl backdrop-blur-md">
          <span>Scroll wheel to zoom in for Bid x Ask clusters</span>
          <button
            onClick={handleZoomIn}
            className="rounded bg-accent/20 border border-accent px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent hover:text-black transition"
          >
            Zoom In
          </button>
        </div>
      )}
    </div>
  );
}
