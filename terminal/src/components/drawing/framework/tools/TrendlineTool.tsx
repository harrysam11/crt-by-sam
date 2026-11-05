import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class TrendlineTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): TrendlineTool {
    return new TrendlineTool(this.toJSON());
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
    const dist = CoordinateHelper.distanceToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y);
    return dist <= Math.max(6, this.lineWidth + 3);
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    const strokeDash =
      this.lineStyle === 'dashed' ? '6 4' : this.lineStyle === 'dotted' ? '2 3' : undefined;

    return (
      <g key={this.id}>
        {/* Invisible wider hit line */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke="transparent"
          strokeWidth={Math.max(12, this.lineWidth + 8)}
        />
        {/* Visible line */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke={this.color}
          strokeWidth={this.lineWidth}
          strokeDasharray={strokeDash}
          opacity={isHovered ? 0.9 : 1}
        />
      </g>
    );
  }
}
