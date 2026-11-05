import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class VerticalLineTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): VerticalLineTool {
    return new VerticalLineTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const x = coord.timeToX(this.p1.time, this.p1.x);
    return [{ id: 'p1', x, y: coord.height / 2, cursor: 'ew-resize' }];
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const lineX = coord.timeToX(this.p1.time, this.p1.x);
    return Math.abs(x - lineX) <= Math.max(6, this.lineWidth + 4);
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    const x = coord.timeToX(this.p1.time, this.p1.x);
    const strokeDash =
      this.lineStyle === 'dashed' ? '6 4' : this.lineStyle === 'dotted' ? '2 3' : undefined;

    const timeLabel = this.p1.time
      ? new Date(this.p1.time * 1000).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <g key={this.id}>
        <line
          x1={x}
          y1={0}
          x2={x}
          y2="100%"
          stroke="transparent"
          strokeWidth={Math.max(12, this.lineWidth + 8)}
        />
        <line
          x1={x}
          y1={0}
          x2={x}
          y2="100%"
          stroke={this.color}
          strokeWidth={this.lineWidth}
          strokeDasharray={strokeDash}
        />
        {/* Time label badge docked to bottom of chart */}
        {timeLabel && (
          <g>
            <rect
              x={x - 45}
              y={coord.height - 24}
              width={90}
              height={20}
              rx={3}
              fill="#181820"
              stroke={isSelected ? '#38bdf8' : this.color}
              strokeWidth={1}
            />
            <text
              x={x}
              y={coord.height - 10}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={10}
              fontFamily="monospace"
            >
              {timeLabel}
            </text>
          </g>
        )}
      </g>
    );
  }
}
