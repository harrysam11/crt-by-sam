import { useState, useEffect } from 'react';
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

  // Expose global hotkey triggers (Space / Shift+Space cycling)
  useEffect(() => {
    (window as any).__cycleWatchlistSymbol = (direction: number) => {
      if (!rows.length) return;
      const curIdx = rows.findIndex((i) => i.id === active);
      const nextIdx = (curIdx + direction + rows.length) % rows.length;
      setSymbol(rows[nextIdx].id);
    };
    return () => {
      delete (window as any).__cycleWatchlistSymbol;
    };
  }, [rows, active, setSymbol]);

  return (
    <aside className="flex w-full h-full flex-col bg-panel font-mono text-xs select-none">
      <div className="flex items-center justify-between border-b border-grid/50 px-3 py-2 bg-[#09090d]/60">
        <span className="font-bold text-white tracking-wide">Markets</span>
        <button className="clay-btn px-2.5 py-1 text-[11px] text-muted hover:text-white" onClick={() => setSearching((v) => !v)}>
          {searching ? 'Close' : '+ Add Symbol'}
        </button>
      </div>
      {searching && <SymbolSearch onDone={() => setSearching(false)} />}
      <div className="flex flex-wrap gap-1 border-b border-grid/50 p-2 bg-[#09090d]/40">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-2.5 py-1 text-[11px] transition ${c === current ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'}`}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1">
        {rows.map((i) => {
          const t = list[i.id];
          const isUp = (t?.change ?? 0) >= 0;
          return (
            <li key={i.id} className={`group flex items-center rounded-xl transition ${i.id === active ? 'clay-card border-white/20 bg-white/10' : 'hover:bg-white/5'}`}>
              <button onClick={() => setSymbol(i.id)} className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left">
                <span className="truncate pr-2 font-bold text-white" title={i.name}>{i.label}</span>
                <span className="flex flex-col items-end leading-tight">
                  <span className="num font-bold text-white">{t ? fmtPrice(t.price, i.id) : '—'}</span>
                  <span className={`num text-[11px] font-semibold ${isUp ? 'text-white' : 'text-zinc-500'}`}>{t ? fmtPct(t.change) : ''}</span>
                </span>
              </button>
              <button
                aria-label={`Remove ${i.label}`}
                className="hidden px-2 text-muted hover:text-white group-hover:block"
                onClick={() => { const r = remove(i.id); setNote(r.ok ? '' : r.error ?? ''); }}
              >×</button>
            </li>
          );
        })}
      </ul>
      {note && <p className="border-t border-grid/50 p-2 text-zinc-400">{note}</p>}
    </aside>
  );
}
