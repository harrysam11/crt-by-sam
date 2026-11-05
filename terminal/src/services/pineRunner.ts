/**
 * Institutional Pine Script v4/v5 Transpiler & Execution Runner.
 * Powered by PineTS open-source runtime.
 * Evaluates Pine Script against live terminal candle streams and returns
 * typed plot series for direct Lightweight Charts line rendering.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { PineTS } from 'pinets';
import type { Candle } from '../types/terminal';

export interface PinePlotOutput {
  title: string;
  color: string;
  data: Array<{ time: number; value: number }>;
}

export interface PineExecutionResult {
  ok: boolean;
  plots: PinePlotOutput[];
  error?: string;
  runtimeMs?: number;
}

export const PRESET_PINE_SCRIPTS = [
  {
    name: 'Dual EMA Ribbon (9 & 21)',
    description: 'Fast and slow exponential moving averages with trend coloring.',
    code: `//@version=5
indicator("Dual EMA Ribbon", overlay=true)
emaFast = ta.ema(close, 9)
emaSlow = ta.ema(close, 21)
plot(emaFast, title="EMA9", color=color.white)
plot(emaSlow, title="EMA21", color=color.gray)
`,
  },
  {
    name: 'Bollinger Bands (20, 2)',
    description: 'Volatility envelope based on 20-period SMA and 2 standard deviations.',
    code: `//@version=5
indicator("Bollinger Bands", overlay=true)
length = 20
mult = 2.0
basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev
plot(basis, title="Basis", color=color.white)
plot(upper, title="Upper", color=color.gray)
plot(lower, title="Lower", color=color.gray)
`,
  },
  {
    name: 'VWAP with Std Dev Bands',
    description: 'Volume-weighted average price benchmark with upper and lower thresholds.',
    code: `//@version=5
indicator("VWAP Benchmark", overlay=true)
vwapValue = ta.vwap(close)
plot(vwapValue, title="VWAP", color=color.white)
`,
  },
  {
    name: 'High-Low Channel (20)',
    description: 'Highest high and lowest low donchian resistance and support lines.',
    code: `//@version=5
indicator("High-Low Donchian", overlay=true)
len = 20
hh = ta.highest(high, len)
ll = ta.lowest(low, len)
plot(hh, title="HighestHigh", color=color.white)
plot(ll, title="LowestLow", color=color.gray)
`,
  },
];

export async function executePineScript(
  code: string,
  candles: Candle[],
  symbol: string = 'BTCUSDT',
  timeframe: string = '1m'
): Promise<PineExecutionResult> {
  const startTime = performance.now();
  if (!candles || candles.length < 5) {
    return { ok: false, plots: [], error: 'Insufficient candle data (need >= 5 bars)' };
  }

  try {
    // Format candles for PineTS market data format
    const pineCandles = candles.map((c, i) => {
      const openTimeMs = c.time > 10000000000 ? c.time : c.time * 1000;
      return {
        openTime: openTimeMs,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 1,
        closeTime: openTimeMs + 59999,
      };
    });

    const runner = new PineTS(pineCandles, symbol, timeframe, pineCandles.length);
    await runner.ready();
    const result = await runner.run(code);

    const plots: PinePlotOutput[] = [];

    if (result && result.plots) {
      for (const [key, plotObj] of Object.entries<any>(result.plots)) {
        // Skip internal non-plot structures
        if (key.startsWith('__')) continue;
        if (!plotObj || !Array.isArray(plotObj.data)) continue;

        const dataPoints: Array<{ time: number; value: number }> = [];

        for (const pt of plotObj.data) {
          if (pt && typeof pt.value === 'number' && !Number.isNaN(pt.value) && Number.isFinite(pt.value)) {
            const timeSec = pt.time > 10000000000 ? Math.floor(pt.time / 1000) : pt.time;
            dataPoints.push({
              time: timeSec,
              value: pt.value,
            });
          }
        }

        if (dataPoints.length > 0) {
          plots.push({
            title: plotObj.title || key,
            color: plotObj.options?.color || '#ffffff',
            data: dataPoints,
          });
        }
      }
    }

    const runtimeMs = Math.round(performance.now() - startTime);
    return {
      ok: true,
      plots,
      runtimeMs,
    };
  } catch (err: any) {
    return {
      ok: false,
      plots: [],
      error: err?.message || 'Failed to transpile and execute Pine Script',
      runtimeMs: Math.round(performance.now() - startTime),
    };
  }
}
