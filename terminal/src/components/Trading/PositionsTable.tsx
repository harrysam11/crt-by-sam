import { useState } from 'react';
import { positionPnlUsd, useTerminalStore } from '../../store/useTerminalStore';
import { fmtPnl, fmtPrice, fmtQty, fmtTime, labelOf, pnlClass } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import AlertsTab from './AlertsTab';
import StatsTab from './StatsTab';
import PineEditor from '../../features/pine/PineEditor';

const TYPE_LABEL = { MARKET: 'Market', LIMIT: 'Limit', STOP_LOSS: 'Stop loss', TAKE_PROFIT: 'Take profit' } as const;
type Tab = 'positions' | 'orders' | 'journal' | 'alerts' | 'pine';

export default function PositionsTable() {
  const [tab, setTab] = useState<Tab>('positions');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const positions = useTerminalStore((s) => s.positions);
  const prices = useTerminalStore((s) => s.prices);
  const orders = useTerminalStore((s) => s.orders);
  const trades = useTerminalStore((s) => s.trades);
  const alertCount = useTerminalStore((s) => s.alerts.filter((a) => !a.triggered).length);
  const setPinePlots = useTerminalStore((s) => s.setPinePlots);
  const close = useTerminalStore((s) => s.closePosition);
  const closePartial = useTerminalStore((s) => s.closePartialPosition);
  const flip = useTerminalStore((s) => s.flipPosition);
  const snapBE = useTerminalStore((s) => s.snapBreakEven);
  const closeAll = useTerminalStore((s) => s.closeAllPositions);
  const cancel = useTerminalStore((s) => s.cancelOrder);
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const open = Object.values(positions);
  const list = [...orders].reverse().slice(0, 100);
  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const th = 'px-3 py-1.5 text-left font-normal text-muted text-xs';
  const tabCls = (on: boolean) => `px-3 py-1 text-xs font-semibold rounded-full transition ${on ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'}`;

  const copyTradesCsv = async () => {
    if (trades.length === 0) {
      setCopyStatus('No trades');
      setTimeout(() => setCopyStatus(null), 2000);
      return;
    }
    const headers = 'ID,Symbol,Side,Quantity,Entry Price,Exit Price,PnL (USD),Timestamp\n';
    const rows = trades.map((t) => `${t.id},${t.symbol},${t.side},${t.qty},${t.entry},${t.exit},${t.pnl.toFixed(2)},${new Date(t.time).toISOString()}`).join('\n');
    try {
      await navigator.clipboard.writeText(headers + rows);
      audioHaptics.tick();
      setCopyStatus('Copied CSV!');
    } catch {
      setCopyStatus('Copy failed');
    }
    setTimeout(() => setCopyStatus(null), 2000);
  };

  return (
    <div className="flex h-full flex-col bg-panel font-mono select-none">
      <div className="flex shrink-0 items-center justify-between border-b border-grid/50 px-3 py-2 bg-[#09090d]/60">
        <div className="flex items-center gap-1.5">
          <button className={tabCls(tab === 'positions')} onClick={() => setTab('positions')}>
            Positions ({open.length})
          </button>
          <button className={tabCls(tab === 'orders')} onClick={() => setTab('orders')}>
            Orders ({pending} open)
          </button>
          <button className={tabCls(tab === 'pine')} onClick={() => setTab('pine')}>
            Pine Editor
          </button>
          <button className={tabCls(tab === 'journal')} onClick={() => setTab('journal')}>
            Journal
          </button>
          <button className={tabCls(tab === 'alerts')} onClick={() => setTab('alerts')}>
            Alerts ({alertCount})
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          {tab === 'journal' && (
            <button
              onClick={copyTradesCsv}
              className="rounded border border-grid px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-white transition"
              title="Copy Trade History as CSV to Clipboard"
            >
              {copyStatus ?? 'Copy CSV'}
            </button>
          )}

          {open.length > 0 && tab === 'positions' && (
            <button
              onClick={() => {
                audioHaptics.error();
                closeAll();
              }}
              className="rounded border border-red-500/60 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white transition"
              title="Emergency Flatten All Open Positions"
            >
              [Flatten All]
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'positions' && (open.length === 0 ? (
          <p className="p-3 text-xs text-muted">No open positions. Place an order to start.</p>
        ) : (
          <table className="num w-full text-xs">
            <thead>
              <tr>
                <th className={th}>Symbol</th>
                <th className={th}>Side</th>
                <th className={th}>Size</th>
                <th className={th}>Entry</th>
                <th className={th}>Mark</th>
                <th className={th}>Lev</th>
                <th className={th}>PnL (USD)</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {open.map((p) => {
                const mark = prices[p.symbol] ?? p.entryPrice;
                const pnl = positionPnlUsd(p, mark);
                return (
                  <tr key={p.symbol} className="border-t border-grid hover:bg-slate-900/30 transition">
                    <td className="px-3 py-2">
                      <button className="text-white hover:underline font-semibold" onClick={() => setSymbol(p.symbol)}>
                        {labelOf(p.symbol)}
                      </button>
                    </td>
                    <td className={`px-3 ${p.side === 'LONG' ? 'text-up font-semibold' : 'text-down font-semibold'}`}>
                      {p.side}
                    </td>
                    <td className="px-3">{fmtQty(p.size)}</td>
                    <td className="px-3">{fmtPrice(p.entryPrice, p.symbol)}</td>
                    <td className="px-3">{fmtPrice(mark, p.symbol)}</td>
                    <td className="px-3 text-muted">{p.leverage}x</td>
                    <td className={`px-3 font-semibold ${pnlClass(pnl)}`}>{fmtPnl(pnl)}</td>
                    <td className="px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            snapBE(p.symbol);
                          }}
                          className="rounded border border-grid px-1.5 py-0.5 text-[11px] text-muted hover:border-cyan-400 hover:text-cyan-300 transition"
                          title="Move Stop Loss to Entry Price (Break-Even)"
                        >
                          Snap BE
                        </button>
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            flip(p.symbol);
                          }}
                          className="rounded border border-grid px-1.5 py-0.5 text-[11px] text-muted hover:border-amber-400 hover:text-amber-300 transition"
                          title="Reverse Position Direction at Market"
                        >
                          Flip
                        </button>
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            closePartial(p.symbol, 0.5);
                          }}
                          className="rounded border border-grid px-1.5 py-0.5 text-[11px] text-muted hover:border-accent hover:text-white transition"
                          title="Close 50% of position size (Scale Out)"
                        >
                          50% Close
                        </button>
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            close(p.symbol);
                          }}
                          className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400 hover:bg-red-500 hover:text-white transition"
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}

        {tab === 'orders' && (list.length === 0 ? (
          <p className="p-3 text-xs text-muted">No orders yet.</p>
        ) : (
          <table className="num w-full text-xs">
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Symbol</th>
                <th className={th}>Type</th>
                <th className={th}>Side</th>
                <th className={th}>Qty</th>
                <th className={th}>Price</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`} />
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-t border-grid hover:bg-slate-900/30 transition">
                  <td className="px-3 py-1.5 text-muted">{fmtTime(o.timestamp)}</td>
                  <td className="px-3 font-medium">{labelOf(o.symbol)}</td>
                  <td className="px-3 text-muted">{TYPE_LABEL[o.type]}</td>
                  <td className={`px-3 ${o.side === 'BUY' ? 'text-up' : 'text-down'}`}>{o.side}</td>
                  <td className="px-3">{fmtQty(o.qty)}</td>
                  <td className="px-3">
                    {fmtPrice(o.triggerPrice ?? o.price, o.symbol)}
                    {o.triggerPrice ? ' trigger' : ''}
                  </td>
                  <td className={`px-3 font-semibold ${o.status === 'FILLED' ? 'text-up' : o.status === 'CANCELLED' ? 'text-muted' : 'text-yellow-400'}`}>
                    {o.status.toLowerCase()}
                  </td>
                  <td className="px-3 text-right">
                    {o.status === 'PENDING' && (
                      <button
                        className="rounded border border-grid px-2 py-0.5 text-muted hover:border-red-400 hover:text-white transition"
                        onClick={() => {
                          audioHaptics.tick();
                          cancel(o.id);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        {tab === 'pine' && (
          <PineEditor
            onApplyPlots={(plots) => setPinePlots(plots)}
            onClearPlots={() => setPinePlots([])}
          />
        )}
        {tab === 'journal' && <StatsTab />}
        {tab === 'alerts' && <AlertsTab />}
      </div>
    </div>
  );
}
