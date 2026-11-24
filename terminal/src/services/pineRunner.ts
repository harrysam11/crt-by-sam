/**
 * Institutional Pine Script v4/v5/v6 Transpiler & Execution Runner.
 * Powered by PineTS runtime.
 * Evaluates Pine Script against live terminal candle streams and returns
 * typed plot series and geometry drawings (boxes, lines, labels, tables)
 * for direct Lightweight Charts canvas rendering.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { PineTS } from 'pinets';
import type { Candle } from '../types/terminal';
import { parseTimeframeToSeconds } from '../utils/timeframe';
import crtModelPine from '../features/pine/presets/crtModel.pine?raw';
import silverBulletsPine from '../features/pine/presets/silverBullets.pine?raw';

export interface PinePlotOutput {
  title: string;
  color: string;
  data: Array<{ time: number; value: number }>;
}

export interface PineDrawingBox {
  id: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  bgcolor?: string;
  border_color?: string;
  border_width?: number;
  border_style?: string;
  text?: string;
  text_color?: string;
}

export interface PineDrawingLine {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  style?: string;
}

export interface PineDrawingLabel {
  id: number;
  x: number;
  y: number;
  text?: string;
  color?: string;
  textcolor?: string;
  style?: string;
}

export interface PineDrawingTable {
  id: number;
  position?: string;
  columns: number;
  rows: number;
  cells: Array<Array<{
    text?: string;
    bgcolor?: string;
    text_color?: string;
  }>>;
}

export interface PineDrawingOutput {
  boxes: PineDrawingBox[];
  lines: PineDrawingLine[];
  labels: PineDrawingLabel[];
  tables: PineDrawingTable[];
  barOffset?: number;
}

export interface PineExecutionResult {
  ok: boolean;
  plots: PinePlotOutput[];
  drawings?: PineDrawingOutput;
  error?: string;
  runtimeMs?: number;
}

export const PRESET_PINE_SCRIPTS = [
  {
    name: 'CRT Model Pro - Sam',
    description: 'Candle Range Theory with HTF boxes, PSP correlation, CISD projections, True Opens & live dashboard.',
    code: crtModelPine,
  },
  {
    name: 'ICT Silver Bullets (Sessions & Killzones)',
    description: 'ICT London (03-04), New York (09-10/10-11), and Asia (21-22) Silver Bullet time windows.',
    code: silverBulletsPine,
  },
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
  timeframe: string = '1m',
  fullCandlesCount?: number
): Promise<PineExecutionResult> {
  const startTime = performance.now();
  if (!candles || candles.length < 5) {
    return { ok: false, plots: [], error: 'Insufficient candle data (need >= 5 bars)' };
  }

  console.log(`[PineRunner] Starting execution: symbol=${symbol}, timeframe=${timeframe}, candles=${candles.length}, fullCandles=${fullCandlesCount || candles.length}, codeLen=${code.length}`);
  try {
    // Format candles for PineTS market data format
    const durSec = parseTimeframeToSeconds(timeframe) || 60;
    const durMs = durSec * 1000;
    const pineCandles = candles.map((c) => {
      const openTimeMs = c.time > 10000000000 ? c.time : c.time * 1000;
      return {
        openTime: openTimeMs,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 1,
        closeTime: openTimeMs + durMs - 1,
      };
    });

    const runner = new PineTS(pineCandles, symbol, timeframe, pineCandles.length);
    const cleanSym = symbol.replace(/[^A-Za-z0-9]/g, '');
    (runner as any)._syminfo = {
      ticker: cleanSym,
      tickerid: `BINANCE:${cleanSym}`,
      root: cleanSym,
      prefix: 'BINANCE',
      currency: 'USD',
      basecurrency: cleanSym.replace('USDT', ''),
      mintick: 0.01,
      pointvalue: 1,
      timezone: 'America/New_York',
    };
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
          // Sort and ensure strictly ascending timestamps
          dataPoints.sort((a, b) => a.time - b.time);
          const uniqueDataPoints: Array<{ time: number; value: number }> = [];
          let lastTime = -1;
          for (const dp of dataPoints) {
            if (dp.time > lastTime) {
              uniqueDataPoints.push(dp);
              lastTime = dp.time;
            }
          }

          if (uniqueDataPoints.length > 0) {
            plots.push({
              title: plotObj.title || key,
              color: plotObj.options?.color || '#ffffff',
              data: uniqueDataPoints,
            });
          }
        }
      }
    }

    function extractLast(data: any): any[] {
      if (!data || !Array.isArray(data) || data.length === 0) return [];
      const last = data[data.length - 1];
      return Array.isArray(last?.value) ? last.value.filter((item: any) => !item._deleted) : [];
    }

    // Extract background shading plots into full-height background boxes
    const bgBoxes: PineDrawingBox[] = [];
    if (result && result.plots) {
      for (const [key, plotObj] of Object.entries<any>(result.plots)) {
        if (!key.startsWith('bgcolor') && plotObj?.options?.style !== 'background') continue;
        if (!plotObj || !Array.isArray(plotObj.data)) continue;

        let curStart = -1;
        let curColor = '';

        for (let bIdx = 0; bIdx < plotObj.data.length; bIdx++) {
          const pt = plotObj.data[bIdx];
          const col = pt?.options?.color;
          if (col && typeof col === 'string') {
            if (curStart === -1) {
              curStart = bIdx;
              curColor = col;
            } else if (curColor !== col) {
              bgBoxes.push({
                id: Math.round(Math.random() * 1000000),
                left: curStart,
                right: bIdx - 1,
                top: 1e9,
                bottom: -1e9,
                bgcolor: curColor,
                border_color: curColor,
                border_width: 1,
              });
              curStart = bIdx;
              curColor = col;
            }
          } else {
            if (curStart !== -1) {
              bgBoxes.push({
                id: Math.round(Math.random() * 1000000),
                left: curStart,
                right: bIdx - 1,
                top: 1e9,
                bottom: -1e9,
                bgcolor: curColor,
                border_color: curColor,
                border_width: 1,
              });
              curStart = -1;
              curColor = '';
            }
          }
        }
        if (curStart !== -1) {
          bgBoxes.push({
            id: Math.round(Math.random() * 1000000),
            left: curStart,
            right: plotObj.data.length - 1,
            top: 1e9,
            bottom: -1e9,
            bgcolor: curColor,
            border_color: curColor,
            border_width: 1,
          });
        }
      }
    }

    const barOffset = Math.max(0, (fullCandlesCount || candles.length) - pineCandles.length);
    const scriptBoxes = extractLast(result?.plots?.__boxes__?.data);
    const drawings: PineDrawingOutput = {
      boxes: [...scriptBoxes, ...bgBoxes],
      lines: extractLast(result?.plots?.__lines__?.data),
      labels: extractLast(result?.plots?.__labels__?.data),
      tables: extractLast(result?.plots?.__tables__?.data),
      barOffset,
    };

    const hasOutputs =
      plots.length > 0 ||
      drawings.boxes.length > 0 ||
      drawings.lines.length > 0 ||
      drawings.labels.length > 0 ||
      drawings.tables.length > 0;

    const runtimeMs = Math.round(performance.now() - startTime);
    console.log(`[PineRunner] Execution complete in ${runtimeMs}ms: ok=${hasOutputs}, plots=${plots.length}, boxes=${drawings.boxes.length}, lines=${drawings.lines.length}, labels=${drawings.labels.length}, tables=${drawings.tables.length}`);
    return {
      ok: hasOutputs,
      plots,
      drawings,
      runtimeMs,
    };
  } catch (err: any) {
    console.error(`[PineRunner] Execution failed:`, err);
    return {
      ok: false,
      plots: [],
      error: err?.message || 'Failed to transpile and execute Pine Script',
      runtimeMs: Math.round(performance.now() - startTime),
    };
  }
}
