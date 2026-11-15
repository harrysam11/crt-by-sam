/**
 * TradingView-Style Price Tag / Price Label Tool.
 * Renders an institutional callout badge showing the exact formatted price at point P1.
 * Unlike HorizontalLine, this is an localized price badge and arrow pointer that can be freely moved.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem, Point2D } from '../../types';
import { fmtPrice } from '../../../../utils/formatters';

export class PriceLabelTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
    if (!this.color) {
      this.color = '#38bdf8';
    }
  }

  clone(): PriceLabelTool {
    return new PriceLabelTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    return [
      { id: 'p1', x: pt1.x, y: pt1.y, cursor: 'move' },
    ];
  }

  onDragHandle(handleId: string, point: Point2D): void {
    if (this.locked) return;
    if (handleId === 'p1') {
      this.p1 = { ...point };
    }
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const pt1 = coord.pointToXY(this.p1);
    const badgeW = 90;
    const badgeH = 24;
    // Hit test within the badge rectangle (anchored right of pt1 or left)
    return (
      x >= pt1.x - 10 &&
      x <= pt1.x + badgeW + 10 &&
      y >= pt1.y - badgeH / 2 - 6 &&
      y <= pt1.y + badgeH / 2 + 6
    );
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol: string
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const priceText = fmtPrice(this.p1.price, symbol);
    const badgeWidth = Math.max(76, priceText.length * 7.5 + 18);
    const badgeHeight = 22;
    const pointerSize = 6;
    const strokeCol = this.color || '#38bdf8';

    return (
      <g key={this.id} className="cursor-move select-none">
        {/* Invisible Wide Hit Box */}
        <rect
          x={pt1.x - pointerSize - 4}
          y={pt1.y - badgeHeight / 2 - 4}
          width={badgeWidth + pointerSize + 8}
          height={badgeHeight + 8}
          fill="rgba(0,0,0,0.001)"
          style={{ pointerEvents: 'all' }}
        />

        {/* Small Triangle Pointer towards P1 */}
        <polygon
          points={`${pt1.x},${pt1.y} ${pt1.x + pointerSize},${pt1.y - pointerSize} ${pt1.x + pointerSize},${pt1.y + pointerSize}`}
          fill={strokeCol}
        />

        {/* Price Tag Badge Pill */}
        <rect
          x={pt1.x + pointerSize}
          y={pt1.y - badgeHeight / 2}
          width={badgeWidth}
          height={badgeHeight}
          rx={3}
          fill="#131722"
          stroke={isSelected ? '#ffffff' : strokeCol}
          strokeWidth={isSelected ? 1.8 : 1.2}
          className="shadow-lg"
        />

        {/* Price Text */}
        <text
          x={pt1.x + pointerSize + badgeWidth / 2}
          y={pt1.y + 3.5}
          fill="#ffffff"
          fontSize={10.5}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          {priceText}
        </text>

        {/* Center anchor dot when selected */}
        {isSelected && (
          <circle
            cx={pt1.x}
            cy={pt1.y}
            r={3.5}
            fill="#ffffff"
            stroke={strokeCol}
            strokeWidth={1.5}
          />
        )}
      </g>
    );
  }
}
