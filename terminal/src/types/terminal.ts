export type AssetCategory = 'CRYPTO' | 'FOREX' | 'COMMODITY' | 'US_STOCK' | 'IN_STOCK' | 'INDEX';
export type Provider = 'binance' | 'yahoo' | 'custom' | 'metaquotes';
export type Timeframe = '1s' | '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d' | '1w' | '1M' | (string & {});
export type ChartStyle = 'CANDLE' | 'BAR' | 'HOLLOW_CANDLE' | 'HEIKIN_ASHI' | 'LINE' | 'AREA' | 'BASELINE' | 'FOOTPRINT';
export type PriceScaleType = 'NORMAL' | 'LOGARITHMIC' | 'PERCENTAGE';
export type ChartTimezone = 'UTC' | 'America/New_York' | 'Europe/London' | 'Asia/Kolkata' | 'Asia/Tokyo' | 'Asia/Hong_Kong';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED';
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Tick {
  symbol: string;
  price: number;
  qty: number;
  side: 'buy' | 'sell';
  timestamp: number; // ms
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number; // limit price, or fill price once filled
  triggerPrice?: number; // STOP_LOSS / TAKE_PROFIT trigger
  qty: number;
  status: OrderStatus;
  timestamp: number;
  reduceOnly?: boolean; // SL/TP only act on an existing opposite position
  leverage?: number;
  trailPct?: number;      // TRAILING_STOP: distance in % from peak price
  trailHighWater?: number; // TRAILING_STOP: running high/low watermark (auto-updated each tick)
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number; // quote currency of the instrument
  size: number;
  unrealizedPnl: number; // USD
  realizedPnl: number; // USD
  leverage: number;
  entryTime?: number; // ms
}

export interface Instrument {
  id: string; // provider symbol, e.g. BTCUSDT, EURUSD=X, RELIANCE.NS, ^NSEI
  label: string;
  name: string;
  category: AssetCategory;
  provider: Provider;
  currency: string; // quote currency; PnL converts to USD
  decimals?: number;
}

export interface QuoteInfo {
  price: number;
  prevClose: number;
  dayHigh: number;
  dayLow: number;
  currency: string;
  open: boolean | null; // null = unknown
  time: number; // last trade time, unix seconds
  name?: string;
}

export type AlertConditionType = 'PRICE' | 'UNREALIZED_LOSS' | 'INDICATOR_CROSS' | 'DRAWING_CROSS';

export interface Alert {
  id: string;
  symbol: string;
  price: number;
  dir: 'above' | 'below';
  triggered: boolean;
  createdAt: number;
  type?: AlertConditionType;
  condition?: {
    indicatorId?: string;
    operator?: 'CROSSING' | 'CROSSING_UP' | 'CROSSING_DOWN' | 'GREATER_THAN' | 'LESS_THAN';
    targetValue?: number;
    drawingId?: string;
  };
  note?: string;
  active?: boolean;
}

export interface DepthLevel { price: number; qty: number }
export interface DepthSnapshot { symbol: string; bids: DepthLevel[]; asks: DepthLevel[] }
export interface TickerStat { price: number; change: number } // change = % vs previous close

export interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  time: number; // exit time in ms
  entryTime?: number; // entry time in ms
}
