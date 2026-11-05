/**
 * Central Datafeed Hub.
 * Routes market data requests to the appropriate adapter (Binance, Yahoo Finance, Custom User Provider).
 * Strict TypeScript, zero mock data, zero emoji policy.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';
import type { DatafeedSubscription, IDatafeedAdapter, UserCustomProviderConfig } from './types';
import { BinanceAdapter } from './BinanceAdapter';
import { YahooAdapter } from './YahooAdapter';
import { CustomUserAdapter } from './CustomUserAdapter';
import { DEFAULT_INSTRUMENTS } from '../instruments';

class DatafeedHub {
  private binanceAdapter = new BinanceAdapter();
  private yahooAdapter = new YahooAdapter();
  private customAdapter = new CustomUserAdapter();

  private activeSubscriptions = new Map<string, () => void>();

  private getAdapterForSymbol(symbol: string): IDatafeedAdapter {
    if (this.customAdapter.supportsSymbol(symbol)) return this.customAdapter;
    if (this.binanceAdapter.supportsSymbol(symbol)) return this.binanceAdapter;
    return this.yahooAdapter;
  }

  getCustomProviderConfig(): UserCustomProviderConfig | null {
    return this.customAdapter.loadConfig();
  }

  saveCustomProviderConfig(cfg: UserCustomProviderConfig): void {
    this.customAdapter.saveConfig(cfg);
  }

  async searchSymbols(query: string, category?: AssetCategory, signal?: AbortSignal): Promise<Instrument[]> {
    const q = query.trim();
    if (!q) {
      return DEFAULT_INSTRUMENTS.filter((i) => !category || (category as string) === 'ALL' || i.category === category);
    }

    const [binanceHits, yahooHits, customHits] = await Promise.allSettled([
      this.binanceAdapter.searchSymbols(q, category, signal),
      this.yahooAdapter.searchSymbols(q, category, signal),
      this.customAdapter.searchSymbols(q, category, signal),
    ]);

    const results = new Map<string, Instrument>();
    if (binanceHits.status === 'fulfilled') binanceHits.value.forEach((i) => results.set(i.id, i));
    if (yahooHits.status === 'fulfilled') yahooHits.value.forEach((i) => results.set(i.id, i));
    if (customHits.status === 'fulfilled') customHits.value.forEach((i) => results.set(i.id, i));

    return Array.from(results.values());
  }

  async resolveSymbol(symbolId: string): Promise<Instrument> {
    const adapter = this.getAdapterForSymbol(symbolId);
    return adapter.resolveSymbol(symbolId);
  }

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    fromSec?: number,
    toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
    const adapter = this.getAdapterForSymbol(symbol);
    return adapter.getBars(symbol, timeframe, fromSec, toSec, signal);
  }

  subscribeBars(
    symbol: string,
    timeframe: Timeframe,
    onTick: (bar: Candle) => void,
    onQuote?: (quote: QuoteInfo) => void
  ): string {
    const subId = `${symbol}_${timeframe}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const adapter = this.getAdapterForSymbol(symbol);

    const subscription: DatafeedSubscription = {
      id: subId,
      symbol,
      timeframe,
      onTick,
      onQuote,
    };

    const unsubscribe = adapter.subscribeBars(subscription);
    this.activeSubscriptions.set(subId, unsubscribe);
    return subId;
  }

  unsubscribeBars(subId: string): void {
    const unsub = this.activeSubscriptions.get(subId);
    if (unsub) {
      unsub();
      this.activeSubscriptions.delete(subId);
    }
  }

  unsubscribeAll(): void {
    this.activeSubscriptions.forEach((unsub) => unsub());
    this.activeSubscriptions.clear();
  }
}

export const datafeedHub = new DatafeedHub();
