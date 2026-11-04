import type { Candle, Tick } from '../types/terminal';

/**
 * Folds ticks into the current candle. When seeded with the last historical candle, buckets are anchored
 * to it, so exchange-specific sessions (NSE candles start at :15) stay aligned with history.
 * Late ticks (earlier bucket) are ignored.
 */
export class CandleAggregator {
  current: Candle | null;
  private anchor: number | null;

  constructor(private tfSec: number, seed?: Candle) {
    this.current = seed ? { ...seed } : null;
    this.anchor = seed ? seed.time : null;
  }

  private bucket(tsSec: number): number {
    const a = this.anchor ?? 0;
    return a + Math.floor((tsSec - a) / this.tfSec) * this.tfSec;
  }

  push(t: Tick): void {
    const b = this.bucket(t.timestamp / 1000);
    const c = this.current;
    if (!c || b > c.time) {
      this.current = { time: b, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.qty };
    } else if (b === c.time) {
      if (t.price > c.high) c.high = t.price;
      if (t.price < c.low) c.low = t.price;
      c.close = t.price;
      c.volume += t.qty;
    }
  }
}
