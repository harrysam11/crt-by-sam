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

export const START_BALANCE = 10000; // USD
export const LEVERAGES = [1, 2, 5, 10, 20, 50, 100];
const MAX_ORDERS = 200;
const MAX_TRADES = 500;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export interface PlaceOrderRequest {
  symbol: string; side: OrderSide; type: 'MARKET' | 'LIMIT'; qty: number; leverage: number;
  price?: number; stopLoss?: number; takeProfit?: number;
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
  pinePlots: Array<{ title: string; color: string; data: Array<{ time: number; value: number }> }>;

  setPinePlots: (plots: Array<{ title: string; color: string; data: Array<{ time: number; value: number }> }>) => void;
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
  resetAccount: () => void;
}

type Book = Pick<TerminalState, 'positions' | 'orders' | 'balance' | 'trades'>;

// ---- Paper engine (pure functions). PnL is converted from the quote currency to USD. ---------------

export const positionPnlUsd = (p: Position, mark: number) =>
  (mark - p.entryPrice) * p.size * (p.side === 'LONG' ? 1 : -1) * toUsd(p.symbol);
const marginUsd = (p: Position) => (p.size * p.entryPrice * toUsd(p.symbol)) / p.leverage;
export const freeMargin = (s: Pick<Book, 'positions' | 'balance'>) =>
  Object.values(s.positions).reduce((f, p) => f + p.unrealizedPnl - marginUsd(p), s.balance);

/** Net a fill into the book: scale-in averages entry, opposite fills realize PnL, overshoot flips. */
function applyFill(positions: Record<string, Position>, balance: number, symbol: string, side: OrderSide, qty: number, price: number, leverage: number) {
  const next = { ...positions };
  const dir: Position['side'] = side === 'BUY' ? 'LONG' : 'SHORT';
  const pos = next[symbol];
  let trade: Trade | undefined;
  if (!pos) {
    next[symbol] = { symbol, side: dir, entryPrice: price, size: qty, unrealizedPnl: 0, realizedPnl: 0, leverage };
  } else if (pos.side === dir) {
    const size = pos.size + qty;
    next[symbol] = { ...pos, size, entryPrice: (pos.entryPrice * pos.size + price * qty) / size };
  } else {
    const closed = Math.min(pos.size, qty);
    const pnl = (price - pos.entryPrice) * closed * (pos.side === 'LONG' ? 1 : -1) * toUsd(symbol);
    balance += pnl;
    trade = { id: uid(), symbol, side: pos.side, qty: closed, entry: pos.entryPrice, exit: price, pnl, time: Date.now() };
    const rest = qty - closed;
    if (closed < pos.size) next[symbol] = { ...pos, size: pos.size - closed, realizedPnl: pos.realizedPnl + pnl };
    else if (rest > 0) next[symbol] = { symbol, side: dir, entryPrice: price, size: rest, unrealizedPnl: 0, realizedPnl: 0, leverage };
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

  if (hasPending) {
    orders = orders.map((o) => {
      if (o.status !== 'PENDING' || o.symbol !== symbol) return o;
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
  return { positions, orders: trimOrders(orders), balance, trades: trimTrades(trades) };
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
        orders: [],
        trades: [],
        alerts: [],
        balance: START_BALANCE,
        status: 'closed',
        error: null,
        pinePlots: [],

        setPinePlots: (pinePlots) => set({ pinePlots }),
        setSymbol: (symbol) => {
          const safe = sanitizeSymbol(symbol);
          set((s) => ({ symbol: safe, candles: [], error: null, currentPrice: s.prices[safe] ?? 0 }));
        },
        setTimeframe: (timeframe) => {
          const safe = sanitizeTimeframe(timeframe);
          set({ timeframe: safe, candles: [], error: null });
        },
        setCandles: (candles) => set({ candles }),
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
            return { prices: { ...s.prices, [symbol]: price }, currentPrice: symbol === s.symbol ? price : s.currentPrice, ...(r ?? {}) };
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

          let { positions, balance, trades } = s;
          if (req.type === 'MARKET') {
            const r = applyFill(positions, balance, req.symbol, req.side, req.qty, ref, req.leverage);
            positions = r.positions;
            balance = r.balance;
            if (r.trade) trades = trimTrades([...trades, r.trade]);
            const p = positions[req.symbol];
            if (p) positions = { ...positions, [req.symbol]: { ...p, unrealizedPnl: positionPnlUsd(p, mark) } };
            dispatchOrderFillTelegram(req.symbol, req.side, req.qty, ref);
          }
          set({ positions, balance, trades, orders: trimOrders([...s.orders, main, ...exits]) });
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
          set({
            positions: r.positions, balance: r.balance,
            trades: r.trade ? trimTrades([...s.trades, r.trade]) : s.trades,
            orders: trimOrders([...orders, closeOrder]),
          });
          notifyAlert('Position Closed', `${labelOf(symbol)} position closed at ${fmtPrice(mark, symbol)}.`);
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
          set({ positions, balance, trades, orders });
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

        resetAccount: () => set({ positions: {}, orders: [], trades: [], balance: START_BALANCE }),
      };
    },
    {
      name: 'terminal-v3',
      version: 1,
      // Account, journal, alerts, watchlist and view survive a reload; market data is always refetched.
      partialize: (s) => ({
        symbol: s.symbol, timeframe: s.timeframe, instruments: s.instruments, positions: s.positions,
        orders: s.orders, trades: s.trades, alerts: s.alerts, balance: s.balance,
      }),
      onRehydrateStorage: () => (state) => { if (state) registerInstruments(state.instruments); },
    },
  ),
);
