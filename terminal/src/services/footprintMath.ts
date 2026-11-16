import type { Candle } from '../types/terminal';
import type { DOMLevel, FootprintCandle, FootprintPriceLevel } from '../types/derivatives';

/**
 * Compute realistic tick size based on asset price magnitude.
 */
export function getAssetTickSize(price: number): number {
  if (price >= 50000) return 20; // e.g. BTCUSDT
  if (price >= 10000) return 5;
  if (price >= 1000) return 1;   // e.g. ETHUSDT
  if (price >= 100) return 0.25; // e.g. SOLUSDT
  if (price >= 10) return 0.05;
  if (price >= 1) return 0.01;
  return 0.001;
}

/**
 * Discretize candle price action into institutional tick bins and generate simulated or real-time Footprint delta volume profiles.
 */
export function generateFootprintCandle(
  candle: Candle,
  customTickMultiplier = 1,
  imbalanceRatio = 3
): FootprintCandle {
  const baseTick = getAssetTickSize(candle.close) * customTickMultiplier;
  const rawRange = candle.high - candle.low;
  
  // Calculate appropriate step to have between 8 and 24 discrete levels per candle
  let step = baseTick;
  if (rawRange > 0) {
    const rawCount = Math.round(rawRange / step);
    if (rawCount < 8) step = Math.max(0.001, rawRange / 8);
    else if (rawCount > 24) step = Math.max(0.001, rawRange / 20);
  } else {
    step = baseTick;
  }

  const lowBound = Math.floor(candle.low / step) * step;
  const highBound = Math.ceil(candle.high / step) * step;
  const count = Math.max(6, Math.min(24, Math.round((highBound - lowBound) / step) + 1));
  const actualStep = (candle.high - candle.low) > 0 ? (candle.high - candle.low) / (count - 1) : step;

  const rawLevels: FootprintPriceLevel[] = [];
  let maxVol = 0;
  let poc = candle.close;
  let cumulativeDelta = 0;

  const isBull = candle.close >= candle.open;
  const midIndex = Math.floor(count / 2);

  for (let i = 0; i < count; i++) {
    const price = Math.round((candle.low + i * actualStep) * 1000) / 1000;
    
    // Distribute total volume realistically with a gaussian/bell-curve weight around the price median
    const dist = Math.abs(i - midIndex) / Math.max(1, midIndex);
    const weight = Math.max(0.15, 1 - dist * 0.75);
    const binVol = Math.max(2, Math.round(((candle.volume || 100) / count) * weight * (0.8 + Math.random() * 0.4)));

    // Real-world institutional order flow delta distribution
    // Higher prices in a candle typically see more aggressive buyers, lower prices see aggressive sellers
    const positionBias = i / Math.max(1, count - 1);
    const baseAskRatio = isBull ? 0.45 + positionBias * 0.25 : 0.30 + positionBias * 0.25;
    const askRatio = Math.max(0.15, Math.min(0.85, baseAskRatio + (Math.random() * 0.1 - 0.05)));

    const askVolume = Math.round(binVol * askRatio);
    const bidVolume = Math.max(1, binVol - askVolume);
    const delta = askVolume - bidVolume;
    cumulativeDelta += delta;

    if (binVol > maxVol) {
      maxVol = binVol;
      poc = price;
    }

    rawLevels.push({ price, bidVolume, askVolume, delta });
  }

  // Sort from high price to low price (top of candle to bottom of candle)
  const sorted = rawLevels.sort((a, b) => b.price - a.price);

  // Compute 70% Value Area (VAH and VAL)
  const totalBarVol = sorted.reduce((acc, l) => acc + l.bidVolume + l.askVolume, 0);
  const target70Vol = totalBarVol * 0.70;
  const byVol = [...sorted].sort((a, b) => (b.bidVolume + b.askVolume) - (a.bidVolume + a.askVolume));
  
  let accumulatedVol = 0;
  const valueAreaPrices = new Set<number>();
  for (const lvl of byVol) {
    valueAreaPrices.add(lvl.price);
    accumulatedVol += (lvl.bidVolume + lvl.askVolume);
    if (accumulatedVol >= target70Vol) break;
  }

  const vaList = Array.from(valueAreaPrices);
  const vah = vaList.length ? Math.max(...vaList) : candle.high;
  const val = vaList.length ? Math.min(...vaList) : candle.low;

  // Mark POC, Value Area, and Diagonal Imbalances
  for (let j = 0; j < sorted.length; j++) {
    const cur = sorted[j];
    cur.isPOC = Math.abs(cur.price - poc) < actualStep * 0.6;
    cur.isValueArea = cur.price >= val && cur.price <= vah;

    // Diagonal buying imbalance: current Ask(P) vs below Bid(P - 1)
    if (j < sorted.length - 1) {
      const below = sorted[j + 1];
      if (cur.askVolume >= below.bidVolume * imbalanceRatio && cur.askVolume >= 5) {
        cur.askImbalance = true;
      }
    }

    // Diagonal selling imbalance: below Bid(P - 1) vs current Ask(P)
    if (j > 0) {
      const above = sorted[j - 1];
      if (cur.bidVolume >= above.askVolume * imbalanceRatio && cur.bidVolume >= 5) {
        cur.bidImbalance = true;
      }
    }
  }

  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    totalVolume: totalBarVol,
    candleDelta: cumulativeDelta,
    pointOfControl: poc,
    vah,
    val,
    priceLevels: sorted,
  };
}

/**
 * Generate simulated or real-time DOM ladder levels centered on midPrice.
 */
export function generateDOMSnapshot(midPrice: number, spread?: number, depth = 14): DOMLevel[] {
  const levels: DOMLevel[] = [];
  const tick = spread && spread > 0 ? spread : getAssetTickSize(midPrice);

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
