import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class BrushTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): BrushTool {
    return new BrushTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    return [{ id: 'p1', x: pt1.x, y: pt1.y, cursor: 'move' }];
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    if (!this.points || this.points.length < 2) return false;

    // Check distance to any line segment in path
    for (let i = 0; i < this.points.length - 1; i++) {
      const ptA = coord.pointToXY(this.points[i]);
      const ptB = coord.pointToXY(this.points[i + 1]);
      const d = Math.hypot(
        (ptB.x - ptA.x) * (ptA.y - y) - (ptA.x - x) * (ptB.y - ptA.y)
      ) / (Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y) || 1);
      if (d <= Math.max(6, this.lineWidth + 4)) return true;
    }

    return false;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    if (!this.points || this.points.length === 0) return null;

    const coords = this.points.map((p) => coord.pointToXY(p));
    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      pathD += ` L ${coords[i].x} ${coords[i].y}`;
    }

    return (
      <g key={this.id}>
        <path
          d={pathD}
          fill="none"
          stroke={this.color}
          strokeWidth={this.lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }
}
