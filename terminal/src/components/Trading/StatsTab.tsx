import { useTerminalStore } from '../../store/useTerminalStore';
import { useJournalStore } from '../../store/useJournalStore';
import { fmtDateTime, fmtPnl, fmtPrice, fmtQty, labelOf, pnlClass } from '../../utils/formatters';

function downloadCsv(rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `journal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Journal: closed trades (PnL in USD) with the numbers that matter. */
export default function StatsTab() {
  const trades = useTerminalStore((s) => s.trades);
  const openJournalModal = useJournalStore((s) => s.openJournalModal);
  const wins = trades.filter((t) => t.pnl > 0), losses = trades.filter((t) => t.pnl < 0);
  const gross = (a: typeof trades) => a.reduce((s, t) => s + t.pnl, 0);
  const net = gross(trades);
  const pf = gross(losses) ? gross(wins) / Math.abs(gross(losses)) : wins.length ? Infinity : 0;

  // Max drawdown on the closed-trade equity curve.
  let peak = 0, cum = 0, dd = 0;
  for (const t of trades) { cum += t.pnl; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }

  const cell = (k: string, v: string, cls = 'text-white') => (
    <div className="flex flex-col"><span className="text-muted">{k}</span><span className={`num ${cls}`}>{v}</span></div>
  );
  if (!trades.length) return <p className="p-3 text-muted">Closed trades appear here with win rate, profit factor and drawdown.</p>;

  return (
    <div className="p-3">
      <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-7">
        {cell('Net PnL', fmtPnl(net), pnlClass(net))}
        {cell('Trades', String(trades.length))}
        {cell('Win rate', `${((wins.length / trades.length) * 100).toFixed(0)}%`)}
        {cell('Avg win', wins.length ? fmtPnl(gross(wins) / wins.length) : '—', 'text-up')}
        {cell('Avg loss', losses.length ? fmtPnl(gross(losses) / losses.length) : '—', 'text-down')}
        {cell('Profit factor', Number.isFinite(pf) ? pf.toFixed(2) : '∞')}
        {cell('Max drawdown', `-$${dd.toFixed(2)}`, 'text-down')}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <button
          className="rounded border border-grid px-2 py-1 text-muted hover:text-white"
          onClick={() => downloadCsv([
            ['time', 'symbol', 'side', 'qty', 'entry', 'exit', 'pnl_usd'],
            ...trades.map((t) => [new Date(t.time).toISOString(), t.symbol, t.side, String(t.qty), String(t.entry), String(t.exit), t.pnl.toFixed(2)]),
          ])}
        >
          Export CSV
        </button>
        <button
          onClick={() => openJournalModal()}
          className="rounded border border-accent/40 bg-accent/10 px-2 py-1 text-accent hover:bg-accent/20"
        >
          Visual Screenshot Archive
        </button>
      </div>
      <table className="num w-full">
        <thead><tr className="text-muted">{['Closed', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'PnL'].map((h) => <th key={h} className="px-2 py-1 text-left font-normal">{h}</th>)}</tr></thead>
        <tbody>
          {[...trades].reverse().slice(0, 100).map((t) => (
            <tr key={t.id} className="border-t border-grid">
              <td className="px-2 py-1 text-muted">{fmtDateTime(t.time)}</td>
              <td className="px-2">{labelOf(t.symbol)}</td>
              <td className={`px-2 ${t.side === 'LONG' ? 'text-up' : 'text-down'}`}>{t.side}</td>
              <td className="px-2">{fmtQty(t.qty)}</td>
              <td className="px-2">{fmtPrice(t.entry, t.symbol)}</td>
              <td className="px-2">{fmtPrice(t.exit, t.symbol)}</td>
              <td className={`px-2 ${pnlClass(t.pnl)}`}>{fmtPnl(t.pnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
