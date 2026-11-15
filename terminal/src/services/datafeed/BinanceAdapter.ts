/**
 * Binance Datafeed Adapter.
 * Native multi-timeframe REST klines + WebSocket live tick/candle streaming.
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';
import type { DatafeedSubscription, IDatafeedAdapter } from './types';
import { DEFAULT_INSTRUMENTS } from '../instruments';
import { CandleAggregator } from '../aggregator';

import { parseTimeframeToSeconds } from '../../utils/timeframe';

const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';

const BINANCE_NATIVE_INTERVALS = new Set<string>([
  '1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M',
]);

function aggregateBars(cs: Candle[], sec: number): Candle[] {
  const out: Candle[] = [];
  for (const c of cs) {
    const b = Math.floor(c.time / sec) * sec;
    const last = out[out.length - 1];
    if (last && last.time === b) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.volume += c.volume;
    } else {
      out.push({ ...c, time: b });
    }
  }
  return out;
}

export class BinanceAdapter implements IDatafeedAdapter {
  readonly name = 'Binance Spot';
  readonly providerId = 'binance';

  supportsSymbol(symbol: string): boolean {
    return symbol.toUpperCase().endsWith('USDT') || symbol.toUpperCase().endsWith('BUSD');
  }

  async searchSymbols(query: string, category?: AssetCategory, signal?: AbortSignal): Promise<Instrument[]> {
    if (category && category !== 'CRYPTO') return [];
    const q = query.trim().toUpperCase();
    const matches = DEFAULT_INSTRUMENTS.filter(
      (i) => i.provider === 'binance' && (!q || i.id.includes(q) || i.label.includes(q) || i.name.toUpperCase().includes(q))
    );
    if (matches.length > 0 || !q) return matches;

    // If not in default list and looks like a crypto symbol, query Binance ticker
    try {
      const res = await fetch(`${BINANCE_REST_BASE}/ticker/price?symbol=${encodeURIComponent(q)}`, { signal });
      if (res.ok) {
        const data = (await res.json()) as { symbol: string; price: string };
        return [
          {
            id: data.symbol,
            label: `${data.symbol.replace('USDT', '')}/USDT`,
            name: `${data.symbol} Crypto`,
            category: 'CRYPTO',
            provider: 'binance',
            currency: 'USDT',
            decimals: 2,
          },
        ];
      }
    } catch {
      // Fallback
    }
    return [];
  }

  async resolveSymbol(symbolId: string): Promise<Instrument> {
    const existing = DEFAULT_INSTRUMENTS.find((i) => i.id === symbolId);
    if (existing) return existing;
    return {
      id: symbolId,
      label: symbolId,
      name: `${symbolId} Crypto Spot`,
      category: 'CRYPTO',
      provider: 'binance',
      currency: 'USDT',
      decimals: 2,
    };
  }

  private getBaseIntervalAndAggregation(timeframe: Timeframe): { isNative: boolean; baseInterval: string; targetSec: number } {
    if (BINANCE_NATIVE_INTERVALS.has(timeframe)) {
      return { isNative: true, baseInterval: timeframe, targetSec: parseTimeframeToSeconds(timeframe) };
    }
    const targetSec = parseTimeframeToSeconds(timeframe);
    let baseInterval = '1m';
    if (targetSec < 60) {
      baseInterval = '1s';
    } else if (targetSec % 86400 === 0 && targetSec >= 86400) {
      baseInterval = '1d';
    } else if (targetSec % 3600 === 0 && targetSec >= 3600) {
      baseInterval = '1h';
    } else if (targetSec % 300 === 0 && targetSec >= 300) {
      baseInterval = '5m';
    } else {
      baseInterval = '1m';
    }
    return { isNative: false, baseInterval, targetSec };
  }

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    fromSec?: number,
    toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
    const { isNative, baseInterval, targetSec } = this.getBaseIntervalAndAggregation(timeframe);
    const limit = isNative ? 600 : 1000;
    let url = `${BINANCE_REST_BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${baseInterval}&limit=${limit}`;
    if (fromSec && toSec) {
      url += `&startTime=${fromSec * 1000}&endTime=${toSec * 1000}`;
    }

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
    }

    const rawKlines = (await res.json()) as (string | number)[][];
    let candles: Candle[] = rawKlines.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));

    if (!isNative && targetSec > 0) {
      candles = aggregateBars(candles, targetSec);
    }

    const last = candles[candles.length - 1];
    const quote: QuoteInfo = {
      price: last ? last.close : 0,
      prevClose: candles[candles.length - 2]?.close ?? (last ? last.close : 0),
      dayHigh: last ? Math.max(...candles.slice(-24).map((c) => c.high)) : 0,
      dayLow: last ? Math.min(...candles.slice(-24).map((c) => c.low)) : 0,
      currency: 'USDT',
      open: true,
      time: last ? last.time : Math.floor(Date.now() / 1000),
      name: `${symbol} Spot`,
    };

    return { candles, quote };
  }

  subscribeBars(sub: DatafeedSubscription): () => void {
    const { isNative, baseInterval, targetSec } = this.getBaseIntervalAndAggregation(sub.timeframe);
    const stream = `${sub.symbol.toLowerCase()}@kline_${baseInterval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;
    let ws: WebSocket | null = new WebSocket(wsUrl);

    let currentAggBar: Candle | null = null;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          k?: {
            t: number;
            o: string;
            h: string;
            l: string;
            c: string;
            v: string;
          };
        };
        if (msg.k) {
          const k = msg.k;
          const rawBar: Candle = {
            time: Math.floor(k.t / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          };

          if (isNative) {
            sub.onTick(rawBar);
          } else {
            const bucket = Math.floor(rawBar.time / targetSec) * targetSec;
            if (!currentAggBar || currentAggBar.time !== bucket) {
              currentAggBar = {
                time: bucket,
                open: rawBar.open,
                high: rawBar.high,
                low: rawBar.low,
                close: rawBar.close,
                volume: rawBar.volume,
              };
            } else {
              currentAggBar.high = Math.max(currentAggBar.high, rawBar.high);
              currentAggBar.low = Math.min(currentAggBar.low, rawBar.low);
              currentAggBar.close = rawBar.close;
              currentAggBar.volume += rawBar.volume;
            }
            sub.onTick({ ...currentAggBar });
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      try {
        ws?.close();
      } catch {}
    };

    return () => {
      if (ws) {
        ws.onmessage = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch {}
        ws = null;
      }
    };
  }
}
