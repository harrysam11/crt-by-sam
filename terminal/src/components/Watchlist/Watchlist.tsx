import { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { CATEGORY_LABEL } from '../../services/instruments';
import { fmtPct, fmtPrice, pnlClass } from '../../utils/formatters';
import type { AssetCategory } from '../../types/terminal';
import SymbolSearch from './SymbolSearch';

const CATS = Object.keys(CATEGORY_LABEL) as AssetCategory[];

export default function Watchlist() {
  const active = useTerminalStore((s) => s.symbol);
  const instruments = useTerminalStore((s) => s.instruments);
  const list = useTerminalStore((s) => s.watchlist);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const remove = useTerminalStore((s) => s.removeInstrument);
  const activeCat = useTerminalStore((s) => s.instruments.find((i) => i.id === s.symbol)?.category);
  const [cat, setCat] = useState<AssetCategory | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const current = cat ?? activeCat ?? 'CRYPTO';
  const rows = instruments.filter((i) => i.category === current);

  // Expose global hotkey trigger for '/' search jump
  useState(() => {
    (window as any).__openSymbolSearch = () => setSearching(true);
  });

  return (
    <aside className="flex w-full h-full flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-grid px-3 py-2">
        <span className="font-semibold text-white">Markets</span>
        <button className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white" onClick={() => setSearching((v) => !v)}>
          {searching ? 'Close' : 'Add symbol'}
        </button>
      </div>
      {searching && <SymbolSearch onDone={() => setSearching(false)} />}
      <div className="flex flex-wrap gap-1 border-b border-grid p-2">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`rounded px-2 py-0.5 ${c === current ? 'bg-grid text-white' : 'text-muted hover:text-white'}`}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((i) => {
          const t = list[i.id];
          return (
            <li key={i.id} className={`group flex items-center hover:bg-grid ${i.id === active ? 'bg-grid' : ''}`}>
              <button onClick={() => setSymbol(i.id)} className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left">
                <span className="truncate pr-2 text-white" title={i.name}>{i.label}</span>
                <span className="flex flex-col items-end leading-tight">
                  <span className="num text-white">{t ? fmtPrice(t.price, i.id) : '—'}</span>
                  <span className={`num ${pnlClass(t?.change ?? 0)}`}>{t ? fmtPct(t.change) : ''}</span>
                </span>
              </button>
              <button
                aria-label={`Remove ${i.label}`}
                className="hidden px-2 text-muted hover:text-down group-hover:block"
                onClick={() => { const r = remove(i.id); setNote(r.ok ? '' : r.error ?? ''); }}
              >×</button>
            </li>
          );
        })}
      </ul>
      {note && <p className="border-t border-grid p-2 text-down">{note}</p>}
    </aside>
  );
}
