import type { Candle } from '../types/terminal';

/** Simple moving average; null until `period` values exist. O(n) with a rolling sum. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** EMA seeded with the SMA of the first `period` values (matches common charting packages). */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI (Relative Strength Index). */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Bollinger Bands (Upper, Middle, Lower). */
export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function bollingerBands(values: number[], period = 20, multiplier = 2): BollingerBandsResult {
  const middle = sma(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const avg = middle[i];
    if (avg === null) continue;
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(values[j] - avg, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = avg + multiplier * stdDev;
    lower[i] = avg - multiplier * stdDev;
  }

  return { upper, middle, lower };
}

/** MACD (Moving Average Convergence Divergence). */
export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(values, fastPeriod);
  const slowEma = ema(values, slowPeriod);
  const macdLine: (number | null)[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== null && s !== null) {
      macdLine[i] = f - s;
    }
  }

  // Extract non-null points to calculate signal line EMA
  const validMacd: number[] = [];
  const validIndices: number[] = [];
  macdLine.forEach((v, idx) => {
    if (v !== null) {
      validMacd.push(v);
      validIndices.push(idx);
    }
  });

  const signalEma = ema(validMacd, signalPeriod);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  const histogram: (number | null)[] = new Array(values.length).fill(null);

  signalEma.forEach((sigVal, idx) => {
    const originalIdx = validIndices[idx];
    signalLine[originalIdx] = sigVal;
    const m = macdLine[originalIdx];
    if (m !== null && sigVal !== null) {
      histogram[originalIdx] = m - sigVal;
    }
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

/** ATR (Average True Range). */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const prevClose = candles[i - 1].close;
      const c = candles[i];
      const trueRange = Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose)
      );
      tr.push(trueRange);
    }
  }

  let atrVal = 0;
  for (let i = 0; i < period; i++) atrVal += tr[i];
  atrVal /= period;
  out[period - 1] = atrVal;

  for (let i = period; i < candles.length; i++) {
    atrVal = (atrVal * (period - 1) + tr[i]) / period;
    out[i] = atrVal;
  }

  return out;
}

/** Heikin-Ashi candlestick generator. */
export function heikinAshi(candles: Candle[]): Candle[] {
  if (!candles.length) return [];
  const ha: Candle[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0
      ? (c.open + c.close) / 2
      : (ha[i - 1].open + ha[i - 1].close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);

    ha.push({
      time: c.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: c.volume,
    });
  }

  return ha;
}

/** Volume Weighted Average Price (VWAP). */
export function vwap(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let cumVol = 0;
  let cumTpVol = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumTpVol += tp * c.volume;
    out[i] = cumVol > 0 ? cumTpVol / cumVol : tp;
  }
  return out;
}

/** Supertrend Indicator Result */
export interface SupertrendResult {
  trend: (1 | -1)[]; // 1 = bullish, -1 = bearish
  line: (number | null)[];
}

/** Supertrend Calculation (ATR Multiplier). */
export function supertrend(candles: Candle[], period = 10, multiplier = 3): SupertrendResult {
  const n = candles.length;
  const trend: (1 | -1)[] = new Array(n).fill(1);
  const line: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return { trend, line };

  const atrVals = atr(candles, period);
  let upperBand = 0;
  let lowerBand = 0;
  let currTrend: 1 | -1 = 1;

  for (let i = period; i < n; i++) {
    const c = candles[i];
    const a = atrVals[i] ?? 0;
    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + multiplier * a;
    const basicLower = hl2 - multiplier * a;

    if (i === period) {
      upperBand = basicUpper;
      lowerBand = basicLower;
    } else {
      const prevClose = candles[i - 1].close;
      upperBand = basicUpper < upperBand || prevClose > upperBand ? basicUpper : upperBand;
      lowerBand = basicLower > lowerBand || prevClose < lowerBand ? basicLower : lowerBand;
    }

    if (currTrend === 1 && c.close < lowerBand) {
      currTrend = -1;
    } else if (currTrend === -1 && c.close > upperBand) {
      currTrend = 1;
    }

    trend[i] = currTrend;
    line[i] = currTrend === 1 ? lowerBand : upperBand;
  }

  return { trend, line };
}

/** Stochastic Oscillator (%K and %D). */
export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): StochasticResult {
  const n = candles.length;
  const k: (number | null)[] = new Array(n).fill(null);
  const d: (number | null)[] = new Array(n).fill(null);
  if (n < kPeriod) return { k, d };

  for (let i = kPeriod - 1; i < n; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    k[i] = range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100;
  }

  // Smooth %K with SMA to get %D
  const validK: number[] = [];
  const validIdx: number[] = [];
  k.forEach((val, idx) => {
    if (val !== null) {
      validK.push(val);
      validIdx.push(idx);
    }
  });

  const dSma = sma(validK, dPeriod);
  dSma.forEach((val, idx) => {
    d[validIdx[idx]] = val;
  });

  return { k, d };
}
