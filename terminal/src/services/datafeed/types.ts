/**
 * Datafeed Adapter Architecture for CRT Terminal.
 * Strict TypeScript, zero mock data, zero emoji policy.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';

export interface DatafeedSubscription {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  onTick: (bar: Candle) => void;
  onQuote?: (quote: QuoteInfo) => void;
}

export interface IDatafeedAdapter {
  readonly name: string;
  readonly providerId: string;
  supportsSymbol(symbol: string): boolean;
  searchSymbols(query: string, category?: AssetCategory, signal?: AbortSignal): Promise<Instrument[]>;
  resolveSymbol(symbolId: string): Promise<Instrument>;
  getBars(
    symbol: string,
    timeframe: Timeframe,
    fromSec?: number,
    toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }>;
  subscribeBars(sub: DatafeedSubscription): () => void;
}

export interface UserCustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  wsUrl?: string;
  enabled: boolean;
  headers?: Record<string, string>;
}
