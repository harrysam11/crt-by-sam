/**
 * Economic Calendar & Financial News Feed Service.
 * Fetches real weekly macro calendar events from FairEconomy / ForexFactory
 * and live financial news stories from Yahoo Finance news proxy.
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface RealEconomicEvent {
  id: string;
  title: string;
  country: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
  timestamp: number;
  impact: 'HIGH' | 'MED' | 'LOW' | 'HOLIDAY';
  forecast: string;
  previous: string;
}

export interface MarketNewsStory {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishTime: number; // unix seconds
  relatedTickers: string[];
  thumbnailUrl?: string;
}

interface RawFairEconomyEvent {
  title: string;
  country: string;
  date: string; // e.g. "2026-11-05T08:30:00-05:00"
  impact: string; // "High", "Medium", "Low", "Holiday"
  forecast?: string;
  previous?: string;
}

interface RawYahooNewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  relatedTickers?: string[];
  thumbnail?: {
    resolutions?: Array<{ url: string; width: number; height: number }>;
  };
}

/**
 * Fetches real economic calendar events for the active trading week.
 */
export async function fetchEconomicCalendar(signal?: AbortSignal): Promise<RealEconomicEvent[]> {
  const urls = [
    '/api/calendar/ff_calendar_thisweek.json',
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) continue;

      const rawList: RawFairEconomyEvent[] = await res.json();
      if (!Array.isArray(rawList)) continue;

      return rawList.map((item, idx) => {
        const d = new Date(item.date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        let impact: RealEconomicEvent['impact'] = 'LOW';
        const rawImpact = (item.impact || '').toLowerCase();
        if (rawImpact.includes('high')) impact = 'HIGH';
        else if (rawImpact.includes('med')) impact = 'MED';
        else if (rawImpact.includes('holiday')) impact = 'HOLIDAY';

        return {
          id: `ev-${idx}-${dateStr}-${item.country}`,
          title: item.title || 'Economic Release',
          country: (item.country || 'USD').toUpperCase(),
          dateStr,
          timeStr,
          timestamp: d.getTime(),
          impact,
          forecast: item.forecast || '-',
          previous: item.previous || '-',
        };
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // Continue to fallback url
    }
  }

  return [];
}

/**
 * Fetches real financial news stories.
 */
export async function fetchMarketNews(topic: string = 'market', signal?: AbortSignal): Promise<MarketNewsStory[]> {
  try {
    const url = `/api/yahoo/v1/finance/search?q=${encodeURIComponent(topic)}&newsCount=30&quotesCount=0`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];

    const json = await res.json();
    const rawNews: RawYahooNewsItem[] = json?.news ?? [];

    return rawNews.map((item) => {
      const thumb = item.thumbnail?.resolutions?.[0]?.url;
      return {
        uuid: item.uuid || String(Math.random()),
        title: item.title || 'Market Update',
        publisher: item.publisher || 'Financial Wire',
        link: item.link || '#',
        publishTime: item.providerPublishTime || Math.floor(Date.now() / 1000),
        relatedTickers: Array.isArray(item.relatedTickers) ? item.relatedTickers : [],
        thumbnailUrl: thumb,
      };
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    console.warn('Failed to fetch financial news:', err);
    return [];
  }
}
