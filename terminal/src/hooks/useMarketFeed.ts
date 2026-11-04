import { useEffect } from 'react';
import { wsManager } from '../services/websocket';
import { CandleAggregator } from '../services/aggregator';
import { fetchHistory, startPolling, startWatchlistPolling, fetchQuote } from '../services/yahoo';
import { fxSymbol, getInstrument, setFx, TIMEFRAMES } from '../services/instruments';
import { useTerminalStore } from '../store/useTerminalStore';
import type { Candle, Tick, Timeframe } from '../types/terminal';

const TF_SEC: Record<Timeframe, number> = { '1s': 1, '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
const STORE_INTERVAL_MS = 100; // price -> store at 10 Hz max; the chart gets every update

/** Live candle fan-out. The chart subscribes directly, so ticks never cause React renders. */
export const liveCandleBus = new Set<(c: Candle) => void>();

async function fetchKlines(symbol: string, tf: Timeframe, signal: AbortSignal): Promise<Candle[]> {
  const safeSym = encodeURIComponent(symbol);
  const safeTf = encodeURIComponent(tf);
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${safeSym}&interval=${safeTf}&limit=500`, { signal });
  if (!res.ok) throw new Error(`Binance returned ${res.status}.`);
  const rows = (await res.json()) as (string | number)[][];
  return rows.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000), open: Number(k[1]), high: Number(k[2]),
    low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]),
  }));
}

const pct = (price: number, prev: number) => (prev ? ((price - prev) / prev) * 100 : 0);
const store = () => useTerminalStore.getState();

export function useMarketFeed(): void {
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const cryptoKey = useTerminalStore((s) => s.instruments.filter((i) => i.provider === 'binance').map((i) => i.id).join(','));
  const yahooKey = useTerminalStore((s) => s.instruments.filter((i) => i.provider === 'yahoo').map((i) => i.id).join(','));

  // One Binance socket for the app's lifetime.
  useEffect(() => {
    const offStatus = wsManager.onStatus((st) => store().setStatus(st));
    const offTickers = wsManager.onTickers((p) => store().updateWatchlist(p));
    wsManager.connect();
    return () => { offStatus(); offTickers(); wsManager.disconnect(); };
  }, []);

  // Crypto watchlist mini-tickers follow the instrument list.
  useEffect(() => {
    const streams = cryptoKey ? cryptoKey.split(',').map((s) => `${s.toLowerCase()}@miniTicker`) : [];
    wsManager.subscribe(streams);
    return () => wsManager.unsubscribe(streams);
  }, [cryptoKey]);

  // Slow rotating refresh for non-active Yahoo symbols.
  useEffect(() => {
    if (!yahooKey) return;
    return startWatchlistPolling(
      () => { const s = store(); return s.instruments.filter((i) => i.provider === 'yahoo' && i.id !== s.symbol).map((i) => i.id); },
      (sym, q) => { store().updateQuote(sym, q); store().updateWatchlist({ [sym]: { price: q.price, change: pct(q.price, q.prevClose) } }); },
    );
  }, [yahooKey]);

  // FX for PnL conversion (INR, JPY, ...): once at start, then every minute.
  useEffect(() => {
    const run = async () => {
      const s = store();
      const curs = new Set<string>([...s.instruments.map((i) => i.currency), ...Object.keys(s.positions).map((p) => getInstrument(p)?.currency ?? 'USD')]);
      curs.delete('USD');
      for (const c of curs) {
        try { setFx(c, (await fetchQuote(fxSymbol(c))).price); } catch { /* keep the seeded rate */ }
      }
    };
    void run();
    const id = setInterval(run, 60000);
    return () => clearInterval(id);
  }, [yahooKey]);

  // Active symbol: history + live feed.
  useEffect(() => {
    const st = store();
    const provider = getInstrument(symbol)?.provider ?? 'binance';
    if (!TIMEFRAMES[provider].includes(timeframe)) { st.setTimeframe('1m'); return; }

    const ctl = new AbortController();
    const pending: Tick[] = []; // ticks that arrive while history is loading
    let agg: CandleAggregator | null = null;
    let lastPush = 0;
    let dropped = false;
    let cancelled = false;

    const feed = (ticks: Tick[]) => {
      if (!agg) return;
      let last: Tick | undefined;
      for (const t of ticks) if (t.symbol === symbol) { agg.push(t); last = t; }
      if (!last || !agg.current) return;
      const c = agg.current;
      liveCandleBus.forEach((fn) => fn(c));
      const now = performance.now();
      if (now - lastPush >= STORE_INTERVAL_MS) { lastPush = now; store().updatePriceTick(symbol, last.price); }
    };

    const load = async () => {
      try {
        let candles: Candle[];
        if (provider === 'binance') candles = await fetchKlines(symbol, timeframe, ctl.signal);
        else {
          const h = await fetchHistory(symbol, timeframe, ctl.signal);
          candles = h.candles;
          if (!cancelled) store().updateQuote(symbol, h.quote);
        }
        if (cancelled) return;
        if (!candles.length) throw new Error('No data for this symbol and timeframe.');
        agg = new CandleAggregator(TF_SEC[timeframe], candles[candles.length - 1]);
        store().setError(null);
        store().setCandles(candles);
        if (pending.length) feed(pending.splice(0));
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return;
        store().setError(e instanceof Error ? e.message : 'Failed to load data.');
      }
    };

    const queue = (ticks: Tick[]) => {
      if (agg) feed(ticks);
      else { pending.push(...ticks); if (pending.length > 5000) pending.splice(0, pending.length - 5000); }
    };

    let stopLive: () => void = () => {};
    if (provider === 'binance') {
      const sym = symbol.toLowerCase();
      const streams = [`${sym}@trade`, `${sym}@depth10@100ms`];
      const offBatch = wsManager.onBatch(queue);
      const offStatus = wsManager.onStatus((s) => {
        if (s === 'reconnecting') dropped = true;
        else if (s === 'open' && dropped) { dropped = false; void load(); } // backfill the gap
      });
      wsManager.subscribe(streams);
      stopLive = () => { offBatch(); offStatus(); wsManager.unsubscribe(streams); };
    } else {
      stopLive = startPolling(
        symbol,
        (t) => queue([t]),
        (q) => { store().updateQuote(symbol, q); store().updateWatchlist({ [symbol]: { price: q.price, change: pct(q.price, q.prevClose) } }); },
      );
    }
    void load();

    return () => { cancelled = true; ctl.abort(); stopLive(); };
  }, [symbol, timeframe]);
}
