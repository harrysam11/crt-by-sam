import type { AssetCategory, Candle, Instrument, QuoteInfo, Tick, Timeframe } from '../types/terminal';

// All calls go through the dev/preview proxy (see vite.config.ts). Unofficial API: it can rate-limit or change,
// and some exchanges are delayed. Fine for paper trading, not for execution decisions.
const BASE = '/api/yahoo';

const MAP: Partial<Record<Timeframe, { interval: string; range: string }>> = {
  '1m': { interval: '1m', range: '5d' },
  '5m': { interval: '5m', range: '1mo' },
  '15m': { interval: '15m', range: '1mo' },
  '1h': { interval: '60m', range: '6mo' },
  '4h': { interval: '60m', range: '1y' }, // aggregated below
  '1d': { interval: '1d', range: '5y' },
};

interface Meta {
  currency?: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number;
  regularMarketDayHigh?: number; regularMarketDayLow?: number; regularMarketTime?: number;
  longName?: string; shortName?: string; currentTradingPeriod?: { regular?: { start: number; end: number } };
}
interface ChartResult {
  meta: Meta; timestamp?: number[];
  indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
}

async function chart(symbol: string, interval: string, range: string, signal?: AbortSignal): Promise<ChartResult> {
  const res = await fetch(`${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`, { signal });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}. Is the dev server proxy running?`);
  const j = (await res.json()) as { chart: { result?: ChartResult[] | null; error?: { description?: string } | null } };
  const r = j.chart.result?.[0];
  if (!r) throw new Error(j.chart.error?.description ?? 'No data for this symbol.');
  return r;
}

function toQuote(m: Meta): QuoteInfo {
  const price = m.regularMarketPrice ?? 0;
  const reg = m.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  return {
    price,
    prevClose: m.chartPreviousClose ?? m.previousClose ?? price,
    dayHigh: m.regularMarketDayHigh ?? price,
    dayLow: m.regularMarketDayLow ?? price,
    currency: m.currency ?? 'USD',
    open: reg ? now >= reg.start && now <= reg.end : null,
    time: m.regularMarketTime ?? 0,
    name: m.longName ?? m.shortName,
  };
}

function aggregate(cs: Candle[], sec: number): Candle[] {
  const out: Candle[] = [];
  for (const c of cs) {
    const b = Math.floor(c.time / sec) * sec;
    const last = out[out.length - 1];
    if (last && last.time === b) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.volume += c.volume;
    } else out.push({ ...c, time: b });
  }
  return out;
}

export async function fetchHistory(symbol: string, tf: Timeframe, signal?: AbortSignal): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
  const cfg = MAP[tf];
  if (!cfg) throw new Error(`${tf} isn't available for this market.`);
  const r = await chart(symbol, cfg.interval, cfg.range, signal);
  const q = r.indicators.quote[0];
  let candles: Candle[] = [];
  (r.timestamp ?? []).forEach((t, k) => {
    const o = q.open[k], h = q.high[k], l = q.low[k], c = q.close[k];
    if (o == null || h == null || l == null || c == null) return; // gaps
    if (candles.length && t <= candles[candles.length - 1].time) return; // keep strictly ascending
    candles.push({ time: t, open: o, high: h, low: l, close: c, volume: q.volume[k] ?? 0 });
  });
  if (tf === '4h') candles = aggregate(candles, 14400);
  return { candles: candles.slice(-600), quote: toQuote(r.meta) };
}

export async function fetchQuote(symbol: string): Promise<QuoteInfo> {
  return toQuote((await chart(symbol, '1d', '1d')).meta);
}

/** Polls the active symbol and emits a tick per poll (qty 0: Yahoo gives no trade sizes). */
export function startPolling(symbol: string, onTick: (t: Tick) => void, onQuote: (q: QuoteInfo) => void, everyMs = 2000): () => void {
  let stop = false;
  let timer = 0;
  const run = async () => {
    try {
      const q = await fetchQuote(symbol);
      if (stop) return;
      onQuote(q);
      if (q.price > 0) onTick({ symbol, price: q.price, qty: 0, side: 'buy', timestamp: (q.time || Date.now() / 1000) * 1000 });
    } catch { /* transient; next poll retries */ }
    if (!stop) timer = window.setTimeout(run, document.hidden ? 15000 : everyMs);
  };
  void run();
  return () => { stop = true; clearTimeout(timer); };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Slow rotating refresh for everything else on the watchlist. */
export function startWatchlistPolling(getSymbols: () => string[], onQuote: (s: string, q: QuoteInfo) => void, everyMs = 20000): () => void {
  let stop = false;
  let timer = 0;
  const run = async () => {
    for (const s of getSymbols()) {
      if (stop) return;
      try { onQuote(s, await fetchQuote(s)); } catch { /* skip */ }
      await sleep(200);
    }
    if (!stop) timer = window.setTimeout(run, document.hidden ? 60000 : everyMs);
  };
  void run();
  return () => { stop = true; clearTimeout(timer); };
}

interface SearchHit { symbol: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }

function categorize(h: SearchHit): AssetCategory | null {
  switch (h.quoteType) {
    case 'EQUITY': case 'ETF': return /\.(NS|BO)$/.test(h.symbol) ? 'IN_STOCK' : 'US_STOCK';
    case 'CURRENCY': return 'FOREX';
    case 'FUTURE': return 'COMMODITY';
    case 'INDEX': return 'INDEX';
    case 'CRYPTOCURRENCY': return 'CRYPTO';
    default: return null;
  }
}

export async function searchSymbols(q: string, signal?: AbortSignal): Promise<Instrument[]> {
  const res = await fetch(`${BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`, { signal });
  if (!res.ok) throw new Error('Search failed');
  const j = (await res.json()) as { quotes?: SearchHit[] };
  return (j.quotes ?? []).flatMap((h) => {
    const category = categorize(h);
    if (!category) return [];
    const name = h.longname ?? h.shortname ?? h.symbol;
    return [{
      id: h.symbol, label: h.symbol.replace(/\.(NS|BO)$/, ''), name: h.exchDisp ? `${name} (${h.exchDisp})` : name,
      category, provider: 'yahoo' as const, currency: h.symbol.endsWith('.NS') || h.symbol.endsWith('.BO') ? 'INR' : 'USD', // corrected on first quote
    }];
  });
}
