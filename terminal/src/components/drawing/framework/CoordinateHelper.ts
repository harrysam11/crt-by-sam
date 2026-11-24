import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp, Time } from 'lightweight-charts';
import type { Point2D } from '../types';
import type { Candle } from '../../../types/terminal';

export class CoordinateHelper {
  constructor(
    private chartApi: IChartApi | null,
    private seriesApi: ISeriesApi<SeriesType> | null,
    public width: number,
    public height: number,
    public candles?: Candle[]
  ) {}

  timeToX(time?: number, fallbackX: number = 0): number {
    if (!this.chartApi || time === undefined) return fallbackX;
    try {
      const timeScale: any = this.chartApi.timeScale();
      const coord = timeScale.timeToCoordinate(time as UTCTimestamp);
      if (coord !== null && typeof coord === 'number' && !isNaN(coord)) {
        return coord;
      }

      // Continuous fractional logical index conversion so drawings never jump or snap to X=0 when offscreen
      if (this.candles && this.candles.length > 0) {
        const cLen = this.candles.length;
        const firstTime = this.candles[0].time;
        const lastTime = this.candles[cLen - 1].time;
        const step = cLen > 1 ? (lastTime - firstTime) / (cLen - 1) : 60;

        let targetLogical: number | null = null;

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

          let fractionalLogical = bestIdx;
          if (bestIdx < cLen - 1 && this.candles[bestIdx].time < time) {
            const nextTime = this.candles[bestIdx + 1].time;
            const span = nextTime - this.candles[bestIdx].time;
            if (span > 0) fractionalLogical = bestIdx + (time - this.candles[bestIdx].time) / span;
          } else if (bestIdx > 0 && this.candles[bestIdx].time > time) {
            const prevTime = this.candles[bestIdx - 1].time;
            const span = this.candles[bestIdx].time - prevTime;
            if (span > 0) fractionalLogical = bestIdx - (this.candles[bestIdx].time - time) / span;
          }
          targetLogical = fractionalLogical;
        } else if (time > lastTime) {
          const futureBars = (time - lastTime) / (step || 60);
          targetLogical = (cLen - 1) + futureBars;
        } else if (time < firstTime) {
          const pastBars = (time - firstTime) / (step || 60);
          targetLogical = pastBars;
        }

        if (targetLogical !== null && typeof timeScale.logicalToCoordinate === 'function') {
          const directCoord = timeScale.logicalToCoordinate(targetLogical);
          if (directCoord !== null && typeof directCoord === 'number' && !isNaN(directCoord)) {
            return directCoord;
          }

          // Extrapolate linearly using visible range reference coordinates
          let refLogical = 0;
          let refCoord: number | null = null;
          let barSpacing = 8;

          const visibleRange = typeof timeScale.getVisibleLogicalRange === 'function' 
            ? timeScale.getVisibleLogicalRange() 
            : null;

          if (visibleRange && typeof visibleRange.from === 'number' && typeof visibleRange.to === 'number') {
            const mid = Math.round((visibleRange.from + visibleRange.to) / 2);
            const cMid = timeScale.logicalToCoordinate(mid);
            const cMid1 = timeScale.logicalToCoordinate(mid + 1);
            if (cMid !== null && cMid1 !== null) {
              refLogical = mid;
              refCoord = cMid;
              barSpacing = Math.max(0.1, cMid1 - cMid);
            }
          }

          if (refCoord === null) {
            const midIdx = Math.floor(cLen / 2);
            const cMid = timeScale.logicalToCoordinate(midIdx);
            const cMid1 = timeScale.logicalToCoordinate(midIdx + 1);
            if (cMid !== null && cMid1 !== null) {
              refLogical = midIdx;
              refCoord = cMid;
              barSpacing = Math.max(0.1, cMid1 - cMid);
            } else {
              const c0 = timeScale.logicalToCoordinate(0);
              const c1 = timeScale.logicalToCoordinate(1);
              if (c0 !== null) {
                refLogical = 0;
                refCoord = c0;
                if (c1 !== null) barSpacing = Math.max(0.1, c1 - c0);
              }
            }
          }

          if (refCoord !== null) {
            const extrapolated = refCoord + (targetLogical - refLogical) * barSpacing;
            if (!isNaN(extrapolated)) {
              return extrapolated;
            }
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
