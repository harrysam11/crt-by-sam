/**
 * TradingView-Style Perfect Circle / Ellipse Drawing Tool.
 * P1 represents the center of the circle; P2 defines the radius.
 * Ensures the circle remains a true Euclidean circle in screen space regardless of price/time scaling.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem, Point2D } from '../../types';

export class CircleTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
    if (!this.fillColor) {
      this.fillColor = this.color || '#38bdf8';
    }
    if (this.fillOpacity === undefined) {
      this.fillOpacity = 0.15;
    }
  }

  clone(): CircleTool {
    return new CircleTool(this.toJSON());
  }

  // Calculate radius in pixel space
  private getRadius(coord: CoordinateHelper): number {
    const pt1 = coord.pointToXY(this.p1);
    if (!this.p2) return 40;
    const pt2 = coord.pointToXY(this.p2);
    const r = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
    return Math.max(8, r);
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const r = this.getRadius(coord);

    return [
      { id: 'center', x: pt1.x, y: pt1.y, cursor: 'move' },
      { id: 'right', x: pt1.x + r, y: pt1.y, cursor: 'ew-resize' },
      { id: 'top', x: pt1.x, y: pt1.y - r, cursor: 'ns-resize' },
      { id: 'left', x: pt1.x - r, y: pt1.y, cursor: 'ew-resize' },
      { id: 'bottom', x: pt1.x, y: pt1.y + r, cursor: 'ns-resize' },
    ];
  }

  onDragHandle(handleId: string, point: Point2D): void {
    if (this.locked) return;
    if (handleId === 'center') {
      const deltaPrice = point.price - this.p1.price;
      const deltaTime = point.time && this.p1.time ? point.time - this.p1.time : 0;
      this.p1 = { ...point };
      if (this.p2) {
        this.p2.price += deltaPrice;
        if (this.p2.time !== undefined && deltaTime) {
          this.p2.time += deltaTime;
        }
      }
    } else {
      // Any perimeter handle updates p2
      this.p2 = { ...point };
    }
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const pt1 = coord.pointToXY(this.p1);
    const r = this.getRadius(coord);
    const dist = Math.hypot(x - pt1.x, y - pt1.y);

    if (this.fillOpacity && this.fillOpacity > 0.05) {
      return dist <= r + 8;
    }
    return Math.abs(dist - r) <= 10;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    _symbol: string
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const r = this.getRadius(coord);

    const strokeColor = this.color || '#38bdf8';
    const fillCol = this.fillColor || strokeColor;
    const opacity = this.fillOpacity !== undefined ? this.fillOpacity : 0.15;

    return (
      <g key={this.id}>
        {/* Invisible Wide Hit Area */}
        <circle
          cx={pt1.x}
          cy={pt1.y}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.001)"
          strokeWidth={Math.max(14, this.lineWidth + 10)}
          style={{ pointerEvents: 'stroke' }}
        />

        {/* Visible Perfect Geometric Circle */}
        <circle
          cx={pt1.x}
          cy={pt1.y}
          r={r}
          fill={fillCol}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeOpacity={this.lineOpacity !== undefined ? this.lineOpacity : 1}
          strokeWidth={this.lineWidth}
          strokeDasharray={
            this.lineStyle === 'dashed'
              ? '6,4'
              : this.lineStyle === 'dotted'
              ? '2,2'
              : undefined
          }
          className="transition-colors"
        />

        {/* Center Point Indicator when selected */}
        {isSelected && (
          <circle
            cx={pt1.x}
            cy={pt1.y}
            r={3}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth={1.5}
          />
        )}
      </g>
    );
  }
}
