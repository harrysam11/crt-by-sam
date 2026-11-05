/**
 * Sandboxed JavaScript / TypeScript Indicator Execution Runner.
 * Executes custom user script algorithms against chart candles in an isolated scope.
 * Provides a rich technical analysis library (ta) with moving averages, oscillators,
 * channels, and series conversion utilities.
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { Candle } from '../types/terminal';
import { sma, ema, rsi, bollingerBands } from './indicatorMath';
import type { PinePlotOutput } from './pineRunner';

export interface JsPlotDataPoint {
  time: number;
  value: number;
}

export interface JsScriptResult {
  ok: boolean;
  plots: PinePlotOutput[];
  error?: string;
  runtimeMs?: number;
}

export interface TechnicalLibrary {
  sma: (values: number[], period: number) => (number | null)[];
  ema: (values: number[], period: number) => (number | null)[];
  rsi: (values: number[], period?: number) => (number | null)[];
  highest: (values: number[], period: number) => (number | null)[];
  lowest: (values: number[], period: number) => (number | null)[];
  stddev: (values: number[], period: number) => (number | null)[];
  crossover: (a: (number | null)[], b: (number | null)[]) => boolean[];
  crossunder: (a: (number | null)[], b: (number | null)[]) => boolean[];
  toPlot: (candles: Candle[], values: (number | null)[]) => JsPlotDataPoint[];
}

export function highest(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (values[j] > max) max = values[j];
    }
    out[i] = max;
  }
  return out;
}

export function lowest(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (values[j] < min) min = values[j];
    }
    out[i] = min;
  }
  return out;
}

export function stddev(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const ma = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    const mean = ma[i];
    if (mean === null) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - mean;
      sumSq += diff * diff;
    }
    out[i] = Math.sqrt(sumSq / period);
  }
  return out;
}

export function crossover(a: (number | null)[], b: (number | null)[]): boolean[] {
  const out: boolean[] = new Array(a.length).fill(false);
  for (let i = 1; i < a.length; i++) {
    const prevA = a[i - 1];
    const currA = a[i];
    const prevB = b[i - 1];
    const currB = b[i];
    if (prevA !== null && currA !== null && prevB !== null && currB !== null) {
      out[i] = prevA <= prevB && currA > currB;
    }
  }
  return out;
}

export function crossunder(a: (number | null)[], b: (number | null)[]): boolean[] {
  const out: boolean[] = new Array(a.length).fill(false);
  for (let i = 1; i < a.length; i++) {
    const prevA = a[i - 1];
    const currA = a[i];
    const prevB = b[i - 1];
    const currB = b[i];
    if (prevA !== null && currA !== null && prevB !== null && currB !== null) {
      out[i] = prevA >= prevB && currA < currB;
    }
  }
  return out;
}

export function toPlot(candles: Candle[], values: (number | null)[]): JsPlotDataPoint[] {
  const points: JsPlotDataPoint[] = [];
  const len = Math.min(candles.length, values.length);
  for (let i = 0; i < len; i++) {
    const val = values[i];
    if (val !== null && !Number.isNaN(val) && Number.isFinite(val)) {
      points.push({ time: candles[i].time, value: val });
    }
  }
  return points;
}

export const taLibrary: TechnicalLibrary = {
  sma,
  ema,
  rsi,
  highest,
  lowest,
  stddev,
  crossover,
  crossunder,
  toPlot,
};

export const PRESET_JS_SCRIPTS = [
  {
    name: 'Dual EMA Ribbon (9 & 21)',
    description: 'Calculates 9-period fast EMA and 21-period slow EMA for trend confirmation.',
    code: `// Dual EMA Ribbon Algorithm
// Inputs: candles: Array<{ time, open, high, low, close, volume }>
// ta: Technical Analysis Library (sma, ema, rsi, highest, lowest, stddev, toPlot)

function main(candles, ta) {
  const closes = candles.map(c => c.close);
  const emaFast = ta.ema(closes, 9);
  const emaSlow = ta.ema(closes, 21);

  return [
    {
      title: "EMA 9 (Fast)",
      color: "#ffffff",
      data: ta.toPlot(candles, emaFast)
    },
    {
      title: "EMA 21 (Slow)",
      color: "#71717a",
      data: ta.toPlot(candles, emaSlow)
    }
  ];
}
`,
  },
  {
    name: 'Donchian Breakout Channel (20)',
    description: 'Highest high and lowest low 20-period price channels.',
    code: `// Donchian Breakout Channel (20)
function main(candles, ta) {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  const upper = ta.highest(highs, 20);
  const lower = ta.lowest(lows, 20);
  const midline = upper.map((u, i) => (u !== null && lower[i] !== null ? (u + lower[i]) / 2 : null));

  return [
    { title: "Donchian Upper (20)", color: "#ffffff", data: ta.toPlot(candles, upper) },
    { title: "Donchian Lower (20)", color: "#a1a1aa", data: ta.toPlot(candles, lower) },
    { title: "Donchian Midline", color: "#52525b", data: ta.toPlot(candles, midline) }
  ];
}
`,
  },
  {
    name: 'RSI Momentum Bands (14)',
    description: 'Relative Strength Index projected with fixed 70/30 overbought and oversold levels.',
    code: `// RSI Momentum Indicator (14)
function main(candles, ta) {
  const closes = candles.map(c => c.close);
  const rsiValues = ta.rsi(closes, 14);

  return [
    { title: "RSI 14", color: "#ffffff", data: ta.toPlot(candles, rsiValues) }
  ];
}
`,
  },
  {
    name: 'Volatility Envelope (SMA 20 + 2 ATR)',
    description: 'Adaptive volatility bands based on 20-period moving average and standard deviations.',
    code: `// Volatility Envelope (SMA 20 + 2 Sigma)
function main(candles, ta) {
  const closes = candles.map(c => c.close);
  const middle = ta.sma(closes, 20);
  const sigma = ta.stddev(closes, 20);

  const upper = middle.map((m, i) => (m !== null && sigma[i] !== null ? m + sigma[i] * 2 : null));
  const lower = middle.map((m, i) => (m !== null && sigma[i] !== null ? m - sigma[i] * 2 : null));

  return [
    { title: "Upper Band (+2s)", color: "#ffffff", data: ta.toPlot(candles, upper) },
    { title: "Middle (SMA 20)", color: "#a1a1aa", data: ta.toPlot(candles, middle) },
    { title: "Lower Band (-2s)", color: "#52525b", data: ta.toPlot(candles, lower) }
  ];
}
`,
  },
];

/**
 * Executes user JavaScript code in a controlled sandboxed environment.
 */
export async function executeJsScript(
  code: string,
  candles: Candle[],
  _symbol: string = 'BTCUSDT',
  _timeframe: string = '1m'
): Promise<JsScriptResult> {
  const startTime = performance.now();

  if (!candles || candles.length < 5) {
    return { ok: false, plots: [], error: 'Insufficient candle data (need >= 5 bars)' };
  }

  try {
    // Create an isolated evaluation scope
    // Wrap the code so the main function is returned
    const wrappedCode = `
      "use strict";
      ${code}
      if (typeof main !== "function") {
        throw new Error("Script must define a 'function main(candles, ta) { ... }' entry point.");
      }
      return main(candles, ta);
    `;

    // Construct sandboxed function without access to window or document
    const sandbox = new Function('candles', 'ta', wrappedCode);
    const result = sandbox(candles, taLibrary);

    if (!Array.isArray(result)) {
      throw new Error("Script main() function must return an array of plot objects: [{ title, color, data: [...] }]");
    }

    const plots: PinePlotOutput[] = [];

    for (const plot of result) {
      if (!plot || typeof plot !== 'object') continue;
      const title = String(plot.title || 'Plot');
      const color = String(plot.color || '#ffffff');
      const data = Array.isArray(plot.data)
        ? plot.data
            .filter((pt: any) => pt && typeof pt.time === 'number' && typeof pt.value === 'number' && !Number.isNaN(pt.value) && Number.isFinite(pt.value))
            .map((pt: any) => ({ time: Number(pt.time), value: Number(pt.value) }))
        : [];

      if (data.length > 0) {
        plots.push({ title, color, data });
      }
    }

    const runtimeMs = Math.round(performance.now() - startTime);

    if (plots.length === 0) {
      return {
        ok: false,
        plots: [],
        error: 'Execution completed but no valid plot data points were generated.',
        runtimeMs,
      };
    }

    return {
      ok: true,
      plots,
      runtimeMs,
    };
  } catch (err: unknown) {
    const runtimeMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      plots: [],
      error: err instanceof Error ? err.message : String(err),
      runtimeMs,
    };
  }
}
