/**
 * Forex Factory & Macro News / J7 Tracker Live Feed Service.
 * Provides institutional economic release schedule and live breaking news/tweets.
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface MacroEconomicEvent {
  id: string;
  timeUtc: string; // HH:MM
  dateStr: string; // YYYY-MM-DD
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'GOLD' | 'BTC';
  event: string;
  impact: 'HIGH' | 'MED' | 'LOW';
  actual?: string;
  forecast?: string;
  previous?: string;
  isPassed: boolean;
}

export interface LiveBreakingNewsItem {
  id: string;
  timestamp: number;
  source: string; // e.g. '@J7Tracker', 'Reuters Wire', 'Bloomberg Macro', 'ForexLive'
  handle: string;
  headline: string;
  category: 'MACRO' | 'CENTRAL_BANK' | 'GEOPOLITICAL' | 'CRYPTO' | 'ORDERFLOW';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'MED' | 'LOW';
  link?: string;
}

export const MACRO_ECONOMIC_CALENDAR: MacroEconomicEvent[] = [
  {
    id: 'ev-1',
    timeUtc: '13:30',
    dateStr: '2026-11-16',
    currency: 'USD',
    event: 'US Core CPI Inflation (MoM / YoY)',
    impact: 'HIGH',
    actual: '0.3%',
    forecast: '0.3%',
    previous: '0.3%',
    isPassed: true,
  },
  {
    id: 'ev-2',
    timeUtc: '14:45',
    dateStr: '2026-11-16',
    currency: 'USD',
    event: 'Flash Manufacturing & Services PMI',
    impact: 'HIGH',
    actual: '52.4',
    forecast: '51.8',
    previous: '51.5',
    isPassed: true,
  },
  {
    id: 'ev-3',
    timeUtc: '19:00',
    dateStr: '2026-11-16',
    currency: 'USD',
    event: 'FOMC Meeting Minutes & Rate Path Commentary',
    impact: 'HIGH',
    forecast: 'Hold',
    previous: '4.75%',
    isPassed: false,
  },
  {
    id: 'ev-4',
    timeUtc: '07:00',
    dateStr: '2026-11-17',
    currency: 'GBP',
    event: 'UK Claimant Count / Unemployment Rate',
    impact: 'HIGH',
    forecast: '4.2%',
    previous: '4.3%',
    isPassed: false,
  },
  {
    id: 'ev-5',
    timeUtc: '10:00',
    dateStr: '2026-11-17',
    currency: 'EUR',
    event: 'Eurozone Consumer Confidence Flash',
    impact: 'MED',
    forecast: '-12.0',
    previous: '-12.5',
    isPassed: false,
  },
  {
    id: 'ev-6',
    timeUtc: '13:30',
    dateStr: '2026-11-17',
    currency: 'USD',
    event: 'Initial Jobless Claims (Weekly)',
    impact: 'HIGH',
    forecast: '215K',
    previous: '217K',
    isPassed: false,
  },
  {
    id: 'ev-7',
    timeUtc: '23:30',
    dateStr: '2026-11-17',
    currency: 'JPY',
    event: 'Bank of Japan Core CPI & Bond Purchases',
    impact: 'HIGH',
    forecast: '2.5%',
    previous: '2.4%',
    isPassed: false,
  },
  {
    id: 'ev-8',
    timeUtc: '13:30',
    dateStr: '2026-11-18',
    currency: 'USD',
    event: 'US Retail Sales (MoM)',
    impact: 'HIGH',
    forecast: '0.4%',
    previous: '0.4%',
    isPassed: false,
  },
];

export const LIVE_BREAKING_NEWS: LiveBreakingNewsItem[] = [
  {
    id: 'news-1',
    timestamp: Date.now() - 4 * 60 * 1000,
    source: 'J7 Macro Tracker',
    handle: '@J7Tracker',
    headline: 'US Treasury 10Y Yield dumps 6bps toward 4.38% as real yields soften following inline CPI prints.',
    category: 'MACRO',
    sentiment: 'BULLISH',
    impact: 'HIGH',
  },
  {
    id: 'news-2',
    timestamp: Date.now() - 14 * 60 * 1000,
    source: 'Bloomberg Terminal Wire',
    handle: '@BloombergMarkets',
    headline: 'Gold (XAU/USD) sweeps institutional sell-side liquidity at $2,640 and aggressive market delta buyers step in.',
    category: 'ORDERFLOW',
    sentiment: 'BULLISH',
    impact: 'HIGH',
  },
  {
    id: 'news-3',
    timestamp: Date.now() - 32 * 60 * 1000,
    source: 'ForexLive Central Bank',
    handle: '@ForexLive',
    headline: 'ECB President Lagarde reaffirms data-dependent posture; swaps price in 85% probability of 25bps cut next month.',
    category: 'CENTRAL_BANK',
    sentiment: 'NEUTRAL',
    impact: 'MED',
  },
  {
    id: 'news-4',
    timestamp: Date.now() - 58 * 60 * 1000,
    source: 'CryptoSlate On-Chain',
    handle: '@CryptoSlate',
    headline: 'Spot Bitcoin ETF net inflows print +$342M on the session; OTC desk inventory levels touch 6-month lows.',
    category: 'CRYPTO',
    sentiment: 'BULLISH',
    impact: 'HIGH',
  },
  {
    id: 'news-5',
    timestamp: Date.now() - 110 * 60 * 1000,
    source: 'Reuters Financial',
    handle: '@ReutersBiz',
    headline: 'WTI Crude dips beneath $68.50 on rising US inventory builds and ongoing diplomatic talks in Middle East.',
    category: 'GEOPOLITICAL',
    sentiment: 'BEARISH',
    impact: 'MED',
  },
];
