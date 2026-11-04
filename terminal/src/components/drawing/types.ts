export type ToolType =
  // Cursors
  | 'CURSOR_CROSSHAIR'
  | 'CURSOR_ARROW'
  | 'CURSOR_DOT'
  | 'CURSOR_ERASER'
  // Lines & Channels
  | 'TRENDLINE'
  | 'RAY'
  | 'HORIZONTAL_LINE'
  | 'HORIZONTAL_RAY'
  | 'VERTICAL_LINE'
  | 'PARALLEL_CHANNEL'
  // Fibonacci
  | 'FIBONACCI'
  | 'FIB_EXTENSION'
  // Geometric Shapes
  | 'RECTANGLE'
  | 'CIRCLE'
  | 'BRUSH'
  // Text & Annotations
  | 'TEXT'
  | 'CALLOUT'
  | 'PRICE_LABEL'
  // Forecasting & Prediction
  | 'POSITION_LONG'
  | 'POSITION_SHORT'
  | 'POSITION_TOOL'
  | 'MEASURE_RULER';

export interface Point2D {
  x: number;
  y: number;
  price: number;
  time?: number;
}

export interface DrawingItem {
  id: string;
  type: ToolType;
  p1: Point2D;
  p2?: Point2D;
  p3?: Point2D;
  points?: Point2D[];
  color: string;
  fillColor?: string;
  lineWidth: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  locked?: boolean;
  hidden?: boolean;
  text?: string;
  // Position Tool Specifics
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  riskReward?: number;
}

export interface MagnetConfig {
  enabled: boolean;
  mode: 'WEAK' | 'STRONG'; // Weak = within 15px; Strong = always snaps to nearest OHLC
}
