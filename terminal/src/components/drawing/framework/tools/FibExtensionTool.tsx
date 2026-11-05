import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';
import { fmtPrice } from '../../../../utils/formatters';

const FIB_EXT_LEVELS = [
  { level: 0, color: '#787b86' },
  { level: 0.382, color: '#ff9800' },
  { level: 0.618, color: '#089981' },
  { level: 1.0, color: '#2962ff' },
  { level: 1.272, color: '#e91e63' },
  { level: 1.618, color: '#ab47bc' },
  { level: 2.618, color: '#ff5252' },
];

export class FibExtensionTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): FibExtensionTool {
    return new FibExtensionTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const handles: DrawingHandle[] = [{ id: 'p1', x: pt1.x, y: pt1.y, cursor: 'crosshair' }];
    if (this.p2) {
      const pt2 = coord.pointToXY(this.p2);
      handles.push({ id: 'p2', x: pt2.x, y: pt2.y, cursor: 'crosshair' });
    }
    if (this.p3) {
      const pt3 = coord.pointToXY(this.p3);
      handles.push({ id: 'p3', x: pt3.x, y: pt3.y, cursor: 'crosshair' });
    }
    return handles;
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    if (!this.p2) return false;
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = coord.pointToXY(this.p2);
    const pt3 = this.p3 ? coord.pointToXY(this.p3) : pt2;

    const leftX = pt3.x;
    const rightX = Math.max(coord.width, pt3.x + 200);
    if (x < leftX - 10 || x > rightX + 10) return false;

    const trendDiff = this.p2.price - this.p1.price;
    const basePrice = (this.p3 ?? this.p2).price;

    for (const { level } of FIB_EXT_LEVELS) {
      const levelPrice = basePrice + trendDiff * level;
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
    const pt3 = this.p3 ? coord.pointToXY(this.p3) : pt2;

    const trendDiff = (this.p2?.price ?? this.p1.price) - this.p1.price;
    const basePrice = (this.p3 ?? this.p2 ?? this.p1).price;
    const projLeftX = pt3.x;
    const projRightX = Math.max(pt3.x + 180, pt2.x + 80);

    return (
      <g key={this.id}>
        {/* Trend line 1: p1 -> p2 */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth={1.5}
        />
        {/* Retracement line 2: p2 -> p3 */}
        {this.p3 && (
          <line
            x1={pt2.x}
            y1={pt2.y}
            x2={pt3.x}
            y2={pt3.y}
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Extension levels from p3 */}
        {FIB_EXT_LEVELS.map(({ level, color }) => {
          const price = basePrice + trendDiff * level;
          const y = coord.priceToY(price);
          return (
            <g key={`ext-${level}`}>
              <line
                x1={projLeftX}
                y1={y}
                x2={projRightX}
                y2={y}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 2"
              />
              <text
                x={projLeftX + 4}
                y={y - 3}
                fill={color}
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                Ext {level} ({fmtPrice(price, symbol)})
              </text>
            </g>
          );
        })}
      </g>
    );
  }
}
