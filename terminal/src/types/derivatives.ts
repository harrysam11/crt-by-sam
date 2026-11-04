export type DerivativeType = 'FUTURE' | 'CALL_OPTION' | 'PUT_OPTION' | 'SPOT';

export interface ContractSpec {
  symbol: string;
  underlying: string;
  type: DerivativeType;
  strikePrice?: number;
  expiryDate?: string;
  lotSize: number;
  tickSize: number;
  maxLeverage: number;
}

export interface DOMLevel {
  price: number;
  bidSize: number;
  askSize: number;
  totalVolume: number;
}

export interface FootprintCandle {
  time: number;
  priceLevels: {
    price: number;
    bidVolume: number;
    askVolume: number;
    delta: number;
  }[];
  pointOfControl: number; // POC price level
}

export interface GhostCandleConfig {
  higherTimeframe: '1h' | '4h' | '1d';
  transparency: number; // 0.15 to 0.35
  showHighLowBoxes: boolean;
}

export interface CanvasOrderLine {
  id: string;
  type: 'ENTRY' | 'STOP_LOSS' | 'TAKE_PROFIT';
  price: number;
  side: 'BUY' | 'SELL';
  qty: number;
  isDragging?: boolean;
}

export interface OptionStrike {
  strikePrice: number;
  callOI: number;
  callChangeOI: number;
  callLtp: number;
  callIv: number;
  putOI: number;
  putChangeOI: number;
  putLtp: number;
  putIv: number;
}

export interface OptionChainData {
  underlying: string;
  spotPrice: number;
  expiryDate: string;
  pcr: number;
  maxPain: number;
  totalCallOI: number;
  totalPutOI: number;
  strikes: OptionStrike[];
}

export interface OpenInterestBar {
  time: number;
  totalOI: number;
  callOI: number;
  putOI: number;
  changeOI: number;
}
