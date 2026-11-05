import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem, Point2D } from '../../types';
import { fmtPrice } from '../../../../utils/formatters';

export class PositionTool extends BaseDrawingTool {
  public isLong: boolean;

  constructor(item: DrawingItem) {
    super(item);
    this.isLong = item.type === 'POSITION_LONG';

    // Initialize defaults if not set
    const p = item.p1.price;
    if (this.entryPrice === undefined) this.entryPrice = p;
    if (this.targetPrice === undefined) {
      this.targetPrice = this.isLong ? p * 1.03 : p * 0.97;
    }
    if (this.stopPrice === undefined) {
      this.stopPrice = this.isLong ? p * 0.985 : p * 1.015;
    }
  }

  clone(): PositionTool {
    return new PositionTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const targetY = coord.priceToY(this.targetPrice);
    const stopY = coord.priceToY(this.stopPrice);
    const entryY = coord.priceToY(this.entryPrice);

    const rightX = this.p2 ? coord.timeToX(this.p2.time, this.p2.x) : pt1.x + 180;
    const midX = (pt1.x + rightX) / 2;

    return [
      { id: 'target', x: midX, y: targetY, cursor: 'ns-resize' },
      { id: 'entry', x: midX, y: entryY, cursor: 'move' },
      { id: 'stop', x: midX, y: stopY, cursor: 'ns-resize' },
      { id: 'width', x: rightX, y: entryY, cursor: 'ew-resize' },
    ];
  }

  onDragHandle(handleId: string, point: Point2D): void {
    if (this.locked) return;
    if (handleId === 'target') {
      this.targetPrice = point.price;
    } else if (handleId === 'stop') {
      this.stopPrice = point.price;
    } else if (handleId === 'entry') {
      const delta = point.price - (this.entryPrice ?? this.p1.price);
      this.entryPrice = point.price;
      this.p1.price = point.price;
      if (this.targetPrice !== undefined) this.targetPrice += delta;
      if (this.stopPrice !== undefined) this.stopPrice += delta;
    } else if (handleId === 'width') {
      this.p2 = { ...point };
    }
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const pt1 = coord.pointToXY(this.p1);
    const rightX = this.p2 ? coord.timeToX(this.p2.time, this.p2.x) : pt1.x + 180;
    const leftX = Math.min(pt1.x, rightX);
    const maxX = Math.max(pt1.x, rightX);

    const targetY = coord.priceToY(this.targetPrice);
    const stopY = coord.priceToY(this.stopPrice);
    const minY = Math.min(targetY, stopY);
    const maxY = Math.max(targetY, stopY);

    return x >= leftX && x <= maxX && y >= minY && y <= maxY;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol: string
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const rightX = this.p2 ? coord.timeToX(this.p2.time, this.p2.x) : pt1.x + 180;
    const leftX = Math.min(pt1.x, rightX);
    const width = Math.max(60, Math.abs(rightX - pt1.x));

    const entryY = coord.priceToY(this.entryPrice);
    const targetY = coord.priceToY(this.targetPrice);
    const stopY = coord.priceToY(this.stopPrice);

    const targetHeight = Math.abs(targetY - entryY);
    const stopHeight = Math.abs(stopY - entryY);

    const entryPrice = this.entryPrice ?? this.p1.price;
    const targetPrice = this.targetPrice ?? entryPrice;
    const stopPrice = this.stopPrice ?? entryPrice;

    const reward = Math.abs(targetPrice - entryPrice);
    const risk = Math.max(0.0000001, Math.abs(entryPrice - stopPrice));
    const rr = (reward / risk).toFixed(2);

    const targetPct = entryPrice > 0 ? ((reward / entryPrice) * 100).toFixed(2) : '0';
    const stopPct = entryPrice > 0 ? ((risk / entryPrice) * 100).toFixed(2) : '0';

    return (
      <g key={this.id}>
        {/* Target profit zone (green) */}
        <rect
          x={leftX}
          y={Math.min(targetY, entryY)}
          width={width}
          height={Math.max(1, targetHeight)}
          fill="rgba(34, 197, 94, 0.18)"
          stroke="#22c55e"
          strokeWidth={1}
        />

        {/* Stop loss zone (red) */}
        <rect
          x={leftX}
          y={Math.min(stopY, entryY)}
          width={width}
          height={Math.max(1, stopHeight)}
          fill="rgba(239, 68, 68, 0.18)"
          stroke="#ef4444"
          strokeWidth={1}
        />

        {/* Entry line */}
        <line
          x1={leftX}
          y1={entryY}
          x2={leftX + width}
          y2={entryY}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />

        {/* Information HUD Header */}
        <rect
          x={leftX}
          y={entryY - 12}
          width={width}
          height={24}
          fill="#101015"
          stroke={isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)'}
          strokeWidth={1}
          rx={3}
        />
        <text
          x={leftX + 6}
          y={entryY + 4}
          fill="#ffffff"
          fontSize={10}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {this.isLong ? 'Long' : 'Short'} | R:R {rr}
        </text>

        {/* Target Label */}
        <text
          x={leftX + 6}
          y={targetY + (this.isLong ? -4 : 12)}
          fill="#22c55e"
          fontSize={10}
          fontFamily="monospace"
        >
          TP: {fmtPrice(targetPrice, symbol)} (+{targetPct}%)
        </text>

        {/* Stop Label */}
        <text
          x={leftX + 6}
          y={stopY + (this.isLong ? 12 : -4)}
          fill="#ef4444"
          fontSize={10}
          fontFamily="monospace"
        >
          SL: {fmtPrice(stopPrice, symbol)} (-{stopPct}%)
        </text>
      </g>
    );
  }
}
