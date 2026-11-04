export type ToolType =
  | 'CURSOR_CROSSHAIR'
  | 'CURSOR_ARROW'
  | 'CURSOR_DOT'
  | 'CURSOR_ERASER'
  | 'TRENDLINE'
  | 'HORIZONTAL_LINE'
  | 'FIBONACCI'
  | 'RECTANGLE'
  | 'POSITION_TOOL';

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
  color: string;
  lineWidth: number;
}
