import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';
import { fmtPrice, fmtQty } from '../../../../utils/formatters';

export class AnchoredVolumeProfileTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): AnchoredVolumeProfileTool {
    return new AnchoredVolumeProfileTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : { x: Math.min(coord.width - 20, pt1.x + 180), y: pt1.y };

    return [
      { id: 'p1', x: pt1.x, y: pt1.y, cursor: 'ew-resize' },
      { id: 'p2', x: pt2.x, y: pt2.y, cursor: 'ew-resize' },
    ];
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : { x: Math.min(coord.width - 20, pt1.x + 180), y: pt1.y };

    const minX = Math.min(pt1.x, pt2.x);
    const maxX = Math.max(pt1.x, pt2.x);

    // Hit test within horizontal span and vertical chart window
    if (x >= minX - 10 && x <= maxX + 10 && y >= 10 && y <= coord.height - 10) {
      return true;
    }
    return Math.hypot(x - pt1.x, y - pt1.y) <= 15 || Math.hypot(x - pt2.x, y - pt2.y) <= 15;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol?: string
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : { x: Math.min(coord.width - 20, pt1.x + 180), y: pt1.y };
    const anchorX = Math.min(pt1.x, pt2.x);
    const endX = Math.max(pt1.x, pt2.x);
    const candles = coord.candles || [];
    if (!candles.length) return null;

    // Determine candle range strictly from user-defined start to end anchor
    const anchorTime = this.p1.time ?? (candles[Math.max(0, candles.length - 60)]?.time || candles[0].time);
    const endTime = this.p2?.time ?? (candles.find((c) => coord.timeToX(c.time, -999) >= pt2.x)?.time || (anchorTime + 3600 * 24));

    const startCandleTime = Math.min(anchorTime, endTime);
    const endCandleTime = Math.max(anchorTime, endTime);

    let rangeCandles = candles.filter((c) => c.time >= startCandleTime && c.time <= endCandleTime);
    if (!rangeCandles.length) {
      const idx = candles.findIndex((c) => c.time >= startCandleTime);
      if (idx !== -1) {
        rangeCandles = candles.slice(idx, idx + 2);
      } else {
        rangeCandles = candles.slice(-5);
      }
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalVol = 0;
    for (const c of rangeCandles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      totalVol += c.volume || 10;
    }

    if (minPrice >= maxPrice || totalVol <= 0 || Math.abs(endX - anchorX) < 6) {
      // Creation preview: show anchor guidelines and guide badge while user drags or selects end point
      return (
        <g key={this.id} className="select-none font-mono">
          <line
            x1={anchorX}
            y1={10}
            x2={anchorX}
            y2={coord.height - 10}
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <line
            x1={anchorX}
            y1={pt1.y}
            x2={endX}
            y2={pt2.y}
            stroke="#38bdf8"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <rect
            x={anchorX - 35}
            y={Math.max(10, pt1.y - 24)}
            width={70}
            height={18}
            rx={3}
            fill="#090a0f"
            stroke="#38bdf8"
            strokeWidth={1}
          />
          <text
            x={anchorX}
            y={Math.max(10, pt1.y - 24) + 12}
            fill="#38bdf8"
            fontSize={9.5}
            fontWeight="bold"
            textAnchor="middle"
          >
            AVP START
          </text>
        </g>
      );
    }

    const rowCount = 28;
    const priceStep = (maxPrice - minPrice) / rowCount;
    const bins = new Array(rowCount).fill(0).map((_, i) => ({
      price: minPrice + (i + 0.5) * priceStep,
      buyVol: 0,
      sellVol: 0,
      totalVol: 0,
    }));

    let maxBinVol = 0;
    let pocPrice = bins[0].price;

    for (const c of rangeCandles) {
      const isBull = c.close >= c.open;
      const cVol = c.volume || 10;
      const lowIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((c.low - minPrice) / priceStep)));
      const highIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((c.high - minPrice) / priceStep)));
      const span = Math.max(1, highIdx - lowIdx + 1);
      const volPerBin = cVol / span;

      for (let j = lowIdx; j <= highIdx; j++) {
        if (isBull) bins[j].buyVol += volPerBin * 0.65;
        else bins[j].sellVol += volPerBin * 0.65;
        bins[j].totalVol += volPerBin;

        if (bins[j].totalVol > maxBinVol) {
          maxBinVol = bins[j].totalVol;
          pocPrice = bins[j].price;
        }
      }
    }

    // 70% Value Area calculation
    const target70 = totalVol * 0.7;
    const sortedBins = [...bins].sort((a, b) => b.totalVol - a.totalVol);
    let acc = 0;
    const vaPrices: number[] = [];
    for (const b of sortedBins) {
      acc += b.totalVol;
      vaPrices.push(b.price);
      if (acc >= target70) break;
    }

    const vahPrice = vaPrices.length ? Math.max(...vaPrices) : maxPrice;
    const valPrice = vaPrices.length ? Math.min(...vaPrices) : minPrice;

    const maxBarWidth = Math.min(320, Math.max(30, (endX - anchorX) * 0.88));

    const pocY = coord.priceToY(pocPrice);
    const vahY = coord.priceToY(vahPrice);
    const valY = coord.priceToY(valPrice);

    return (
      <g key={this.id} className="select-none font-mono">
        {/* Value Area Shaded Zone */}
        <rect
          x={anchorX}
          y={Math.min(vahY, valY)}
          width={Math.max(10, endX - anchorX)}
          height={Math.max(4, Math.abs(valY - vahY))}
          fill="rgba(59, 130, 246, 0.08)"
          stroke="rgba(59, 130, 246, 0.35)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {/* Start Anchor Vertical Line */}
        <line
          x1={anchorX}
          y1={Math.min(coord.priceToY(maxPrice), 20)}
          x2={anchorX}
          y2={Math.max(coord.priceToY(minPrice), coord.height - 20)}
          stroke={this.color || '#38bdf8'}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* End Boundary Vertical Line */}
        <line
          x1={endX}
          y1={Math.min(coord.priceToY(maxPrice), 20)}
          x2={endX}
          y2={Math.max(coord.priceToY(minPrice), coord.height - 20)}
          stroke={this.color || '#38bdf8'}
          strokeWidth={1.5}
          strokeDasharray="2 2"
          opacity={0.8}
        />

        {/* Volume Histogram Bars - DMCharts / Vela Institutional Palette */}
        {bins.map((bin, idx) => {
          const binY = coord.priceToY(bin.price);
          const binHeight = Math.max(2, Math.abs(coord.priceToY(bin.price + priceStep / 2) - coord.priceToY(bin.price - priceStep / 2)) - 1);
          const totalWidth = maxBinVol > 0 ? (bin.totalVol / maxBinVol) * maxBarWidth : 0;
          if (totalWidth <= 0) return null;

          const buyRatio = bin.totalVol > 0 ? bin.buyVol / bin.totalVol : 0.5;
          const buyWidth = totalWidth * buyRatio;
          const sellWidth = totalWidth - buyWidth;

          const isInVA = bin.price >= valPrice && bin.price <= vahPrice;
          const buyColor = isInVA ? 'rgba(31, 166, 125, 0.85)' : 'rgba(31, 166, 125, 0.35)';
          const sellColor = isInVA ? 'rgba(193, 80, 101, 0.85)' : 'rgba(193, 80, 101, 0.35)';

          return (
            <g key={idx}>
              {/* Buy Volume Bar */}
              <rect
                x={anchorX}
                y={binY - binHeight / 2}
                width={buyWidth}
                height={binHeight}
                fill={buyColor}
              />
              {/* Sell Volume Bar */}
              <rect
                x={anchorX + buyWidth}
                y={binY - binHeight / 2}
                width={sellWidth}
                height={binHeight}
                fill={sellColor}
              />
            </g>
          );
        })}

        {/* Point of Control (POC) Laser Line & Badge - Institutional Gold #facc15 */}
        <line
          x1={anchorX}
          y1={pocY}
          x2={endX}
          y2={pocY}
          stroke="#facc15"
          strokeWidth={2}
        />
        <rect
          x={endX - 86}
          y={pocY - 9}
          width={86}
          height={18}
          rx={3}
          fill="#facc15"
        />
        <text
          x={endX - 43}
          y={pocY + 4}
          fill="#000000"
          fontSize={10}
          fontWeight="bold"
          textAnchor="middle"
        >
          POC: {fmtPrice(pocPrice, symbol)}
        </text>

        {/* Value Area High (VAH) Line & Badge */}
        <line
          x1={anchorX}
          y1={vahY}
          x2={endX}
          y2={vahY}
          stroke="#38bdf8"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <rect
          x={endX - 86}
          y={vahY - 8}
          width={86}
          height={16}
          rx={3}
          fill="#0c4a6e"
          stroke="#38bdf8"
          strokeWidth={0.5}
        />
        <text
          x={endX - 43}
          y={vahY + 4}
          fill="#38bdf8"
          fontSize={9.5}
          fontWeight="bold"
          textAnchor="middle"
        >
          VAH: {fmtPrice(vahPrice, symbol)}
        </text>

        {/* Value Area Low (VAL) Line & Badge */}
        <line
          x1={anchorX}
          y1={valY}
          x2={endX}
          y2={valY}
          stroke="#38bdf8"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <rect
          x={endX - 86}
          y={valY - 8}
          width={86}
          height={16}
          rx={3}
          fill="#0c4a6e"
          stroke="#38bdf8"
          strokeWidth={0.5}
        />
        <text
          x={endX - 43}
          y={valY + 4}
          fill="#38bdf8"
          fontSize={9.5}
          fontWeight="bold"
          textAnchor="middle"
        >
          VAL: {fmtPrice(valPrice, symbol)}
        </text>

        {/* Start Anchor Pin & Info Badge */}
        <circle
          cx={anchorX}
          cy={pt1.y}
          r={5}
          fill="#38bdf8"
          stroke="#ffffff"
          strokeWidth={2}
        />
        {/* End Boundary Pin */}
        <circle
          cx={endX}
          cy={pt2.y}
          r={5}
          fill="#0284c7"
          stroke="#ffffff"
          strokeWidth={2}
        />
        <g transform={`translate(${anchorX}, ${Math.max(18, pt1.y - 24)})`}>
          <rect
            x={0}
            y={0}
            width={124}
            height={20}
            rx={4}
            fill="#090a0f"
            fillOpacity={0.92}
            stroke="#38bdf8"
            strokeWidth={1}
          />
          <text
            x={6}
            y={14}
            fill="#38bdf8"
            fontSize={10}
            fontWeight="bold"
          >
            AVP ({fmtQty(totalVol)})
          </text>
        </g>
      </g>
    );
  }
}
