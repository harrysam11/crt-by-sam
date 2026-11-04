import { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtDateTime, fmtPrice, fmtUsd, labelOf } from '../../utils/formatters';

export default function AlertsTab() {
  const symbol = useTerminalStore((s) => s.symbol);
  const price = useTerminalStore((s) => s.currentPrice);
  const alerts = useTerminalStore((s) => s.alerts);
  const add = useTerminalStore((s) => s.addAlert);
  const remove = useTerminalStore((s) => s.removeAlert);

  const [v, setV] = useState('');
  const [lossThreshold, setLossThreshold] = useState('');
  const [alertType, setAlertType] = useState<'PRICE' | 'UNREALIZED_LOSS'>('PRICE');

  const n = parseFloat(v);
  const lossN = parseFloat(lossThreshold);

  return (
    <div className="p-3 font-mono text-xs select-none">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setAlertType('PRICE')}
          className={`rounded px-2.5 py-1 font-semibold transition ${
            alertType === 'PRICE' ? 'bg-accent text-white' : 'bg-grid text-muted hover:text-white'
          }`}
        >
          Price Level Alert
        </button>
        <button
          onClick={() => setAlertType('UNREALIZED_LOSS')}
          className={`rounded px-2.5 py-1 font-semibold transition ${
            alertType === 'UNREALIZED_LOSS' ? 'bg-accent text-white' : 'bg-grid text-muted hover:text-white'
          }`}
        >
          PnL Loss Limit Alert
        </button>
      </div>

      {alertType === 'PRICE' ? (
        <form
          className="mb-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (n > 0) {
              add(symbol, n);
              setV('');
            }
          }}
        >
          <span className="text-muted">Alert when {labelOf(symbol)} reaches</span>
          <input
            inputMode="decimal"
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder={fmtPrice(price, symbol)}
            className="num w-32 rounded border border-grid bg-bg px-2 py-1 text-white placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            className="rounded bg-grid px-3 py-1 text-white hover:brightness-125 disabled:opacity-50"
            disabled={!(n > 0)}
          >
            Add Price Alert
          </button>
        </form>
      ) : (
        <form
          className="mb-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (lossN > 0) {
              add('PORTFOLIO', lossN, 'UNREALIZED_LOSS');
              setLossThreshold('');
            }
          }}
        >
          <span className="text-muted">Alert if session unrealized loss exceeds</span>
          <input
            inputMode="decimal"
            value={lossThreshold}
            onChange={(e) => setLossThreshold(e.target.value)}
            placeholder="e.g. 250"
            className="num w-28 rounded border border-grid bg-bg px-2 py-1 text-white placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <span className="text-muted">USD</span>
          <button
            className="rounded bg-grid px-3 py-1 text-white hover:brightness-125 disabled:opacity-50"
            disabled={!(lossN > 0)}
          >
            Set Risk Alert
          </button>
        </form>
      )}

      {alerts.length === 0 ? (
        <p className="text-muted">No active alerts. Browser notifications and audible tones fire when price levels trigger.</p>
      ) : (
        <ul className="divide-y divide-grid/40">
          {[...alerts].reverse().map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1.5">
              <span className="num">
                {a.type === 'UNREALIZED_LOSS' ? (
                  <>
                    <span className="font-bold text-red-400">[RISK LIMIT]</span>{' '}
                    <span className="text-muted">Max Loss Threshold:</span>{' '}
                    <span className="text-white font-semibold">-${a.price.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-white">{labelOf(a.symbol)}</span>{' '}
                    <span className="text-muted">{a.dir}</span>{' '}
                    <span className="text-white font-semibold">{fmtPrice(a.price, a.symbol)}</span>
                  </>
                )}
                <span className="ml-3 text-[10px] text-muted">{fmtDateTime(a.createdAt)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={a.triggered ? 'text-up font-bold' : 'text-yellow-400 font-semibold'}>
                  {a.triggered ? 'TRIGGERED' : 'ACTIVE'}
                </span>
                <button
                  className="text-muted hover:text-white"
                  onClick={() => remove(a.id)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
