/**
 * Institutional Depth of Market (DOM) Price Ladder & Order Flow Matrix.
 * Features:
 * - Real-time Bid/Ask depth with heatmap bars
 * - 1-Click Limit Order placement on price rows (Click Bid = Buy Limit, Click Ask = Sell Limit)
 * - Live Pending Order badges with 1-click cancel on the ladder
 * - Active Position Entry marker and live unrealized PnL
 * - Fast Execution Toolbar: Market Buy, Market Sell, Cancel All, Flatten, Reverse
 * - Auto-centering on current price
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { generateDOMSnapshot, generateFootprintCandle } from '../../services/footprintMath';
import { fmtPrice, fmtQty, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

export default function FootprintDOM() {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const candles = useTerminalStore((s) => s.candles);
  const positions = useTerminalStore((s) => s.positions);
  const orders = useTerminalStore((s) => s.orders);
  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const cancelOrder = useTerminalStore((s) => s.cancelOrder);
  const closePosition = useTerminalStore((s) => s.closePosition);
  const flipPosition = useTerminalStore((s) => s.flipPosition);

  const domLevels = useDerivativesStore((s) => s.domLevels);
  const setDomLevels = useDerivativesStore((s) => s.setDomLevels);
  const footprintCandles = useDerivativesStore((s) => s.footprintCandles);
  const setFootprintCandles = useDerivativesStore((s) => s.setFootprintCandles);
  const isDomVisible = useDerivativesStore((s) => s.isDomVisible);
  const isFootprintVisible = useDerivativesStore((s) => s.isFootprintVisible);
  const toggleDom = useDerivativesStore((s) => s.toggleDom);
  const toggleFootprint = useDerivativesStore((s) => s.toggleFootprint);

  const [activeTab, setActiveTab] = useState<'DOM' | 'FOOTPRINT' | 'HEATMAP'>('DOM');
  const [orderQty, setOrderQty] = useState<number>(0.1);
  const ladderRef = useRef<HTMLDivElement>(null);
  const [autoCenter, setAutoCenter] = useState<boolean>(true);

  // Generate DOM levels when price updates
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    const levels = generateDOMSnapshot(currentPrice, 0.5, 12);
    setDomLevels(levels);
  }, [currentPrice, setDomLevels]);

  // Generate footprint candles from latest candles
  useEffect(() => {
    if (!candles.length) return;
    const latest = candles.slice(-5).map((c) => generateFootprintCandle(c, 7));
    setFootprintCandles(latest);
  }, [candles, setFootprintCandles]);

  // Auto center scroll on active row
  useEffect(() => {
    if (autoCenter && ladderRef.current) {
      const midEl = ladderRef.current.querySelector('[data-mid="true"]');
      if (midEl) {
        midEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [currentPrice, autoCenter]);

  const currentPos = positions[symbol];
  const pendingOrders = orders.filter((o) => o.symbol === symbol && o.status === 'PENDING');
  const latestFootprint = footprintCandles[footprintCandles.length - 1];
  const maxDomSize = Math.max(...domLevels.map((l) => Math.max(l.bidSize, l.askSize)), 1);

  // Total Bid vs Ask depth for Heatmap imbalance
  const totalBids = domLevels.reduce((a, l) => a + l.bidSize, 0);
  const totalAsks = domLevels.reduce((a, l) => a + l.askSize, 0);
  const bidRatio = totalBids + totalAsks > 0 ? Math.round((totalBids / (totalBids + totalAsks)) * 100) : 50;

  const handlePlaceLimit = (side: 'BUY' | 'SELL', price: number) => {
    audioHaptics.tick();
    placeOrder({
      symbol,
      side,
      type: 'LIMIT',
      price,
      qty: orderQty,
      leverage: 10,
    });
  };

  const handleMarketBuy = () => {
    audioHaptics.tick();
    placeOrder({
      symbol,
      side: 'BUY',
      type: 'MARKET',
      price: currentPrice,
      qty: orderQty,
      leverage: 10,
    });
  };

  const handleMarketSell = () => {
    audioHaptics.tick();
    placeOrder({
      symbol,
      side: 'SELL',
      type: 'MARKET',
      price: currentPrice,
      qty: orderQty,
      leverage: 10,
    });
  };

  const handleCancelAll = () => {
    audioHaptics.tick();
    for (const o of pendingOrders) {
      cancelOrder(o.id);
    }
  };

  const handleFlatten = () => {
    audioHaptics.tick();
    if (currentPos) {
      closePosition(symbol);
    }
    handleCancelAll();
  };

  const handleReverse = () => {
    audioHaptics.tick();
    if (currentPos) {
      flipPosition(symbol);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-panel font-mono text-xs select-none shadow-2xl">
      {/* Top Header / View Toggle */}
      <div className="flex items-center justify-between border-b border-grid/50 px-3 py-2 bg-[#09090d]/60">
        <div className="flex items-center gap-1.5">
          {(['DOM', 'FOOTPRINT', 'HEATMAP'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                audioHaptics.tick();
                setActiveTab(t);
              }}
              className={`px-3 py-1 text-[11px] font-bold transition ${
                activeTab === t ? 'clay-pill-active font-extrabold' : 'clay-pill text-muted hover:text-white'
              }`}
            >
              {t === 'DOM' ? 'DOM Ladder' : t === 'FOOTPRINT' ? 'Footprint' : 'Heatmap'}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            audioHaptics.tick();
            useDrawingStore.getState().setActiveRightDrawer(null);
            if (isDomVisible) toggleDom();
            if (isFootprintVisible) toggleFootprint();
          }}
          className="clay-btn h-7 w-7 text-muted hover:text-white"
          aria-label="Close"
          title="Close Sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Quick Order Qty Strip */}
      <div className="flex items-center justify-between border-b border-grid/50 px-3 py-1.5 bg-[#09090d]/40 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-muted text-[10px]">Qty:</span>
          <input
            type="number"
            step="0.01"
            min="0.001"
            value={orderQty}
            onChange={(e) => setOrderQty(Math.max(0.001, parseFloat(e.target.value) || 0.1))}
            className="w-16 clay-inset px-1.5 py-0.5 text-center font-bold text-white focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {[0.01, 0.05, 0.1, 0.5, 1.0].map((q) => (
            <button
              key={q}
              onClick={() => {
                audioHaptics.tick();
                setOrderQty(q);
              }}
              className={`px-2 py-0.5 text-[10px] transition ${
                orderQty === q ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Active Position HUD Banner */}
      {currentPos && (
        <div className="flex items-center justify-between border-b border-grid bg-slate-900/80 px-3 py-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${currentPos.side === 'LONG' ? 'bg-up' : 'bg-down'}`} />
            <span className="font-bold text-white">{currentPos.side} {fmtQty(currentPos.size)}</span>
            <span className="text-slate-400">@ {fmtPrice(currentPos.entryPrice, symbol)}</span>
          </div>
          <span className={`font-bold ${currentPos.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
            {currentPos.unrealizedPnl >= 0 ? `+$${currentPos.unrealizedPnl.toFixed(2)}` : `-$${Math.abs(currentPos.unrealizedPnl).toFixed(2)}`}
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div ref={ladderRef} className="min-h-0 flex-1 overflow-y-auto">
        {/* TAB 1: INTERACTIVE DOM LADDER */}
        {activeTab === 'DOM' && (
          <div>
            {/* Table Header */}
            <div className="sticky top-0 z-20 grid grid-cols-3 border-b border-grid bg-panel/95 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider backdrop-blur-sm">
              <span className="text-left">Bid (Buy)</span>
              <span className="text-center">Price</span>
              <span className="text-right">Ask (Sell)</span>
            </div>

            {/* Price Rows */}
            <div className="divide-y divide-grid/30">
              {domLevels.map((lvl, idx) => {
                const isMid = Math.abs(lvl.price - currentPrice) < (lvl.price * 0.0003);
                const bidPct = Math.min(100, (lvl.bidSize / maxDomSize) * 100);
                const askPct = Math.min(100, (lvl.askSize / maxDomSize) * 100);

                // Check if any pending orders at this level
                const pendingAtPrice = pendingOrders.filter(
                  (o) => Math.abs((o.price ?? 0) - lvl.price) < (lvl.price * 0.0003)
                );

                // Check if position entry is near this level
                const isPositionEntry = currentPos && Math.abs(currentPos.entryPrice - lvl.price) < (lvl.price * 0.0003);

                return (
                  <div
                    key={idx}
                    data-mid={isMid ? 'true' : 'false'}
                    className={`group relative grid grid-cols-3 items-center px-2 py-1 text-[11px] transition cursor-pointer select-none ${
                      isMid ? 'bg-accent/15 font-bold ring-1 ring-accent/30' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Bid Column (Click to Buy Limit) */}
                    <div
                      onClick={() => handlePlaceLimit('BUY', lvl.price)}
                      className="relative z-10 flex items-center justify-start h-full py-0.5 group/bid"
                      title={`Click to BUY ${orderQty} @ ${fmtPrice(lvl.price, symbol)}`}
                    >
                      {/* Bid Depth Bar */}
                      {lvl.bidSize > 0 && (
                        <div
                          style={{ width: `${bidPct}%` }}
                          className="pointer-events-none absolute left-0 top-0 bottom-0 bg-up/20 transition-all"
                        />
                      )}
                      <span className="relative text-up font-semibold group-hover/bid:underline">
                        {lvl.bidSize > 0 ? fmtQty(lvl.bidSize) : ''}
                      </span>
                      <span className="hidden group-hover/bid:inline-block ml-1 text-[9px] text-accent font-bold">
                        [+BUY]
                      </span>
                    </div>

                    {/* Price Column */}
                    <div className="relative z-10 flex items-center justify-center gap-1">
                      <span className={`text-center font-bold ${isMid ? 'text-accent' : 'text-white'}`}>
                        {fmtPrice(lvl.price, symbol)}
                      </span>
                      {isPositionEntry && (
                        <span className="rounded bg-accent/20 px-1 py-0.2 text-[8px] font-bold text-accent">
                          POS
                        </span>
                      )}
                    </div>

                    {/* Ask Column (Click to Sell Limit) */}
                    <div
                      onClick={() => handlePlaceLimit('SELL', lvl.price)}
                      className="relative z-10 flex items-center justify-end h-full py-0.5 group/ask"
                      title={`Click to SELL ${orderQty} @ ${fmtPrice(lvl.price, symbol)}`}
                    >
                      {/* Ask Depth Bar */}
                      {lvl.askSize > 0 && (
                        <div
                          style={{ width: `${askPct}%` }}
                          className="pointer-events-none absolute right-0 top-0 bottom-0 bg-down/20 transition-all"
                        />
                      )}
                      <span className="hidden group-hover/ask:inline-block mr-1 text-[9px] text-rose-400 font-bold">
                        [+SELL]
                      </span>
                      <span className="relative text-down font-semibold group-hover/ask:underline">
                        {lvl.askSize > 0 ? fmtQty(lvl.askSize) : ''}
                      </span>
                    </div>

                    {/* Pending Order Tag on this Price Level */}
                    {pendingAtPrice.length > 0 && (
                      <div className="absolute right-1 top-0.5 z-20 flex items-center gap-1 rounded bg-amber-500/90 px-1 py-0.2 text-[9px] font-bold text-black shadow-sm">
                        <span>{pendingAtPrice[0].side} {pendingAtPrice[0].qty}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            audioHaptics.tick();
                            cancelOrder(pendingAtPrice[0].id);
                          }}
                          className="ml-0.5 hover:text-white"
                          title="Cancel Order"
                        >
                          [x]
                        </button>
                      </div>
                    )}
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
              <span className="text-slate-400 text-[11px]">Active Bar POC</span>
              <span className="font-bold text-amber-400">
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
                      className={`rounded-lg border p-1.5 transition ${
                        isPOC
                          ? 'border-amber-400/80 bg-amber-500/10'
                          : 'border-grid bg-bg/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">{fmtPrice(node.price, symbol)}</span>
                        <span className={`text-[10px] font-semibold ${deltaPositive ? 'text-up' : 'text-down'}`}>
                          Delta {deltaPositive ? `+${node.delta}` : node.delta}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="text-up">Bid: {node.bidVolume}</span>
                        <span className="text-down">Ask: {node.askVolume}</span>
                        <span>Vol: {node.bidVolume + node.askVolume}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-slate-400 py-6">Waiting for volume footprint data...</p>
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
                <span className="text-slate-400">Orderflow Ratio</span>
                <span className="text-down font-bold">Asks {100 - bidRatio}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${bidRatio}%` }} className="h-full bg-up transition-all duration-300" />
                <div style={{ width: `${100 - bidRatio}%` }} className="h-full bg-down transition-all duration-300" />
              </div>
              <span className="text-[10px] text-slate-400 block text-center">
                {bidRatio > 55 ? 'Aggressive Bid Absorption' : bidRatio < 45 ? 'Heavy Ask Wall Resistance' : 'Balanced Two-Sided Liquidity'}
              </span>
            </div>

            {/* Depth Heatmap Grid */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
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
                    className={`rounded-lg border px-2 py-1.5 transition ${
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

      {/* Fast Execution Bottom Action Strip */}
      <div className="border-t border-grid/50 bg-[#09090d]/80 p-2 space-y-1.5 shadow-lg">
        {/* Market Buy / Sell Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleMarketBuy}
            className="flex items-center justify-center gap-1 clay-pill-active px-3 py-2 font-bold active:scale-95 transition text-xs"
          >
            <span>BUY MKT</span>
            <span className="text-[10px] opacity-70">({orderQty})</span>
          </button>
          <button
            onClick={handleMarketSell}
            className="flex items-center justify-center gap-1 clay-card border-zinc-600 px-3 py-2 font-bold text-white active:scale-95 transition text-xs"
          >
            <span>SELL MKT</span>
            <span className="text-[10px] text-muted">({orderQty})</span>
          </button>
        </div>

        {/* Position Management Tools: Flatten, Reverse, Cancel All */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <button
            onClick={handleFlatten}
            className="clay-btn py-1 font-bold text-white hover:text-zinc-300 transition"
            title="Flatten: Close position immediately at market & cancel orders"
          >
            Flatten
          </button>
          <button
            onClick={handleReverse}
            className="clay-btn py-1 font-bold text-white hover:text-zinc-300 transition"
            title="Reverse: Flip active position to opposite direction"
          >
            Reverse
          </button>
          <button
            onClick={handleCancelAll}
            className="clay-btn py-1 font-semibold text-muted hover:text-white transition"
            title="Cancel All: Cancel all pending orders for this symbol"
          >
            Cancel ({pendingOrders.length})
          </button>
        </div>

        {/* Auto Center Toggle */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCenter}
              onChange={(e) => setAutoCenter(e.target.checked)}
              className="rounded border-grid text-accent focus:ring-0 h-3 w-3"
            />
            <span>Auto-Center Price</span>
          </label>
          <button
            onClick={() => {
              audioHaptics.tick();
              if (ladderRef.current) {
                const midEl = ladderRef.current.querySelector('[data-mid="true"]');
                midEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }}
            className="text-accent hover:underline"
          >
            Center Now
          </button>
        </div>
      </div>
    </div>
  );
}
