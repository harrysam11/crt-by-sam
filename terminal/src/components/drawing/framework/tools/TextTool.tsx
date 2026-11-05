import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';

export class TextTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): TextTool {
    return new TextTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const pt1 = coord.pointToXY(this.p1);
    return [{ id: 'p1', x: pt1.x, y: pt1.y, cursor: 'move' }];
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const pt1 = coord.pointToXY(this.p1);
    const textWidth = Math.max(60, (this.text?.length || 4) * 8 + 16);
    const textHeight = 28;
    return x >= pt1.x && x <= pt1.x + textWidth && y >= pt1.y && y <= pt1.y + textHeight;
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper
  ): React.ReactNode {
    const pt1 = coord.pointToXY(this.p1);
    const displayText = this.text || 'Double click to edit';
    const textWidth = Math.max(70, displayText.length * 8 + 20);
    const textHeight = 28;

    return (
      <g key={this.id}>
        {/* Background box */}
        <rect
          x={pt1.x}
          y={pt1.y}
          width={textWidth}
          height={textHeight}
          rx={4}
          fill={this.fillColor || '#181820'}
          stroke={isSelected ? '#38bdf8' : this.color}
          strokeWidth={this.lineWidth}
        />
        {/* Text */}
        <text
          x={pt1.x + 10}
          y={pt1.y + 18}
          fill={this.color || '#ffffff'}
          fontSize={this.fontSize || 12}
          fontFamily="sans-serif"
          fontWeight="500"
        >
          {displayText}
        </text>
      </g>
    );
  }
}
