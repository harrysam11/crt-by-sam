/**
 * Binance Datafeed Adapter.
 * Native multi-timeframe REST klines + WebSocket live tick/candle streaming.
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';
import type { DatafeedSubscription, IDatafeedAdapter } from './types';
import { DEFAULT_INSTRUMENTS } from '../instruments';
import { CandleAggregator } from '../aggregator';

const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';

const TF_TO_BINANCE: Record<Timeframe, string> = {
  '1s': '1s',
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
};

const TF_TO_SECONDS: Record<Timeframe, number> = {
  '1s': 1,
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
};

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

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    fromSec?: number,
    toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
    const interval = TF_TO_BINANCE[timeframe] || '1m';
    const limit = 600;
    let url = `${BINANCE_REST_BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
    if (fromSec && toSec) {
      url += `&startTime=${fromSec * 1000}&endTime=${toSec * 1000}`;
    }

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
    }

    const rawKlines = (await res.json()) as (string | number)[][];
    const candles: Candle[] = rawKlines.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));

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
    const interval = TF_TO_BINANCE[sub.timeframe] || '1m';
    const stream = `${sub.symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;
    let ws: WebSocket | null = new WebSocket(wsUrl);

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
          const bar: Candle = {
            time: Math.floor(k.t / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          };
          sub.onTick(bar);
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
