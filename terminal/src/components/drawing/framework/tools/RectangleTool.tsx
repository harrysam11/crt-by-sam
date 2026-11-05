import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class RectangleTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): RectangleTool {
    return new RectangleTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    const minX = Math.min(pt1.x, pt2.x);
    const maxX = Math.max(pt1.x, pt2.x);
    const minY = Math.min(pt1.y, pt2.y);
    const maxY = Math.max(pt1.y, pt2.y);

    return [
      { id: 'p1', x: pt1.x, y: pt1.y, cursor: 'nwse-resize' },
      { id: 'p2', x: pt2.x, y: pt2.y, cursor: 'nwse-resize' },
      { id: 'mid-top', x: (minX + maxX) / 2, y: minY, cursor: 'ns-resize' },
      { id: 'mid-bottom', x: (minX + maxX) / 2, y: maxY, cursor: 'ns-resize' },
    ];
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    if (!this.p2) return false;
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = coord.pointToXY(this.p2);

    const minX = Math.min(pt1.x, pt2.x);
    const maxX = Math.max(pt1.x, pt2.x);
    const minY = Math.min(pt1.y, pt2.y);
    const maxY = Math.max(pt1.y, pt2.y);

    // Hit test boundary or inside
    const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
    if (inside) return true;

    // Edge proximity
    const dLeft = Math.abs(x - minX);
    const dRight = Math.abs(x - maxX);
    const dTop = Math.abs(y - minY);
    const dBottom = Math.abs(y - maxY);
    const nearEdge =
      (dLeft <= 6 && y >= minY - 6 && y <= maxY + 6) ||
      (dRight <= 6 && y >= minY - 6 && y <= maxY + 6) ||
      (dTop <= 6 && x >= minX - 6 && x <= maxX + 6) ||
      (dBottom <= 6 && x >= minX - 6 && x <= maxX + 6);

    return nearEdge;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    const minX = Math.min(pt1.x, pt2.x);
    const maxX = Math.max(pt1.x, pt2.x);
    const minY = Math.min(pt1.y, pt2.y);
    const maxY = Math.max(pt1.y, pt2.y);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    const strokeDash =
      this.lineStyle === 'dashed' ? '6 4' : this.lineStyle === 'dotted' ? '2 3' : undefined;

    return (
      <g key={this.id}>
        <rect
          x={minX}
          y={minY}
          width={width}
          height={height}
          fill={this.fillColor || this.color}
          fillOpacity={this.fillOpacity ?? 0.15}
          stroke={this.color}
          strokeWidth={this.lineWidth}
          strokeDasharray={strokeDash}
        />
      </g>
    );
  }
}
