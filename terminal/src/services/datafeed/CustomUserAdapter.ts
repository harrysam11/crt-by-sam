/**
 * Custom User Datafeed Adapter.
 * Allows users to connect their own custom REST / WebSocket market data provider.
 * Keys and endpoints stay strictly in the user's browser (localStorage).
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { AssetCategory, Candle, Instrument, QuoteInfo, Timeframe } from '../../types/terminal';
import type { DatafeedSubscription, IDatafeedAdapter, UserCustomProviderConfig } from './types';

const STORAGE_KEY = 'crt_user_custom_datafeed';

export class CustomUserAdapter implements IDatafeedAdapter {
  readonly name = 'Custom User Provider';
  readonly providerId = 'custom';

  private config: UserCustomProviderConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  loadConfig(): UserCustomProviderConfig | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.config = stored ? JSON.parse(stored) : null;
    } catch {
      this.config = null;
    }
    return this.config;
  }

  saveConfig(cfg: UserCustomProviderConfig): void {
    this.config = cfg;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  }

  clearConfig(): void {
    this.config = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  supportsSymbol(symbol: string): boolean {
    if (!this.config?.enabled) return false;
    return symbol.startsWith('CUSTOM:') || symbol.includes(':');
  }

  async searchSymbols(query: string, _category?: AssetCategory, signal?: AbortSignal): Promise<Instrument[]> {
    if (!this.config?.enabled || !this.config.baseUrl) return [];
    try {
      const url = `${this.config.baseUrl}/search?q=${encodeURIComponent(query)}`;
      const headers: Record<string, string> = { ...this.config.headers };
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

      const res = await fetch(url, { headers, signal });
      if (!res.ok) return [];
      const hits = (await res.json()) as Array<{ symbol: string; name?: string; category?: AssetCategory }>;
      return hits.map((h) => ({
        id: `CUSTOM:${h.symbol}`,
        label: h.symbol,
        name: h.name ?? h.symbol,
        category: h.category ?? 'CRYPTO',
        provider: 'custom',
        currency: 'USD',
      }));
    } catch {
      return [];
    }
  }

  async resolveSymbol(symbolId: string): Promise<Instrument> {
    const rawSymbol = symbolId.replace(/^CUSTOM:/, '');
    return {
      id: symbolId,
      label: rawSymbol,
      name: `${rawSymbol} (Custom Provider)`,
      category: 'CRYPTO',
      provider: 'custom',
      currency: 'USD',
      decimals: 2,
    };
  }

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    _fromSec?: number,
    _toSec?: number,
    signal?: AbortSignal
  ): Promise<{ candles: Candle[]; quote: QuoteInfo }> {
    if (!this.config?.enabled || !this.config.baseUrl) {
      throw new Error('Custom provider is not configured or disabled');
    }
    const rawSymbol = symbol.replace(/^CUSTOM:/, '');
    const url = `${this.config.baseUrl}/candles?symbol=${encodeURIComponent(rawSymbol)}&timeframe=${timeframe}`;
    const headers: Record<string, string> = { ...this.config.headers };
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

    const res = await fetch(url, { headers, signal });
    if (!res.ok) throw new Error(`Custom provider returned ${res.status}`);

    const candles = (await res.json()) as Candle[];
    const last = candles[candles.length - 1];
    const price = last ? last.close : 0;

    const quote: QuoteInfo = {
      price,
      prevClose: candles[candles.length - 2]?.close ?? price,
      dayHigh: last ? Math.max(...candles.map((c) => c.high)) : price,
      dayLow: last ? Math.min(...candles.map((c) => c.low)) : price,
      currency: 'USD',
      open: true,
      time: last ? last.time : Math.floor(Date.now() / 1000),
      name: rawSymbol,
    };

    return { candles, quote };
  }

  subscribeBars(sub: DatafeedSubscription): () => void {
    if (!this.config?.enabled || !this.config.wsUrl) {
      return () => {};
    }
    const ws = new WebSocket(this.config.wsUrl);
    ws.onmessage = (e) => {
      try {
        const bar = JSON.parse(e.data as string) as Candle;
        if (bar && bar.time && bar.close) sub.onTick(bar);
      } catch {}
    };
    return () => {
      try {
        ws.close();
      } catch {}
    };
  }
}
