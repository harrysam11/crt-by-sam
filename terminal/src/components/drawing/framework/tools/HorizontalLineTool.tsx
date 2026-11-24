import React from 'react';
import { BaseDrawingTool } from '../BaseDrawingTool';
import type { CoordinateHelper } from '../CoordinateHelper';
import type { DrawingHandle, DrawingItem } from '../../types';
import { fmtPrice } from '../../../../utils/formatters';

export class HorizontalLineTool extends BaseDrawingTool {
  constructor(item: DrawingItem) {
    super(item);
  }

  clone(): HorizontalLineTool {
    return new HorizontalLineTool(this.toJSON());
  }

  getHandles(coord: CoordinateHelper): DrawingHandle[] {
    const y = coord.priceToY(this.p1.price, this.p1.y);
    return [{ id: 'p1', x: coord.width / 2, y, cursor: 'ns-resize' }];
  }

  hitTest(x: number, y: number, coord: CoordinateHelper): boolean {
    const lineY = coord.priceToY(this.p1.price, this.p1.y);
    return Math.abs(y - lineY) <= Math.max(6, this.lineWidth + 4);
  }

  renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol: string
  ): React.ReactNode {
    const y = coord.priceToY(this.p1.price, this.p1.y);
    const strokeDash =
      this.lineStyle === 'dashed' ? '6 4' : this.lineStyle === 'dotted' ? '2 3' : undefined;

    return (
      <g key={this.id}>
        <line
          x1={0}
          y1={y}
          x2="100%"
          y2={y}
          stroke="rgba(0, 0, 0, 0.001)"
          pointerEvents="stroke"
          strokeWidth={Math.max(16, this.lineWidth + 10)}
        />
        <line
          x1={0}
          y1={y}
          x2="100%"
          y2={y}
          stroke={this.color}
          strokeOpacity={this.lineOpacity !== undefined ? this.lineOpacity : 1}
          strokeWidth={this.lineWidth}
          strokeDasharray={strokeDash}
        />
        {/* Price badge label on left margin */}
        <rect
          x={6}
          y={y - 10}
          width={80}
          height={20}
          rx={3}
          fill="#181820"
          stroke={isSelected ? '#38bdf8' : this.color}
          strokeWidth={1}
        />
        <text
          x={10}
          y={y + 4}
          fill="#ffffff"
          fontSize={10}
          fontFamily="monospace"
        >
          {fmtPrice(this.p1.price, symbol)}
        </text>
      </g>
    );
  }
}
