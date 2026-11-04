import { getInstrument } from '../services/instruments';

const cache = new Map<number, Intl.NumberFormat>();
const nf = (d: number) => {
  let f = cache.get(d);
  if (!f) { f = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); cache.set(d, f); }
  return f;
};

export const priceDecimals = (p: number) => (p >= 10 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 5 : 8);
/** Instrument-specific precision (forex pips, JPY pairs) with a magnitude heuristic as fallback. */
export const decimalsFor = (symbol: string | undefined, p: number) => (symbol ? getInstrument(symbol)?.decimals : undefined) ?? priceDecimals(Math.abs(p));
export const fmtPrice = (p: number, symbol?: string) => (p ? nf(decimalsFor(symbol, p)).format(p) : '—');
export const fmtUsd = (n: number) => `${n < 0 ? '-' : ''}$${nf(2).format(Math.abs(n))}`;
export const fmtPnl = (n: number) => `${n > 0 ? '+' : ''}${fmtUsd(n)}`;
export const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
export const fmtQty = (n: number) => (n >= 100 ? nf(2).format(n) : String(Number(n.toFixed(6))));
export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB');
export const fmtDateTime = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const labelOf = (symbol: string) => getInstrument(symbol)?.label ?? symbol;
export const pnlClass = (n: number) => (n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-muted');
