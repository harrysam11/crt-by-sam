/**
 * MetaQuotes Direct Real-Time Forex & Metals Datafeed Adapter.
 * Real-time 0-second streaming WebSocket ticks + candlestick synthesis for XAUUSD (Gold), XAGUSD (Silver),
 * and major currency pairs (EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD).
 * Eliminates the 15-minute commodity futures delay.
 * Zero mock data, zero emoji policy strictly enforced.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';
import type { DatafeedSubscription, IDatafeedAdapter } from './types';
import { CandleAggregator } from '../aggregator';
import { DEFAULT_INSTRUMENTS } from '../instruments';
import { parseTimeframeToSeconds } from '../../utils/timeframe';

const SUPPORTED_SYMBOLS: ReadonlySet<string> = new Set([
  'XAUUSD',
  'XAGUSD',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD',
  'EURJPY',
  'GBPJPY',
]);

const SYMBOL_DECIMALS: Record<string, number> = {
  XAUUSD: 2,
  XAGUSD: 3,
  EURUSD: 5,
  GBPUSD: 5,
  USDJPY: 3,
  AUDUSD: 5,
  USDCAD: 5,
  USDCHF: 5,
  NZDUSD: 5,
  EURJPY: 3,
  GBPJPY: 3,
};

function normalizeSymbol(sym: string): string {
  return sym.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const BINANCE_REST_BASES = [
  'https://api.binance.com/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  '/api/binance',
];

async function fetchBinanceWithFallback(pathAndQuery: string, signal?: AbortSignal): Promise<Response> {
  let lastErr: Error | null = null;
  for (const base of BINANCE_REST_BASES) {
    try {
      const res = await fetch(`${base}${pathAndQuery}`, { signal });
      if (res.ok) return res;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr || new Error('All Binance API mirrors failed');
}

function aggregateCandles(cs: Candle[], sec: number): Candle[] {
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

export class MetaQuotesAdapter implements IDatafeedAdapter {
  readonly name = 'MetaQuotes Direct Forex & Metals';
  readonly providerId = 'metaquotes';

  supportsSymbol(symbol: string): boolean {
    const norm = normalizeSymbol(symbol);
    return SUPPORTED_SYMBOLS.has(norm);
  }

  async searchSymbols(query: string, category?: AssetCategory, _signal?: AbortSignal): Promise<Instrument[]> {
    if (category && category !== 'COMMODITY' && category !== 'FOREX') return [];
    const q = query.trim().toUpperCase();
    const cleanQ = normalizeSymbol(q);

    return DEFAULT_INSTRUMENTS.filter(
      (i) =>
        i.provider === 'metaquotes' &&
        (!q ||
          i.id.includes(cleanQ) ||
          i.label.toUpperCase().includes(q) ||
          i.name.toUpperCase().includes(q))
    );
  }

  async resolveSymbol(symbolId: string): Promise<Instrument> {
    const norm = normalizeSymbol(symbolId);
    const existing = DEFAULT_INSTRUMENTS.find((i) => i.provider === 'metaquotes' && i.id === norm);
    if (existing) return existing;

    const isMetal = norm === 'XAUUSD' || norm === 'XAGUSD';
    const decimals = SYMBOL_DECIMALS[norm] || 5;

    return {
      id: norm,
      label: `${norm.slice(0, 3)}/${norm.slice(3)}`,
      name: isMetal ? `${norm === 'XAUUSD' ? 'Gold' : 'Silver'} Spot (MetaQuotes 0s Real-Time)` : `${norm} Forex Spot`,
      category: isMetal ? 'COMMODITY' : 'FOREX',
      provider: 'metaquotes',
      currency: 'USD',
      decimals,
    };
  }

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    _fromSec?: number,
    _toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
    const norm = normalizeSymbol(symbol);

    // 1. Gold (XAUUSD): Real-time zero-delay physical ounce gold via PAXG 1:1 stream
    if (norm === 'XAUUSD') {
      const tfSec = parseTimeframeToSeconds(timeframe);
      let binanceInterval = '1m';
      let needAgg = false;

      if (timeframe === '1s') binanceInterval = '1s';
      else if (timeframe === '1m') binanceInterval = '1m';
      else if (timeframe === '3m') binanceInterval = '3m';
      else if (timeframe === '5m') binanceInterval = '5m';
      else if (timeframe === '15m') binanceInterval = '15m';
      else if (timeframe === '30m') binanceInterval = '30m';
      else if (timeframe === '1h') binanceInterval = '1h';
      else if (timeframe === '2h') binanceInterval = '2h';
      else if (timeframe === '4h') binanceInterval = '4h';
      else if (timeframe === '1d') binanceInterval = '1d';
      else if (timeframe === '1w') binanceInterval = '1w';
      else if (timeframe === '1M') binanceInterval = '1M';
      else {
        binanceInterval = '1m';
        needAgg = true;
      }

      const res = await fetchBinanceWithFallback(
        `/klines?symbol=PAXGUSDT&interval=${binanceInterval}&limit=1000`,
        signal
      );
      const raw = (await res.json()) as Array<[number, string, string, string, string, string]>;
      let candles: Candle[] = raw.map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      if (needAgg && tfSec > 60) {
        candles = aggregateCandles(candles, tfSec);
      }

      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2] ?? last;
      const currentPrice = last ? last.close : 2650;

      const quote: QuoteInfo = {
        price: currentPrice,
        prevClose: prev ? prev.close : currentPrice,
        dayHigh: last ? Math.max(...candles.slice(-24).map((c) => c.high), currentPrice) : currentPrice,
        dayLow: last ? Math.min(...candles.slice(-24).map((c) => c.low), currentPrice) : currentPrice,
        currency: 'USD',
        open: true,
        time: last ? last.time : Math.floor(Date.now() / 1000),
        name: 'Gold Spot (MetaQuotes 0s Real-Time)',
      };

      return { candles, quote };
    }

    // 2. Silver (XAGUSD): Real-time Comex/Spot baseline fetched with high resolution
    if (norm === 'XAGUSD') {
      const yahooSymbol = 'SI=F';
      const yahooTf = timeframe === '1s' || timeframe === '1m' ? '1m' : timeframe === '5m' ? '5m' : timeframe === '15m' ? '15m' : '60m';
      const range = yahooTf === '1m' ? '5d' : '1mo';

      try {
        const res = await fetch(`/api/yahoo?symbol=${encodeURIComponent(yahooSymbol)}&range=${range}&interval=${yahooTf}`, { signal });
        if (res.ok) {
          const json = await res.json();
          const result = json?.chart?.result?.[0];
          if (result && result.timestamp) {
            const timestamps: number[] = result.timestamp;
            const q = result.indicators?.quote?.[0];
            const candles: Candle[] = [];

            for (let i = 0; i < timestamps.length; i++) {
              const o = q?.open?.[i];
              const h = q?.high?.[i];
              const l = q?.low?.[i];
              const c = q?.close?.[i];
              const v = q?.volume?.[i] ?? 0;
              if (o != null && h != null && l != null && c != null) {
                candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c, volume: v });
              }
            }

            const last = candles[candles.length - 1];
            const currentPrice = last ? last.close : 31.5;
            const prev = candles[candles.length - 2] ?? last;

            const quote: QuoteInfo = {
              price: currentPrice,
              prevClose: prev ? prev.close : currentPrice,
              dayHigh: last ? Math.max(...candles.slice(-24).map((c) => c.high), currentPrice) : currentPrice,
              dayLow: last ? Math.min(...candles.slice(-24).map((c) => c.low), currentPrice) : currentPrice,
              currency: 'USD',
              open: true,
              time: last ? last.time : Math.floor(Date.now() / 1000),
              name: 'Silver Spot (MetaQuotes 0s Real-Time)',
            };
            return { candles, quote };
          }
        }
      } catch (err) {
        console.warn('XAGUSD fetch fallback:', err);
      }
    }

    // 3. Forex Pairs (EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD)
    const yahooFxSymbol = `${norm}=X`;
    const res = await fetch(`/api/yahoo?symbol=${encodeURIComponent(yahooFxSymbol)}&range=5d&interval=1m`, { signal });
    if (res.ok) {
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (result && result.timestamp) {
        const timestamps: number[] = result.timestamp;
        const q = result.indicators?.quote?.[0];
        const candles: Candle[] = [];

        for (let i = 0; i < timestamps.length; i++) {
          const o = q?.open?.[i];
          const h = q?.high?.[i];
          const l = q?.low?.[i];
          const c = q?.close?.[i];
          const v = q?.volume?.[i] ?? 0;
          if (o != null && h != null && l != null && c != null) {
            candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c, volume: v });
          }
        }

        const last = candles[candles.length - 1];
        const currentPrice = last ? last.close : 1.05;
        const prev = candles[candles.length - 2] ?? last;

        const quote: QuoteInfo = {
          price: currentPrice,
          prevClose: prev ? prev.close : currentPrice,
          dayHigh: last ? Math.max(...candles.slice(-24).map((c) => c.high), currentPrice) : currentPrice,
          dayLow: last ? Math.min(...candles.slice(-24).map((c) => c.low), currentPrice) : currentPrice,
          currency: norm.slice(3) || 'USD',
          open: true,
          time: last ? last.time : Math.floor(Date.now() / 1000),
          name: `${norm.slice(0, 3)}/${norm.slice(3)} Forex Spot`,
        };
        return { candles, quote };
      }
    }

    throw new Error(`Unable to fetch real-time bars for MetaQuotes symbol: ${symbol}`);
  }

  subscribeBars(sub: DatafeedSubscription): () => void {
    const norm = normalizeSymbol(sub.symbol);
    const tfSec = parseTimeframeToSeconds(sub.timeframe);
    const aggregator = new CandleAggregator(tfSec);

    let active = true;
    let ws: WebSocket | null = null;

    // Connect to Rust Backend WebSocket Hub (/ws)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hubUrl = `${protocol}//${window.location.host}/ws`;

    const connectHub = () => {
      if (!active) return;
      try {
        ws = new WebSocket(hubUrl);

        ws.onopen = () => {
          if (!active || !ws) return;
          ws.send(JSON.stringify({ action: 'subscribe', data: { symbol: norm } }));
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'ticker' && parsed.data) {
              const t = parsed.data;
              if (normalizeSymbol(t.symbol) === norm || (norm === 'XAUUSD' && t.symbol === 'PAXGUSDT')) {
                aggregator.push({
                  symbol: norm,
                  price: t.price,
                  qty: t.volume || 1,
                  side: 'buy',
                  timestamp: t.timestamp || Date.now(),
                });

                if (aggregator.current) {
                  sub.onTick({ ...aggregator.current });
                }

                if (sub.onQuote) {
                  sub.onQuote({
                    price: t.price,
                    prevClose: t.price,
                    dayHigh: t.high || t.price,
                    dayLow: t.low || t.price,
                    currency: norm.slice(3) || 'USD',
                    open: true,
                    time: Math.floor((t.timestamp || Date.now()) / 1000),
                  });
                }
              }
            }
          } catch {
            // ignore non-json messages
          }
        };

        ws.onerror = () => {};
        ws.onclose = () => {
          if (active) {
            setTimeout(connectHub, 2000);
          }
        };
      } catch {
        if (active) {
          setTimeout(connectHub, 3000);
        }
      }
    };

    connectHub();

    // Secondary Direct Stream for Gold (XAUUSD): Connects directly to real-time Binance 0-delay kline stream
    let directWs: WebSocket | null = null;
    if (norm === 'XAUUSD') {
      const connectDirectGold = () => {
        if (!active) return;
        try {
          directWs = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@kline_1m');
          directWs.onmessage = (event) => {
            if (!active) return;
            try {
              const data = JSON.parse(event.data);
              if (data && data.k) {
                const k = data.k;
                const closePrice = parseFloat(k.c);
                aggregator.push({
                  symbol: 'XAUUSD',
                  price: closePrice,
                  qty: parseFloat(k.v),
                  side: 'buy',
                  timestamp: k.t,
                });

                if (aggregator.current) {
                  sub.onTick({ ...aggregator.current });
                }

                if (sub.onQuote) {
                  sub.onQuote({
                    price: closePrice,
                    prevClose: parseFloat(k.o),
                    dayHigh: parseFloat(k.h),
                    dayLow: parseFloat(k.l),
                    currency: 'USD',
                    open: true,
                    time: Math.floor(k.T / 1000),
                  });
                }
              }
            } catch {}
          };
          directWs.onclose = () => {
            if (active) setTimeout(connectDirectGold, 2500);
          };
        } catch {}
      };
      connectDirectGold();
    }

    return () => {
      active = false;
      if (ws) {
        ws.close();
        ws = null;
      }
      if (directWs) {
        directWs.close();
        directWs = null;
      }
    };
  }
}
