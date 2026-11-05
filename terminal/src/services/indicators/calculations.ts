import type { Candle } from '../../types/terminal';

// Simple Moving Average
export function calcSMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// Exponential Moving Average
export function calcEMA(values: number[], period: number): (number | null)[] {
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

// Weighted Moving Average
export function calcWMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const denominator = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let numerator = 0;
    for (let j = 0; j < period; j++) {
      numerator += values[i - j] * (period - j);
    }
    out[i] = numerator / denominator;
  }
  return out;
}

// Hull Moving Average: WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
export function calcHMA(values: number[], period: number): (number | null)[] {
  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)));

  const wmaHalf = calcWMA(values, halfPeriod);
  const wmaFull = calcWMA(values, period);

  const rawDiff: number[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const h = wmaHalf[i];
    const f = wmaFull[i];
    if (h !== null && f !== null) {
      rawDiff.push(2 * h - f);
      validIndices.push(i);
    }
  }

  const smoothed = calcWMA(rawDiff, sqrtPeriod);
  const out: (number | null)[] = new Array(values.length).fill(null);
  smoothed.forEach((val, idx) => {
    if (val !== null) out[validIndices[idx]] = val;
  });
  return out;
}

// Double Exponential Moving Average (DEMA): 2 * EMA - EMA(EMA)
export function calcDEMA(values: number[], period: number): (number | null)[] {
  const ema1 = calcEMA(values, period);
  const validEma1: number[] = [];
  const validIdx: number[] = [];
  ema1.forEach((v, i) => {
    if (v !== null) {
      validEma1.push(v);
      validIdx.push(i);
    }
  });

  const ema2 = calcEMA(validEma1, period);
  const out: (number | null)[] = new Array(values.length).fill(null);
  ema2.forEach((v2, i) => {
    if (v2 !== null) {
      const origIdx = validIdx[i];
      const v1 = ema1[origIdx];
      if (v1 !== null) out[origIdx] = 2 * v1 - v2;
    }
  });
  return out;
}

// Triple Exponential Moving Average (TEMA): 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
export function calcTEMA(values: number[], period: number): (number | null)[] {
  const ema1 = calcEMA(values, period);
  const valid1: number[] = [];
  const idx1: number[] = [];
  ema1.forEach((v, i) => {
    if (v !== null) {
      valid1.push(v);
      idx1.push(i);
    }
  });

  const ema2 = calcEMA(valid1, period);
  const valid2: number[] = [];
  const idx2: number[] = [];
  ema2.forEach((v, i) => {
    if (v !== null) {
      valid2.push(v);
      idx2.push(idx1[i]);
    }
  });

  const ema3 = calcEMA(valid2, period);
  const out: (number | null)[] = new Array(values.length).fill(null);
  ema3.forEach((v3, i) => {
    if (v3 !== null) {
      const origIdx = idx2[i];
      const v1 = ema1[origIdx];
      const v2 = ema2[valid1.indexOf(v1!)];
      if (v1 !== null && v2 !== null) {
        out[origIdx] = 3 * v1 - 3 * v2 + v3;
      }
    }
  });
  return out;
}

// Relative Strength Index (RSI)
export function calcRSI(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

// Average True Range (ATR)
export function calcATR(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const prevClose = candles[i - 1].close;
      const c = candles[i];
      tr.push(
        Math.max(
          c.high - c.low,
          Math.abs(c.high - prevClose),
          Math.abs(c.low - prevClose)
        )
      );
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

// Bollinger Bands
export function calcBollingerBands(
  values: number[],
  period = 20,
  multiplier = 2
) {
  const middle = calcSMA(values, period);
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

// MACD
export function calcMACD(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9
) {
  const fastEma = calcEMA(values, fast);
  const slowEma = calcEMA(values, slow);
  const macdLine: (number | null)[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== null && s !== null) macdLine[i] = f - s;
  }

  const validMacd: number[] = [];
  const validIndices: number[] = [];
  macdLine.forEach((v, idx) => {
    if (v !== null) {
      validMacd.push(v);
      validIndices.push(idx);
    }
  });

  const signalEma = calcEMA(validMacd, signal);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  const histogram: (number | null)[] = new Array(values.length).fill(null);

  signalEma.forEach((sigVal, idx) => {
    const origIdx = validIndices[idx];
    signalLine[origIdx] = sigVal;
    const m = macdLine[origIdx];
    if (m !== null && sigVal !== null) {
      histogram[origIdx] = m - sigVal;
    }
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

// Stochastic Oscillator
export function calcStochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
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

  const validK: number[] = [];
  const validIdx: number[] = [];
  k.forEach((val, idx) => {
    if (val !== null) {
      validK.push(val);
      validIdx.push(idx);
    }
  });

  const dSma = calcSMA(validK, dPeriod);
  dSma.forEach((val, idx) => {
    d[validIdx[idx]] = val;
  });

  return { k, d };
}

// Volume Weighted Average Price (VWAP)
export function calcVWAP(candles: Candle[]): (number | null)[] {
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

// Supertrend
export function calcSupertrend(candles: Candle[], period = 10, multiplier = 3) {
  const n = candles.length;
  const trend: (1 | -1)[] = new Array(n).fill(1);
  const line: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return { trend, line };

  const atrVals = calcATR(candles, period);
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

    if (currTrend === 1 && c.close < lowerBand) currTrend = -1;
    else if (currTrend === -1 && c.close > upperBand) currTrend = 1;

    trend[i] = currTrend;
    line[i] = currTrend === 1 ? lowerBand : upperBand;
  }

  return { trend, line };
}

// Ichimoku Cloud
export function calcIchimoku(
  candles: Candle[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouBPeriod = 52
) {
  const n = candles.length;
  const tenkan: (number | null)[] = new Array(n).fill(null);
  const kijun: (number | null)[] = new Array(n).fill(null);
  const senkouA: (number | null)[] = new Array(n).fill(null);
  const senkouB: (number | null)[] = new Array(n).fill(null);
  const chikou: (number | null)[] = new Array(n).fill(null);

  const highestLowest = (start: number, end: number) => {
    let high = -Infinity;
    let low = Infinity;
    for (let i = start; i <= end; i++) {
      if (candles[i].high > high) high = candles[i].high;
      if (candles[i].low < low) low = candles[i].low;
    }
    return (high + low) / 2;
  };

  for (let i = 0; i < n; i++) {
    if (i >= tenkanPeriod - 1) {
      tenkan[i] = highestLowest(i - tenkanPeriod + 1, i);
    }
    if (i >= kijunPeriod - 1) {
      kijun[i] = highestLowest(i - kijunPeriod + 1, i);
    }
    if (tenkan[i] !== null && kijun[i] !== null) {
      senkouA[i] = (tenkan[i]! + kijun[i]!) / 2;
    }
    if (i >= senkouBPeriod - 1) {
      senkouB[i] = highestLowest(i - senkouBPeriod + 1, i);
    }
    chikou[i] = candles[i].close;
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ADX (+DI / -DI / ADX)
export function calcADX(candles: Candle[], period = 14) {
  const n = candles.length;
  const adx: (number | null)[] = new Array(n).fill(null);
  const plusDI: (number | null)[] = new Array(n).fill(null);
  const minusDI: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return { adx, plusDI, minusDI };

  const atrVals = calcATR(candles, period);
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smoothPlus = calcEMA(plusDM, period);
  const smoothMinus = calcEMA(minusDM, period);
  const dx: number[] = [];
  const dxIndices: number[] = [];

  for (let i = period; i < n; i++) {
    const a = atrVals[i];
    const sp = smoothPlus[i];
    const sm = smoothMinus[i];
    if (a && sp !== null && sm !== null) {
      const pDI = (sp / a) * 100;
      const mDI = (sm / a) * 100;
      plusDI[i] = pDI;
      minusDI[i] = mDI;
      const sum = pDI + mDI;
      const d = sum === 0 ? 0 : (Math.abs(pDI - mDI) / sum) * 100;
      dx.push(d);
      dxIndices.push(i);
    }
  }

  const smoothADX = calcEMA(dx, period);
  smoothADX.forEach((v, idx) => {
    if (v !== null) adx[dxIndices[idx]] = v;
  });

  return { adx, plusDI, minusDI };
}

// On-Balance Volume (OBV)
export function calcOBV(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let obv = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) {
      if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
      else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    } else {
      obv = candles[i].volume;
    }
    out[i] = obv;
  }
  return out;
}

// Commodity Channel Index (CCI)
export function calcCCI(candles: Candle[], period = 20): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period) return out;

  const tp: number[] = candles.map((c) => (c.high + c.low + c.close) / 3);
  const tpSma = calcSMA(tp, period);

  for (let i = period - 1; i < n; i++) {
    const avg = tpSma[i];
    if (avg === null) continue;
    let devSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      devSum += Math.abs(tp[j] - avg);
    }
    const meanDev = devSum / period;
    out[i] = meanDev === 0 ? 0 : (tp[i] - avg) / (0.015 * meanDev);
  }
  return out;
}

// Williams %R
export function calcWilliamsR(candles: Candle[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period) return out;

  for (let i = period - 1; i < n; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    out[i] = range === 0 ? -50 : ((highest - candles[i].close) / range) * -100;
  }
  return out;
}

// Money Flow Index (MFI)
export function calcMFI(candles: Candle[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return out;

  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  for (let i = period; i < n; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * candles[j].volume;
      if (tp[j] > tp[j - 1]) posFlow += flow;
      else if (tp[j] < tp[j - 1]) negFlow += flow;
    }
    const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
    out[i] = 100 - 100 / (1 + ratio);
  }
  return out;
}

// Chaikin Money Flow (CMF)
export function calcCMF(candles: Candle[], period = 20): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period) return out;

  for (let i = period - 1; i < n; i++) {
    let volSum = 0;
    let mfvSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      const range = c.high - c.low;
      const clv = range === 0 ? 0 : (c.close - c.low - (c.high - c.close)) / range;
      mfvSum += clv * c.volume;
      volSum += c.volume;
    }
    out[i] = volSum === 0 ? 0 : mfvSum / volSum;
  }
  return out;
}

// Rate of Change (ROC)
export function calcROC(values: number[], period = 9): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period; i < values.length; i++) {
    const prev = values[i - period];
    out[i] = prev === 0 ? 0 : ((values[i] - prev) / prev) * 100;
  }
  return out;
}

// Keltner Channels
export function calcKeltnerChannels(
  candles: Candle[],
  emaPeriod = 20,
  atrPeriod = 10,
  multiplier = 2
) {
  const closes = candles.map((c) => c.close);
  const middle = calcEMA(closes, emaPeriod);
  const atrVals = calcATR(candles, atrPeriod);
  const upper: (number | null)[] = new Array(candles.length).fill(null);
  const lower: (number | null)[] = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i++) {
    const m = middle[i];
    const a = atrVals[i];
    if (m !== null && a !== null) {
      upper[i] = m + multiplier * a;
      lower[i] = m - multiplier * a;
    }
  }
  return { upper, middle, lower };
}

// Awesome Oscillator (AO)
export function calcAwesomeOscillator(candles: Candle[]): (number | null)[] {
  const medians = candles.map((c) => (c.high + c.low) / 2);
  const fastSma = calcSMA(medians, 5);
  const slowSma = calcSMA(medians, 34);
  const out: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    const f = fastSma[i];
    const s = slowSma[i];
    if (f !== null && s !== null) out[i] = f - s;
  }
  return out;
}

// Stochastic RSI
export function calcStochRSI(
  values: number[],
  rsiPeriod = 14,
  kPeriod = 14,
  dPeriod = 3
) {
  const rsiVals = calcRSI(values, rsiPeriod);
  const validRsi: number[] = [];
  const validIdx: number[] = [];

  rsiVals.forEach((val, i) => {
    if (val !== null) {
      validRsi.push(val);
      validIdx.push(i);
    }
  });

  const k: (number | null)[] = new Array(values.length).fill(null);
  const d: (number | null)[] = new Array(values.length).fill(null);

  for (let i = kPeriod - 1; i < validRsi.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (validRsi[j] > highest) highest = validRsi[j];
      if (validRsi[j] < lowest) lowest = validRsi[j];
    }
    const range = highest - lowest;
    const origIdx = validIdx[i];
    k[origIdx] = range === 0 ? 50 : ((validRsi[i] - lowest) / range) * 100;
  }

  const validK: number[] = [];
  const kIdx: number[] = [];
  k.forEach((val, i) => {
    if (val !== null) {
      validK.push(val);
      kIdx.push(i);
    }
  });

  const dSma = calcSMA(validK, dPeriod);
  dSma.forEach((val, i) => {
    d[kIdx[i]] = val;
  });

  return { k, d };
}

// Parabolic SAR
export function calcParabolicSAR(
  candles: Candle[],
  startAf = 0.02,
  maxAf = 0.2
): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < 2) return out;

  let isLong = candles[1].close > candles[0].close;
  let sar = isLong ? candles[0].low : candles[0].high;
  let ep = isLong ? candles[1].high : candles[1].low;
  let af = startAf;
  out[0] = sar;

  for (let i = 1; i < n; i++) {
    sar = sar + af * (ep - sar);
    if (isLong) {
      if (i >= 2) sar = Math.min(sar, candles[i - 1].low, candles[i - 2].low);
      else sar = Math.min(sar, candles[i - 1].low);

      if (candles[i].low < sar) {
        isLong = false;
        sar = ep;
        ep = candles[i].low;
        af = startAf;
      } else {
        if (candles[i].high > ep) {
          ep = candles[i].high;
          af = Math.min(maxAf, af + startAf);
        }
      }
    } else {
      if (i >= 2) sar = Math.max(sar, candles[i - 1].high, candles[i - 2].high);
      else sar = Math.max(sar, candles[i - 1].high);

      if (candles[i].high > sar) {
        isLong = true;
        sar = ep;
        ep = candles[i].high;
        af = startAf;
      } else {
        if (candles[i].low < ep) {
          ep = candles[i].low;
          af = Math.min(maxAf, af + startAf);
        }
      }
    }
    out[i] = sar;
  }
  return out;
}

// Pivot Points Standard
export function calcPivotPoints(candles: Candle[]) {
  const n = candles.length;
  const p: (number | null)[] = new Array(n).fill(null);
  const r1: (number | null)[] = new Array(n).fill(null);
  const s1: (number | null)[] = new Array(n).fill(null);
  const r2: (number | null)[] = new Array(n).fill(null);
  const s2: (number | null)[] = new Array(n).fill(null);

  if (n < 2) return { p, r1, s1, r2, s2 };

  for (let i = 1; i < n; i++) {
    const prev = candles[i - 1];
    const pivot = (prev.high + prev.low + prev.close) / 3;
    p[i] = pivot;
    r1[i] = 2 * pivot - prev.low;
    s1[i] = 2 * pivot - prev.high;
    r2[i] = pivot + (prev.high - prev.low);
    s2[i] = pivot - (prev.high - prev.low);
  }
  return { p, r1, s1, r2, s2 };
}
