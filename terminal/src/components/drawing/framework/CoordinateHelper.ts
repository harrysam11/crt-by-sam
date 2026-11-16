import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp, Time } from 'lightweight-charts';
import type { Point2D } from '../types';

export class CoordinateHelper {
  constructor(
    private chartApi: IChartApi | null,
    private seriesApi: ISeriesApi<SeriesType> | null,
    public width: number,
    public height: number,
    private candles?: Array<{ time: number }>
  ) {}

  timeToX(time?: number, fallbackX: number = 0): number {
    if (!this.chartApi || time === undefined) return fallbackX;
    try {
      const coord = this.chartApi.timeScale().timeToCoordinate(time as UTCTimestamp);
      if (coord !== null) return coord;

      // Off-screen or future/past bars: use logical index conversion to preserve candle anchoring
      if (this.candles && this.candles.length > 0) {
        const timeScale: any = this.chartApi.timeScale();
        const cLen = this.candles.length;
        const firstTime = this.candles[0].time;
        const lastTime = this.candles[cLen - 1].time;
        const step = cLen > 1 ? (lastTime - firstTime) / (cLen - 1) : 60;

        if (time >= firstTime && time <= lastTime) {
          let low = 0;
          let high = cLen - 1;
          let bestIdx = 0;
          let minDiff = Infinity;
          while (low <= high) {
            const mid = (low + high) >> 1;
            const diff = Math.abs(this.candles[mid].time - time);
            if (diff < minDiff) {
              minDiff = diff;
              bestIdx = mid;
            }
            if (this.candles[mid].time < time) low = mid + 1;
            else if (this.candles[mid].time > time) high = mid - 1;
            else break;
          }
          if (typeof timeScale.logicalToCoordinate === 'function') {
            const lCoord = timeScale.logicalToCoordinate(bestIdx);
            if (lCoord !== null) return lCoord;
          }
        } else if (time > lastTime) {
          const futureBars = (time - lastTime) / (step || 60);
          const logical = cLen - 1 + futureBars;
          if (typeof timeScale.logicalToCoordinate === 'function') {
            const lCoord = timeScale.logicalToCoordinate(logical);
            if (lCoord !== null) return lCoord;
          }
        } else if (time < firstTime) {
          const pastBars = (time - firstTime) / (step || 60);
          if (typeof timeScale.logicalToCoordinate === 'function') {
            const lCoord = timeScale.logicalToCoordinate(pastBars);
            if (lCoord !== null) return lCoord;
          }
        }
      }
      return fallbackX;
    } catch {
      return fallbackX;
    }
  }

  xToTime(x: number): number | undefined {
    if (!this.chartApi) return undefined;
    try {
      const time = this.chartApi.timeScale().coordinateToTime(x);
      if (typeof time === 'number') return time;

      // If clicked outside loaded bars (whitespace to the right or left), calculate via logical index
      if (this.candles && this.candles.length > 0) {
        const timeScale: any = this.chartApi.timeScale();
        if (typeof timeScale.coordinateToLogical === 'function') {
          const logical = timeScale.coordinateToLogical(x);
          if (typeof logical === 'number' && !isNaN(logical)) {
            const cLen = this.candles.length;
            const firstTime = this.candles[0].time;
            const lastTime = this.candles[cLen - 1].time;
            const step = cLen > 1 ? (lastTime - firstTime) / (cLen - 1) : 60;

            if (logical >= 0 && logical < cLen) {
              const idx = Math.min(cLen - 1, Math.max(0, Math.round(logical)));
              return this.candles[idx].time;
            } else if (logical >= cLen) {
              const diffBars = logical - (cLen - 1);
              return Math.round(lastTime + diffBars * (step || 60));
            } else {
              return Math.round(firstTime + logical * (step || 60));
            }
          }
        }
      }
      return undefined;
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
