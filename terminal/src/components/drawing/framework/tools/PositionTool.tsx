/**
 * TradingView-Style Long & Short Position Drawing Tool.
 * Provides risk/reward visualization, profit target zone, stop loss zone,
 * draggable target/stop/entry/width handles, and institutional price tag badges.
 * ZERO EMOJI POLICY strictly enforced.
 */

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

    // Initialize sensible defaults if not set
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
    const entryPrice = this.entryPrice ?? this.p1.price;
    const targetPrice = this.targetPrice ?? (this.isLong ? entryPrice * 1.03 : entryPrice * 0.97);
    const stopPrice = this.stopPrice ?? (this.isLong ? entryPrice * 0.985 : entryPrice * 1.015);

    const targetY = coord.priceToY(targetPrice);
    const stopY = coord.priceToY(stopPrice);
    const entryY = coord.priceToY(entryPrice);

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
    } else if (handleId === 'entry' || handleId === 'p1') {
      const oldEntry = this.entryPrice ?? this.p1.price;
      const delta = point.price - oldEntry;
      this.entryPrice = point.price;
      this.p1.price = point.price;
      if (this.targetPrice !== undefined) this.targetPrice += delta;
      if (this.stopPrice !== undefined) this.stopPrice += delta;
    } else if (handleId === 'width' || handleId === 'p2') {
      this.p2 = { ...point, price: this.entryPrice ?? this.p1.price };
    }
  }

  onTranslate(deltaPrice: number, deltaTime: number): void {
    if (this.locked) return;
    this.p1.price += deltaPrice;
    if (this.p1.time !== undefined && deltaTime) this.p1.time += deltaTime;

    if (this.p2) {
      this.p2.price += deltaPrice;
      if (this.p2.time !== undefined && deltaTime) this.p2.time += deltaTime;
    }
    if (this.entryPrice !== undefined) this.entryPrice += deltaPrice;
    if (this.targetPrice !== undefined) this.targetPrice += deltaPrice;
    if (this.stopPrice !== undefined) this.stopPrice += deltaPrice;
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const pt1 = coord.pointToXY(this.p1);
    const rightX = this.p2 ? coord.timeToX(this.p2.time, this.p2.x) : pt1.x + 180;
    const leftX = Math.min(pt1.x, rightX);
    const maxX = Math.max(pt1.x, rightX);

    const entryPrice = this.entryPrice ?? this.p1.price;
    const targetPrice = this.targetPrice ?? (this.isLong ? entryPrice * 1.03 : entryPrice * 0.97);
    const stopPrice = this.stopPrice ?? (this.isLong ? entryPrice * 0.985 : entryPrice * 1.015);

    const targetY = coord.priceToY(targetPrice);
    const stopY = coord.priceToY(stopPrice);
    const entryY = coord.priceToY(entryPrice);
    const minY = Math.min(targetY, stopY, entryY);
    const maxY = Math.max(targetY, stopY, entryY);

    return x >= leftX - 4 && x <= maxX + 4 && y >= minY - 4 && y <= maxY + 4;
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

    const entryPrice = this.entryPrice ?? this.p1.price;
    const targetPrice = this.targetPrice ?? (this.isLong ? entryPrice * 1.03 : entryPrice * 0.97);
    const stopPrice = this.stopPrice ?? (this.isLong ? entryPrice * 0.985 : entryPrice * 1.015);

    const entryY = coord.priceToY(entryPrice);
    const targetY = coord.priceToY(targetPrice);
    const stopY = coord.priceToY(stopPrice);

    const targetHeight = Math.max(2, Math.abs(targetY - entryY));
    const stopHeight = Math.max(2, Math.abs(stopY - entryY));

    const reward = Math.abs(targetPrice - entryPrice);
    const risk = Math.max(0.0000001, Math.abs(entryPrice - stopPrice));
    const rr = (reward / risk).toFixed(2);

    const targetPct = entryPrice > 0 ? ((reward / entryPrice) * 100).toFixed(2) : '0';
    const stopPct = entryPrice > 0 ? ((risk / entryPrice) * 100).toFixed(2) : '0';

    const targetTagText = `TP ${fmtPrice(targetPrice, symbol)} (+${targetPct}%)`;
    const stopTagText = `SL ${fmtPrice(stopPrice, symbol)} (-${stopPct}%)`;
    const entryTagText = fmtPrice(entryPrice, symbol);

    return (
      <g key={this.id}>
        {/* Target profit zone (green) */}
        <rect
          x={leftX}
          y={Math.min(targetY, entryY)}
          width={width}
          height={targetHeight}
          fill="rgba(34, 197, 94, 0.2)"
          stroke="#22c55e"
          strokeWidth={1.2}
        />

        {/* Stop loss zone (red) */}
        <rect
          x={leftX}
          y={Math.min(stopY, entryY)}
          width={width}
          height={stopHeight}
          fill="rgba(239, 68, 68, 0.2)"
          stroke="#ef4444"
          strokeWidth={1.2}
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

        {/* Central Information HUD Card */}
        <rect
          x={leftX + width / 2 - 75}
          y={entryY - 12}
          width={150}
          height={24}
          fill="#0e1118"
          stroke={isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'}
          strokeWidth={1}
          rx={4}
          className="shadow-xl"
        />
        <text
          x={leftX + width / 2}
          y={entryY + 4}
          fill="#ffffff"
          fontSize={10.5}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          {this.isLong ? 'Long' : 'Short'} | R:R {rr}
        </text>

        {/* Target Price Tag Badge (Green) on Right Edge */}
        <g className="font-mono text-[10px]">
          <rect
            x={leftX + width + 4}
            y={targetY - 10}
            width={targetTagText.length * 6.5 + 10}
            height={20}
            rx={3}
            fill="#052e16"
            stroke="#22c55e"
            strokeWidth={1}
          />
          <text
            x={leftX + width + 9}
            y={targetY + 4}
            fill="#4ade80"
            fontSize={10}
            fontWeight="bold"
          >
            {targetTagText}
          </text>
        </g>

        {/* Stop Price Tag Badge (Red) on Right Edge */}
        <g className="font-mono text-[10px]">
          <rect
            x={leftX + width + 4}
            y={stopY - 10}
            width={stopTagText.length * 6.5 + 10}
            height={20}
            rx={3}
            fill="#450a0a"
            stroke="#ef4444"
            strokeWidth={1}
          />
          <text
            x={leftX + width + 9}
            y={stopY + 4}
            fill="#f87171"
            fontSize={10}
            fontWeight="bold"
          >
            {stopTagText}
          </text>
        </g>

        {/* Entry Price Tag Badge (Slate) on Right Edge */}
        <g className="font-mono text-[10px]">
          <rect
            x={leftX + width + 4}
            y={entryY - 9}
            width={entryTagText.length * 6.5 + 10}
            height={18}
            rx={3}
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth={1}
          />
          <text
            x={leftX + width + 9}
            y={entryY + 3.5}
            fill="#cbd5e1"
            fontSize={9.5}
            fontWeight="bold"
          >
            {entryTagText}
          </text>
        </g>
      </g>
    );
  }
}
