import React, { useEffect, useState } from 'react';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { generateDOMSnapshot, generateFootprintCandle } from '../../services/footprintMath';
import { fmtPrice, fmtQty, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

export default function FootprintDOM() {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const candles = useTerminalStore((s) => s.candles);

  const domLevels = useDerivativesStore((s) => s.domLevels);
  const setDomLevels = useDerivativesStore((s) => s.setDomLevels);
  const footprintCandles = useDerivativesStore((s) => s.footprintCandles);
  const setFootprintCandles = useDerivativesStore((s) => s.setFootprintCandles);
  const isDomVisible = useDerivativesStore((s) => s.isDomVisible);
  const isFootprintVisible = useDerivativesStore((s) => s.isFootprintVisible);
  const toggleDom = useDerivativesStore((s) => s.toggleDom);
  const toggleFootprint = useDerivativesStore((s) => s.toggleFootprint);

  const [activeTab, setActiveTab] = useState<'DOM' | 'FOOTPRINT' | 'HEATMAP'>('DOM');

  // Generate DOM levels when price updates
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    const levels = generateDOMSnapshot(currentPrice, 0.5, 10);
    setDomLevels(levels);
  }, [currentPrice, setDomLevels]);

  // Generate footprint candles from latest candles
  useEffect(() => {
    if (!candles.length) return;
    const latest = candles.slice(-5).map((c) => generateFootprintCandle(c, 7));
    setFootprintCandles(latest);
  }, [candles, setFootprintCandles]);

  if (!isDomVisible && !isFootprintVisible) return null;

  const latestFootprint = footprintCandles[footprintCandles.length - 1];
  const maxDomSize = Math.max(...domLevels.map((l) => Math.max(l.bidSize, l.askSize)), 1);

  // Total Bid vs Ask depth for Heatmap imbalance
  const totalBids = domLevels.reduce((a, l) => a + l.bidSize, 0);
  const totalAsks = domLevels.reduce((a, l) => a + l.askSize, 0);
  const bidRatio = totalBids + totalAsks > 0 ? Math.round((totalBids / (totalBids + totalAsks)) * 100) : 50;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-grid bg-panel font-mono text-xs select-none">
      {/* Top Header / View Toggle */}
      <div className="flex items-center justify-between border-b border-grid px-3 py-2 bg-bg/50">
        <div className="flex items-center gap-1">
          {(['DOM', 'FOOTPRINT', 'HEATMAP'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                audioHaptics.tick();
                setActiveTab(t);
              }}
              className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                activeTab === t ? 'bg-accent text-black font-extrabold' : 'text-muted hover:text-white'
              }`}
            >
              {t === 'DOM' ? 'DOM' : t === 'FOOTPRINT' ? 'Footprint' : 'Heatmap'}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            audioHaptics.tick();
            if (isDomVisible) toggleDom();
            if (isFootprintVisible) toggleFootprint();
          }}
          className="text-muted hover:text-white"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* TAB 1: DOM LADDER */}
        {activeTab === 'DOM' && (
          <div>
            <div className="grid grid-cols-3 border-b border-grid px-2 py-1 text-[10px] text-muted uppercase">
              <span>Bid Size</span>
              <span className="text-center">Price</span>
              <span className="text-right">Ask Size</span>
            </div>

            <div className="divide-y divide-grid/40">
              {domLevels.map((lvl, idx) => {
                const isMid = Math.abs(lvl.price - currentPrice) < (lvl.price * 0.0005);
                const bidPct = (lvl.bidSize / maxDomSize) * 100;
                const askPct = (lvl.askSize / maxDomSize) * 100;

                return (
                  <div
                    key={idx}
                    className={`relative grid grid-cols-3 px-2 py-1 text-[11px] ${
                      isMid ? 'bg-accent/20 font-bold' : 'hover:bg-grid/20'
                    }`}
                  >
                    {/* Bid Depth background bar */}
                    {lvl.bidSize > 0 && (
                      <div
                        style={{ width: `${bidPct}%` }}
                        className="pointer-events-none absolute left-0 top-0 bottom-0 bg-up/20"
                      />
                    )}

                    {/* Ask Depth background bar */}
                    {lvl.askSize > 0 && (
                      <div
                        style={{ width: `${askPct}%` }}
                        className="pointer-events-none absolute right-0 top-0 bottom-0 bg-down/20"
                      />
                    )}

                    <span className="relative z-10 text-up font-semibold">
                      {lvl.bidSize > 0 ? fmtQty(lvl.bidSize) : ''}
                    </span>

                    <span className="relative z-10 text-center text-white">
                      {fmtPrice(lvl.price, symbol)}
                    </span>

                    <span className="relative z-10 text-right text-down font-semibold">
                      {lvl.askSize > 0 ? fmtQty(lvl.askSize) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: FOOTPRINT & POC */}
        {activeTab === 'FOOTPRINT' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-grid pb-2">
              <span className="text-muted text-[11px]">Active Session Bar POC</span>
              <span className="font-bold text-yellow-400">
                {latestFootprint ? fmtPrice(latestFootprint.pointOfControl, symbol) : '---'}
              </span>
            </div>

            {latestFootprint ? (
              <div className="space-y-1.5">
                {latestFootprint.priceLevels.map((node, i) => {
                  const isPOC = Math.abs(node.price - latestFootprint.pointOfControl) < 0.01;
                  const deltaPositive = node.delta >= 0;

                  return (
                    <div
                      key={i}
                      className={`rounded border p-1.5 ${
                        isPOC
                          ? 'border-yellow-400/80 bg-yellow-500/10'
                          : 'border-grid bg-bg/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">{fmtPrice(node.price, symbol)}</span>
                        <span className={`text-[10px] font-semibold ${deltaPositive ? 'text-up' : 'text-down'}`}>
                          Delta {deltaPositive ? `+${node.delta}` : node.delta}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
                        <span className="text-up">Bid: {node.bidVolume}</span>
                        <span className="text-down">Ask: {node.askVolume}</span>
                        <span>Vol: {node.bidVolume + node.askVolume}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted py-6">Waiting for volume footprint data...</p>
            )}
          </div>
        )}

        {/* TAB 3: ORDERFLOW LIQUIDITY HEATMAP */}
        {activeTab === 'HEATMAP' && (
          <div className="p-3 space-y-3">
            {/* Liquidity Imbalance Ratio Gauge */}
            <div className="rounded-xl border border-grid bg-slate-900/60 p-2.5 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-up font-bold">Bids {bidRatio}%</span>
                <span className="text-muted">Orderflow Ratio</span>
                <span className="text-down font-bold">Asks {100 - bidRatio}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${bidRatio}%` }} className="h-full bg-up transition-all duration-300" />
                <div style={{ width: `${100 - bidRatio}%` }} className="h-full bg-down transition-all duration-300" />
              </div>
              <span className="text-[10px] text-muted block text-center">
                {bidRatio > 55 ? 'Aggressive Bid Absorption' : bidRatio < 45 ? 'Heavy Ask Wall Resistance' : 'Balanced Two-Sided Liquidity'}
              </span>
            </div>

            {/* Depth Heatmap Grid */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Limit Liquidity Heat Spectrum
              </span>

              {domLevels.map((lvl, idx) => {
                const totalVol = lvl.bidSize + lvl.askSize;
                const heatRatio = totalVol / (maxDomSize * 1.5);
                const isWhaleWall = heatRatio > 0.65;
                const isModerate = heatRatio > 0.35;

                return (
                  <div
                    key={idx}
                    className={`rounded border px-2 py-1.5 transition ${
                      isWhaleWall
                        ? 'border-rose-500/60 bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40'
                        : isModerate
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-grid/60 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-white">{fmtPrice(lvl.price, symbol)}</span>
                      <span className="font-mono text-[10px] font-semibold">
                        {fmtQty(totalVol)} contracts
                      </span>
                      {isWhaleWall && (
                        <span className="rounded bg-rose-500 px-1 text-[9px] font-extrabold text-black uppercase">
                          Whale Wall
                        </span>
                      )}
                    </div>

                    {/* Heat intensity bar */}
                    <div className="mt-1 h-1 w-full bg-slate-800/80 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.round(heatRatio * 100))}%` }}
                        className={`h-full ${
                          isWhaleWall ? 'bg-gradient-to-r from-amber-400 to-rose-500' : isModerate ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-grid px-3 py-2 text-[10px] text-muted bg-bg/40">
        Live Stream: <span className="text-white">Active Orderflow Depth Engine</span>
      </div>
    </div>
  );
}
