import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class ParallelChannelTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): ParallelChannelTool {
    return new ParallelChannelTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    const handles: DrawingHandle[] = [{ id: 'p1', x: pt1.x, y: pt1.y, cursor: 'crosshair' }];

    if (this.p2) {
      const pt2 = coord.pointToXY(this.p2);
      handles.push({ id: 'p2', x: pt2.x, y: pt2.y, cursor: 'crosshair' });

      // Offset handle at p3 or perpendicular projection
      if (this.p3) {
        const pt3 = coord.pointToXY(this.p3);
        handles.push({ id: 'p3', x: pt3.x, y: pt3.y, cursor: 'ns-resize' });
      }
    }
    return handles;
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    if (!this.p2) return false;
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = coord.pointToXY(this.p2);

    // Base line hit test
    const dBase = CoordinateHelper.distanceToSegment(x, y, pt1.x, pt1.y, pt2.x, pt2.y);
    if (dBase <= Math.max(6, this.lineWidth + 4)) return true;

    if (this.p3) {
      const pt3 = coord.pointToXY(this.p3);
      // Offset vector
      const offX = pt3.x - pt1.x;
      const offY = pt3.y - pt1.y;
      const par1X = pt1.x + offX;
      const par1Y = pt1.y + offY;
      const par2X = pt2.x + offX;
      const par2Y = pt2.y + offY;

      // Parallel line hit test
      const dPar = CoordinateHelper.distanceToSegment(x, y, par1X, par1Y, par2X, par2Y);
      if (dPar <= Math.max(6, this.lineWidth + 4)) return true;

      // Midline hit test
      const mid1X = (pt1.x + par1X) / 2;
      const mid1Y = (pt1.y + par1Y) / 2;
      const mid2X = (pt2.x + par2X) / 2;
      const mid2Y = (pt2.y + par2Y) / 2;
      const dMid = CoordinateHelper.distanceToSegment(x, y, mid1X, mid1Y, mid2X, mid2Y);
      if (dMid <= Math.max(6, this.lineWidth + 4)) return true;
    }

    return false;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const pt2 = this.p2 ? coord.pointToXY(this.p2) : pt1;

    let par1 = pt1;
    let par2 = pt2;
    let mid1 = pt1;
    let mid2 = pt2;
    let hasOffset = false;

    if (this.p3) {
      hasOffset = true;
      const pt3 = coord.pointToXY(this.p3);
      const offY = pt3.y - pt1.y;
      par1 = { x: pt1.x, y: pt1.y + offY };
      par2 = { x: pt2.x, y: pt2.y + offY };
      mid1 = { x: pt1.x, y: pt1.y + offY / 2 };
      mid2 = { x: pt2.x, y: pt2.y + offY / 2 };
    }

    const strokeDash =
      this.lineStyle === 'dashed' ? '6 4' : this.lineStyle === 'dotted' ? '2 3' : undefined;

    return (
      <g key={this.id}>
        {/* Shaded channel fill between base and parallel line */}
        {hasOffset && (
          <polygon
            points={`${pt1.x},${pt1.y} ${pt2.x},${pt2.y} ${par2.x},${par2.y} ${par1.x},${par1.y}`}
            fill={this.fillColor || this.color}
            fillOpacity={this.fillOpacity ?? 0.12}
          />
        )}
        {/* Base line */}
        <line
          x1={pt1.x}
          y1={pt1.y}
          x2={pt2.x}
          y2={pt2.y}
          stroke={this.color}
          strokeWidth={this.lineWidth}
          strokeDasharray={strokeDash}
        />
        {/* Parallel channel line */}
        {hasOffset && (
          <line
            x1={par1.x}
            y1={par1.y}
            x2={par2.x}
            y2={par2.y}
            stroke={this.color}
            strokeWidth={this.lineWidth}
            strokeDasharray={strokeDash}
          />
        )}
        {/* Midline (dashed 50%) */}
        {hasOffset && (
          <line
            x1={mid1.x}
            y1={mid1.y}
            x2={mid2.x}
            y2={mid2.y}
            stroke={this.color}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
        )}
      </g>
    );
  }
}
