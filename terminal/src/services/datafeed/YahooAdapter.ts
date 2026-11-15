/**
 * Yahoo Finance Datafeed Adapter for Forex, Commodities, US Stocks, Indian Stocks (NSE/BSE), and Indices.
 * Proxied via Vite / server proxy to prevent CORS issues.
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';
import type { DatafeedSubscription, IDatafeedAdapter } from './types';
import { CandleAggregator } from '../aggregator';
import { DEFAULT_INSTRUMENTS } from '../instruments';

const BASE = '/api/yahoo';

interface YahooMeta {
  currency?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketTime?: number;
  longName?: string;
  shortName?: string;
  currentTradingPeriod?: { regular?: { start: number; end: number } };
}

interface YahooChartResult {
  meta: YahooMeta;
  timestamp?: number[];
  indicators: {
    quote: {
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }[];
  };
}

import { parseTimeframeToSeconds } from '../../utils/timeframe';

const TF_YAHOO_CONFIG: Record<
  string,
  { interval: string; range: string; aggregateSec?: number }
> = {
  '1s': { interval: '1m', range: '1d' },
  '1m': { interval: '1m', range: '5d' },
  '3m': { interval: '1m', range: '5d', aggregateSec: 180 },
  '5m': { interval: '5m', range: '1mo' },
  '15m': { interval: '15m', range: '1mo' },
  '30m': { interval: '15m', range: '1mo', aggregateSec: 1800 },
  '1h': { interval: '60m', range: '6mo' },
  '2h': { interval: '60m', range: '1y', aggregateSec: 7200 },
  '4h': { interval: '60m', range: '1y', aggregateSec: 14400 },
  '1d': { interval: '1d', range: '5y' },
  '1w': { interval: '1wk', range: '5y' },
  '1M': { interval: '1mo', range: '10y' },
};

function getYahooConfig(timeframe: Timeframe): { interval: string; range: string; aggregateSec?: number } {
  if (TF_YAHOO_CONFIG[timeframe]) {
    return TF_YAHOO_CONFIG[timeframe];
  }
  const sec = parseTimeframeToSeconds(timeframe);
  if (sec <= 300) {
    return { interval: '1m', range: '5d', aggregateSec: sec };
  } else if (sec <= 1800) {
    return { interval: '5m', range: '1mo', aggregateSec: sec };
  } else if (sec <= 3600) {
    return { interval: '15m', range: '1mo', aggregateSec: sec };
  } else if (sec <= 86400) {
    return { interval: '60m', range: '1y', aggregateSec: sec };
  } else if (sec <= 604800) {
    return { interval: '1d', range: '5y', aggregateSec: sec };
  } else {
    return { interval: '1wk', range: '5y', aggregateSec: sec };
  }
}

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

export class YahooAdapter implements IDatafeedAdapter {
  readonly name = 'Yahoo Finance / Global Markets';
  readonly providerId = 'yahoo';

  supportsSymbol(symbol: string): boolean {
    const s = symbol.toUpperCase();
    return (
      s.includes('=X') ||
      s.includes('=F') ||
      s.includes('.NS') ||
      s.includes('.BO') ||
      s.startsWith('^') ||
      DEFAULT_INSTRUMENTS.some((i) => i.id === symbol && i.provider === 'yahoo')
    );
  }

  async searchSymbols(query: string, category?: AssetCategory, signal?: AbortSignal): Promise<Instrument[]> {
    const q = query.trim().toUpperCase();
    const defaultMatches = DEFAULT_INSTRUMENTS.filter(
      (inst) =>
        inst.provider === 'yahoo' &&
        (!category || inst.category === category) &&
        (!q || inst.id.includes(q) || inst.label.includes(q) || inst.name.toUpperCase().includes(q))
    );

    if (!q) return defaultMatches;

    try {
      const res = await fetch(
        `${BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
        { signal }
      );
      if (!res.ok) return defaultMatches;

      const j = (await res.json()) as { quotes?: Array<{
        symbol: string;
        shortname?: string;
        longname?: string;
        quoteType?: string;
        exchDisp?: string;
      }> };

      const apiHits: Instrument[] = (j.quotes ?? []).flatMap((h) => {
        let cat: AssetCategory = 'US_STOCK';
        if (/\.(NS|BO)$/i.test(h.symbol)) cat = 'IN_STOCK';
        else if (h.quoteType === 'CURRENCY' || h.symbol.endsWith('=X')) cat = 'FOREX';
        else if (h.quoteType === 'FUTURE' || h.symbol.endsWith('=F')) cat = 'COMMODITY';
        else if (h.quoteType === 'INDEX' || h.symbol.startsWith('^')) cat = 'INDEX';

        if (category && cat !== category) return [];

        const name = h.longname ?? h.shortname ?? h.symbol;
        return [
          {
            id: h.symbol,
            label: h.symbol.replace(/\.(NS|BO)$/i, ''),
            name: h.exchDisp ? `${name} (${h.exchDisp})` : name,
            category: cat,
            provider: 'yahoo',
            currency: h.symbol.endsWith('.NS') || h.symbol.endsWith('.BO') ? 'INR' : 'USD',
            decimals: cat === 'FOREX' ? 5 : 2,
          },
        ];
      });

      const map = new Map<string, Instrument>();
      defaultMatches.forEach((m) => map.set(m.id, m));
      apiHits.forEach((m) => map.set(m.id, m));
      return Array.from(map.values());
    } catch {
      return defaultMatches;
    }
  }

  async resolveSymbol(symbolId: string): Promise<Instrument> {
    const existing = DEFAULT_INSTRUMENTS.find((i) => i.id === symbolId);
    if (existing) return existing;

    let cat: AssetCategory = 'US_STOCK';
    if (/\.(NS|BO)$/i.test(symbolId)) cat = 'IN_STOCK';
    else if (symbolId.endsWith('=X')) cat = 'FOREX';
    else if (symbolId.endsWith('=F')) cat = 'COMMODITY';
    else if (symbolId.startsWith('^')) cat = 'INDEX';

    return {
      id: symbolId,
      label: symbolId.replace(/\.(NS|BO)$/i, ''),
      name: symbolId,
      category: cat,
      provider: 'yahoo',
      currency: symbolId.endsWith('.NS') || symbolId.endsWith('.BO') ? 'INR' : 'USD',
      decimals: cat === 'FOREX' ? 5 : 2,
    };
  }

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    _fromSec?: number,
    _toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
    const cfg = getYahooConfig(timeframe);
    const url = `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false`;

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Yahoo Finance error: ${res.status} ${res.statusText}`);
    }

    const j = (await res.json()) as { chart: { result?: YahooChartResult[] | null; error?: { description?: string } | null } };
    const r = j.chart.result?.[0];
    if (!r) {
      throw new Error(j.chart.error?.description ?? 'No market data returned for symbol');
    }

    const q = r.indicators.quote[0];
    const rawCandles: Candle[] = [];
    (r.timestamp ?? []).forEach((t, k) => {
      const o = q.open[k], h = q.high[k], l = q.low[k], c = q.close[k];
      if (o == null || h == null || l == null || c == null) return;
      if (rawCandles.length && t <= rawCandles[rawCandles.length - 1].time) return;
      rawCandles.push({
        time: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: q.volume[k] ?? 0,
      });
    });

    let candles = rawCandles;
    if (cfg.aggregateSec) {
      candles = aggregateBars(candles, cfg.aggregateSec);
    }

    const meta = r.meta;
    const price = meta.regularMarketPrice ?? (candles[candles.length - 1]?.close ?? 0);
    const quote: QuoteInfo = {
      price,
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? price,
      dayHigh: meta.regularMarketDayHigh ?? price,
      dayLow: meta.regularMarketDayLow ?? price,
      currency: meta.currency ?? (symbol.endsWith('.NS') ? 'INR' : 'USD'),
      open: meta.currentTradingPeriod?.regular
        ? Date.now() / 1000 >= meta.currentTradingPeriod.regular.start &&
          Date.now() / 1000 <= meta.currentTradingPeriod.regular.end
        : null,
      time: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
      name: meta.longName ?? meta.shortName ?? symbol,
    };

    return { candles: candles.slice(-600), quote };
  }

  subscribeBars(sub: DatafeedSubscription): () => void {
    let stop = false;
    let timer = 0;
    const cfg = getYahooConfig(sub.timeframe);
    const tfSec = cfg.aggregateSec ?? 60;
    const aggregator = new CandleAggregator(tfSec);

    const poll = async () => {
      if (stop) return;
      try {
        const { quote } = await this.getBars(sub.symbol, sub.timeframe);
        if (stop) return;
        if (sub.onQuote) sub.onQuote(quote);
        if (quote.price > 0) {
          aggregator.push({
            symbol: sub.symbol,
            price: quote.price,
            qty: 0,
            side: 'buy',
            timestamp: (quote.time || Date.now() / 1000) * 1000,
          });
          if (aggregator.current) {
            sub.onTick(aggregator.current);
          }
        }
      } catch {}
      if (!stop) {
        timer = window.setTimeout(poll, document.hidden ? 15000 : 3000);
      }
    };

    void poll();

    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }
}
