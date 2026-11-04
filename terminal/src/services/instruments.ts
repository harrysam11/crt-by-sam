import type { AssetCategory, Instrument, Provider, Timeframe } from '../types/terminal';

const I = (id: string, label: string, name: string, category: AssetCategory, provider: Provider, currency = 'USD', decimals?: number): Instrument =>
  ({ id, label, name, category, provider, currency, decimals });

export const DEFAULT_INSTRUMENTS: Instrument[] = [
  I('BTCUSDT', 'BTC/USDT', 'Bitcoin', 'CRYPTO', 'binance'),
  I('ETHUSDT', 'ETH/USDT', 'Ethereum', 'CRYPTO', 'binance'),
  I('SOLUSDT', 'SOL/USDT', 'Solana', 'CRYPTO', 'binance'),
  I('BNBUSDT', 'BNB/USDT', 'BNB', 'CRYPTO', 'binance'),
  I('XRPUSDT', 'XRP/USDT', 'XRP', 'CRYPTO', 'binance'),
  I('DOGEUSDT', 'DOGE/USDT', 'Dogecoin', 'CRYPTO', 'binance'),

  I('EURUSD=X', 'EUR/USD', 'Euro / US Dollar', 'FOREX', 'yahoo', 'USD', 5),
  I('GBPUSD=X', 'GBP/USD', 'Pound / US Dollar', 'FOREX', 'yahoo', 'USD', 5),
  I('USDJPY=X', 'USD/JPY', 'US Dollar / Yen', 'FOREX', 'yahoo', 'JPY', 3),
  I('AUDUSD=X', 'AUD/USD', 'Aussie / US Dollar', 'FOREX', 'yahoo', 'USD', 5),
  I('USDCAD=X', 'USD/CAD', 'US Dollar / CAD', 'FOREX', 'yahoo', 'CAD', 5),
  I('USDINR=X', 'USD/INR', 'US Dollar / Rupee', 'FOREX', 'yahoo', 'INR', 3),

  I('XAUUSD=X', 'XAU/USD', 'Gold spot', 'COMMODITY', 'yahoo', 'USD', 2),
  I('XAGUSD=X', 'XAG/USD', 'Silver spot', 'COMMODITY', 'yahoo', 'USD', 3),
  I('GC=F', 'Gold fut.', 'Gold futures', 'COMMODITY', 'yahoo', 'USD', 2),
  I('CL=F', 'WTI Crude', 'Crude oil futures', 'COMMODITY', 'yahoo', 'USD', 2),
  I('BZ=F', 'Brent', 'Brent crude futures', 'COMMODITY', 'yahoo', 'USD', 2),
  I('NG=F', 'Nat Gas', 'Natural gas futures', 'COMMODITY', 'yahoo', 'USD', 3),

  I('AAPL', 'AAPL', 'Apple', 'US_STOCK', 'yahoo'),
  I('MSFT', 'MSFT', 'Microsoft', 'US_STOCK', 'yahoo'),
  I('NVDA', 'NVDA', 'NVIDIA', 'US_STOCK', 'yahoo'),
  I('TSLA', 'TSLA', 'Tesla', 'US_STOCK', 'yahoo'),
  I('AMZN', 'AMZN', 'Amazon', 'US_STOCK', 'yahoo'),
  I('GOOGL', 'GOOGL', 'Alphabet', 'US_STOCK', 'yahoo'),
  I('SPY', 'SPY', 'S&P 500 ETF', 'US_STOCK', 'yahoo'),

  I('RELIANCE.NS', 'RELIANCE', 'Reliance Industries (NSE)', 'IN_STOCK', 'yahoo', 'INR', 2),
  I('TCS.NS', 'TCS', 'Tata Consultancy (NSE)', 'IN_STOCK', 'yahoo', 'INR', 2),
  I('HDFCBANK.NS', 'HDFCBANK', 'HDFC Bank (NSE)', 'IN_STOCK', 'yahoo', 'INR', 2),
  I('INFY.NS', 'INFY', 'Infosys (NSE)', 'IN_STOCK', 'yahoo', 'INR', 2),
  I('ICICIBANK.NS', 'ICICIBANK', 'ICICI Bank (NSE)', 'IN_STOCK', 'yahoo', 'INR', 2),
  I('SBIN.NS', 'SBIN', 'State Bank of India (NSE)', 'IN_STOCK', 'yahoo', 'INR', 2),

  I('^NSEI', 'Nifty 50', 'NSE Nifty 50', 'INDEX', 'yahoo', 'INR', 2),
  I('^NSEBANK', 'Bank Nifty', 'NSE Nifty Bank', 'INDEX', 'yahoo', 'INR', 2),
  I('^BSESN', 'Sensex', 'BSE Sensex', 'INDEX', 'yahoo', 'INR', 2),
  I('^GSPC', 'S&P 500', 'S&P 500 index', 'INDEX', 'yahoo', 'USD', 2),
  I('^IXIC', 'Nasdaq', 'Nasdaq Composite', 'INDEX', 'yahoo', 'USD', 2),
  I('^DJI', 'Dow 30', 'Dow Jones Industrial', 'INDEX', 'yahoo', 'USD', 2),
];

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  CRYPTO: 'Crypto', FOREX: 'Forex', COMMODITY: 'Commodities', US_STOCK: 'US stocks', IN_STOCK: 'India', INDEX: 'Indices',
};

/** Binance supports 1s; Yahoo has no 1s data, and 4h is built client-side from 1h. */
export const TIMEFRAMES: Record<Provider, Timeframe[]> = {
  binance: ['1s', '1m', '5m', '15m', '1h', '4h', '1d'],
  yahoo: ['1m', '5m', '15m', '1h', '4h', '1d'],
};

const registry = new Map<string, Instrument>();
export const registerInstruments = (list: Instrument[]) => list.forEach((i) => registry.set(i.id, i));
export const getInstrument = (id: string) => registry.get(id);
registerInstruments(DEFAULT_INSTRUMENTS);

// ---- FX: USD value of one unit of each quote currency (seeded, then refreshed live) -------------
const rates: Record<string, number> = { USD: 1, INR: 0.012, JPY: 0.0066, EUR: 1.08, GBP: 1.27, CAD: 0.72, CHF: 1.1, AUD: 0.65, HKD: 0.128 };
const DIRECT = ['EUR', 'GBP', 'AUD', 'NZD']; // quoted as CCYUSD=X (USD per unit); others as CCY=X (units per USD)

export const fxSymbol = (cur: string) => (DIRECT.includes(cur) ? `${cur}USD=X` : `${cur}=X`);
export const setFx = (cur: string, quote: number) => { if (quote > 0) rates[cur] = DIRECT.includes(cur) ? quote : 1 / quote; };
export const currencyOf = (symbol: string) => registry.get(symbol)?.currency ?? 'USD';
export const toUsd = (symbol: string) => rates[currencyOf(symbol)] ?? 1;
