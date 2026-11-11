/**
 * TradingView-Style Alerts Dashboard Tab.
 * Supports:
 * - Active alerts list with trigger status, pause/resume, edit and delete
 * - Triggered alert logs with timestamps
 * - Launch CreateAlertModal
 * - Clear triggered history
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtDateTime, fmtPrice, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import CreateAlertModal from './CreateAlertModal';

export default function AlertsTab() {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const alerts = useTerminalStore((s) => s.alerts);
  const removeAlert = useTerminalStore((s) => s.removeAlert);
  const toggleAlert = useTerminalStore((s) => s.toggleAlert);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'TRIGGERED'>('ALL');

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === 'ACTIVE') return !a.triggered;
    if (filterType === 'TRIGGERED') return a.triggered;
    return true;
  });

  return (
    <div className="flex flex-col h-full p-3 font-mono text-xs select-none">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-grid/50 mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-0.5 rounded-[4px] text-[11px] transition ${
              filterType === 'ALL' ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setFilterType('ACTIVE')}
            className={`px-2.5 py-0.5 rounded-[4px] text-[11px] transition ${
              filterType === 'ACTIVE' ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'
            }`}
          >
            Active ({alerts.filter((a) => !a.triggered).length})
          </button>
          <button
            onClick={() => setFilterType('TRIGGERED')}
            className={`px-2.5 py-0.5 rounded-[4px] text-[11px] transition ${
              filterType === 'TRIGGERED' ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'
            }`}
          >
            History ({alerts.filter((a) => a.triggered).length})
          </button>
        </div>

        <button
          onClick={() => {
            audioHaptics.tick();
            setIsCreateModalOpen(true);
          }}
          className="clay-pill-active px-3 py-1 font-bold text-xs"
        >
          + Create Alert
        </button>
      </div>

      {/* Alerts Table / List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted">
            <p>No alerts in this category.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 text-white hover:underline text-[11px]"
            >
              Create an alert on {labelOf(symbol)}
            </button>
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-grid/50 text-[10px] uppercase text-muted">
                <th className="py-1 px-2">Symbol</th>
                <th className="py-1 px-2">Condition</th>
                <th className="py-1 px-2">Target Price</th>
                <th className="py-1 px-2">Status</th>
                <th className="py-1 px-2">Created</th>
                <th className="py-1 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid/30 font-mono">
              {[...filteredAlerts].reverse().map((a) => {
                const isTriggered = a.triggered;
                const isActive = a.active !== false && !isTriggered;

                return (
                  <tr key={a.id} className="hover:bg-white/5 transition">
                    <td className="py-2 px-2 font-bold text-white">
                      {labelOf(a.symbol)}
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-slate-300">
                        {a.type === 'UNREALIZED_LOSS'
                          ? `Loss Limit > $${a.price}`
                          : a.type === 'INDICATOR_CROSS'
                          ? `${a.condition?.indicatorId?.toUpperCase()} ${a.condition?.operator} ${a.condition?.targetValue}`
                          : `Price ${a.dir} ${fmtPrice(a.price, a.symbol)}`}
                      </span>
                      {a.note && (
                        <p className="text-[10px] text-muted truncate max-w-[180px]">{a.note}</p>
                      )}
                    </td>
                    <td className="py-2 px-2 text-white">
                      {fmtPrice(a.price, a.symbol)}
                    </td>
                    <td className="py-2 px-2">
                      {isTriggered ? (
                        <span className="clay-badge text-[9px] px-1.5 py-0.2 text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                          Triggered
                        </span>
                      ) : isActive ? (
                        <span className="clay-badge text-[9px] px-1.5 py-0.2 text-amber-400 bg-amber-500/10 border-amber-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="clay-badge text-[9px] px-1.5 py-0.2 text-zinc-500 bg-zinc-800/40">
                          Paused
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted text-[10px]">
                      {fmtDateTime(a.createdAt)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {!isTriggered && (
                          <button
                            onClick={() => {
                              audioHaptics.tick();
                              toggleAlert(a.id);
                            }}
                            className="clay-btn px-2 py-0.5 text-[10px] text-slate-300 hover:text-white"
                            title={isActive ? 'Pause Alert' : 'Resume Alert'}
                          >
                            {isActive ? 'Pause' : 'Resume'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            removeAlert(a.id);
                          }}
                          className="clay-btn px-2 py-0.5 text-[10px] text-muted hover:text-white hover:border-red-400"
                          title="Delete Alert"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Alert Modal */}
      <CreateAlertModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
