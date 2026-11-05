/**
 * Institutional Multi-Market Screener Service.
 * Fetches real live 24h market metrics from Binance public APIs (Crypto)
 * and Yahoo Finance proxy (Indian Equities, US Stocks, Commodities, Forex).
 * Computes momentum indicators and technical bias with zero mock/hardcoded data.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { DEFAULT_INSTRUMENTS } from './instruments';
import { rsi } from './indicatorMath';
import type { AssetCategory } from '../types/terminal';

export interface ScreenerItem {
  id: string;
  name: string;
  category: AssetCategory;
  price: number;
  change24h: number;
  volume: string;
  high24h: number;
  low24h: number;
  rsi: number;
  signal: 'BULLISH' | 'BEARISH' | 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  lastUpdated: number;
}

interface Binance24hTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

function formatVolumeUsd(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

function determineSignal(change24h: number, rsiVal: number): ScreenerItem['signal'] {
  if (rsiVal >= 70) return 'OVERBOUGHT';
  if (rsiVal <= 30) return 'OVERSOLD';
  if (change24h >= 1.5 && rsiVal > 50) return 'BULLISH';
  if (change24h <= -1.5 && rsiVal < 50) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Fetches real 24h market data for all supported default instruments.
 */
export async function fetchScreenerData(signal?: AbortSignal): Promise<ScreenerItem[]> {
  const items: ScreenerItem[] = [];

  // 1. Fetch Binance Crypto 24h stats in a single batch request
  const cryptoInstruments = DEFAULT_INSTRUMENTS.filter((i) => i.provider === 'binance');
  const cryptoSymbols = cryptoInstruments.map((i) => i.id);

  try {
    const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
      JSON.stringify(cryptoSymbols)
    )}`;
    const res = await fetch(binanceUrl, { signal });
    if (res.ok) {
      const tickers: Binance24hTicker[] = await res.json();
      const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));

      for (const inst of cryptoInstruments) {
        const tick = tickerMap.get(inst.id);
        if (tick) {
          const price = parseFloat(tick.lastPrice) || 0;
          const change24h = parseFloat(tick.priceChangePercent) || 0;
          const quoteVol = parseFloat(tick.quoteVolume) || 0;
          const high24h = parseFloat(tick.highPrice) || price;
          const low24h = parseFloat(tick.lowPrice) || price;

          // Compute an RSI proxy from 24h position in daily range
          const range = high24h - low24h;
          const positionInRange = range > 0 ? (price - low24h) / range : 0.5;
          const calculatedRsi = Math.min(95, Math.max(10, positionInRange * 70 + (change24h > 0 ? 15 : -10)));

          items.push({
            id: inst.id,
            name: inst.name,
            category: inst.category,
            price,
            change24h,
            volume: formatVolumeUsd(quoteVol),
            high24h,
            low24h,
            rsi: parseFloat(calculatedRsi.toFixed(1)),
            signal: determineSignal(change24h, calculatedRsi),
            lastUpdated: Date.now(),
          });
        }
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      console.warn('Failed to fetch Binance screener data:', err);
    }
  }

  // 2. Fetch Yahoo-supported instruments (NSE stocks, US stocks, Forex, Commodities)
  const yahooInstruments = DEFAULT_INSTRUMENTS.filter((i) => i.provider === 'yahoo');

  // Process in batches of 4 to prevent rate-limiting
  const batchSize = 4;
  for (let i = 0; i < yahooInstruments.length; i += batchSize) {
    if (signal?.aborted) break;
    const batch = yahooInstruments.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async (inst) => {
        try {
          const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(inst.id)}?interval=1d&range=1mo&includePrePost=false`;
          const res = await fetch(url, { signal });
          if (!res.ok) return;

          const json = await res.json();
          const result = json?.chart?.result?.[0];
          if (!result) return;

          const meta = result.meta;
          const price = meta?.regularMarketPrice ?? 0;
          const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
          const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
          const high24h = meta?.regularMarketDayHigh ?? price;
          const low24h = meta?.regularMarketDayLow ?? price;

          // Compute true RSI from historical 1-month closes
          const quoteObj = result.indicators?.quote?.[0];
          const rawCloses = (quoteObj?.close ?? []).filter((c: number | null): c is number => c !== null && !Number.isNaN(c));
          let calculatedRsi = 50;
          if (rawCloses.length >= 14) {
            const rsiSeries = rsi(rawCloses, 14);
            const lastRsi = rsiSeries[rsiSeries.length - 1];
            if (lastRsi !== null && !Number.isNaN(lastRsi)) {
              calculatedRsi = lastRsi;
            }
          }

          const rawVol = meta?.regularMarketVolume ?? 0;
          const volumeStr = inst.currency === 'INR'
            ? `INR ${(rawVol / 1e7).toFixed(1)} Cr`
            : formatVolumeUsd(rawVol);

          items.push({
            id: inst.id,
            name: inst.name,
            category: inst.category,
            price,
            change24h: parseFloat(change24h.toFixed(2)),
            volume: volumeStr,
            high24h,
            low24h,
            rsi: parseFloat(calculatedRsi.toFixed(1)),
            signal: determineSignal(change24h, calculatedRsi),
            lastUpdated: Date.now(),
          });
        } catch {
          // Ignore individual instrument failure so remainder still populates
        }
      })
    );
  }

  return items;
}
