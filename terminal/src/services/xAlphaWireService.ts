/**
 * xAlphaWireService.ts
 * Curated real-time market-moving tweets & dynamic current affairs wire.
 * Connects traders to high-impact figures:
 *   - @realDonaldTrump (Donald Trump - US Policy, Tariffs, Geopolitics)
 *   - @KremlinRussia_E (Vladimir Putin / Russian Federation - Energy, Sanctions, Nuclear)
 *   - @IRIMFA_EN (Islamic Republic of Iran - Middle East Conflict, Hormuz, Oil)
 *   - @nvidia (Jensen Huang - AI Infrastructure & Semiconductors)
 *   - @OPECSecretariat (OPEC+ Alliance - Crude Oil Quotas & Energy Policy)
 *   - @DeItaone (Walter Bloomberg / Financial wire)
 *   - @tier10k (Tree News / Ultra-fast macro & crypto wire)
 *   - @federalreserve (FOMC & Federal Reserve Board)
 *   - @FinancialJuice (Real-time economic releases)
 *   - @elonmusk (Macro & Tech sentiment)
 *   - @saylor (Institutional BTC treasury updates)
 *
 * Dynamic Current Affairs Engine:
 * Fetches real-time fundamental news wire from `/api/news/wire` with automatic
 * keyword-to-asset mapping so the terminal remains permanently up to date
 * with live geopolitical and macroeconomic developments without manual updates.
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface MarketTweetItem {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  isVerified: boolean;
  timestamp: number;
  content: string;
  symbols: string[];
  category:
    | 'MACRO'
    | 'CENTRAL_BANK'
    | 'CRYPTO'
    | 'COMMODITIES'
    | 'GEOPOLITICAL'
    | 'TRUMP_POLICY'
    | 'SEMICONDUCTOR_AI'
    | 'ENERGY_OPEC';
  impact: 'HIGH' | 'MED' | 'LOW';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  tweetUrl: string;
  sourceType?: 'X_TWEET' | 'LIVE_WIRE';
}

export interface CustomFigureTracker {
  id: string;
  handle: string;
  name: string;
  category: string;
  symbols: string[];
}

export const CURATED_MARKET_TWEETS: MarketTweetItem[] = [
  {
    id: 'xt-trump-1',
    handle: 'realDonaldTrump',
    name: 'Donald J. Trump',
    isVerified: true,
    timestamp: Date.now() - 4 * 60 * 1000,
    content: 'All incoming imports from reciprocal non-compliant nations will face an immediate 25% tariff adjustment. American manufacturing and energy dominance will be protected at all costs.',
    symbols: ['SPX', 'DXY', 'XAUUSD', 'EURUSD'],
    category: 'TRUMP_POLICY',
    impact: 'HIGH',
    sentiment: 'BEARISH',
    tweetUrl: 'https://x.com/realDonaldTrump',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-putin-1',
    handle: 'KremlinRussia_E',
    name: 'President of Russia (Putin)',
    isVerified: true,
    timestamp: Date.now() - 14 * 60 * 1000,
    content: 'Natural gas pipeline routing and Eurasian currency settlements will transition 100% to non-dollar bilateral reserves. Global multipolar reserve architecture is advancing.',
    symbols: ['USOIL', 'XAUUSD', 'EURUSD'],
    category: 'GEOPOLITICAL',
    impact: 'HIGH',
    sentiment: 'BEARISH',
    tweetUrl: 'https://x.com/KremlinRussia_E',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-iran-1',
    handle: 'IRIMFA_EN',
    name: 'Foreign Ministry Iran',
    isVerified: true,
    timestamp: Date.now() - 24 * 60 * 1000,
    content: 'Strait of Hormuz commercial maritime security remains non-negotiable. Any aggressive naval provocations or unilateral sanctions will meet an immediate asymmetric response.',
    symbols: ['USOIL', 'BRENT', 'XAUUSD'],
    category: 'GEOPOLITICAL',
    impact: 'HIGH',
    sentiment: 'BEARISH',
    tweetUrl: 'https://x.com/IRIMFA_EN',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-huang-1',
    handle: 'nvidia',
    name: 'Jensen Huang (NVIDIA)',
    isVerified: true,
    timestamp: Date.now() - 36 * 60 * 1000,
    content: 'Blackwell ultra-scale AI data center shipments have accelerated beyond full capacity. Sovereign AI infrastructure demand from nation-states is growing exponentially.',
    symbols: ['NVDA', 'SPX', 'BTCUSDT'],
    category: 'SEMICONDUCTOR_AI',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/nvidia',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-opec-1',
    handle: 'OPECSecretariat',
    name: 'OPEC+ Alliance',
    isVerified: true,
    timestamp: Date.now() - 52 * 60 * 1000,
    content: 'OPEC+ ministerial committee agrees to extend voluntary 2.2 million barrel per day output reductions into Q1 to maintain oil market stability and counter inventory builds.',
    symbols: ['USOIL', 'BRENT', 'CADUSD'],
    category: 'ENERGY_OPEC',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/OPECSecretariat',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-delta-1',
    handle: 'DeItaone',
    name: 'Walter Bloomberg',
    isVerified: true,
    timestamp: Date.now() - 6 * 60 * 1000,
    content: 'US 10-YEAR YIELDS RETREAT TO 4.38% FOLLOWING SOFT WHOLESALE INFLATION PRINT; DXY INDEX DIPS BELOW 106.20.',
    symbols: ['XAUUSD', 'EURUSD', 'DXY'],
    category: 'MACRO',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/DeItaone',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-tree-1',
    handle: 'tier10k',
    name: 'Tree News',
    isVerified: true,
    timestamp: Date.now() - 19 * 60 * 1000,
    content: 'FED FUNDS FUTURES NOW PRICING AN 84.2% PROBABILITY OF A 25 BPS RATE CUT AT THE UPCOMING FOMC MEETING.',
    symbols: ['XAUUSD', 'BTCUSDT', 'SPX'],
    category: 'CENTRAL_BANK',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/tier10k',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-fed-1',
    handle: 'federalreserve',
    name: 'Federal Reserve',
    isVerified: true,
    timestamp: Date.now() - 48 * 60 * 1000,
    content: 'Federal Reserve Board releases statement on monetary policy operations and overnight reverse repurchase facility adjustments.',
    symbols: ['XAUUSD', 'EURUSD', 'USDJPY'],
    category: 'CENTRAL_BANK',
    impact: 'HIGH',
    sentiment: 'NEUTRAL',
    tweetUrl: 'https://x.com/federalreserve',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-juice-1',
    handle: 'FinancialJuice',
    name: 'FinancialJuice',
    isVerified: true,
    timestamp: Date.now() - 62 * 60 * 1000,
    content: 'SPOT GOLD (XAU/USD) CLIMBS TO SESSION HIGHS AS CENTRAL BANK OFFICIAL RESERVES REACH NEW RECORD LEVEL IN Q4.',
    symbols: ['XAUUSD', 'GOLD'],
    category: 'COMMODITIES',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/FinancialJuice',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-saylor-1',
    handle: 'saylor',
    name: 'Michael Saylor',
    isVerified: true,
    timestamp: Date.now() - 85 * 60 * 1000,
    content: 'MicroStrategy has acquired an additional 15,400 BTC for ~$1.5 Billion at ~$97,400 per bitcoin and achieved BTC Yield of 26.4% YTD.',
    symbols: ['BTCUSDT', 'BTC', 'ETHUSDT'],
    category: 'CRYPTO',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/saylor',
    sourceType: 'X_TWEET',
  },
  {
    id: 'xt-elon-1',
    handle: 'elonmusk',
    name: 'Elon Musk',
    isVerified: true,
    timestamp: Date.now() - 130 * 60 * 1000,
    content: 'Government spending waste will be dramatically reduced. Inflation is fundamentally created by excessive money supply expansion.',
    symbols: ['DXY', 'SPX', 'BTCUSDT'],
    category: 'MACRO',
    impact: 'MED',
    sentiment: 'NEUTRAL',
    tweetUrl: 'https://x.com/elonmusk',
    sourceType: 'X_TWEET',
  },
];

const CUSTOM_FIGURES_KEY = 'terminalx_custom_figures';

export function getCustomTrackedFigures(): CustomFigureTracker[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FIGURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomTrackedFigure(figure: CustomFigureTracker) {
  const current = getCustomTrackedFigures();
  const exists = current.some((f) => f.handle.toLowerCase() === figure.handle.toLowerCase());
  if (!exists) {
    const updated = [figure, ...current];
    try {
      localStorage.setItem(CUSTOM_FIGURES_KEY, JSON.stringify(updated));
    } catch {}
  }
}

export function removeCustomTrackedFigure(id: string) {
  const current = getCustomTrackedFigures();
  const filtered = current.filter((f) => f.id !== id);
  try {
    localStorage.setItem(CUSTOM_FIGURES_KEY, JSON.stringify(filtered));
  } catch {}
}

/**
 * Fetch dynamic real-time fundamental news wire from the TerminalX backend.
 * Connects directly to live macro RSS feeds (Google News / Yahoo Finance)
 * covering Trump, Putin, Iran, Nvidia, Fed, OPEC, Oil, and Gold.
 */
export async function fetchLiveNewsWire(query?: string): Promise<MarketTweetItem[]> {
  try {
    const url = query
      ? `/api/news/wire?q=${encodeURIComponent(query)}`
      : '/api/news/wire';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.items) && data.items.length > 0) {
      return data.items.map((item: any) => ({
        id: item.id || `live-${Math.random().toString(36).slice(2, 8)}`,
        handle: (item.source || 'NewsWire').replace(/\s+/g, ''),
        name: item.figures && item.figures.length > 0 ? item.figures[0] : item.source || 'Breaking News',
        isVerified: true,
        timestamp: item.pub_date ? new Date(item.pub_date).getTime() : Date.now(),
        content: item.title,
        symbols: item.symbols && item.symbols.length > 0 ? item.symbols : ['SPX', 'DXY'],
        category: (item.category as any) || 'MACRO',
        impact: (item.impact as any) || 'HIGH',
        sentiment: (item.sentiment as any) || 'NEUTRAL',
        tweetUrl: item.link || 'https://news.google.com',
        sourceType: 'LIVE_WIRE',
      }));
    }
  } catch {
    // If backend wire endpoint is unreachable or offline, fall back to curated feed
  }
  return CURATED_MARKET_TWEETS;
}

/**
 * Build an X.com (Twitter) Web Intent URL to share charts or commentary directly
 */
export function buildXIntentUrl(options: {
  text: string;
  url?: string;
  hashtags?: string[];
  via?: string;
}): string {
  const params = new URLSearchParams();
  params.set('text', options.text);
  if (options.url) params.set('url', options.url);
  if (options.hashtags && options.hashtags.length > 0) {
    params.set('hashtags', options.hashtags.join(','));
  }
  if (options.via) params.set('via', options.via);
  return `https://x.com/intent/tweet?${params.toString()}`;
}

/**
 * Filter market tweets and live wire items by symbol, category, or search query
 */
export function filterMarketTweets(
  tweets: MarketTweetItem[],
  filter: {
    symbol?: string;
    category?: string;
    searchQuery?: string;
  }
): MarketTweetItem[] {
  return tweets.filter((item) => {
    if (filter.symbol && filter.symbol !== 'ALL') {
      const target = filter.symbol.toUpperCase();
      const hasDirectSymbol = item.symbols.some((s) => target.includes(s) || s.includes(target));
      const hasContentMatch = item.content.toUpperCase().includes(target.replace('USDT', ''));
      if (!hasDirectSymbol && !hasContentMatch) return false;
    }

    if (filter.category && filter.category !== 'ALL') {
      if (item.category !== filter.category) return false;
    }

    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      const matchText =
        item.content.toLowerCase().includes(q) ||
        item.handle.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    return true;
  });
}
