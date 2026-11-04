import React from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { calculateFnoTaxSummary, generateTaxAuditCsv } from '../../services/fnoTaxService';
import { fmtPnl, fmtPrice, fmtQty, fmtTime, fmtUsd, labelOf, pnlClass } from '../../utils/formatters';

interface TaxLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TaxLedgerModal({ isOpen, onClose }: TaxLedgerModalProps) {
  const trades = useTerminalStore((s) => s.trades);
  const summary = calculateFnoTaxSummary(trades);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    const csvContent = generateTaxAuditCsv(trades);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fno-tax-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              FnO Tax, Regulatory Turnover & Audit Ledger
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Regulatory Turnover (Sec 43(5))</span>
              <span className="text-base font-bold text-white mt-1 block">
                {fmtUsd(summary.totalTurnover)}
              </span>
              <span className="text-[10px] text-muted">Abs(Profit) + Abs(Loss)</span>
            </div>

            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Gross Realized P&L</span>
              <span className={`text-base font-bold mt-1 block ${pnlClass(summary.grossRealizedPnl)}`}>
                {fmtPnl(summary.grossRealizedPnl)}
              </span>
              <span className="text-[10px] text-muted">{summary.tradeCount} trades closed</span>
            </div>

            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Est. Brokerage & STT</span>
              <span className="text-base font-bold text-down mt-1 block">
                -{fmtUsd(summary.estimatedBrokerage + summary.estimatedSTT)}
              </span>
              <span className="text-[10px] text-muted">Brokerage: {fmtUsd(summary.estimatedBrokerage)}</span>
            </div>

            <div className="rounded-xl border border-grid bg-bg/50 p-4">
              <span className="text-[10px] text-muted uppercase block">Net Taxable P&L</span>
              <span className={`text-base font-bold mt-1 block ${pnlClass(summary.netTaxableIncome)}`}>
                {fmtPnl(summary.netTaxableIncome)}
              </span>
              <span className="text-[10px] text-muted">Post statutory deduction</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              Displaying all closed trades mapped to turnover and audit schedules.
            </span>
            <button
              onClick={handleDownloadCsv}
              disabled={trades.length === 0}
              className="rounded bg-accent px-4 py-2 font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              Export Audit CSV Ledger
            </button>
          </div>

          {/* Trades Ledger Table */}
          <div className="rounded-xl border border-grid bg-bg/40 p-4">
            {trades.length === 0 ? (
              <p className="p-6 text-center text-muted">No closed trade records found for tax calculation.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-grid text-[10px] uppercase text-muted">
                    <tr>
                      <th className="py-2 text-left">Time</th>
                      <th className="py-2 text-left">Symbol</th>
                      <th className="py-2 text-center">Side</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Entry</th>
                      <th className="py-2">Exit</th>
                      <th className="py-2">Gross PnL</th>
                      <th className="py-2">Turnover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grid/40">
                    {[...trades].reverse().map((t) => (
                      <tr key={t.id} className="hover:bg-grid/20">
                        <td className="py-2 text-left text-muted">{fmtTime(t.time)}</td>
                        <td className="py-2 text-left font-bold text-white">{labelOf(t.symbol)}</td>
                        <td className={`py-2 text-center font-bold ${t.side === 'LONG' ? 'text-up' : 'text-down'}`}>
                          {t.side}
                        </td>
                        <td className="py-2">{fmtQty(t.qty)}</td>
                        <td className="py-2">{fmtPrice(t.entry, t.symbol)}</td>
                        <td className="py-2">{fmtPrice(t.exit, t.symbol)}</td>
                        <td className={`py-2 font-semibold ${pnlClass(t.pnl)}`}>{fmtPnl(t.pnl)}</td>
                        <td className="py-2 text-white font-mono">{fmtUsd(Math.abs(t.pnl))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-grid px-6 py-2.5 bg-bg/50 text-[10px] text-muted flex items-center justify-between">
          <span>Compliant with standard derivatives turnover reporting rules.</span>
          <span>Consult a certified tax professional for official tax filing submissions.</span>
        </div>
      </div>
    </div>
  );
}
