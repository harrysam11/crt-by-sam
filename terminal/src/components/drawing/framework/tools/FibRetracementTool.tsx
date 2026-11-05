import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';
import { fmtPrice } from '../../../../utils/formatters';

const FIB_RETRACEMENT_LEVELS = [
  { level: 0, color: '#787b86', fill: 'rgba(120, 123, 134, 0.08)' },
  { level: 0.236, color: '#f23645', fill: 'rgba(242, 54, 69, 0.08)' },
  { level: 0.382, color: '#ff9800', fill: 'rgba(255, 152, 0, 0.08)' },
  { level: 0.5, color: '#4caf50', fill: 'rgba(76, 175, 80, 0.08)' },
  { level: 0.618, color: '#089981', fill: 'rgba(8, 153, 129, 0.08)' },
  { level: 0.786, color: '#2962ff', fill: 'rgba(41, 98, 255, 0.08)' },
  { level: 1.0, color: '#787b86', fill: 'rgba(120, 123, 134, 0.08)' },
  { level: 1.618, color: '#ab47bc', fill: 'rgba(171, 71, 188, 0.08)' },
];

export class FibRetracementTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): FibRetracementTool {
    return new FibRetracementTool(this.toJSON());
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
    if (x < minX - 10 || x > maxX + 10) return false;

    const priceDiff = this.p2.price - this.p1.price;
    for (const { level } of FIB_RETRACEMENT_LEVELS) {
      const levelPrice = this.p1.price + priceDiff * level;
      const levelY = coord.priceToY(levelPrice);
      if (Math.abs(y - levelY) <= 5) return true;
    }

    return false;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol: string
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    const leftX = Math.min(pt1.x, pt2.x);
    const rightX = Math.max(pt1.x, pt2.x);
    const priceDiff = (this.p2?.price ?? this.p1.price) - this.p1.price;

    const renderedLevels = FIB_RETRACEMENT_LEVELS.map(({ level, color, fill }) => {
      const price = this.p1.price + priceDiff * level;
      const y = coord.priceToY(price);
      return { level, color, fill, price, y };
    });

    return (
      <g key={this.id}>
        {/* Shaded bands between levels */}
        {renderedLevels.slice(0, -1).map((cur, idx) => {
          const next = renderedLevels[idx + 1];
          const minY = Math.min(cur.y, next.y);
          const height = Math.abs(next.y - cur.y);
          return (
            <rect
              key={`band-${idx}`}
              x={leftX}
              y={minY}
              width={Math.max(1, rightX - leftX)}
              height={height}
              fill={cur.fill}
            />
          );
        })}

        {/* Diagonal base trendline */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Level lines and labels */}
        {renderedLevels.map(({ level, color, price, y }) => (
          <g key={`lvl-${level}`}>
            <line
              x1={leftX}
              y1={y}
              x2={rightX}
              y2={y}
              stroke={color}
              strokeWidth={level === 0 || level === 1 ? 1.5 : 1}
              strokeDasharray={level === 0 || level === 1 ? undefined : '4 2'}
            />
            {/* Level label */}
            <text
              x={leftX + 4}
              y={y - 3}
              fill={color}
              fontSize={10}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {level} ({fmtPrice(price, symbol)})
            </text>
          </g>
        ))}
      </g>
    );
  }
}
