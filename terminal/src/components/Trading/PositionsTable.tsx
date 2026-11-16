import { useState } from 'react';
import { positionPnlUsd, useTerminalStore } from '../../store/useTerminalStore';
import { useExecutionEngineStore } from '../../store/useExecutionEngineStore';
import { fmtPnl, fmtPrice, fmtQty, fmtTime, labelOf, pnlClass } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import AlertsTab from './AlertsTab';
import StatsTab from './StatsTab';
import ScriptStudio from '../../features/pine/ScriptStudio';
import BulkBracketModal from './BulkBracketModal';
import ExecutionEngineTab from './ExecutionEngineTab';

const TYPE_LABEL = { MARKET: 'Market', LIMIT: 'Limit', STOP_LOSS: 'Stop loss', TAKE_PROFIT: 'Take profit' } as const;
type Tab = 'positions' | 'orders' | 'algos' | 'journal' | 'alerts' | 'pine';

export interface PositionsTableProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export default function PositionsTable({
  isCollapsed,
  onToggleCollapse,
  isMaximized,
  onToggleMaximize,
}: PositionsTableProps = {}) {
  const [tab, setTab] = useState<Tab>('positions');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Multi-selection state for Quantum Bulk Operations
  const [selectedPositionSymbols, setSelectedPositionSymbols] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkBracketOpen, setIsBulkBracketOpen] = useState(false);

  const handleTabClick = (t: Tab) => {
    audioHaptics.tick();
    setTab(t);
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    }
  };

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

  // Quantum Bulk Actions from Store
  const bulkClosePositions = useTerminalStore((s) => s.bulkClosePositions);
  const closeWinningPositions = useTerminalStore((s) => s.closeWinningPositions);
  const closeLosingPositions = useTerminalStore((s) => s.closeLosingPositions);
  const bulkCancelOrders = useTerminalStore((s) => s.bulkCancelOrders);
  const bulkShiftOrderPrices = useTerminalStore((s) => s.bulkShiftOrderPrices);

  // cTrader execution rules count
  const activeRulesCount = useExecutionEngineStore((s) => s.rules.filter((r) => r.enabled).length);

  const open = Object.values(positions);
  const list = [...orders].reverse().slice(0, 100);
  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const pending = pendingOrders.length;
  const th = 'px-3 py-1.5 text-left font-normal text-muted text-xs';
  const tabCls = (on: boolean) => `px-3 py-1 text-xs font-semibold rounded-[4px] transition ${on ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'}`;

  // Position multi-selection toggles
  const toggleSelectPosition = (sym: string) => {
    audioHaptics.tick();
    setSelectedPositionSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const toggleSelectAllPositions = () => {
    audioHaptics.tick();
    if (selectedPositionSymbols.length === open.length) {
      setSelectedPositionSymbols([]);
    } else {
      setSelectedPositionSymbols(open.map((p) => p.symbol));
    }
  };

  // Order multi-selection toggles
  const toggleSelectOrder = (id: string) => {
    audioHaptics.tick();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllOrders = () => {
    audioHaptics.tick();
    if (selectedOrderIds.length === pendingOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(pendingOrders.map((o) => o.id));
    }
  };

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
      {/* Tab Strip */}
      <div className="flex shrink-0 items-center justify-between border-b border-grid/50 px-3 py-1.5 bg-[#09090d]/60">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button className={tabCls(tab === 'positions')} onClick={() => handleTabClick('positions')}>
            Positions ({open.length})
          </button>
          <button className={tabCls(tab === 'orders')} onClick={() => handleTabClick('orders')}>
            Orders ({pending} open)
          </button>
          <button className={tabCls(tab === 'algos')} onClick={() => handleTabClick('algos')}>
            cTrader Algos ({activeRulesCount})
          </button>
          <button className={tabCls(tab === 'pine')} onClick={() => handleTabClick('pine')}>
            Script Studio
          </button>
          <button className={tabCls(tab === 'journal')} onClick={() => handleTabClick('journal')}>
            Journal
          </button>
          <button className={tabCls(tab === 'alerts')} onClick={() => handleTabClick('alerts')}>
            Alerts ({alertCount})
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
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

          {/* Maximize / Restore Toggle */}
          {onToggleMaximize && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onToggleMaximize();
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
              title={isMaximized ? 'Restore Bottom Panel Size' : 'Maximize Bottom Panel to Full Height'}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMaximized ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M14 4h6m0 0v6m0-6l-7 7M10 4H4m0 0v6m0-6l7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          )}

          {/* Expand / Collapse Button with Explicit Label & Chevron */}
          {onToggleCollapse && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onToggleCollapse();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition ${
                isCollapsed
                  ? 'clay-pill-active font-bold text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={isCollapsed ? 'Expand Bottom Panel (Show Positions & Orders)' : 'Collapse Bottom Panel'}
            >
              <span className="text-[10px] hidden sm:inline">{isCollapsed ? 'Expand' : 'Collapse'}</span>
              <svg className={`h-3.5 w-3.5 transition-transform duration-150 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Quantum Bulk Actions Toolbar (Positions) */}
      {tab === 'positions' && open.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0e0e16] border-b border-grid/40 text-[11px]">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-slate-400 font-bold uppercase text-[10px]">
              Quantum Bulk:
            </span>
            <button
              onClick={() => setIsBulkBracketOpen(true)}
              className="px-2 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40 hover:bg-[#38bdf8] hover:text-black font-semibold transition"
              title="Batch Modify Stop Loss and Take Profit across positions"
            >
              Set Bulk TP/SL
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                const targets = selectedPositionSymbols.length > 0 ? selectedPositionSymbols : open.map((p) => p.symbol);
                targets.forEach((sym) => snapBE(sym));
              }}
              className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 hover:bg-cyan-500 hover:text-black transition"
              title="Snap Stop Loss to Entry for selected or all positions"
            >
              BE All {selectedPositionSymbols.length > 0 ? `(${selectedPositionSymbols.length})` : ''}
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                const targets = selectedPositionSymbols.length > 0 ? selectedPositionSymbols : open.map((p) => p.symbol);
                bulkClosePositions(targets, 0.5);
              }}
              className="px-2 py-0.5 rounded bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5 transition"
              title="Scale Out 50% Size"
            >
              Close 50%
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                closeWinningPositions();
              }}
              className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-500 hover:text-black transition"
              title="Close all positions currently in profit"
            >
              Close Winners
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                closeLosingPositions();
              }}
              className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-500 hover:text-white transition"
              title="Close all positions currently in loss"
            >
              Close Losers
            </button>
          </div>

          {selectedPositionSymbols.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[#38bdf8] font-bold">
                {selectedPositionSymbols.length} selected
              </span>
              <button
                onClick={() => {
                  audioHaptics.error();
                  bulkClosePositions(selectedPositionSymbols, 1);
                  setSelectedPositionSymbols([]);
                }}
                className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500 hover:text-white font-bold transition"
              >
                Close Selected
              </button>
              <button
                onClick={() => setSelectedPositionSymbols([])}
                className="text-slate-400 hover:text-white text-[10px]"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quantum Bulk Actions Toolbar (Orders) */}
      {tab === 'orders' && pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0e0e16] border-b border-grid/40 text-[11px]">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-slate-400 font-bold uppercase text-[10px]">
              Quantum Orders:
            </span>
            <button
              onClick={() => {
                audioHaptics.tick();
                const buys = pendingOrders.filter((o) => o.side === 'BUY').map((o) => o.id);
                if (buys.length) bulkCancelOrders(buys);
              }}
              className="px-2 py-0.5 rounded bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5 transition"
            >
              Cancel Buys
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                const sells = pendingOrders.filter((o) => o.side === 'SELL').map((o) => o.id);
                if (sells.length) bulkCancelOrders(sells);
              }}
              className="px-2 py-0.5 rounded bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5 transition"
            >
              Cancel Sells
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                const sls = pendingOrders.filter((o) => o.type === 'STOP_LOSS').map((o) => o.id);
                if (sls.length) bulkCancelOrders(sls);
              }}
              className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-500 hover:text-white transition"
            >
              Cancel All SL
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                const tps = pendingOrders.filter((o) => o.type === 'TAKE_PROFIT').map((o) => o.id);
                if (tps.length) bulkCancelOrders(tps);
              }}
              className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-500 hover:text-black transition"
            >
              Cancel All TP
            </button>
          </div>

          {selectedOrderIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[#38bdf8] font-bold">
                {selectedOrderIds.length} selected
              </span>
              <button
                onClick={() => {
                  audioHaptics.tick();
                  bulkShiftOrderPrices(selectedOrderIds, 0.5);
                }}
                className="px-2 py-0.5 rounded bg-white/5 text-slate-300 hover:text-white border border-white/5 transition"
                title="Shift price +0.5%"
              >
                +0.5%
              </button>
              <button
                onClick={() => {
                  audioHaptics.tick();
                  bulkShiftOrderPrices(selectedOrderIds, -0.5);
                }}
                className="px-2 py-0.5 rounded bg-white/5 text-slate-300 hover:text-white border border-white/5 transition"
                title="Shift price -0.5%"
              >
                -0.5%
              </button>
              <button
                onClick={() => {
                  audioHaptics.error();
                  bulkCancelOrders(selectedOrderIds);
                  setSelectedOrderIds([]);
                }}
                className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500 hover:text-white font-bold transition"
              >
                Cancel Selected
              </button>
              <button
                onClick={() => setSelectedOrderIds([])}
                className="text-slate-400 hover:text-white text-[10px]"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Panels */}
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'positions' && (open.length === 0 ? (
          <p className="p-3 text-xs text-muted">No open positions. Place an order to start.</p>
        ) : (
          <table className="num w-full text-xs">
            <thead>
              <tr>
                <th className="px-3 py-1.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={selectedPositionSymbols.length === open.length && open.length > 0}
                    onChange={toggleSelectAllPositions}
                    className="rounded bg-[#1a1a26] border-grid cursor-pointer"
                    title="Select / Deselect All Positions"
                  />
                </th>
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
                const isSelected = selectedPositionSymbols.includes(p.symbol);
                return (
                  <tr
                    key={p.symbol}
                    className={`border-t border-grid transition ${
                      isSelected ? 'bg-[#38bdf8]/10' : 'hover:bg-slate-900/30'
                    }`}
                  >
                    <td className="px-3 py-2 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectPosition(p.symbol)}
                        className="rounded bg-[#1a1a26] border-grid cursor-pointer"
                      />
                    </td>
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
                <th className="px-3 py-1.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.length === pendingOrders.length && pendingOrders.length > 0}
                    onChange={toggleSelectAllOrders}
                    className="rounded bg-[#1a1a26] border-grid cursor-pointer"
                    title="Select / Deselect All Pending Orders"
                  />
                </th>
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
              {list.map((o) => {
                const isSelected = selectedOrderIds.includes(o.id);
                return (
                  <tr
                    key={o.id}
                    className={`border-t border-grid transition ${
                      isSelected ? 'bg-[#38bdf8]/10' : 'hover:bg-slate-900/30'
                    }`}
                  >
                    <td className="px-3 py-1.5 w-8 text-center">
                      {o.status === 'PENDING' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(o.id)}
                          className="rounded bg-[#1a1a26] border-grid cursor-pointer"
                        />
                      )}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        ))}

        {tab === 'algos' && <ExecutionEngineTab />}

        {tab === 'pine' && (
          <ScriptStudio
            onApplyPlots={(plots) => setPinePlots(plots)}
            onClearPlots={() => setPinePlots([])}
          />
        )}
        {tab === 'journal' && <StatsTab />}
        {tab === 'alerts' && <AlertsTab />}
      </div>

      {/* Quantum Bulk TP/SL Dialog */}
      <BulkBracketModal
        isOpen={isBulkBracketOpen}
        onClose={() => setIsBulkBracketOpen(false)}
        selectedSymbols={selectedPositionSymbols}
      />
    </div>
  );
}
