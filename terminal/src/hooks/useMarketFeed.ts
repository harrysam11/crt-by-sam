import { useEffect } from 'react';
import { wsManager } from '../services/websocket';
import { CandleAggregator } from '../services/aggregator';
import { fetchQuote } from '../services/yahoo';
import { fxSymbol, getInstrument, setFx, TIMEFRAMES } from '../services/instruments';
import { useTerminalStore } from '../store/useTerminalStore';
import { datafeedHub } from '../services/datafeed';
import { parseTimeframeToSeconds } from '../utils/timeframe';
import type { Candle, Tick, Timeframe } from '../types/terminal';

const TF_SEC: Record<Timeframe, number> = {
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

const STORE_INTERVAL_MS = 100; // price -> store at 10 Hz max; the chart gets every update

/** Live candle fan-out. The chart subscribes directly, so ticks never cause React renders. */
export const liveCandleBus = new Set<(c: Candle) => void>();

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

  // FX for PnL conversion (INR, JPY, ...): once at start, then every minute.
  useEffect(() => {
    const run = async () => {
      const s = store();
      const curs = new Set<string>([...s.instruments.map((i) => i.currency), ...Object.keys(s.positions).map((p) => getInstrument(p)?.currency ?? 'USD')]);
      curs.delete('USD');
      for (const c of curs) {
        try { setFx(c, (await fetchQuote(fxSymbol(c))).price); } catch { /* keep seeded rate */ }
      }
    };
    void run();
    const id = setInterval(run, 60000);
    return () => clearInterval(id);
  }, [yahooKey]);

  // Active symbol: history + live feed via DatafeedHub.
  useEffect(() => {
    const st = store();
    const provider = getInstrument(symbol)?.provider ?? 'binance';
    const isCustom = /^[1-9]\d{0,3}[smhdwM]$/.test(timeframe);
    if (!TIMEFRAMES[provider]?.includes(timeframe) && !isCustom) {
      st.setTimeframe('1m');
      return;
    }

    const ctl = new AbortController();
    let agg: CandleAggregator | null = null;
    let lastPush = 0;
    let cancelled = false;

    const handleRealtimeBar = (bar: Candle) => {
      liveCandleBus.forEach((fn) => fn(bar));
      const now = performance.now();
      if (now - lastPush >= STORE_INTERVAL_MS) {
        lastPush = now;
        store().updatePriceTick(symbol, bar.close);
      }
    };

    const load = async () => {
      try {
        store().setIsLoadingCandles(true);
        const { candles, quote } = await datafeedHub.getBars(symbol, timeframe, undefined, undefined, ctl.signal);
        if (cancelled) return;
        if (!candles.length) throw new Error('No data for this symbol and timeframe.');
        if (quote) {
          store().updateQuote(symbol, quote);
          store().updateWatchlist({ [symbol]: { price: quote.price, change: pct(quote.price, quote.prevClose) } });
        }
        const durSec = parseTimeframeToSeconds(timeframe);
        agg = new CandleAggregator(durSec > 0 ? durSec : 60, candles[candles.length - 1]);
        store().setError(null);
        store().setCandles(candles);
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return;
        store().setError(e instanceof Error ? e.message : 'Failed to load data.');
      } finally {
        if (!cancelled) {
          store().setIsLoadingCandles(false);
        }
      }
    };

    const subId = datafeedHub.subscribeBars(
      symbol,
      timeframe,
      (bar) => {
        handleRealtimeBar(bar);
      },
      (q) => {
        store().updateQuote(symbol, q);
        store().updateWatchlist({ [symbol]: { price: q.price, change: pct(q.price, q.prevClose) } });
      }
    );

    void load();

    return () => {
      cancelled = true;
      ctl.abort();
      datafeedHub.unsubscribeBars(subId);
    };
  }, [symbol, timeframe]);
}
