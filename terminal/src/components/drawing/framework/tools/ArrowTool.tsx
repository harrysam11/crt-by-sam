import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class ArrowTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): ArrowTool {
    return new ArrowTool(this.toJSON());
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
    return dist <= Math.max(6, this.lineWidth + 4);
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    // Calculate arrowhead points
    const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
    const arrowLen = 14;
    const arrowWidth = 7;

    const xArrow1 = pt2.x - arrowLen * Math.cos(angle) + arrowWidth * Math.sin(angle);
    const yArrow1 = pt2.y - arrowLen * Math.sin(angle) - arrowWidth * Math.cos(angle);

    const xArrow2 = pt2.x - arrowLen * Math.cos(angle) - arrowWidth * Math.sin(angle);
    const yArrow2 = pt2.y - arrowLen * Math.sin(angle) + arrowWidth * Math.cos(angle);

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
        {/* Visible arrow shaft */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke={this.color}
          strokeWidth={this.lineWidth}
          strokeDasharray={strokeDash}
        />
        {/* Arrowhead polygon */}
        <polygon
          points={`${pt2.x},${pt2.y} ${xArrow1},${yArrow1} ${xArrow2},${yArrow2}`}
          fill={this.color}
        />
      </g>
    );
  }
}
