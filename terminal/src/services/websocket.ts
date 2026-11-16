import type { ConnectionStatus, DepthSnapshot, Tick, TickerStat } from '../types/terminal';

type Listener<T> = (v: T) => void;

const URL = 'wss://stream.binance.com:9443/stream';
const BASE_MS = 1000;
const MAX_MS = 30000;
const SILENCE_MS = 5000; // no frame for this long => treat the socket as dead
const MAX_BUFFER = 20000;

/**
 * Singleton Binance combined-stream client.
 * - Subscriptions are tracked in a Set and replayed after every reconnect, so symbol/timeframe
 *   switches never close the socket.
 * - Raw frames never touch React. Everything is buffered and flushed once per animation frame.
 */
class WebSocketManager {
  private ws: WebSocket | null = null;
  private streams = new Set<string>();
  private status: ConnectionStatus = 'closed';
  private attempts = 0;
  private reconnectTimer: number | null = null;
  private watchdog: number | null = null;
  private raf = 0;
  private lastMsg = 0;
  private wantOpen = false;
  private msgId = 1;

  private tickBuf: Tick[] = [];
  private depth: DepthSnapshot | null = null;
  private tickers = new Map<string, TickerStat>();

  private batchL = new Set<Listener<Tick[]>>();
  private depthL = new Set<Listener<DepthSnapshot>>();
  private tickerL = new Set<Listener<Record<string, TickerStat>>>();
  private statusL = new Set<Listener<ConnectionStatus>>();

  connect(): void {
    this.wantOpen = true;
    if (this.ws) return;
    this.open();
    if (!this.raf) this.raf = requestAnimationFrame(this.flush);
    if (!this.watchdog) this.watchdog = window.setInterval(this.checkAlive, 1000);
  }

  disconnect(): void {
    this.wantOpen = false;
    this.clearReconnect();
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.killSocket();
    this.tickBuf = [];
    this.setStatus('closed');
  }

  /** Force immediate reconnection cycle (useful for recovering stalled sockets) */
  forceReconnect(): void {
    this.killSocket();
    this.clearReconnect();
    this.setStatus('reconnecting');
    this.attempts = 0;
    this.open();
  }

  subscribe(streams: string[]): void {
    const fresh = streams.filter((s) => !this.streams.has(s));
    fresh.forEach((s) => this.streams.add(s));
    if (fresh.length) this.send('SUBSCRIBE', fresh);
  }

  unsubscribe(streams: string[]): void {
    const had = streams.filter((s) => this.streams.delete(s));
    if (had.length) this.send('UNSUBSCRIBE', had);
  }

  onBatch(cb: Listener<Tick[]>) { this.batchL.add(cb); return () => { this.batchL.delete(cb); }; }
  onDepth(cb: Listener<DepthSnapshot>) { this.depthL.add(cb); return () => { this.depthL.delete(cb); }; }
  onTickers(cb: Listener<Record<string, TickerStat>>) { this.tickerL.add(cb); return () => { this.tickerL.delete(cb); }; }
  onStatus(cb: Listener<ConnectionStatus>) { this.statusL.add(cb); return () => { this.statusL.delete(cb); }; }

  // ---- internals ----------------------------------------------------------

  private open() {
    this.setStatus(this.attempts ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(URL);
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.lastMsg = performance.now();
      this.setStatus('open');
      if (this.streams.size) this.send('SUBSCRIBE', [...this.streams]); // replay subscriptions
    };
    ws.onmessage = (ev) => { this.lastMsg = performance.now(); this.parse(ev.data as string); };
    ws.onclose = () => { this.ws = null; this.scheduleReconnect(); };
    ws.onerror = () => ws.close();
  }

  private send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return; // replayed on open
    for (let i = 0; i < params.length; i += 50) {
      this.ws.send(JSON.stringify({ method, params: params.slice(i, i + 50), id: this.msgId++ }));
    }
  }

  private parse(raw: string) {
    let msg: { stream?: string; data?: Record<string, unknown> };
    try { msg = JSON.parse(raw); } catch { return; }
    const { stream, data } = msg;
    if (!stream || !data) return; // subscribe acks
    if (stream.endsWith('@trade')) {
      const p = Number(data.p);
      const q = Number(data.q);
      const t = Number(data.T);
      if (typeof data.s === 'string' && !isNaN(p) && !isNaN(q)) {
        this.tickBuf.push({
          symbol: data.s,
          price: p,
          qty: q,
          side: data.m ? 'sell' : 'buy', // m = buyer is maker => aggressor sold
          timestamp: !isNaN(t) ? t : Date.now(),
        });
        if (this.tickBuf.length > MAX_BUFFER) this.tickBuf.splice(0, this.tickBuf.length - MAX_BUFFER);
      }
    } else if (stream.includes('@depth')) {
      const lv = (rows: unknown) =>
        Array.isArray(rows)
          ? (rows as (string | number)[][])
              .filter((r) => Array.isArray(r) && r.length >= 2)
              .map(([p, q]) => ({ price: Number(p) || 0, qty: Number(q) || 0 }))
          : [];
      this.depth = { symbol: stream.split('@')[0].toUpperCase(), bids: lv(data.bids), asks: lv(data.asks) };
    } else if (stream.endsWith('@miniTicker')) {
      const c = Number(data.c), o = Number(data.o);
      if (typeof data.s === 'string' && !isNaN(c)) {
        this.tickers.set(data.s, { price: c, change: o ? ((c - o) / o) * 100 : 0 });
      }
    }
  }

  /** One flush per frame: at most 60 listener calls/sec however many frames arrived. */
  private flush = () => {
    if (this.tickBuf.length) {
      const batch = this.tickBuf;
      this.tickBuf = [];
      this.batchL.forEach((l) => l(batch));
    }
    if (this.depth) { const d = this.depth; this.depth = null; this.depthL.forEach((l) => l(d)); }
    if (this.tickers.size) {
      const patch = Object.fromEntries(this.tickers);
      this.tickers.clear();
      this.tickerL.forEach((l) => l(patch));
    }
    this.raf = requestAnimationFrame(this.flush);
  };

  private checkAlive = () => {
    if (this.ws?.readyState === WebSocket.OPEN && performance.now() - this.lastMsg > SILENCE_MS) {
      this.killSocket(); // silent drop: onclose may never fire, so go straight to reconnect
      this.scheduleReconnect();
    }
  };

  private killSocket() {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch { /* already closed */ }
  }

  private scheduleReconnect() {
    if (!this.wantOpen || this.reconnectTimer) return;
    this.setStatus('reconnecting');
    const delay = Math.min(MAX_MS, BASE_MS * 2 ** this.attempts) * (0.5 + Math.random() * 0.5); // jitter
    this.attempts++;
    this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; if (this.wantOpen) this.open(); }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private setStatus(s: ConnectionStatus) {
    if (s === this.status) return;
    this.status = s;
    this.statusL.forEach((l) => l(s));
  }
}

export const wsManager = new WebSocketManager();
