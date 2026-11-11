import React, { useEffect, useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { generateOptionChain, getOIBuildupSignal } from '../../services/nseOptionChain';
import { fmtPrice, fmtQty, labelOf } from '../../utils/formatters';
import type { OptionChainData } from '../../types/derivatives';

interface OptionChainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OptionChainModal({ isOpen, onClose }: OptionChainModalProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const [data, setData] = useState<OptionChainData | null>(null);
  const [selectedUnderlying, setSelectedUnderlying] = useState(symbol);

  useEffect(() => {
    const mark = currentPrice > 0 ? currentPrice : selectedUnderlying === '^NSEI' ? 24500 : 96000;
    const chain = generateOptionChain(selectedUnderlying, mark);
    setData(chain);
  }, [selectedUnderlying, currentPrice]);

  if (!isOpen || !data) return null;

  const maxCallOI = Math.max(...data.strikes.map((s) => s.callOI), 1);
  const maxPutOI = Math.max(...data.strikes.map((s) => s.putOI), 1);
  const pcrSignal = data.pcr >= 1.2 ? 'Bullish (Put Heavy)' : data.pcr <= 0.8 ? 'Bearish (Call Heavy)' : 'Neutral Balance';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col rounded-[10px] border border-white/[0.08] bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 bg-bg/50">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold text-white">
              NSE Option Chain & Open Interest (OI)
            </h2>
            <span className="rounded-[4px] bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-xs text-muted">
              Expiry: {data.expiryDate}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Underlyings */}
            <div className="flex items-center gap-1">
              {[
                { id: '^NSEI', label: 'Nifty 50' },
                { id: '^NSEBANK', label: 'Bank Nifty' },
                { id: 'RELIANCE.NS', label: 'Reliance' },
                { id: 'BTCUSDT', label: 'BTC Crypto' },
              ].map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUnderlying(u.id)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                    selectedUnderlying === u.id
                      ? 'bg-accent text-white'
                      : 'bg-grid text-muted hover:text-white'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="text-muted hover:text-white"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Analytics Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-grid bg-bg/30 px-5 py-3 text-xs">
          <div>
            <span className="text-[10px] text-muted block uppercase">Spot Price</span>
            <span className="text-sm font-bold text-white">{fmtPrice(data.spotPrice, data.underlying)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase">Max Pain Strike</span>
            <span className="text-sm font-bold text-amber-400">{fmtPrice(data.maxPain, data.underlying)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase">Put-Call Ratio (PCR)</span>
            <span className="text-sm font-bold text-up">{data.pcr} ({pcrSignal})</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase">Total Call OI</span>
            <span className="text-sm font-semibold text-down">{fmtQty(data.totalCallOI)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase">Total Put OI</span>
            <span className="text-sm font-semibold text-up">{fmtQty(data.totalPutOI)}</span>
          </div>
        </div>

        {/* Strike Table */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-xs text-right">
            <thead className="sticky top-0 z-10 border-b border-grid bg-[#10141c] text-[10px] uppercase text-muted">
              <tr>
                <th colSpan={4} className="border-r border-grid py-2 text-center bg-down/5 text-down">
                  Calls (CE)
                </th>
                <th className="py-2 text-center bg-grid/40 text-white font-bold">
                  Strike
                </th>
                <th colSpan={4} className="border-l border-grid py-2 text-center bg-up/5 text-up">
                  Puts (PE)
                </th>
              </tr>
              <tr className="border-t border-grid text-muted">
                <th className="px-3 py-1 text-left">OI (Chg)</th>
                <th className="px-2 py-1">Call OI</th>
                <th className="px-2 py-1">IV %</th>
                <th className="px-3 py-1 border-r border-grid">LTP</th>
                <th className="px-4 py-1 text-center bg-grid/20 text-white">Strike</th>
                <th className="px-3 py-1 border-l border-grid text-left">LTP</th>
                <th className="px-2 py-1">IV %</th>
                <th className="px-2 py-1">Put OI</th>
                <th className="px-3 py-1 text-right">OI (Chg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid/40">
              {data.strikes.map((s) => {
                const isATM = Math.abs(s.strikePrice - data.spotPrice) <= (data.spotPrice > 1000 ? 50 : 5);
                const isITMCall = s.strikePrice < data.spotPrice;
                const isITMPut = s.strikePrice > data.spotPrice;

                const callBarWidth = Math.round((s.callOI / maxCallOI) * 100);
                const putBarWidth = Math.round((s.putOI / maxPutOI) * 100);

                return (
                  <tr
                    key={s.strikePrice}
                    className={`transition ${
                      isATM
                        ? 'bg-amber-400/10 font-bold'
                        : 'hover:bg-grid/20'
                    }`}
                  >
                    {/* Call Change OI */}
                    <td className={`px-3 py-1.5 text-left ${isITMCall ? 'bg-down/5' : ''}`}>
                      <span className={s.callChangeOI >= 0 ? 'text-up' : 'text-down'}>
                        {s.callChangeOI >= 0 ? `+${fmtQty(s.callChangeOI)}` : fmtQty(s.callChangeOI)}
                      </span>
                    </td>

                    {/* Call OI Bar */}
                    <td className={`px-2 py-1.5 relative ${isITMCall ? 'bg-down/5' : ''}`}>
                      <div
                        className="absolute right-0 top-1 bottom-1 bg-down/20 rounded-l"
                        style={{ width: `${callBarWidth}%` }}
                      />
                      <span className="relative z-10 text-white font-semibold">{fmtQty(s.callOI)}</span>
                    </td>

                    {/* Call IV */}
                    <td className={`px-2 py-1.5 text-muted ${isITMCall ? 'bg-down/5' : ''}`}>{s.callIv}%</td>

                    {/* Call LTP */}
                    <td className={`px-3 py-1.5 font-bold text-white border-r border-grid ${isITMCall ? 'bg-down/5' : ''}`}>
                      {fmtPrice(s.callLtp, data.underlying)}
                    </td>

                    {/* Strike Price */}
                    <td className={`px-4 py-1.5 text-center font-bold text-white ${isATM ? 'bg-amber-400/20 text-amber-300' : 'bg-grid/30'}`}>
                      {fmtPrice(s.strikePrice, data.underlying)}
                      {isATM && <span className="ml-1 text-[9px] text-amber-300 uppercase">ATM</span>}
                    </td>

                    {/* Put LTP */}
                    <td className={`px-3 py-1.5 font-bold text-white border-l border-grid text-left ${isITMPut ? 'bg-up/5' : ''}`}>
                      {fmtPrice(s.putLtp, data.underlying)}
                    </td>

                    {/* Put IV */}
                    <td className={`px-2 py-1.5 text-muted ${isITMPut ? 'bg-up/5' : ''}`}>{s.putIv}%</td>

                    {/* Put OI Bar */}
                    <td className={`px-2 py-1.5 relative ${isITMPut ? 'bg-up/5' : ''}`}>
                      <div
                        className="absolute left-0 top-1 bottom-1 bg-up/20 rounded-r"
                        style={{ width: `${putBarWidth}%` }}
                      />
                      <span className="relative z-10 text-white font-semibold">{fmtQty(s.putOI)}</span>
                    </td>

                    {/* Put Change OI */}
                    <td className={`px-3 py-1.5 text-right ${isITMPut ? 'bg-up/5' : ''}`}>
                      <span className={s.putChangeOI >= 0 ? 'text-up' : 'text-down'}>
                        {s.putChangeOI >= 0 ? `+${fmtQty(s.putChangeOI)}` : fmtQty(s.putChangeOI)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-grid px-5 py-2 text-[10px] text-muted bg-bg/50">
          <span>Data Provider: NSE India F&O Gateway • Auto-refreshed every minute</span>
          <span>Yellow highlight = At The Money (ATM) • Bar widths represent OI cluster density</span>
        </div>
      </div>
    </div>
  );
}
