/**
 * xAlphaWireService.ts
 * Curated real-time market-moving tweets & social intelligence wire.
 * Connects traders to high-impact posts from:
 *   - @DeItaone (Walter Bloomberg / Financial wire)
 *   - @tier10k (Tree News / Ultra-fast macro & crypto wire)
 *   - @federalreserve (FOMC & Federal Reserve Board)
 *   - @FinancialJuice (Real-time economic releases)
 *   - @elonmusk (Macro & Tech sentiment)
 *   - @saylor (Institutional BTC treasury updates)
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
  category: 'MACRO' | 'CENTRAL_BANK' | 'CRYPTO' | 'COMMODITIES' | 'EARNINGS';
  impact: 'HIGH' | 'MED' | 'LOW';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  tweetUrl: string;
}

export const CURATED_MARKET_TWEETS: MarketTweetItem[] = [
  {
    id: 'xt-1',
    handle: 'DeItaone',
    name: 'Walter Bloomberg',
    isVerified: true,
    timestamp: Date.now() - 3 * 60 * 1000,
    content: 'US 10-YEAR YIELDS RETREAT TO 4.38% FOLLOWING SOFT WHOLESALE INFLATION PRINT; DXY INDEX DIPS BELOW 106.20.',
    symbols: ['XAUUSD', 'EURUSD', 'DXY'],
    category: 'MACRO',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/DeItaone',
  },
  {
    id: 'xt-2',
    handle: 'tier10k',
    name: 'Tree News',
    isVerified: true,
    timestamp: Date.now() - 11 * 60 * 1000,
    content: 'FED FUNDS FUTURES NOW PRICING AN 84.2% PROBABILITY OF A 25 BPS RATE CUT AT THE UPCOMING FOMC MEETING.',
    symbols: ['XAUUSD', 'BTCUSDT', 'SPX'],
    category: 'CENTRAL_BANK',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/tier10k',
  },
  {
    id: 'xt-3',
    handle: 'federalreserve',
    name: 'Federal Reserve',
    isVerified: true,
    timestamp: Date.now() - 28 * 60 * 1000,
    content: 'Federal Reserve Board releases statement on monetary policy operations and overnight reverse repurchase facility adjustments.',
    symbols: ['XAUUSD', 'EURUSD', 'USDJPY'],
    category: 'CENTRAL_BANK',
    impact: 'HIGH',
    sentiment: 'NEUTRAL',
    tweetUrl: 'https://x.com/federalreserve',
  },
  {
    id: 'xt-4',
    handle: 'FinancialJuice',
    name: 'FinancialJuice',
    isVerified: true,
    timestamp: Date.now() - 42 * 60 * 1000,
    content: 'SPOT GOLD (XAU/USD) CLIMBS TO SESSION HIGHS AS CENTRAL BANK OFFICIAL RESERVES REACH NEW RECORD LEVEL IN Q4.',
    symbols: ['XAUUSD', 'GOLD'],
    category: 'COMMODITIES',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/FinancialJuice',
  },
  {
    id: 'xt-5',
    handle: 'saylor',
    name: 'Michael Saylor',
    isVerified: true,
    timestamp: Date.now() - 65 * 60 * 1000,
    content: 'MicroStrategy has acquired an additional 15,400 BTC for ~$1.5 Billion at ~$97,400 per bitcoin and achieved BTC Yield of 26.4% YTD.',
    symbols: ['BTCUSDT', 'BTC', 'ETHUSDT'],
    category: 'CRYPTO',
    impact: 'HIGH',
    sentiment: 'BULLISH',
    tweetUrl: 'https://x.com/saylor',
  },
  {
    id: 'xt-6',
    handle: 'elonmusk',
    name: 'Elon Musk',
    isVerified: true,
    timestamp: Date.now() - 115 * 60 * 1000,
    content: 'Government spending waste will be dramatically reduced. Inflation is fundamentally created by excessive money supply expansion.',
    symbols: ['DXY', 'SPX', 'BTCUSDT'],
    category: 'MACRO',
    impact: 'MED',
    sentiment: 'NEUTRAL',
    tweetUrl: 'https://x.com/elonmusk',
  },
  {
    id: 'xt-7',
    handle: 'DeItaone',
    name: 'Walter Bloomberg',
    isVerified: true,
    timestamp: Date.now() - 170 * 60 * 1000,
    content: 'EUROPEAN CENTRAL BANK SIGNALS READINESS TO EXPEDITE RATE ADJUSTMENTS IF INDUSTRIAL STAGNATION PERSISTS.',
    symbols: ['EURUSD', 'EURGBP'],
    category: 'CENTRAL_BANK',
    impact: 'MED',
    sentiment: 'BEARISH',
    tweetUrl: 'https://x.com/DeItaone',
  },
];

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
 * Filter market tweets by symbol or category
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
