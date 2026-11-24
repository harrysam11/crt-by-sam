import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';
import { fmtPrice } from '../../../../utils/formatters';

export class MeasureTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): MeasureTool {
    return new MeasureTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const handles: DrawingHandle[] = [{ id: 'p1', x: pt1.x, y: pt1.y, cursor: 'crosshair' }];
    if (this.p2) {
      const pt2 = coord.pointToXY(this.p2);
      handles.push({ id: 'p2', x: pt2.x, y: pt2.y, cursor: 'crosshair' });
    }
    return handles;
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    if (!this.p2) return false;
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = coord.pointToXY(this.p2);
    const minX = Math.min(pt1.x, pt2.x);
    const maxX = Math.max(pt1.x, pt2.x);
    const minY = Math.min(pt1.y, pt2.y);
    const maxY = Math.max(pt1.y, pt2.y);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol: string
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    const minX = Math.min(pt1.x, pt2.x);
    const maxX = Math.max(pt1.x, pt2.x);
    const minY = Math.min(pt1.y, pt2.y);
    const maxY = Math.max(pt1.y, pt2.y);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    const priceDelta = (this.p2?.price ?? this.p1.price) - this.p1.price;
    const pctDelta = this.p1.price > 0 ? (priceDelta / this.p1.price) * 100 : 0;
    const isUp = priceDelta >= 0;
    const fillColor = isUp ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    const strokeColor = isUp ? '#22c55e' : '#ef4444';

    // Time elapsed string & estimated bars
    let timeLabel = '';
    let barsLabel = '';
    if (this.p1.time && this.p2?.time) {
      const secDiff = Math.abs(this.p2.time - this.p1.time);
      const hours = Math.floor(secDiff / 3600);
      const mins = Math.floor((secDiff % 3600) / 60);
      timeLabel = hours > 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${mins}m`;
      const approxBars = Math.max(1, Math.round(secDiff / 60));
      barsLabel = `${approxBars} bars`;
    }

    const badgeX = Math.max(10, minX + width / 2 - 80);
    const badgeY = Math.max(20, minY + height / 2 - 20);

    return (
      <g key={this.id}>
        {/* Measured bounding box */}
        <rect
          x={minX}
          y={minY}
          width={width}
          height={height}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        {/* Diagonal measurement vector line */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke={strokeColor}
          strokeWidth={1.5}
        />

        {/* Floating statistics badge */}
        <g>
          <rect
            x={badgeX}
            y={badgeY}
            width={160}
            height={40}
            rx={4}
            fill="#101015"
            stroke={strokeColor}
            strokeWidth={1}
            opacity={0.95}
          />
          <text
            x={badgeX + 10}
            y={badgeY + 16}
            fill={isUp ? '#4ade80' : '#f87171'}
            fontSize={11}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {isUp ? '+' : ''}{priceDelta.toFixed(2)} ({isUp ? '+' : ''}{pctDelta.toFixed(2)}%)
          </text>
          {(timeLabel || barsLabel) && (
            <text
              x={badgeX + 10}
              y={badgeY + 31}
              fill="#94a3b8"
              fontSize={10}
              fontFamily="monospace"
            >
              {barsLabel ? `${barsLabel}, ` : ''}{timeLabel}
            </text>
          )}
        </g>
      </g>
    );
  }
}
