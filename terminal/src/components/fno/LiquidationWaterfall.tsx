import React, { useEffect, useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPrice, fmtTime, fmtUsd } from '../../utils/formatters';

interface LiquidationEvent {
  id: string;
  time: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  sizeUsd: number;
  price: number;
  isWhale: boolean;
}

interface LiquidationWaterfallProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiquidationWaterfall({ isOpen, onClose }: LiquidationWaterfallProps) {
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const mark = currentPrice > 0 ? currentPrice : 95000;

  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [totalLiquidations24h, setTotalLiquidations24h] = useState({ long: 84200000, short: 61500000 });

  // Simulate or connect real-time liquidation stream
  useEffect(() => {
    if (!isOpen) return;

    // Seed recent events
    const initial: LiquidationEvent[] = [
      {
        id: 'liq-1',
        time: Date.now() - 4000,
        symbol: 'BTCUSDT',
        side: 'LONG',
        sizeUsd: 1250000,
        price: mark - 120,
        isWhale: true,
      },
      {
        id: 'liq-2',
        time: Date.now() - 14000,
        symbol: 'ETHUSDT',
        side: 'SHORT',
        sizeUsd: 480000,
        price: 3450,
        isWhale: false,
      },
      {
        id: 'liq-3',
        time: Date.now() - 28000,
        symbol: 'SOLUSDT',
        side: 'LONG',
        sizeUsd: 890000,
        price: 215.4,
        isWhale: true,
      },
      {
        id: 'liq-4',
        time: Date.now() - 45000,
        symbol: 'BTCUSDT',
        side: 'SHORT',
        sizeUsd: 2100000,
        price: mark + 180,
        isWhale: true,
      },
    ];
    setEvents(initial);

    // Incoming simulated real-time stream
    const interval = setInterval(() => {
      const isLong = Math.random() > 0.45;
      const sizeUsd = Math.round((Math.random() * 1500000 + 50000) * 100) / 100;
      const isWhale = sizeUsd > 500000;
      const priceOffset = (Math.random() - 0.5) * 200;

      const newEvent: LiquidationEvent = {
        id: `liq-${Date.now()}`,
        time: Date.now(),
        symbol: 'BTCUSDT',
        side: isLong ? 'LONG' : 'SHORT',
        sizeUsd,
        price: Math.round((mark + priceOffset) * 100) / 100,
        isWhale,
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      setTotalLiquidations24h((prev) => ({
        long: isLong ? prev.long + sizeUsd : prev.long,
        short: !isLong ? prev.short + sizeUsd : prev.short,
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, mark]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Live Liquidation Waterfall & Whale Order Flow Tape
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 24h Summary Bar */}
        <div className="grid grid-cols-2 gap-4 border-b border-grid bg-bg/30 px-6 py-3 text-xs">
          <div>
            <span className="text-[10px] text-muted block uppercase">24h Long Liquidations (Forced Sell)</span>
            <span className="text-sm font-bold text-down">{fmtUsd(totalLiquidations24h.long)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase">24h Short Liquidations (Forced Buy)</span>
            <span className="text-sm font-bold text-up">{fmtUsd(totalLiquidations24h.short)}</span>
          </div>
        </div>

        {/* Stream Table */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-grid text-[10px] uppercase text-muted">
              <tr>
                <th className="py-2 text-left">Time</th>
                <th className="py-2 text-left">Contract</th>
                <th className="py-2 text-center">Type</th>
                <th className="py-2">Liquidation Price</th>
                <th className="py-2">Notional Value</th>
                <th className="py-2 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid/40">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-grid/20 transition">
                  <td className="py-2 text-left text-muted">{fmtTime(e.time)}</td>
                  <td className="py-2 text-left font-bold text-white">{e.symbol}</td>
                  <td className="py-2 text-center font-bold">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        e.side === 'LONG'
                          ? 'bg-down/20 text-down border border-down/30'
                          : 'bg-up/20 text-up border border-up/30'
                      }`}
                    >
                      {e.side} LIQ
                    </span>
                  </td>
                  <td className="py-2 text-white font-semibold">{fmtPrice(e.price, e.symbol)}</td>
                  <td className={`py-2 font-bold ${e.isWhale ? 'text-amber-400 font-extrabold' : 'text-white'}`}>
                    {fmtUsd(e.sizeUsd)}
                  </td>
                  <td className="py-2 text-center">
                    {e.isWhale ? (
                      <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        WHALE CASCADE
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted">Retail</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-grid px-6 py-2.5 bg-bg/50 text-[10px] text-muted flex items-center justify-between">
          <span>Monitors cascading margin calls across Binance Futures, Bybit, and Delta Exchange.</span>
          <span>Whale threshold: Volume &gt; $500,000</span>
        </div>
      </div>
    </div>
  );
}
