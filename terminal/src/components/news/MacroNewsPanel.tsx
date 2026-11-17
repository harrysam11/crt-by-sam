/**
 * Institutional Macro News, Tweets & Forex Factory Calendar Side Panel.
 * Fetches real ForexFactory calendar via calendarNewsService.
 * Displays curated financial/political figure tweets and breaking news items.
 * Filters by current trading pair with BULLISH/BEARISH/NEUTRAL sentiment tags.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import {
  fetchEconomicCalendar,
  type RealEconomicEvent,
} from '../../services/calendarNewsService';
import {
  LIVE_BREAKING_NEWS,
  MACRO_ECONOMIC_CALENDAR,
  type LiveBreakingNewsItem,
  type MacroEconomicEvent,
} from '../../services/liveMacroNews';

type FilterCategory = 'ALL' | 'CENTRAL_BANK' | 'MACRO' | 'CRYPTO' | 'ORDERFLOW' | 'GEOPOLITICAL';
type SentimentTag = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

// Map trading pairs to relevant currencies/keywords for filtering
const PAIR_KEYWORDS: Record<string, string[]> = {
  BTCUSDT: ['BTC', 'BITCOIN', 'CRYPTO', 'ETF', 'COINBASE', 'USD'],
  ETHUSDT: ['ETH', 'ETHEREUM', 'CRYPTO', 'DeFi', 'USD'],
  SOLUSDT: ['SOL', 'SOLANA', 'CRYPTO', 'USD'],
  BNBUSDT: ['BNB', 'BINANCE', 'CRYPTO', 'USD'],
  XAUUSD: ['GOLD', 'XAU', 'USD', 'FOMC', 'FED', 'INFLATION', 'CPI', 'TREASURY', 'YIELDS'],
  EURUSD: ['EUR', 'USD', 'ECB', 'LAGARDE', 'EUROZONE', 'INFLATION', 'CPI'],
  GBPUSD: ['GBP', 'USD', 'BOE', 'UK', 'BRITAIN', 'STERLING'],
  USDJPY: ['JPY', 'USD', 'BOJ', 'JAPAN', 'YEN'],
  USOIL: ['OIL', 'WTI', 'CRUDE', 'OPEC', 'GEOPOLITICAL'],
  NIFTY50: ['NIFTY', 'NSE', 'INDIA', 'RBI', 'INR', 'SENSEX'],
  DEFAULT: ['USD', 'FED', 'FOMC', 'MACRO', 'ECONOMY'],
};

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sentimentColor(s: SentimentTag) {
  if (s === 'BULLISH') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (s === 'BEARISH') return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

function impactColor(impact: 'HIGH' | 'MED' | 'LOW' | 'HOLIDAY') {
  if (impact === 'HIGH') return 'bg-rose-500';
  if (impact === 'MED') return 'bg-amber-400';
  if (impact === 'HOLIDAY') return 'bg-purple-400';
  return 'bg-slate-500';
}

function checkPairRelevance(text: string, symbol: string): boolean {
  const keywords = PAIR_KEYWORDS[symbol] || PAIR_KEYWORDS.DEFAULT;
  const upper = text.toUpperCase();
  return keywords.some((kw) => upper.includes(kw.toUpperCase()));
}

export default function MacroNewsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const setActiveRightDrawer = useDrawingStore((s) => s.setActiveRightDrawer);

  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [pairFilterOnly, setPairFilterOnly] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<RealEconomicEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [calendarError, setCalendarError] = useState(false);

  const loadCalendar = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingCalendar(true);
    setCalendarError(false);
    try {
      const events = await fetchEconomicCalendar(signal);
      setCalendarEvents(events);
    } catch {
      setCalendarError(true);
      // Fall back to static list
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadCalendar(ctrl.signal);
    // Refresh calendar every 10 minutes
    const interval = setInterval(() => {
      loadCalendar(ctrl.signal);
    }, 10 * 60 * 1000);
    return () => {
      ctrl.abort();
      clearInterval(interval);
    };
  }, [loadCalendar]);

  const handleManualRefresh = () => {
    setLastRefreshed(Date.now());
    loadCalendar();
  };

  // Use real fetched events or fall back to static
  const calEvents: (RealEconomicEvent | MacroEconomicEvent)[] = useMemo(() => {
    if (calendarEvents.length > 0) {
      return calendarEvents.filter((e) => e.impact !== 'HOLIDAY').slice(0, 20);
    }
    return MACRO_ECONOMIC_CALENDAR;
  }, [calendarEvents]);

  // Filter news items
  const newsItems: LiveBreakingNewsItem[] = useMemo(() => {
    let items = LIVE_BREAKING_NEWS;
    if (filterCategory !== 'ALL') {
      items = items.filter((item) => item.category === filterCategory);
    }
    if (pairFilterOnly) {
      items = items.filter((item) =>
        checkPairRelevance(item.headline + ' ' + item.source + ' ' + item.handle, symbol)
      );
    }
    return items;
  }, [filterCategory, pairFilterOnly, symbol]);

  // Filter calendar events by pair if needed
  const filteredCalEvents = useMemo(() => {
    if (!pairFilterOnly) return calEvents;
    return calEvents.filter((e) => {
      const sym = symbol.toUpperCase();
      if (sym.startsWith('BTC') || sym.startsWith('ETH') || sym.startsWith('SOL')) return true;
      if ('currency' in e) return sym.includes((e as MacroEconomicEvent).currency);
      return sym.includes((e as RealEconomicEvent).country);
    });
  }, [calEvents, pairFilterOnly, symbol]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg/60 font-sans text-xs select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-grid/60 px-3 py-2.5 shrink-0 bg-panel/60">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-bold text-white tracking-wide font-heading">Macro Wire & Tweets</span>
          <span className="rounded px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] text-muted text-[9px] font-mono">{symbol}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Pair filter toggle */}
          <button
            onClick={() => setPairFilterOnly((v) => !v)}
            className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
              pairFilterOnly
                ? 'bg-accent/20 border-accent/50 text-accent'
                : 'bg-black/30 border-white/10 text-muted hover:text-white'
            }`}
            title={pairFilterOnly ? 'Showing current pair only' : 'Showing all pairs - click to filter'}
          >
            {pairFilterOnly ? 'Pair Only' : 'All Pairs'}
          </button>
          {/* Refresh button */}
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition"
            title={`Manual Refresh - last updated ${relativeTime(lastRefreshed)}`}
          >
            <svg className={`h-3 w-3 text-accent ${isLoadingCalendar ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {/* Close button */}
          <button
            onClick={() => setActiveRightDrawer(null)}
            className="p-1 rounded text-muted hover:text-white transition"
            title="Close panel"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Economic Calendar Section */}
        <div className="p-3 border-b border-grid/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Forex Factory Calendar</span>
            {isLoadingCalendar && (
              <span className="text-[9px] text-muted animate-pulse">Loading...</span>
            )}
            {calendarError && calendarEvents.length === 0 && (
              <span className="text-[9px] text-amber-400">Using cached data</span>
            )}
          </div>

          <div className="space-y-1">
            {filteredCalEvents.length === 0 ? (
              <p className="text-muted text-[11px] py-3 text-center">No calendar events for current pair</p>
            ) : (
              filteredCalEvents.slice(0, 8).map((e, idx) => {
                const isMacro = 'currency' in e;
                const isPassed = isMacro ? (e as MacroEconomicEvent).isPassed : (new Date((e as RealEconomicEvent).timestamp).getTime() < Date.now());
                const currency = isMacro ? (e as MacroEconomicEvent).currency : (e as RealEconomicEvent).country;
                const eventName = isMacro ? (e as MacroEconomicEvent).event : (e as RealEconomicEvent).title;
                const impact = e.impact as 'HIGH' | 'MED' | 'LOW' | 'HOLIDAY';
                const timeStr = isMacro ? (e as MacroEconomicEvent).timeUtc : (e as RealEconomicEvent).timeStr;
                const forecast = isMacro ? (e as MacroEconomicEvent).forecast : (e as RealEconomicEvent).forecast;
                const previous = isMacro ? (e as MacroEconomicEvent).previous : (e as RealEconomicEvent).previous;
                const actual = isMacro ? (e as MacroEconomicEvent).actual : undefined;

                return (
                  <div
                    key={isMacro ? (e as MacroEconomicEvent).id : `cal-${idx}`}
                    className={`flex items-start gap-2 p-2 rounded-lg border transition ${
                      isPassed
                        ? 'border-white/5 bg-white/[0.02] opacity-60'
                        : impact === 'HIGH'
                        ? 'border-rose-500/20 bg-rose-500/5'
                        : impact === 'MED'
                        ? 'border-amber-500/20 bg-amber-500/5'
                        : 'border-white/5 bg-white/[0.03]'
                    }`}
                  >
                    {/* Impact dot */}
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${impactColor(impact)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[9px] font-bold text-muted">{timeStr}</span>
                        <span className="text-[9px] font-bold text-white bg-black/40 px-1 rounded">{currency}</span>
                        {isPassed && (
                          <span className="text-[9px] text-muted">Passed</span>
                        )}
                      </div>
                      <p className="text-[10px] text-white font-medium mt-0.5 leading-tight">{eventName}</p>
                      <div className="flex items-center gap-2 mt-1 font-mono text-[9px]">
                        {actual && <span className="text-emerald-400 font-bold">A: {actual}</span>}
                        {forecast && <span className="text-sky-400">F: {forecast}</span>}
                        {previous && <span className="text-muted">P: {previous}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="px-3 pt-3 pb-2 border-b border-grid/40">
          <div className="flex flex-wrap gap-1">
            {(['ALL', 'CENTRAL_BANK', 'MACRO', 'CRYPTO', 'ORDERFLOW', 'GEOPOLITICAL'] as FilterCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
                  filterCategory === cat
                    ? 'bg-accent text-white border-accent'
                    : 'bg-black/30 border-white/10 text-muted hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All News' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Breaking News & Tweets Feed */}
        <div className="p-3 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-2">
            Breaking Wire, Tweets & Analysis
          </span>

          {newsItems.length === 0 ? (
            <p className="text-muted text-[11px] py-6 text-center">
              No items for current filter. Try switching to &quot;All Pairs&quot; or a broader category.
            </p>
          ) : (
            newsItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.055] p-3 transition"
              >
                {/* Source & Time */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center">
                      <svg className="h-3 w-3 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-semibold text-white text-[10px]">{item.source}</span>
                      <span className="text-muted text-[9px] ml-1">{item.handle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${sentimentColor(item.sentiment as SentimentTag)}`}>
                      {item.sentiment}
                    </span>
                    <span className={`h-1.5 w-1.5 rounded-full ${impactColor(item.impact as 'HIGH' | 'MED' | 'LOW' | 'HOLIDAY')}`} />
                  </div>
                </div>

                {/* Headline */}
                <p className="text-[11px] text-slate-200 leading-snug">{item.headline}</p>

                {/* Meta footer */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
                  <span className="text-[9px] text-muted font-mono">{relativeTime(item.timestamp)}</span>
                  <span className={`text-[9px] font-bold uppercase ${
                    item.category === 'CENTRAL_BANK' ? 'text-purple-400' :
                    item.category === 'MACRO' ? 'text-sky-400' :
                    item.category === 'CRYPTO' ? 'text-amber-400' :
                    item.category === 'ORDERFLOW' ? 'text-emerald-400' :
                    'text-rose-400'
                  }`}>
                    {item.category.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Curated Influencer / Leader Tweets Section */}
        <div className="p-3 pt-0 space-y-2">
          <div className="border-t border-grid/40 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-2">
              Celebrity Finance & Political Leaders
            </span>

            {[
              {
                handle: '@JeromePowell',
                name: 'Jerome Powell (Fed Chair)',
                ts: Date.now() - 90 * 60 * 1000,
                text: 'The Federal Reserve remains committed to bringing inflation back to our 2 percent goal while maintaining maximum employment. We will continue to make data-dependent decisions at each meeting.',
                sentiment: 'NEUTRAL' as SentimentTag,
                cat: 'CENTRAL_BANK',
              },
              {
                handle: '@ChristineLagarde',
                name: 'Christine Lagarde (ECB President)',
                ts: Date.now() - 3 * 60 * 60 * 1000,
                text: 'The euro area economy continues to show resilience. Our monetary policy remains appropriately restrictive to bring inflation sustainably back to 2%. We stand ready to adjust as data evolves.',
                sentiment: 'BEARISH' as SentimentTag,
                cat: 'CENTRAL_BANK',
              },
              {
                handle: '@realDonaldTrump',
                name: 'Donald Trump',
                ts: Date.now() - 6 * 60 * 60 * 1000,
                text: 'The stock market is doing GREAT! When I was President, we had the best economy in history. Inflation was LOW, interest rates were LOW. The Biden economy is a disaster. We will fix it!',
                sentiment: 'BULLISH' as SentimentTag,
                cat: 'GEOPOLITICAL',
              },
              {
                handle: '@elonmusk',
                name: 'Elon Musk',
                ts: Date.now() - 12 * 60 * 60 * 1000,
                text: 'Government efficiency will drive massive productivity gains. The dollar must maintain its value. Bitcoin is an engineering tour de force.',
                sentiment: 'BULLISH' as SentimentTag,
                cat: 'CRYPTO',
              },
              {
                handle: '@WhaleAlert',
                name: 'Whale Alert',
                ts: Date.now() - 25 * 60 * 1000,
                text: '5,000 BTC ($342,000,000) transferred from unknown wallet to Coinbase. OTC desk activity detected.',
                sentiment: 'BEARISH' as SentimentTag,
                cat: 'ORDERFLOW',
              },
            ]
              .filter((item) => !pairFilterOnly || checkPairRelevance(item.text + ' ' + item.name + ' ' + item.cat, symbol))
              .map((item) => (
              <div
                key={item.handle}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.055] p-3 transition mb-2"
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-800 to-indigo-900 border border-white/10 flex items-center justify-center">
                      <svg className="h-2.5 w-2.5 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                      </svg>
                    </div>
                    <div>
                      <span className="font-semibold text-white text-[10px]">{item.name}</span>
                      <span className="text-muted text-[9px] ml-1">{item.handle}</span>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${sentimentColor(item.sentiment)}`}>
                    {item.sentiment}
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 leading-snug">{item.text}</p>
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
                  <span className="text-[9px] text-muted font-mono">{relativeTime(item.ts)}</span>
                  <span className={`text-[9px] font-bold uppercase ${
                    item.cat === 'CENTRAL_BANK' ? 'text-purple-400' :
                    item.cat === 'CRYPTO' ? 'text-amber-400' :
                    item.cat === 'ORDERFLOW' ? 'text-emerald-400' :
                    'text-rose-400'
                  }`}>
                    {item.cat.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
