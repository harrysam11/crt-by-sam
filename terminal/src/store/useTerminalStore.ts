import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_INSTRUMENTS, getInstrument, registerInstruments, toUsd } from '../services/instruments';
import { notifyAlert, requestNotify } from '../utils/notify';
import { dispatchOrderFillTelegram, dispatchPriceAlertTelegram } from '../services/telegramService';
import { sanitizeSymbol, sanitizeTimeframe } from '../utils/security';
import { fmtPrice, labelOf } from '../utils/formatters';
import type {
  Alert, Candle, ConnectionStatus, Instrument, Order, OrderSide, Position, QuoteInfo, TickerStat, Timeframe, Trade,
} from '../types/terminal';
import { useExecutionEngineStore } from './useExecutionEngineStore';
import { useLayoutStore } from './useLayoutStore';
import crtModelPine from '../features/pine/presets/crtModel.pine?raw';
import { executePineScript, type PineDrawingOutput, type PinePlotOutput } from '../services/pineRunner';
import { useGuardianStore } from './useGuardianStore';

export interface PositionTicket {
  id: string;
  orderId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  entryTime: number;
  leverage: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ActivePineScript {
  id: string;
  name: string;
  code: string;
  visible: boolean;
}

export const DEFAULT_PINE_SCRIPTS: ActivePineScript[] = [
  {
    id: 'pine-crt-model-pro',
    name: 'CRT Model Pro - Sam',
    code: crtModelPine,
    visible: true,
  },
];

interface CachedPineOutput {
  cacheKey: string;
  plots: PinePlotOutput[];
  drawings?: PineDrawingOutput;
}
const pineScriptCache: Record<string, CachedPineOutput> = {};

export const START_BALANCE = 10000; // USD
export const LEVERAGES = [1, 2, 5, 10, 20, 50, 100];
const MAX_ORDERS = 200;
const MAX_TRADES = 500;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export interface TradingAccount {
  id: string;
  name: string;
  type: 'PAPER' | 'PROP_FIRM' | 'BINANCE_FUTURES' | 'BYBIT' | 'DEMO';
  balance: number;
  currency: string;
  leverageLimit: number;
  firmName?: string;
  accountNumber?: string;
  positions?: Record<string, Position>;
  orders?: Order[];
  trades?: Trade[];
}

export const DEFAULT_ACCOUNTS: TradingAccount[] = [
  {
    id: 'acc-paper-1',
    name: 'Paper Simulation',
    type: 'PAPER',
    balance: START_BALANCE,
    currency: 'USD',
    leverageLimit: 100,
    accountNumber: 'SIM-94812',
    positions: {},
    orders: [],
    trades: [],
  },
  {
    id: 'acc-apex-50k',
    name: 'Apex Trader 50K',
    type: 'PROP_FIRM',
    firmName: 'Apex Trader Funding',
    balance: 50000,
    currency: 'USD',
    leverageLimit: 20,
    accountNumber: 'APEX-50K-8812',
    positions: {},
    orders: [],
    trades: [],
  },
  {
    id: 'acc-topstep-100k',
    name: 'Topstep 100K Funded',
    type: 'PROP_FIRM',
    firmName: 'Topstep Trading',
    balance: 100000,
    currency: 'USD',
    leverageLimit: 20,
    accountNumber: 'TS-100K-3940',
    positions: {},
    orders: [],
    trades: [],
  },
  {
    id: 'acc-binance-live',
    name: 'Binance Futures Live',
    type: 'BINANCE_FUTURES',
    balance: 25480,
    currency: 'USDT',
    leverageLimit: 50,
    accountNumber: 'BN-FUT-0291',
    positions: {},
    orders: [],
    trades: [],
  },
  {
    id: 'acc-demo-scalp',
    name: 'Scalper Demo',
    type: 'DEMO',
    balance: 5000,
    currency: 'USD',
    leverageLimit: 100,
    accountNumber: 'DEMO-7718',
    positions: {},
    orders: [],
    trades: [],
  },
];

export interface PlaceOrderRequest {
  symbol: string; side: OrderSide; type: 'MARKET' | 'LIMIT'; qty: number; leverage: number;
  price?: number; stopLoss?: number; takeProfit?: number; trailStopPct?: number;
}
export interface PlaceResult { ok: boolean; error?: string; warning?: string }

interface TerminalState {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[]; // history snapshot; live candles go straight to the chart
  currentPrice: number;
  prices: Record<string, number>;
  watchlist: Record<string, TickerStat>;
  quotes: Record<string, QuoteInfo>;
  instruments: Instrument[];
  positions: Record<string, Position>;
  orders: Order[];
  trades: Trade[];
  alerts: Alert[];
  balance: number; // USD wallet = start + realized PnL
  status: ConnectionStatus;
  error: string | null;
  isLoadingCandles: boolean;
  pinePlots: Array<{ title: string; color: string; data: Array<{ time: number; value: number }> }>;
  pineDrawings: PineDrawingOutput | null;
  activePineScripts: ActivePineScript[];

  accounts: TradingAccount[];
  activeAccountId: string;
  switchAccount: (accountId: string) => void;
  createAccount: (acc: Omit<TradingAccount, 'id' | 'positions' | 'orders' | 'trades'>) => void;
  deleteAccount: (accountId: string) => void;
  resetAccountBalance: (accountId: string, newBalance?: number) => void;

  setIsLoadingCandles: (l: boolean) => void;
  setPinePlots: (plots: Array<{ title: string; color: string; data: Array<{ time: number; value: number }> }>) => void;
  setPineDrawings: (drawings: PineDrawingOutput | null) => void;
  addPineScript: (script: { name: string; code: string }) => void;
  updatePineScript: (id: string, patch: Partial<ActivePineScript>) => void;
  removePineScript: (id: string) => void;
  togglePineScript: (id: string) => void;
  showPeriodSeparators: boolean;
  togglePeriodSeparators: () => void;
  setShowPeriodSeparators: (val: boolean) => void;
  periodSeparatorInterval: 'AUTO' | '1h' | '4h' | '1D' | '1W';
  setPeriodSeparatorInterval: (interval: 'AUTO' | '1h' | '4h' | '1D' | '1W') => void;
  recalculatePineScripts: () => Promise<void>;
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  setCandles: (c: Candle[]) => void;
  setStatus: (s: ConnectionStatus) => void;
  setError: (e: string | null) => void;
  updateWatchlist: (patch: Record<string, TickerStat>) => void;
  updateQuote: (symbol: string, q: QuoteInfo) => void;
  updatePriceTick: (symbol: string, price: number) => void;
  addInstrument: (i: Instrument) => void;
  removeInstrument: (id: string) => PlaceResult;
  placeOrder: (req: PlaceOrderRequest) => PlaceResult;
  cancelOrder: (id: string) => void;
  closePosition: (symbol: string) => void;
  closePartialPosition: (symbol: string, fraction?: number) => void;
  flipPosition: (symbol: string) => void;
  snapBreakEven: (symbol: string) => void;
  closeAllPositions: () => void;
  addAlert: (symbol: string, price: number, type?: 'PRICE' | 'UNREALIZED_LOSS') => void;
  addAdvancedAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => void;
  updateAlertPrice: (id: string, newPrice: number) => void;
  toggleAlert: (id: string) => void;
  removeAlert: (id: string) => void;
  updateOrderPrice: (id: string, newPrice: number) => void;
  updatePositionBrackets: (symbol: string, sl?: number, tp?: number) => void;
  bulkModifyBrackets: (params: {
    symbols: string[];
    slOffsetPct?: number;
    tpOffsetPct?: number;
    slPrice?: number;
    tpPrice?: number;
    riskRewardRatio?: number;
    isBreakEven?: boolean;
  }) => void;
  bulkClosePositions: (symbols: string[], fraction?: number) => void;
  closeWinningPositions: () => void;
  closeLosingPositions: () => void;
  bulkCancelOrders: (orderIds: string[]) => void;
  bulkShiftOrderPrices: (orderIds: string[], offsetPct: number) => void;
  setTrailingStop: (symbol: string, trailPct: number) => void;
  positionTickets: PositionTicket[];
  positionViewMode: 'TICKETS' | 'NETTED';
  setPositionViewMode: (mode: 'TICKETS' | 'NETTED') => void;
  closePositionTicket: (ticketId: string) => void;
  resetAccount: () => void;
}

type Book = Pick<TerminalState, 'positions' | 'orders' | 'balance' | 'trades'>;

// ---- Paper engine (pure functions). PnL is converted from the quote currency to USD. ---------------

export const positionPnlUsd = (p: Position, mark: number) =>
  (mark - p.entryPrice) * p.size * (p.side === 'LONG' ? 1 : -1) * toUsd(p.symbol);
const marginUsd = (p: Position) => (p.size * p.entryPrice * toUsd(p.symbol)) / p.leverage;
export const freeMargin = (s: Pick<Book, 'positions' | 'balance'>) =>
  Object.values(s.positions).reduce((f, p) => f + p.unrealizedPnl - marginUsd(p), s.balance);
export const totalEquity = (s: Pick<Book, 'positions' | 'balance'>) =>
  Object.values(s.positions).reduce((acc, p) => acc + p.unrealizedPnl, s.balance);

/** Net a fill into the book: scale-in averages entry, opposite fills realize PnL, overshoot flips. */
function applyFill(positions: Record<string, Position>, balance: number, symbol: string, side: OrderSide, qty: number, price: number, leverage: number) {
  const next = { ...positions };
  const dir: Position['side'] = side === 'BUY' ? 'LONG' : 'SHORT';
  const pos = next[symbol];
  let trade: Trade | undefined;
  const now = Date.now();
  if (!pos) {
    next[symbol] = { symbol, side: dir, entryPrice: price, size: qty, unrealizedPnl: 0, realizedPnl: 0, leverage, entryTime: now };
  } else if (pos.side === dir) {
    const size = pos.size + qty;
    next[symbol] = { ...pos, size, entryPrice: (pos.entryPrice * pos.size + price * qty) / size, entryTime: pos.entryTime || now };
  } else {
    const closed = Math.min(pos.size, qty);
    const pnl = (price - pos.entryPrice) * closed * (pos.side === 'LONG' ? 1 : -1) * toUsd(symbol);
    balance += pnl;
    trade = { id: uid(), symbol, side: pos.side, qty: closed, entry: pos.entryPrice, exit: price, pnl, time: now, entryTime: pos.entryTime || (now - 60000) };
    const rest = qty - closed;
    if (closed < pos.size) next[symbol] = { ...pos, size: pos.size - closed, realizedPnl: pos.realizedPnl + pnl };
    else if (rest > 0) next[symbol] = { symbol, side: dir, entryPrice: price, size: rest, unrealizedPnl: 0, realizedPnl: 0, leverage, entryTime: now };
    else delete next[symbol];
  }
  return { positions: next, balance, trade };
}

const trimOrders = (o: Order[]) => (o.length > MAX_ORDERS ? o.slice(-MAX_ORDERS) : o);
const trimTrades = (t: Trade[]) => (t.length > MAX_TRADES ? t.slice(-MAX_TRADES) : t);

/** Match pending orders for `symbol` against a new price. Returns null when nothing changed. */
function runEngine(book: Book, symbol: string, price: number): Partial<Book> | null {
  const hasPending = book.orders.some((o) => o.status === 'PENDING' && o.symbol === symbol);
  if (!hasPending && !book.positions[symbol]) return null;

  let { positions, balance, trades } = book;
  let orders = book.orders;
  let touched = false as boolean;
  const newTickets: PositionTicket[] = [];

  if (hasPending) {
    orders = orders.map((o) => {
      if (o.status !== 'PENDING' || o.symbol !== symbol) return o;

      // --- Trailing Stop ratchet update ---
      if (o.type === 'TRAILING_STOP' && o.trailPct !== undefined) {
        const pos = positions[symbol];
        if (!pos) return o;
        const isLong = pos.side === 'LONG';
        const pct = o.trailPct / 100;
        // advance high-water mark
        const prevHw = o.trailHighWater ?? (isLong ? price : price);
        const newHw = isLong ? Math.max(prevHw, price) : Math.min(prevHw, price);
        const newTrigger = isLong ? newHw * (1 - pct) : newHw * (1 + pct);
        const hit = isLong ? price <= newTrigger : price >= newTrigger;
        if (!hit) return { ...o, trailHighWater: newHw, triggerPrice: newTrigger };
        // triggered — treat as stop loss fill
        const qty = Math.min(o.qty, pos.size);
        const r = applyFill(positions, balance, symbol, o.side, qty, price, o.leverage ?? 1);
        positions = r.positions;
        balance = r.balance;
        if (r.trade) trades = [...trades, r.trade];
        touched = true;
        return { ...o, qty, price, triggerPrice: newTrigger, status: 'FILLED' as const, timestamp: Date.now() };
      }

      let fill = false;
      let fillPrice = price;
      let qty = o.qty;
      if (o.type === 'LIMIT') {
        fill = o.side === 'BUY' ? price <= o.price : price >= o.price;
        fillPrice = o.price;
      } else {
        const pos = positions[symbol];
        if (!pos || (o.side === 'SELL') !== (pos.side === 'LONG')) return o; // exits need an opposite position
        const t = o.triggerPrice ?? 0;
        if (o.type === 'STOP_LOSS') fill = o.side === 'SELL' ? price <= t : price >= t;
        else fill = o.side === 'SELL' ? price >= t : price <= t;
        qty = Math.min(o.qty, pos.size);
      }
      if (!fill) return o;
      const r = applyFill(positions, balance, symbol, o.side, qty, fillPrice, o.leverage ?? 1);
      positions = r.positions;
      balance = r.balance;
      if (r.trade) trades = [...trades, r.trade];
      if (o.type === 'LIMIT' && !o.reduceOnly) {
        newTickets.push({
          id: `TKT-${Math.floor(100000 + Math.random() * 900000)}`,
          orderId: o.id,
          symbol,
          side: o.side === 'BUY' ? 'LONG' : 'SHORT',
          size: qty,
          entryPrice: fillPrice,
          entryTime: Date.now(),
          leverage: o.leverage ?? 1,
          unrealizedPnl: 0,
        });
      }
      touched = true;
      return { ...o, qty, price: fillPrice, status: 'FILLED' as const, timestamp: Date.now() };
    });
    // OCO: once flat, leftover SL/TP exits are void
    if (touched && !positions[symbol]) {
      orders = orders.map((o) => (o.status === 'PENDING' && o.symbol === symbol && o.reduceOnly ? { ...o, status: 'CANCELLED' as const } : o));
    }
  }

  const pos = positions[symbol];
  if (pos) positions = { ...positions, [symbol]: { ...pos, unrealizedPnl: positionPnlUsd(pos, price) } };
  return { positions, orders: trimOrders(orders), balance, trades: trimTrades(trades), ...(newTickets.length > 0 ? { newTickets } as any : {}) };
}

// ---- Store ---------------------------------------------------------------------------------------

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => {
      const fireAlerts = (symbol: string, price: number) => {
        const openPos = Object.values(get().positions);
        const currentUnrealizedLoss = Math.abs(
          Math.min(0, openPos.reduce((acc, p) => acc + p.unrealizedPnl, 0))
        );

        const priceHits = get().alerts.filter(
          (a) =>
            !a.triggered &&
            a.active !== false &&
            a.type !== 'UNREALIZED_LOSS' &&
            a.symbol === symbol &&
            (a.dir === 'above' ? price >= a.price : price <= a.price)
        );

        const lossHits = get().alerts.filter(
          (a) =>
            !a.triggered &&
            a.active !== false &&
            a.type === 'UNREALIZED_LOSS' &&
            currentUnrealizedLoss >= a.price
        );

        const allHits = [...priceHits, ...lossHits];
        if (!allHits.length) return;

        set((s) => ({
          alerts: s.alerts.map((a) => (allHits.some((h) => h.id === a.id) ? { ...a, triggered: true } : a)),
        }));

        priceHits.forEach((a) => {
          notifyAlert(
            `${getInstrument(symbol)?.label ?? symbol} Alert`,
            a.note || `Price reached ${fmtPrice(a.price, symbol)}`
          );
          dispatchPriceAlertTelegram(symbol, a.price, price);
        });
        lossHits.forEach((a) =>
          notifyAlert('Risk Alert: Loss Threshold Exceeded', `Unrealized loss exceeded -$${a.price.toFixed(2)}`)
        );
      };

      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const initialSymbol = sanitizeSymbol(urlParams?.get('symbol') || 'BTCUSDT');
      const initialTf = sanitizeTimeframe(urlParams?.get('tf') || '1m');

      return {
        symbol: initialSymbol,
        timeframe: initialTf,
        candles: [],
        currentPrice: 0,
        prices: {},
        watchlist: {},
        quotes: {},
        instruments: DEFAULT_INSTRUMENTS,
        positions: {},
        positionTickets: [],
        positionViewMode: 'TICKETS',
        setPositionViewMode: (mode) => set({ positionViewMode: mode }),
        orders: [],
        trades: [],
        alerts: [],
        balance: START_BALANCE,
        accounts: DEFAULT_ACCOUNTS,
        activeAccountId: 'acc-paper-1',
        status: 'closed',
        error: null,
        isLoadingCandles: false,
        pinePlots: [],
        pineDrawings: null,
        activePineScripts: DEFAULT_PINE_SCRIPTS,

        setIsLoadingCandles: (isLoadingCandles) => set({ isLoadingCandles }),
        setPinePlots: (pinePlots) => set({ pinePlots }),
        setPineDrawings: (pineDrawings) => set({ pineDrawings }),

        addPineScript: (script) => {
          const current = get().activePineScripts;
          const existing = current.find((p) => p.name === script.name);
          if (existing) {
            set({
              activePineScripts: current.map((p) =>
                p.id === existing.id ? { ...p, code: script.code, visible: true } : p
              ),
            });
          } else {
            const newScript: ActivePineScript = {
              id: `pine-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: script.name,
              code: script.code,
              visible: true,
            };
            set({ activePineScripts: [...current, newScript] });
          }
          get().recalculatePineScripts();
        },

        updatePineScript: (id, patch) => {
          set((s) => ({
            activePineScripts: s.activePineScripts.map((p) =>
              p.id === id ? { ...p, ...patch } : p
            ),
          }));
          get().recalculatePineScripts();
        },

        removePineScript: (id) => {
          set((s) => ({
            activePineScripts: s.activePineScripts.filter((p) => p.id !== id),
          }));
          get().recalculatePineScripts();
        },

        togglePineScript: (id) => {
          set((s) => ({
            activePineScripts: s.activePineScripts.map((p) =>
              p.id === id ? { ...p, visible: !p.visible } : p
            ),
          }));
          get().recalculatePineScripts();
        },

        showPeriodSeparators: true,
        periodSeparatorInterval: 'AUTO',
        togglePeriodSeparators: () => set((s) => ({ showPeriodSeparators: !s.showPeriodSeparators })),
        setShowPeriodSeparators: (val: boolean) => set({ showPeriodSeparators: val }),
        setPeriodSeparatorInterval: (val: 'AUTO' | '1h' | '4h' | '1D' | '1W') => set({ periodSeparatorInterval: val }),

        recalculatePineScripts: async () => {
          const state = get();
          const candles = state.candles;
          const symbol = state.symbol;
          const timeframe = state.timeframe;
          if (!candles || candles.length < 5) return;

          const active = state.activePineScripts.filter((p) => p.visible);
          if (active.length === 0) {
            set({ pinePlots: [], pineDrawings: null });
            return;
          }

          // Clean up cache for any removed scripts
          const activeIds = new Set(active.map((p) => p.id));
          for (const key of Object.keys(pineScriptCache)) {
            if (!activeIds.has(key)) {
              delete pineScriptCache[key];
            }
          }

          const syncOutputsToStore = () => {
            const allPlots: PinePlotOutput[] = [];
            const mergedDrawings: PineDrawingOutput = {
              boxes: [],
              lines: [],
              labels: [],
              tables: [],
              barOffset: 0,
            };

            for (const script of active) {
              const cached = pineScriptCache[script.id];
              if (!cached) continue;
              if (cached.plots && cached.plots.length > 0) {
                allPlots.push(...cached.plots);
              }
              if (cached.drawings) {
                if (cached.drawings.boxes) mergedDrawings.boxes.push(...cached.drawings.boxes);
                if (cached.drawings.lines) mergedDrawings.lines.push(...cached.drawings.lines);
                if (cached.drawings.labels) mergedDrawings.labels.push(...cached.drawings.labels);
                if (cached.drawings.tables) mergedDrawings.tables.push(...cached.drawings.tables);
                if (cached.drawings.barOffset !== undefined) mergedDrawings.barOffset = cached.drawings.barOffset;
              }
            }

            set({
              pinePlots: allPlots,
              pineDrawings:
                mergedDrawings.boxes.length > 0 ||
                mergedDrawings.lines.length > 0 ||
                mergedDrawings.labels.length > 0 ||
                mergedDrawings.tables.length > 0
                  ? mergedDrawings
                  : null,
            });
          };

          // Synchronize immediately from existing cache so already-calculated indicators show with 0ms delay
          syncOutputsToStore();

          // Sort so lightweight scripts (e.g. Dual EMA, Bollinger Bands) execute first (< 15ms)
          const sorted = [...active].sort((a, b) => a.code.length - b.code.length);

          const lastCandleTime = candles[candles.length - 1]?.time || 0;

          for (const script of sorted) {
            let codeHash = 0;
            for (let chIdx = 0; chIdx < script.code.length; chIdx++) {
              codeHash = (codeHash * 31 + script.code.charCodeAt(chIdx)) | 0;
            }
            const cacheKey = `${script.id}_${symbol}_${timeframe}_${lastCandleTime}_${codeHash}`;
            if (pineScriptCache[script.id]?.cacheKey === cacheKey) {
              continue;
            }

            // Slicing: heavy scripts (>20k chars like CRT Model Pro) use 100 bars; light scripts use 200 bars
            const sliceCount = script.code.length > 20000 ? 100 : 200;
            const calcCandles = candles.length > sliceCount ? candles.slice(-sliceCount) : candles;

            try {
              const res = await executePineScript(script.code, calcCandles, symbol, timeframe, candles.length);
              if (res && res.ok) {
                pineScriptCache[script.id] = {
                  cacheKey,
                  plots: res.plots || [],
                  drawings: res.drawings,
                };
                syncOutputsToStore();
              }
            } catch (err) {
              console.warn(`Failed to execute pine script ${script.name}:`, err);
            }
          }
        },
        setSymbol: (symbol) => {
          const safe = sanitizeSymbol(symbol);
          set((s) => ({ symbol: safe, candles: [], error: null, currentPrice: s.prices[safe] ?? 0 }));
          try {
            const layoutState = useLayoutStore.getState();
            layoutState.setPaneSymbol(layoutState.activePaneId || 'pane-1', safe);
          } catch {}
        },
        setTimeframe: (timeframe) => {
          const safe = sanitizeTimeframe(timeframe);
          set({ timeframe: safe, error: null });
          try {
            const layoutState = useLayoutStore.getState();
            layoutState.setPaneTimeframe(layoutState.activePaneId || 'pane-1', safe);
          } catch {}
        },
        setCandles: (candles) => {
          set({ candles });
          if (get().activePineScripts.some((p) => p.visible)) {
            get().recalculatePineScripts();
          }
        },
        setStatus: (status) => set({ status }),
        setError: (error) => set({ error }),

        updateWatchlist: (patch) => {
          set((s) => {
            let book: Book = { positions: s.positions, orders: s.orders, balance: s.balance, trades: s.trades };
            const prices = { ...s.prices };
            for (const [sym, t] of Object.entries(patch)) {
              if (sym === s.symbol) continue; // the active symbol is driven by its own, faster feed
              prices[sym] = t.price;
              const r = runEngine(book, sym, t.price); // keeps pending orders alive on other symbols
              if (r) book = { ...book, ...r };
            }
            return { watchlist: { ...s.watchlist, ...patch }, prices, ...book };
          });
          const active = get().symbol;
          for (const [sym, t] of Object.entries(patch)) if (sym !== active) fireAlerts(sym, t.price);
        },

        updateQuote: (symbol, q) =>
          set((s) => {
            const inst = getInstrument(symbol);
            let instruments = s.instruments;
            if (inst && q.currency && inst.currency !== q.currency) {
              const fixed = { ...inst, currency: q.currency };
              registerInstruments([fixed]);
              instruments = s.instruments.map((i) => (i.id === symbol ? fixed : i));
            }
            return { quotes: { ...s.quotes, [symbol]: q }, instruments };
          }),

        updatePriceTick: (symbol, price) => {
          set((s) => {
            const r = runEngine(s, symbol, price);
            const currentPrices = { ...s.prices, [symbol]: price };
            const positionTickets = (s.positionTickets || []).map((t) => {
              const m = currentPrices[t.symbol] ?? t.entryPrice;
              const dir = t.side === 'LONG' ? 1 : -1;
              const pnl = (m - t.entryPrice) * t.size * dir * toUsd(t.symbol);
              return { ...t, unrealizedPnl: pnl };
            });
            const incomingTickets: PositionTicket[] = (r as any)?.newTickets || [];
            const mergedTickets = incomingTickets.length > 0 ? [...positionTickets, ...incomingTickets] : positionTickets;
            return {
              prices: currentPrices,
              currentPrice: symbol === s.symbol ? price : s.currentPrice,
              positionTickets: mergedTickets,
              ...(r ?? {}),
            };
          });
          fireAlerts(symbol, price);
          try {
            useExecutionEngineStore.getState().evaluateRules(symbol, price);
          } catch {}
        },

        addInstrument: (inst) => {
          if (get().instruments.some((i) => i.id === inst.id)) return;
          registerInstruments([inst]);
          set((s) => ({ instruments: [...s.instruments, inst] }));
        },

        removeInstrument: (id) => {
          const s = get();
          if (s.positions[id] || s.orders.some((o) => o.symbol === id && o.status === 'PENDING'))
            return { ok: false, error: 'Close the position and cancel its orders first.' };
          if (s.symbol === id) return { ok: false, error: "Switch to another symbol first." };
          set({ instruments: s.instruments.filter((i) => i.id !== id) });
          return { ok: true };
        },

        placeOrder: (req) => {
          const s = get();
          const mark = s.prices[req.symbol] ?? 0;
          const ref = req.type === 'LIMIT' ? req.price ?? 0 : mark;
          if (!(req.qty > 0)) return { ok: false, error: 'Enter a quantity above zero.' };
          if (!(ref > 0)) return { ok: false, error: req.type === 'LIMIT' ? 'Enter a limit price.' : 'Waiting for a live price.' };

          // TradeXGuardian Pre-Trade Enforcement
          try {
            const guardianState = useGuardianStore.getState();
            if (guardianState.emergencyLocked) {
              const msg = `[GUARDIAN LOCKED] Emergency risk lock active: ${guardianState.emergencyLockReason || 'Trading halted.'}`;
              notifyAlert('TradeXGuardian Locked', msg);
              return { ok: false, error: msg };
            }
            if (guardianState.enabled) {
              const openCount = (s.positionTickets && s.positionTickets.length > 0) ? s.positionTickets.length : Object.keys(s.positions).length;
              const todayTrades = s.trades.filter((t) => t.time >= new Date().setHours(0, 0, 0, 0)).length;
              const dailyLoss = s.trades
                .filter((t) => t.time >= new Date().setHours(0, 0, 0, 0) && t.pnl < 0)
                .reduce((sum, t) => sum + Math.abs(t.pnl), 0);

              let consecutiveLosses = 0;
              for (let i = s.trades.length - 1; i >= 0; i--) {
                if (s.trades[i].pnl < 0) consecutiveLosses++;
                else break;
              }

              const checkRes = guardianState.checkTrade({
                symbol: req.symbol,
                side: req.side,
                qty: req.qty,
                entryPrice: ref,
                stopLoss: req.stopLoss,
                takeProfit: req.takeProfit,
                leverage: req.leverage,
                accountEquity: totalEquity(s),
                currentBalance: s.balance,
                openPositionsCount: openCount,
                tradesTodayCount: todayTrades,
                dailyRealizedLoss: dailyLoss,
                consecutiveLosses,
                lastTradeTimestamp: s.trades[s.trades.length - 1]?.time,
              });

              if (checkRes.blocked) {
                const reason = checkRes.violations.join('; ') || 'Rule violation.';
                guardianState.logViolation('Risk Rule', 'BLOCK', reason);
                notifyAlert('TradeXGuardian Blocked', reason);
                return { ok: false, error: `[GUARDIAN BLOCKED] ${reason}` };
              }
              if (checkRes.warnings.length > 0) {
                notifyAlert('TradeXGuardian Warning', checkRes.warnings[0]);
              }
            }
          } catch (err) {
            console.warn('Guardian check error:', err);
          }

          const pos = s.positions[req.symbol];
          const reducing = !!pos && (req.side === 'SELL') === (pos.side === 'LONG');
          const need = (req.qty * ref * toUsd(req.symbol)) / req.leverage;
          const free = freeMargin(s);
          if (!reducing && need > free) return { ok: false, error: `Needs $${need.toFixed(2)} margin; $${Math.max(0, free).toFixed(2)} free.` };

          const buy = req.side === 'BUY';
          if (req.stopLoss !== undefined && (buy ? req.stopLoss >= ref : req.stopLoss <= ref))
            return { ok: false, error: `Stop loss must be ${buy ? 'below' : 'above'} the entry price.` };
          if (req.takeProfit !== undefined && (buy ? req.takeProfit <= ref : req.takeProfit >= ref))
            return { ok: false, error: `Take profit must be ${buy ? 'above' : 'below'} the entry price.` };
          if (req.trailStopPct !== undefined && !(req.trailStopPct > 0 && req.trailStopPct < 100))
            return { ok: false, error: 'Trailing stop % must be between 0.01 and 99.99.' };

          const now = Date.now();
          const main: Order = {
            id: uid(), symbol: req.symbol, side: req.side, type: req.type, price: ref, qty: req.qty, leverage: req.leverage,
            status: req.type === 'MARKET' ? 'FILLED' : 'PENDING', timestamp: now,
          };
          const exitSide: OrderSide = buy ? 'SELL' : 'BUY';
          const exits: Order[] = [];
          const exit = (type: 'STOP_LOSS' | 'TAKE_PROFIT', trigger: number): Order =>
            ({ id: uid(), symbol: req.symbol, side: exitSide, type, price: 0, triggerPrice: trigger, qty: req.qty, status: 'PENDING', timestamp: now, reduceOnly: true });
          if (req.stopLoss !== undefined) exits.push(exit('STOP_LOSS', req.stopLoss));
          if (req.takeProfit !== undefined) exits.push(exit('TAKE_PROFIT', req.takeProfit));
          if (req.trailStopPct !== undefined) {
            const tslInitial = buy ? ref * (1 - req.trailStopPct / 100) : ref * (1 + req.trailStopPct / 100);
            exits.push({
              id: uid(), symbol: req.symbol, side: exitSide, type: 'TRAILING_STOP',
              price: 0, triggerPrice: tslInitial, qty: req.qty, status: 'PENDING', timestamp: now,
              reduceOnly: true, trailPct: req.trailStopPct, trailHighWater: ref,
            });
          }

          let { positions, balance, trades } = s;
          let positionTickets = s.positionTickets || [];
          if (req.type === 'MARKET') {
            const r = applyFill(positions, balance, req.symbol, req.side, req.qty, ref, req.leverage);
            positions = r.positions;
            balance = r.balance;
            if (r.trade) trades = trimTrades([...trades, r.trade]);
            const p = positions[req.symbol];
            if (p) positions = { ...positions, [req.symbol]: { ...p, unrealizedPnl: positionPnlUsd(p, mark) } };

            const newTicket: PositionTicket = {
              id: `TKT-${Math.floor(100000 + Math.random() * 900000)}`,
              orderId: main.id,
              symbol: req.symbol,
              side: buy ? 'LONG' : 'SHORT',
              size: req.qty,
              entryPrice: ref,
              entryTime: now,
              leverage: req.leverage,
              unrealizedPnl: 0,
              stopLoss: req.stopLoss,
              takeProfit: req.takeProfit,
            };
            positionTickets = [...positionTickets, newTicket];

            dispatchOrderFillTelegram(req.symbol, req.side, req.qty, ref);
          }
          set({ positions, balance, trades, positionTickets, orders: trimOrders([...s.orders, main, ...exits]) });
          const closed = s.quotes[req.symbol]?.open === false && req.type === 'MARKET';
          return { ok: true, warning: closed ? 'Market is closed; filled at the last price.' : undefined };
        },

        cancelOrder: (id) =>
          set((s) => ({ orders: s.orders.map((o) => (o.id === id && o.status === 'PENDING' ? { ...o, status: 'CANCELLED' as const } : o)) })),

        closePosition: (symbol) => {
          const s = get();
          const pos = s.positions[symbol];
          const mark = s.prices[symbol];
          if (!pos || !mark) return;
          const side: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
          const r = applyFill(s.positions, s.balance, symbol, side, pos.size, mark, pos.leverage);
          const closeOrder: Order = { id: uid(), symbol, side, type: 'MARKET', price: mark, qty: pos.size, status: 'FILLED', timestamp: Date.now() };
          const orders = s.orders.map((o) => (o.status === 'PENDING' && o.symbol === symbol && o.reduceOnly ? { ...o, status: 'CANCELLED' as const } : o));
          const remainingTickets = (s.positionTickets || []).filter((t) => t.symbol !== symbol);
          set({
            positions: r.positions, balance: r.balance,
            positionTickets: remainingTickets,
            trades: r.trade ? trimTrades([...s.trades, r.trade]) : s.trades,
            orders: trimOrders([...orders, closeOrder]),
          });
          notifyAlert('Position Closed', `${labelOf(symbol)} position closed at ${fmtPrice(mark, symbol)}.`);
        },

        closePositionTicket: (ticketId: string) => {
          const s = get();
          const ticket = (s.positionTickets || []).find((t) => t.id === ticketId);
          if (!ticket) return;
          const mark = s.prices[ticket.symbol] ?? ticket.entryPrice;
          const dir = ticket.side === 'LONG' ? 1 : -1;
          const pnl = (mark - ticket.entryPrice) * ticket.size * dir * toUsd(ticket.symbol);
          const newBalance = s.balance + pnl;
          const trade: Trade = {
            id: uid(),
            symbol: ticket.symbol,
            side: ticket.side,
            qty: ticket.size,
            entry: ticket.entryPrice,
            exit: mark,
            pnl,
            time: Date.now(),
            entryTime: ticket.entryTime,
          };

          // Adjust netted positions
          const pos = s.positions[ticket.symbol];
          const nextPositions = { ...s.positions };
          if (pos) {
            const remainingSize = +(pos.size - ticket.size).toFixed(4);
            if (remainingSize <= 0) {
              delete nextPositions[ticket.symbol];
            } else {
              nextPositions[ticket.symbol] = {
                ...pos,
                size: remainingSize,
                realizedPnl: pos.realizedPnl + pnl,
                unrealizedPnl: positionPnlUsd({ ...pos, size: remainingSize }, mark),
              };
            }
          }

          const remainingTickets = (s.positionTickets || []).filter((t) => t.id !== ticketId);
          set({
            balance: newBalance,
            positions: nextPositions,
            positionTickets: remainingTickets,
            trades: trimTrades([...s.trades, trade]),
          });
          notifyAlert('Ticket Closed', `Closed ${ticket.id} (${ticket.symbol} ${ticket.size}) at ${fmtPrice(mark, ticket.symbol)}. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}.`);
        },

        closePartialPosition: (symbol, fraction = 0.5) => {
          const s = get();
          const pos = s.positions[symbol];
          const mark = s.prices[symbol];
          if (!pos || !mark) return;
          const closeQty = +(pos.size * fraction).toFixed(4);
          if (closeQty <= 0) return;
          const side: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
          const r = applyFill(s.positions, s.balance, symbol, side, closeQty, mark, pos.leverage);
          const closeOrder: Order = { id: uid(), symbol, side, type: 'MARKET', price: mark, qty: closeQty, status: 'FILLED', timestamp: Date.now() };
          set({
            positions: r.positions, balance: r.balance,
            trades: r.trade ? trimTrades([...s.trades, r.trade]) : s.trades,
            orders: trimOrders([...s.orders, closeOrder]),
          });
          notifyAlert('Partial Close', `Closed ${(fraction * 100).toFixed(0)}% of ${labelOf(symbol)} at ${fmtPrice(mark, symbol)}.`);
        },

        flipPosition: (symbol) => {
          const s = get();
          const pos = s.positions[symbol];
          const mark = s.prices[symbol];
          if (!pos || !mark) return;
          const flipSide: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
          const totalQty = +(pos.size * 2).toFixed(4);
          const r = applyFill(s.positions, s.balance, symbol, flipSide, totalQty, mark, pos.leverage);
          const flipOrder: Order = { id: uid(), symbol, side: flipSide, type: 'MARKET', price: mark, qty: totalQty, status: 'FILLED', timestamp: Date.now() };
          const orders = s.orders.map((o) => (o.status === 'PENDING' && o.symbol === symbol && o.reduceOnly ? { ...o, status: 'CANCELLED' as const } : o));
          set({
            positions: r.positions, balance: r.balance,
            trades: r.trade ? trimTrades([...s.trades, r.trade]) : s.trades,
            orders: trimOrders([...orders, flipOrder]),
          });
          notifyAlert('Position Reversed', `Flipped ${labelOf(symbol)} to ${pos.side === 'LONG' ? 'SHORT' : 'LONG'}.`);
        },

        snapBreakEven: (symbol) => {
          const s = get();
          const pos = s.positions[symbol];
          if (!pos) return;
          const exitSide: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
          const otherOrders = s.orders.map((o) =>
            o.status === 'PENDING' && o.symbol === symbol && o.type === 'STOP_LOSS'
              ? { ...o, status: 'CANCELLED' as const }
              : o
          );
          const beOrder: Order = {
            id: uid(),
            symbol,
            side: exitSide,
            type: 'STOP_LOSS',
            price: 0,
            triggerPrice: pos.entryPrice,
            qty: pos.size,
            status: 'PENDING',
            timestamp: Date.now(),
            reduceOnly: true,
          };
          set({ orders: trimOrders([...otherOrders, beOrder]) });
          notifyAlert('Break-Even Locked', `SL for ${labelOf(symbol)} set to entry ${pos.entryPrice}.`);
        },

        closeAllPositions: () => {
          const s = get();
          const open = Object.values(s.positions);
          if (open.length === 0) return;
          let positions = s.positions;
          let balance = s.balance;
          let trades = s.trades;
          let orders = s.orders;
          for (const pos of open) {
            const mark = s.prices[pos.symbol] ?? pos.entryPrice;
            const side: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
            const r = applyFill(positions, balance, pos.symbol, side, pos.size, mark, pos.leverage);
            positions = r.positions;
            balance = r.balance;
            if (r.trade) trades = trimTrades([...trades, r.trade]);
            orders = trimOrders([...orders, { id: uid(), symbol: pos.symbol, side, type: 'MARKET', price: mark, qty: pos.size, status: 'FILLED', timestamp: Date.now() }]);
          }
          orders = orders.map((o) => (o.status === 'PENDING' && o.reduceOnly ? { ...o, status: 'CANCELLED' as const } : o));
          set({ positions, balance, trades, orders, positionTickets: [] });
          notifyAlert('Emergency Flatten', `Closed all ${open.length} open positions.`);
        },

        addAlert: (symbol, price, type = 'PRICE') => {
          const now = get().prices[symbol] ?? 0;
          if (!(price > 0)) return;
          requestNotify();
          set((s) => ({
            alerts: [
              ...s.alerts,
              {
                id: uid(),
                symbol,
                price,
                dir: price >= now ? 'above' : 'below',
                triggered: false,
                createdAt: Date.now(),
                type,
              },
            ],
          }));
        },
        addAdvancedAlert: (req) => {
          const now = get().prices[req.symbol] ?? get().currentPrice ?? 0;
          requestNotify();
          const item: Alert = {
            id: uid(),
            symbol: req.symbol,
            price: req.price,
            dir: req.dir || (req.price >= now ? 'above' : 'below'),
            triggered: false,
            createdAt: Date.now(),
            type: req.type || 'PRICE',
            condition: req.condition,
            note: req.note,
            active: true,
          };
          set((s) => ({ alerts: [...s.alerts, item] }));
        },

        updateAlertPrice: (id, newPrice) => {
          if (!(newPrice > 0)) return;
          const now = get().currentPrice;
          set((s) => ({
            alerts: s.alerts.map((a) =>
              a.id === id
                ? {
                    ...a,
                    price: newPrice,
                    dir: newPrice >= now ? 'above' : 'below',
                    triggered: false,
                    active: true,
                  }
                : a
            ),
          }));
        },

        toggleAlert: (id) => {
          set((s) => ({
            alerts: s.alerts.map((a) => (a.id === id ? { ...a, active: a.active === false ? true : false } : a)),
          }));
        },

        updateOrderPrice: (id, newPrice) => {
          if (!(newPrice > 0)) return;
          set((s) => ({
            orders: s.orders.map((o) => {
              if (o.id !== id || o.status !== 'PENDING') return o;
              if (o.type === 'LIMIT') return { ...o, price: newPrice };
              return { ...o, triggerPrice: newPrice };
            }),
          }));
        },

        updatePositionBrackets: (symbol, sl, tp) => {
          const s = get();
          const pos = s.positions[symbol];
          if (!pos) return;
          const exitSide: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
          let orders = [...s.orders];

          if (sl !== undefined) {
            orders = orders.filter((o) => !(o.status === 'PENDING' && o.symbol === symbol && o.type === 'STOP_LOSS'));
            if (sl > 0) {
              orders.push({
                id: uid(),
                symbol,
                side: exitSide,
                type: 'STOP_LOSS',
                price: 0,
                triggerPrice: sl,
                qty: pos.size,
                status: 'PENDING',
                timestamp: Date.now(),
                reduceOnly: true,
              });
            }
          }

          if (tp !== undefined) {
            orders = orders.filter((o) => !(o.status === 'PENDING' && o.symbol === symbol && o.type === 'TAKE_PROFIT'));
            if (tp > 0) {
              orders.push({
                id: uid(),
                symbol,
                side: exitSide,
                type: 'TAKE_PROFIT',
                price: 0,
                triggerPrice: tp,
                qty: pos.size,
                status: 'PENDING',
                timestamp: Date.now(),
                reduceOnly: true,
              });
            }
          }

          set({ orders: trimOrders(orders) });
        },

        bulkModifyBrackets: ({
          symbols,
          slOffsetPct,
          tpOffsetPct,
          slPrice,
          tpPrice,
          riskRewardRatio,
          isBreakEven,
        }) => {
          const s = get();
          let orders = [...s.orders];
          let updatedCount = 0;

          for (const sym of symbols) {
            const pos = s.positions[sym];
            if (!pos) continue;

            const isLong = pos.side === 'LONG';
            const exitSide: OrderSide = isLong ? 'SELL' : 'BUY';

            // Calculate SL
            let finalSl: number | undefined = undefined;
            if (isBreakEven) {
              finalSl = pos.entryPrice;
            } else if (slPrice !== undefined && slPrice > 0) {
              finalSl = slPrice;
            } else if (slOffsetPct !== undefined && slOffsetPct > 0) {
              finalSl = +(isLong
                ? pos.entryPrice * (1 - slOffsetPct / 100)
                : pos.entryPrice * (1 + slOffsetPct / 100)
              ).toFixed(sym.includes('BTC') ? 2 : 4);
            }

            // Calculate TP
            let finalTp: number | undefined = undefined;
            if (riskRewardRatio !== undefined && riskRewardRatio > 0 && finalSl !== undefined) {
              const riskDist = Math.abs(pos.entryPrice - finalSl);
              finalTp = +(isLong
                ? pos.entryPrice + riskDist * riskRewardRatio
                : pos.entryPrice - riskDist * riskRewardRatio
              ).toFixed(sym.includes('BTC') ? 2 : 4);
            } else if (tpPrice !== undefined && tpPrice > 0) {
              finalTp = tpPrice;
            } else if (tpOffsetPct !== undefined && tpOffsetPct > 0) {
              finalTp = +(isLong
                ? pos.entryPrice * (1 + tpOffsetPct / 100)
                : pos.entryPrice * (1 - tpOffsetPct / 100)
              ).toFixed(sym.includes('BTC') ? 2 : 4);
            }

            if (finalSl !== undefined) {
              orders = orders.filter((o) => !(o.status === 'PENDING' && o.symbol === sym && o.type === 'STOP_LOSS'));
              orders.push({
                id: uid(),
                symbol: sym,
                side: exitSide,
                type: 'STOP_LOSS',
                price: 0,
                triggerPrice: finalSl,
                qty: pos.size,
                status: 'PENDING',
                timestamp: Date.now(),
                reduceOnly: true,
              });
            }

            if (finalTp !== undefined) {
              orders = orders.filter((o) => !(o.status === 'PENDING' && o.symbol === sym && o.type === 'TAKE_PROFIT'));
              orders.push({
                id: uid(),
                symbol: sym,
                side: exitSide,
                type: 'TAKE_PROFIT',
                price: 0,
                triggerPrice: finalTp,
                qty: pos.size,
                status: 'PENDING',
                timestamp: Date.now(),
                reduceOnly: true,
              });
            }

            updatedCount++;
          }

          set({ orders: trimOrders(orders) });
          notifyAlert('Bulk Brackets Updated', `Modified SL/TP for ${updatedCount} open position${updatedCount > 1 ? 's' : ''}.`);
        },

        bulkClosePositions: (symbols, fraction = 1) => {
          const s = get();
          let positions = s.positions;
          let balance = s.balance;
          let trades = s.trades;
          let orders = s.orders;
          let closedCount = 0;

          for (const sym of symbols) {
            const pos = positions[sym];
            if (!pos) continue;

            const mark = s.prices[sym] ?? pos.entryPrice;
            const side: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
            const closeQty = +(pos.size * Math.min(1, Math.max(0.01, fraction))).toFixed(4);

            const r = applyFill(positions, balance, sym, side, closeQty, mark, pos.leverage);
            positions = r.positions;
            balance = r.balance;
            if (r.trade) trades = trimTrades([...trades, r.trade]);

            orders = trimOrders([
              ...orders,
              {
                id: uid(),
                symbol: sym,
                side,
                type: 'MARKET',
                price: mark,
                qty: closeQty,
                status: 'FILLED',
                timestamp: Date.now(),
              },
            ]);

            // If fully closed, cancel its reduceOnly bracket orders
            if (!positions[sym]) {
              orders = orders.map((o) =>
                o.status === 'PENDING' && o.symbol === sym && o.reduceOnly
                  ? { ...o, status: 'CANCELLED' as const }
                  : o
              );
            }
            closedCount++;
          }

          set({ positions, balance, trades, orders });
          notifyAlert('Bulk Close Executed', `Closed ${(fraction * 100).toFixed(0)}% of ${closedCount} position${closedCount > 1 ? 's' : ''}.`);
        },

        closeWinningPositions: () => {
          const s = get();
          const winners = Object.values(s.positions).filter((p) => {
            const mark = s.prices[p.symbol] ?? p.entryPrice;
            return positionPnlUsd(p, mark) > 0;
          });
          if (winners.length === 0) {
            notifyAlert('No Winning Positions', 'There are no open positions currently in profit.');
            return;
          }
          s.bulkClosePositions(winners.map((p) => p.symbol), 1);
        },

        closeLosingPositions: () => {
          const s = get();
          const losers = Object.values(s.positions).filter((p) => {
            const mark = s.prices[p.symbol] ?? p.entryPrice;
            return positionPnlUsd(p, mark) < 0;
          });
          if (losers.length === 0) {
            notifyAlert('No Losing Positions', 'There are no open positions currently in loss.');
            return;
          }
          s.bulkClosePositions(losers.map((p) => p.symbol), 1);
        },

        bulkCancelOrders: (orderIds) => {
          set((s) => ({
            orders: s.orders.map((o) =>
              orderIds.includes(o.id) && o.status === 'PENDING'
                ? { ...o, status: 'CANCELLED' as const }
                : o
            ),
          }));
          notifyAlert('Orders Cancelled', `Cancelled ${orderIds.length} pending order${orderIds.length > 1 ? 's' : ''}.`);
        },

        bulkShiftOrderPrices: (orderIds, offsetPct) => {
          set((s) => ({
            orders: s.orders.map((o) => {
              if (!orderIds.includes(o.id) || o.status !== 'PENDING') return o;
              const mult = 1 + offsetPct / 100;
              if (o.type === 'LIMIT') {
                return { ...o, price: +(o.price * mult).toFixed(o.symbol.includes('BTC') ? 2 : 4) };
              }
              const trig = o.triggerPrice ? +(o.triggerPrice * mult).toFixed(o.symbol.includes('BTC') ? 2 : 4) : o.price;
              return { ...o, triggerPrice: trig };
            }),
          }));
          notifyAlert('Orders Shifted', `Shifted prices of ${orderIds.length} orders by ${offsetPct > 0 ? '+' : ''}${offsetPct}%.`);
        },

        removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

        setTrailingStop: (symbol, trailPct) => {
          const s = get();
          const pos = s.positions[symbol];
          const mark = s.prices[symbol];
          if (!pos || !mark) return;
          if (!(trailPct > 0 && trailPct < 100)) return;
          const exitSide: OrderSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
          const isLong = pos.side === 'LONG';
          const triggerPrice = isLong ? mark * (1 - trailPct / 100) : mark * (1 + trailPct / 100);
          // Cancel existing trailing stops for this symbol
          const others = s.orders.map((o) =>
            o.status === 'PENDING' && o.symbol === symbol && o.type === 'TRAILING_STOP'
              ? { ...o, status: 'CANCELLED' as const }
              : o
          );
          const tslOrder: Order = {
            id: uid(), symbol, side: exitSide, type: 'TRAILING_STOP',
            price: 0, triggerPrice, qty: pos.size, status: 'PENDING',
            timestamp: Date.now(), reduceOnly: true,
            trailPct, trailHighWater: mark,
          };
          set({ orders: trimOrders([...others, tslOrder]) });
          notifyAlert('Trailing Stop Set', `${labelOf(symbol)} TSL @ ${trailPct}% — trigger: ${fmtPrice(triggerPrice, symbol)}`);
        },

        switchAccount: (accountId: string) => {
          const s = get();
          if (s.activeAccountId === accountId) return;
          const target = s.accounts.find((a) => a.id === accountId);
          if (!target) return;

          // Snapshot current account
          const updatedAccounts = s.accounts.map((acc) => {
            if (acc.id === s.activeAccountId) {
              return {
                ...acc,
                balance: s.balance,
                positions: s.positions,
                orders: s.orders,
                trades: s.trades,
              };
            }
            return acc;
          });

          set({
            accounts: updatedAccounts,
            activeAccountId: accountId,
            balance: target.balance,
            positions: target.positions || {},
            orders: target.orders || [],
            trades: target.trades || [],
          });
          notifyAlert('Account Switched', `Active account: ${target.name} (${target.type})`);
        },

        createAccount: (acc) => {
          const newAcc: TradingAccount = {
            ...acc,
            id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            positions: {},
            orders: [],
            trades: [],
          };
          set((s) => ({
            accounts: [...s.accounts, newAcc],
          }));
          notifyAlert('Account Created', `Created ${newAcc.name}`);
        },

        deleteAccount: (accountId) => {
          const s = get();
          if (s.accounts.length <= 1) return;
          const remaining = s.accounts.filter((a) => a.id !== accountId);
          if (s.activeAccountId === accountId) {
            const nextAcc = remaining[0];
            set({
              accounts: remaining,
              activeAccountId: nextAcc.id,
              balance: nextAcc.balance,
              positions: nextAcc.positions || {},
              orders: nextAcc.orders || [],
              trades: nextAcc.trades || [],
            });
          } else {
            set({ accounts: remaining });
          }
        },

        resetAccountBalance: (accountId, newBalance) => {
          const s = get();
          const target = s.accounts.find((a) => a.id === accountId);
          const bal = newBalance ?? (target ? target.balance : START_BALANCE);
          const updatedAccounts = s.accounts.map((a) => {
            if (a.id === accountId) {
              return { ...a, balance: bal, positions: {}, orders: [], trades: [] };
            }
            return a;
          });
          if (s.activeAccountId === accountId) {
            set({
              accounts: updatedAccounts,
              balance: bal,
              positions: {},
              orders: [],
              trades: [],
            });
          } else {
            set({ accounts: updatedAccounts });
          }
          notifyAlert('Account Reset', `Account reset with balance ${bal}`);
        },

        resetAccount: () => {
          const s = get();
          s.resetAccountBalance(s.activeAccountId);
        },
      };
    },
    {
      name: 'terminal-v3',
      version: 1,
      // Account, journal, alerts, watchlist and view survive a reload; market data is always refetched.
      partialize: (s) => ({
        symbol: s.symbol, timeframe: s.timeframe, instruments: s.instruments, positions: s.positions,
        positionTickets: s.positionTickets, positionViewMode: s.positionViewMode,
        orders: s.orders, trades: s.trades, alerts: s.alerts, balance: s.balance,
        accounts: s.accounts, activeAccountId: s.activeAccountId,
        activePineScripts: s.activePineScripts,
        showPeriodSeparators: s.showPeriodSeparators,
        periodSeparatorInterval: s.periodSeparatorInterval,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          registerInstruments(state.instruments);
          if (!state.activePineScripts || state.activePineScripts.length === 0) {
            state.activePineScripts = DEFAULT_PINE_SCRIPTS;
          }
          if (!state.positionTickets) {
            state.positionTickets = [];
          }
          if (!state.positionViewMode) {
            state.positionViewMode = 'TICKETS';
          }
          if (state.positionTickets.length === 0 && Object.keys(state.positions || {}).length > 0) {
            state.positionTickets = Object.values(state.positions).map((pos) => ({
              id: `TKT-${Math.floor(100000 + Math.random() * 900000)}`,
              orderId: `ORD-${Date.now()}`,
              symbol: pos.symbol,
              side: pos.side,
              size: pos.size,
              entryPrice: pos.entryPrice,
              entryTime: pos.entryTime || Date.now(),
              leverage: pos.leverage || 1,
              unrealizedPnl: pos.unrealizedPnl || 0,
            }));
          }
        }
      },
    },
  ),
);
