import { useEffect, useState } from 'react';
import { wsManager } from '../../services/websocket';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPrice, fmtQty } from '../../utils/formatters';
import type { DepthLevel, DepthSnapshot } from '../../types/terminal';

/** 10-level book from Binance's partial-depth stream; the manager already limits updates to one per frame. */
export default function OrderBook() {
  const symbol = useTerminalStore((s) => s.symbol);
  const price = useTerminalStore((s) => s.currentPrice);
  const [book, setBook] = useState<DepthSnapshot | null>(null);

  useEffect(() => {
    setBook(null);
    return wsManager.onDepth((d) => { if (d.symbol === symbol) setBook(d); });
  }, [symbol]);

  const asks = book ? [...book.asks].slice(0, 10).reverse() : [];
  const bids = book ? book.bids.slice(0, 10) : [];
  const max = Math.max(1, ...asks.map((l) => l.qty), ...bids.map((l) => l.qty));
  const spread = book && book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : 0;

  const row = (l: DepthLevel, side: 'ask' | 'bid') => (
    <div key={`${side}${l.price}`} className="relative flex justify-between px-3 py-[2px] hover:bg-white/5">
      <div
        className={`absolute inset-y-0 right-0 ${side === 'ask' ? 'bg-zinc-700/20' : 'bg-white/10'}`}
        style={{ width: `${(l.qty / max) * 100}%` }}
      />
      <span className={`num relative font-medium ${side === 'ask' ? 'text-zinc-400' : 'text-white'}`}>{fmtPrice(l.price)}</span>
      <span className="num relative text-zinc-300">{fmtQty(l.qty)}</span>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel font-mono text-xs select-none">
      <div className="flex justify-between border-b border-grid/50 px-3 py-2 text-muted bg-[#09090d]/60">
        <span className="font-semibold text-white">Price</span>
        <span className="font-semibold text-white">Size</span>
      </div>
      {book ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
          {asks.map((l) => row(l, 'ask'))}
          <div className="num flex items-baseline justify-between border-y border-grid/50 px-3 py-2 text-sm text-white bg-white/5 shadow-inner">
            <span className="font-bold text-white text-base tracking-tight">{fmtPrice(price)}</span>
            <span className="text-[11px] text-muted font-normal">spread {fmtPrice(spread)}</span>
          </div>
          {bids.map((l) => row(l, 'bid'))}
        </div>
      ) : (
        <div className="p-3 text-muted">Waiting for depth data…</div>
      )}
    </div>
  );
}
