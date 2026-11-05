import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp, Time } from 'lightweight-charts';
import type { Point2D } from '../types';

export class CoordinateHelper {
  constructor(
    private chartApi: IChartApi | null,
    private seriesApi: ISeriesApi<SeriesType> | null,
    public width: number,
    public height: number
  ) {}

  timeToX(time?: number, fallbackX: number = 0): number {
    if (!this.chartApi || time === undefined) return fallbackX;
    try {
      const coord = this.chartApi.timeScale().timeToCoordinate(time as UTCTimestamp);
      return coord !== null ? coord : fallbackX;
    } catch {
      return fallbackX;
    }
  }

  xToTime(x: number): number | undefined {
    if (!this.chartApi) return undefined;
    try {
      const time = this.chartApi.timeScale().coordinateToTime(x);
      return typeof time === 'number' ? time : undefined;
    } catch {
      return undefined;
    }
  }

  priceToY(price?: number, fallbackY: number = 0): number {
    if (!this.seriesApi || price === undefined) return fallbackY;
    try {
      const coord = this.seriesApi.priceToCoordinate(price);
      return coord !== null ? coord : fallbackY;
    } catch {
      return fallbackY;
    }
  }

  yToPrice(y: number): number {
    if (!this.seriesApi) return 0;
    try {
      return this.seriesApi.coordinateToPrice(y) ?? 0;
    } catch {
      return 0;
    }
  }

  pointToXY(p: Point2D): { x: number; y: number } {
    const x = this.timeToX(p.time, p.x);
    const y = this.priceToY(p.price, p.y);
    return { x, y };
  }

  // Hit-testing geometric utilities
  static distanceToPoint(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  static distanceToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  static distanceToRay(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, ((px - x1) * dx + (py - y1) * dy) / l2);
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  static pointInRect(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): boolean {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }
}
