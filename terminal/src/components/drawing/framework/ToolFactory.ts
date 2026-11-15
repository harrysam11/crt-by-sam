import type { DrawingItem } from '../types';
import { BaseDrawingTool } from './BaseDrawingTool';
import { TrendlineTool } from './tools/TrendlineTool';
import { RayTool } from './tools/RayTool';
import { HorizontalLineTool } from './tools/HorizontalLineTool';
import { VerticalLineTool } from './tools/VerticalLineTool';
import { RectangleTool } from './tools/RectangleTool';
import { ParallelChannelTool } from './tools/ParallelChannelTool';
import { FibRetracementTool } from './tools/FibRetracementTool';
import { FibExtensionTool } from './tools/FibExtensionTool';
import { TextTool } from './tools/TextTool';
import { MeasureTool } from './tools/MeasureTool';
import { PositionTool } from './tools/PositionTool';
import { ArrowTool } from './tools/ArrowTool';
import { BrushTool } from './tools/BrushTool';
import { CircleTool } from './tools/CircleTool';
import { PriceLabelTool } from './tools/PriceLabelTool';

export class ToolFactory {
  static create(item: DrawingItem): BaseDrawingTool {
    switch (item.type) {
      case 'TRENDLINE':
        return new TrendlineTool(item);
      case 'RAY':
      case 'HORIZONTAL_RAY':
        return new RayTool(item);
      case 'HORIZONTAL_LINE':
        return new HorizontalLineTool(item);
      case 'PRICE_LABEL':
        return new PriceLabelTool(item);
      case 'VERTICAL_LINE':
        return new VerticalLineTool(item);
      case 'RECTANGLE':
        return new RectangleTool(item);
      case 'CIRCLE':
        return new CircleTool(item);
      case 'PARALLEL_CHANNEL':
        return new ParallelChannelTool(item);
      case 'FIBONACCI':
        return new FibRetracementTool(item);
      case 'FIB_EXTENSION':
        return new FibExtensionTool(item);
      case 'TEXT':
      case 'CALLOUT':
        return new TextTool(item);
      case 'MEASURE_RULER':
        return new MeasureTool(item);
      case 'POSITION_LONG':
      case 'POSITION_SHORT':
      case 'POSITION_TOOL':
        return new PositionTool(item);
      case 'ARROW':
        return new ArrowTool(item);
      case 'BRUSH':
        return new BrushTool(item);
      default:
        return new TrendlineTool(item);
    }
  }
}
