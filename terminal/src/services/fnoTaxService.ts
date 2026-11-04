import type { Trade } from '../types/terminal';

export interface TaxSummary {
  grossRealizedPnl: number;
  totalTurnover: number;       // Section 43(5) turnover: Abs(Profits) + Abs(Losses)
  totalNotionalVolume: number; // Sum of trade values (Qty * Price)
  estimatedBrokerage: number;
  estimatedSTT: number;        // Securities Transaction Tax
  netTaxableIncome: number;
  tradeCount: number;
  profitableTradesCount: number;
  lossTradesCount: number;
}

/**
 * Calculate FnO Tax & Regulatory Turnover according to institutional standards
 * Turnover for Futures & Options is calculated as:
 * Absolute Realized Profits + Absolute Realized Losses (plus Option premium on sale)
 */
export function calculateFnoTaxSummary(trades: Trade[]): TaxSummary {
  let grossRealizedPnl = 0;
  let totalTurnover = 0;
  let totalNotionalVolume = 0;
  let profitableTradesCount = 0;
  let lossTradesCount = 0;

  for (const t of trades) {
    grossRealizedPnl += t.pnl;
    totalTurnover += Math.abs(t.pnl);
    totalNotionalVolume += t.qty * t.entry + t.qty * t.exit;

    if (t.pnl > 0) profitableTradesCount++;
    else if (t.pnl < 0) lossTradesCount++;
  }

  // Standard derivative fee schedules: 0.02% brokerage + 0.0125% STT on sale
  const estimatedBrokerage = Math.round(totalNotionalVolume * 0.0002 * 100) / 100;
  const estimatedSTT = Math.round(totalNotionalVolume * 0.000125 * 100) / 100;
  const netTaxableIncome = Math.round((grossRealizedPnl - estimatedBrokerage - estimatedSTT) * 100) / 100;

  return {
    grossRealizedPnl: Math.round(grossRealizedPnl * 100) / 100,
    totalTurnover: Math.round(totalTurnover * 100) / 100,
    totalNotionalVolume: Math.round(totalNotionalVolume * 100) / 100,
    estimatedBrokerage,
    estimatedSTT,
    netTaxableIncome,
    tradeCount: trades.length,
    profitableTradesCount,
    lossTradesCount,
  };
}

/**
 * Generate audit-ready tax filing CSV export
 */
export function generateTaxAuditCsv(trades: Trade[]): string {
  const headers = [
    'Trade ID',
    'Date / Time',
    'Symbol',
    'Side',
    'Quantity',
    'Entry Price',
    'Exit Price',
    'Gross Realized PnL',
    'Turnover Contribution',
    'Est. Brokerage',
    'Est. STT',
    'Net PnL',
  ];

  const rows = trades.map((t) => {
    const turnover = Math.abs(t.pnl);
    const notional = (t.qty * t.entry) + (t.qty * t.exit);
    const brokerage = Math.round(notional * 0.0002 * 100) / 100;
    const stt = Math.round(notional * 0.000125 * 100) / 100;
    const net = Math.round((t.pnl - brokerage - stt) * 100) / 100;

    return [
      t.id,
      new Date(t.time).toISOString(),
      t.symbol,
      t.side,
      String(t.qty),
      String(t.entry),
      String(t.exit),
      t.pnl.toFixed(2),
      turnover.toFixed(2),
      brokerage.toFixed(2),
      stt.toFixed(2),
      net.toFixed(2),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
}
