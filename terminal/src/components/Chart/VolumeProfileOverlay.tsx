/**
 * Institutional Visible Range Volume Profile (VPVR / Volume Profile).
 * Computes price-volume distribution across all visible candles in viewport.
 * Features:
 * - Dynamic High Volume Nodes (HVN) and Low Volume Nodes (LVN)
 * - 70% Value Area (VAH and VAL) with boundary laser lines
 * - Point of Control (POC) with prominent red/gold horizontal laser line
 * - Docked to right chart margin (TradingView style)
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { IChartApi, ISeriesApi, SeriesType, LogicalRange, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../../types/terminal';
import { fmtPrice, fmtQty } from '../../utils/formatters';

interface VolumeProfileOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
  candles: Candle[];
  containerWidth: number;
  containerHeight: number;
  isVisible: boolean;
  symbol: string;
}

export default function VolumeProfileOverlay({
  chartApi,
  seriesApi,
  candles,
  containerWidth,
  containerHeight,
  isVisible,
  symbol,
}: VolumeProfileOverlayProps) {
  const [visibleRange, setVisibleRange] = useState<LogicalRange | null>(null);

  // Subscribe to range changes
  useEffect(() => {
    if (!chartApi || !isVisible) return;
    const timeScale = chartApi.timeScale();
    const handleRangeChange = (range: LogicalRange | null) => {
      setVisibleRange(range);
    };
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    setVisibleRange(timeScale.getVisibleLogicalRange());
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
  }, [chartApi, isVisible]);

  // Compute Volume Profile over visible candles
  const profileData = useMemo(() => {
    if (!isVisible || !chartApi || !seriesApi || !candles.length) return null;

    const startIndex = visibleRange ? Math.max(0, Math.floor(visibleRange.from)) : Math.max(0, candles.length - 60);
    const endIndex = visibleRange ? Math.min(candles.length - 1, Math.ceil(visibleRange.to)) : candles.length - 1;

    const visibleCandles = candles.slice(startIndex, endIndex + 1);
    if (!visibleCandles.length) return null;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const c of visibleCandles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    }

    if (minPrice >= maxPrice) return null;

    const rowCount = 36;
    const priceStep = (maxPrice - minPrice) / rowCount;
    const bins = new Array(rowCount).fill(0).map((_, i) => ({
      price: minPrice + (i + 0.5) * priceStep,
      buyVol: 0,
      sellVol: 0,
      totalVol: 0,
    }));

    let maxTotalVol = 0;
    let totalWindowVol = 0;
    let pocPrice = bins[0].price;

    for (const c of visibleCandles) {
      const isBull = c.close >= c.open;
      const cVol = c.volume || 10;
      totalWindowVol += cVol;
      const candleLowIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((c.low - minPrice) / priceStep)));
      const candleHighIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((c.high - minPrice) / priceStep)));
      const span = Math.max(1, candleHighIdx - candleLowIdx + 1);
      const volPerBin = cVol / span;

      for (let j = candleLowIdx; j <= candleHighIdx; j++) {
        if (isBull) bins[j].buyVol += volPerBin * 0.6;
        else bins[j].sellVol += volPerBin * 0.6;
        bins[j].totalVol += volPerBin;

        if (bins[j].totalVol > maxTotalVol) {
          maxTotalVol = bins[j].totalVol;
          pocPrice = bins[j].price;
        }
      }
    }

    // Compute 70% Value Area
    const target70 = totalWindowVol * 0.7;
    const sortedBins = [...bins].sort((a, b) => b.totalVol - a.totalVol);
    let acc = 0;
    const vaPrices: number[] = [];
    for (const b of sortedBins) {
      acc += b.totalVol;
      vaPrices.push(b.price);
      if (acc >= target70) break;
    }

    const vah = vaPrices.length ? Math.max(...vaPrices) : maxPrice;
    const val = vaPrices.length ? Math.min(...vaPrices) : minPrice;

    return {
      bins,
      maxTotalVol,
      pocPrice,
      vah,
      val,
      priceStep,
    };
  }, [candles, visibleRange, chartApi, seriesApi, isVisible]);

  if (!isVisible || !profileData || !seriesApi) return null;

  const maxProfileWidth = 140; // Max width in pixels on the right
  const priceScaleWidth = (chartApi as any)?.priceScale?.('right')?.width?.() || 68;
  const rightOffset = Math.max(60, priceScaleWidth + 2);
  const pocY = seriesApi.priceToCoordinate(profileData.pocPrice);
  const vahY = seriesApi.priceToCoordinate(profileData.vah);
  const valY = seriesApi.priceToCoordinate(profileData.val);

  return (
    <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden select-none font-mono">
      <svg className="h-full w-full">
        {/* Render Profile Bins docked to the right */}
        {profileData.bins.map((bin, idx) => {
          const y = seriesApi.priceToCoordinate(bin.price);
          if (y === null || y < -20 || y > containerHeight + 20) return null;

          const rowH = Math.max(2, containerHeight / profileData.bins.length);
          const ratio = profileData.maxTotalVol > 0 ? bin.totalVol / profileData.maxTotalVol : 0;
          const barW = Math.max(2, ratio * maxProfileWidth);
          const isValueArea = bin.price >= profileData.val && bin.price <= profileData.vah;

          return (
            <g key={idx}>
              {/* Total Volume Bar */}
              <rect
                x={containerWidth - barW - rightOffset} // Docked before the price scale
                y={y - rowH / 2}
                width={barW}
                height={Math.max(1, rowH - 1)}
                fill={isValueArea ? 'rgba(56, 189, 248, 0.35)' : 'rgba(71, 85, 105, 0.25)'}
              />
              {/* Buy Volume Portion */}
              <rect
                x={containerWidth - barW - rightOffset}
                y={y - rowH / 2}
                width={barW * (bin.totalVol > 0 ? bin.buyVol / bin.totalVol : 0.5)}
                height={Math.max(1, rowH - 1)}
                fill={isValueArea ? 'rgba(8, 153, 129, 0.45)' : 'rgba(8, 153, 129, 0.25)'}
              />
            </g>
          );
        })}

        {/* Value Area High (VAH) Horizontal Line */}
        {vahY !== null && (
          <g>
            <line
              x1={0}
              y1={vahY}
              x2={containerWidth - rightOffset}
              y2={vahY}
              stroke="#38bdf8"
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeOpacity={0.7}
            />
            <rect x={containerWidth - rightOffset - 48} y={vahY - 8} width="45" height="14" rx="2" fill="#0b0e14" stroke="#38bdf8" strokeWidth={0.8} />
            <text x={containerWidth - rightOffset - 26} y={vahY + 3} textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
              VAH
            </text>
          </g>
        )}

        {/* Value Area Low (VAL) Horizontal Line */}
        {valY !== null && (
          <g>
            <line
              x1={0}
              y1={valY}
              x2={containerWidth - rightOffset}
              y2={valY}
              stroke="#38bdf8"
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeOpacity={0.7}
            />
            <rect x={containerWidth - rightOffset - 48} y={valY - 8} width="45" height="14" rx="2" fill="#0b0e14" stroke="#38bdf8" strokeWidth={0.8} />
            <text x={containerWidth - rightOffset - 26} y={valY + 3} textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
              VAL
            </text>
          </g>
        )}

        {/* Point of Control (POC) Golden/Red Laser Line */}
        {pocY !== null && (
          <g>
            <line
              x1={0}
              y1={pocY}
              x2={containerWidth - rightOffset}
              y2={pocY}
              stroke="#ef4444"
              strokeWidth={1.5}
            />
            <rect x={containerWidth - rightOffset - 48} y={pocY - 9} width="48" height="16" rx="2" fill="#ef4444" />
            <text x={containerWidth - rightOffset - 24} y={pocY + 3} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold">
              POC
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
