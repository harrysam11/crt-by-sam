import type { Candle } from '../types/terminal';
import type { DOMLevel, FootprintCandle, FootprintPriceLevel } from '../types/derivatives';

/**
 * Discretize candle price action into bins and generate simulated or real-time Footprint delta volume profiles.
 */
export function generateFootprintCandle(candle: Candle, binCount = 8): FootprintCandle {
  const range = candle.high - candle.low;
  const step = range > 0 ? range / binCount : 1;
  const rawLevels: FootprintPriceLevel[] = [];

  let maxVol = 0;
  let poc = candle.close;
  let cumulativeDelta = 0;

  for (let i = 0; i < binCount; i++) {
    const price = Math.round((candle.low + (i + 0.5) * step) * 100) / 100;
    // Distribute total volume realistically with a bell-curve weight around the median
    const dist = Math.abs(i - binCount / 2) / (binCount / 2);
    const weight = Math.max(0.2, 1 - dist * 0.7);
    const binVol = Math.max(1, Math.round((candle.volume / binCount) * weight));

    // Delta bias based on close vs open
    const isBull = candle.close >= candle.open;
    const bidRatio = isBull ? 0.35 + Math.random() * 0.2 : 0.45 + Math.random() * 0.3;
    const bidVolume = Math.round(binVol * bidRatio);
    const askVolume = Math.max(0, binVol - bidVolume);
    const delta = askVolume - bidVolume;
    cumulativeDelta += delta;

    if (binVol > maxVol) {
      maxVol = binVol;
      poc = price;
    }

    rawLevels.push({ price, bidVolume, askVolume, delta });
  }

  // Sort from high price to low price (top to bottom cluster)
  const sorted = rawLevels.sort((a, b) => b.price - a.price);

  // Mark diagonal volume imbalances (standard institutional 300% threshold)
  for (let j = 0; j < sorted.length - 1; j++) {
    const current = sorted[j];
    const below = sorted[j + 1];
    if (current && below) {
      if (current.askVolume > below.bidVolume * 3 && current.askVolume > 5) {
        current.askImbalance = true;
      }
      if (below.bidVolume > current.askVolume * 3 && below.bidVolume > 5) {
        below.bidImbalance = true;
      }
    }
  }

  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    totalVolume: candle.volume,
    candleDelta: cumulativeDelta,
    pointOfControl: poc,
    priceLevels: sorted,
  };
}

/**
 * Generate simulated or real-time DOM ladder levels centered on midPrice.
 */
export function generateDOMSnapshot(midPrice: number, spread = 0.5, depth = 12): DOMLevel[] {
  const levels: DOMLevel[] = [];
  const tick = midPrice > 1000 ? 1 : midPrice > 10 ? 0.05 : 0.001;

  for (let i = -depth; i <= depth; i++) {
    if (i === 0) continue;
    const price = Math.round((midPrice + i * tick) * 100) / 100;
    const distance = Math.abs(i);
    const baseSize = Math.max(0.5, (15 - distance * 0.8) * (1 + Math.random() * 0.5));

    if (i < 0) {
      // Bids (below mid)
      levels.push({
        price,
        bidSize: Math.round(baseSize * 10) / 10,
        askSize: 0,
        totalVolume: Math.round(baseSize * 10) / 10,
      });
    } else {
      // Asks (above mid)
      levels.push({
        price,
        bidSize: 0,
        askSize: Math.round(baseSize * 10) / 10,
        totalVolume: Math.round(baseSize * 10) / 10,
      });
    }
  }

  return levels.sort((a, b) => b.price - a.price);
}
