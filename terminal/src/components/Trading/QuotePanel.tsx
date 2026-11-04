import { useTerminalStore } from '../../store/useTerminalStore';
import { getInstrument } from '../../services/instruments';
import { fmtPct, fmtPrice, pnlClass } from '../../utils/formatters';

/** Shown instead of the order book for markets without a public depth feed. */
export default function QuotePanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const q = useTerminalStore((s) => s.quotes[s.symbol]);
  const price = useTerminalStore((s) => s.currentPrice);
  const inst = getInstrument(symbol);
  if (!q) return <div className="flex-1 bg-panel p-3 text-muted">Loading quote…</div>;

  const last = price || q.price;
  const change = q.prevClose ? ((last - q.prevClose) / q.prevClose) * 100 : 0;
  const span = q.dayHigh - q.dayLow;
  const pos = span > 0 ? Math.min(100, Math.max(0, ((last - q.dayLow) / span) * 100)) : 50;
  const row = (k: string, v: string, cls = 'text-white') => (
    <div className="flex justify-between py-1"><span className="text-muted">{k}</span><span className={`num ${cls}`}>{v}</span></div>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-panel p-3">
      <p className="text-white">{q.name ?? inst?.name}</p>
      <p className="num mt-1 text-lg text-white">{fmtPrice(last, symbol)} <span className="text-xs text-muted">{q.currency}</span></p>
      <p className={`num ${pnlClass(change)}`}>{fmtPct(change)} today</p>
      <div className="mt-3 border-t border-grid pt-2">
        {row('Previous close', fmtPrice(q.prevClose, symbol))}
        {row('Day low', fmtPrice(q.dayLow, symbol))}
        {row('Day high', fmtPrice(q.dayHigh, symbol))}
        <div className="my-2 h-1 rounded bg-grid"><div className="relative h-1"><span className="absolute -top-1 h-3 w-1 rounded bg-accent" style={{ left: `${pos}%` }} /></div></div>
        {row('Session', q.open === null ? 'Unknown' : q.open ? 'Open' : 'Closed', q.open ? 'text-up' : 'text-yellow-400')}
        {q.currency !== 'USD' && row('PnL currency', `${q.currency} → USD`)}
      </div>
      <p className="mt-3 text-muted">Prices come from Yahoo Finance, polled about every 2 seconds. Some exchanges are delayed, and there is no order book for this market.</p>
    </div>
  );
}
