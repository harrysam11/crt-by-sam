import { useEffect, useState } from 'react';
import { searchSymbols } from '../../services/yahoo';
import { CATEGORY_LABEL } from '../../services/instruments';
import { useTerminalStore } from '../../store/useTerminalStore';
import type { Instrument } from '../../types/terminal';

/** Search any stock, ETF, index, FX pair or future on Yahoo Finance and add it to the watchlist. */
export default function SymbolSearch({ onDone, onSelect }: { onDone: () => void; onSelect?: (i: Instrument) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Instrument[]>([]);
  const [msg, setMsg] = useState('');
  const add = useTerminalStore((s) => s.addInstrument);
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setMsg(''); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchSymbols(q.trim(), ctl.signal)
        .then((r) => { setHits(r); setMsg(r.length ? '' : 'No matches.'); })
        .catch((e: unknown) => { if (!(e instanceof DOMException)) setMsg('Search is unavailable. Check the dev server proxy.'); });
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const pick = (i: Instrument) => {
    add(i);
    setSymbol(i.id);
    if (onSelect) onSelect(i);
    onDone();
  };

  return (
    <div className="border-b border-grid p-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}
        placeholder="Search e.g. ITC, Nifty IT, AAPL"
        className="w-full rounded border border-grid bg-bg px-2 py-1.5 text-white placeholder:text-muted/60"
      />
      {msg && <p className="px-1 pt-2 text-muted">{msg}</p>}
      <ul className="mt-1 max-h-60 overflow-y-auto">
        {hits.map((h) => (
          <li key={h.id}>
            <button onClick={() => pick(h)} className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-grid">
              <span className="text-white">{h.id} <span className="text-muted">· {CATEGORY_LABEL[h.category]}</span></span>
              <span className="truncate text-muted">{h.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
