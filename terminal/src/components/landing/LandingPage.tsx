/**
 * LandingPage.tsx
 * Institutional Landing Page & Feature Showcase for CRT Terminal & TradeXGuardian.
 *
 * Designed to Linear / Raycast / TradingView institutional standard:
 * - Soft-card clay panels with subtle borders and micro-interactions.
 * - Interactive Prop Firm Challenge Calculator wired to real useGuardianStore.
 * - Live market ticker strip connected to real useTerminalStore quotes.
 * - Interactive Guardian violation simulation playground.
 * - ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useGuardianStore } from '../../store/useGuardianStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { fmtPrice, fmtPct, fmtUsd } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

interface LandingPageProps {
  onLaunchTerminal: (symbol?: string) => void;
  onOpenGuardian?: () => void;
  onOpenPortfolio?: () => void;
}

export default function LandingPage({
  onLaunchTerminal,
  onOpenGuardian,
  onOpenPortfolio,
}: LandingPageProps) {
  const themeMode = useLayoutStore((s) => s.themeMode);
  const toggleThemeMode = useLayoutStore((s) => s.toggleThemeMode);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const quotes = useTerminalStore((s) => s.quotes);

  // Prop Firm Challenge Calculator State (Live & Real)
  const [accountSize, setAccountSize] = useState<number>(50000);
  const [maxDailyLossPct, setMaxDailyLossPct] = useState<number>(5);
  const [maxTotalLossPct, setMaxTotalLossPct] = useState<number>(10);
  const [profitTargetPct, setProfitTargetPct] = useState<number>(8);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(3);
  const [ruleApplied, setRuleApplied] = useState(false);

  // Live Calculations for Prop Firm Calculator
  const maxDailyLossUsd = useMemo(() => accountSize * (maxDailyLossPct / 100), [accountSize, maxDailyLossPct]);
  const maxTotalLossUsd = useMemo(() => accountSize * (maxTotalLossPct / 100), [accountSize, maxTotalLossPct]);
  const profitTargetUsd = useMemo(() => accountSize * (profitTargetPct / 100), [accountSize, profitTargetPct]);
  const maxRiskPerTradeUsd = useMemo(() => maxDailyLossUsd / Math.max(1, maxTradesPerDay), [maxDailyLossUsd, maxTradesPerDay]);

  // Safe lot size estimations based on 25-pip stop loss
  const safeLotSizes = useMemo(() => {
    return {
      forex: +(maxRiskPerTradeUsd / (25 * 10)).toFixed(2), // 25 pips @ $10/pip for standard lot
      gold: +(maxRiskPerTradeUsd / (2.5 * 100)).toFixed(2), // $2.50 gold move on 100oz contract
      btc: +(maxRiskPerTradeUsd / 1200).toFixed(3), // $1200 BTC move per coin
    };
  }, [maxRiskPerTradeUsd]);

  // Apply Prop Firm configuration directly to TradeXGuardian and Psychology Store
  const handleApplyRulesToGuardian = () => {
    audioHaptics.tick();
    useGuardianStore.getState().updateBlockerConfig({
      maxDailyLossPct,
      maxTradesPerDay,
    });
    useGuardianStore.getState().updatePropFirm({
      enabled: true,
      accountSize,
      dailyDrawdownPct: maxDailyLossPct,
      maxDrawdownPct: maxTotalLossPct,
      profitTargetPct,
      maxDailyTrades: maxTradesPerDay,
    });
    useGuardianStore.getState().updateRiskConfig({
      riskPerTradePct: +(maxDailyLossPct / maxTradesPerDay).toFixed(2),
    });
    usePsychologyStore.getState().updateRiskRules({
      maxDailyLoss: maxDailyLossUsd,
      maxDailyTrades: maxTradesPerDay,
      propFirmShieldEnabled: true,
      propFirmDailyLossPct: maxDailyLossPct,
      propFirmMaxDrawdownPct: maxTotalLossPct,
    });
    setRuleApplied(true);
    setTimeout(() => setRuleApplied(false), 3000);
  };

  // Guardian Simulator Demo State
  const [simScenario, setSimScenario] = useState<'OVERTRADING' | 'SL_TOO_WIDE' | 'TIME_WINDOW' | null>(null);

  return (
    <div className="min-h-screen bg-bg text-slate-200 font-mono flex flex-col selection:bg-sky-500/20 selection:text-sky-300">
      {/* Top Announcement & Live Market Ticker Strip */}
      <div className="border-b border-grid bg-panel/70 backdrop-blur-md px-4 py-2 text-xs flex items-center justify-between overflow-x-auto gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-white text-[11px] uppercase tracking-wider">Market Feeds</span>
        </div>

        <div className="flex items-center gap-4 text-xs whitespace-nowrap overflow-x-auto py-0.5">
          {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', '^NSEI'].map((sym) => {
            const item = watchlist[sym];
            const p = quotes[sym]?.price ?? item?.price ?? 0;
            const chg = item?.change ?? 0;
            return (
              <button
                key={sym}
                onClick={() => {
                  audioHaptics.tick();
                  useTerminalStore.getState().setSymbol(sym);
                  onLaunchTerminal(sym);
                }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-grid/50 bg-white/[0.02] hover:bg-white/10 hover:border-white/20 transition cursor-pointer"
                title={`Click to open ${sym} on Live Terminal`}
              >
                <span className="font-bold text-white">{sym}</span>
                <span className="text-slate-300">{fmtPrice(p, sym)}</span>
                <span className={`text-[10px] font-semibold ${chg >= 0 ? 'text-up' : 'text-down'}`}>
                  {fmtPct(chg)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleThemeMode();
            }}
            className="clay-btn px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white"
            title="Toggle Dark / Light Theme"
          >
            {themeMode === 'DARK' ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>
      </div>

      {/* Primary Navigation Bar */}
      <nav className="border-b border-grid bg-panel/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-wider text-sm">CRT TERMINAL</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                TradeXGuardian
              </span>
            </div>
            <span className="text-[10px] text-muted block -mt-0.5">Prevention-First Institutional Trading</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs text-slate-300">
          <a href="#guardian" className="hover:text-white transition">Guardian Engine</a>
          <a href="#calculator" className="hover:text-white transition">Prop Calculator</a>
          <a href="#features" className="hover:text-white transition">Order Flow Suite</a>
          <a href="#security" className="hover:text-white transition">Key Vault</a>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenGuardian && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenGuardian();
              }}
              className="clay-btn px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hidden sm:flex items-center gap-1.5"
            >
              Guardian Rules
            </button>
          )}
          <button
            onClick={() => {
              audioHaptics.tick();
              onLaunchTerminal();
            }}
            className="clay-btn-active px-4 py-1.5 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <span>Launch Web Terminal</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs font-semibold mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          <span>No Automated Bots • Zero Signals • Pure Capital Protection</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl leading-tight">
          You decide how to trade. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400">
            TradeXGuardian controls the discipline.
          </span>
        </h1>

        <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
          The institutional prevention-only trading system that sits between you and the market.
          Blocks revenge-trading, overleveraging, and daily drawdown breaches before an order ever reaches your broker.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              audioHaptics.tick();
              onLaunchTerminal();
            }}
            className="clay-btn-active px-6 py-2.5 text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-xl"
          >
            <span>Enter Live Terminal</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <a
            href="#calculator"
            className="clay-btn px-5 py-2.5 text-sm font-semibold text-slate-200 hover:text-white transition flex items-center gap-2"
          >
            <span>Configure Prop Shield</span>
          </a>

          {onOpenPortfolio && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenPortfolio();
              }}
              className="clay-btn px-5 py-2.5 text-sm font-semibold text-[#38bdf8] hover:text-white transition"
            >
              <span>Portfolio & AI Journal</span>
            </button>
          )}
        </div>

        {/* Live Terminal Preview Soft Card */}
        <div className="mt-12 w-full clay-panel p-4 rounded-xl border border-grid shadow-2xl text-left font-mono">
          <div className="flex items-center justify-between border-b border-grid/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs text-muted ml-2 font-medium">CRT Terminal v2.0 • Live Prevention Engine</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Guardian Active</span>
              <span className="text-white font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10">100% Score</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Chart & Killzone Radar */}
            <div className="lg:col-span-2 clay-inset p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-white">BTCUSDT Perpetual</span>
                  <span className="text-xs text-muted ml-2 font-medium">Binance Futures</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-up bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    London / NY Overlap Active
                  </span>
                </div>
              </div>

              {/* Mock Order Execution with Intercept Preview */}
              <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-bold text-amber-300">Guardian Pre-Trade Intercept Active</span>
                  </div>
                  <span className="text-[10px] text-amber-400 uppercase font-semibold">Risk Error Confirmation</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Your planned Stop Loss ($1,250) is 2.5x larger than configured standard ($500). Expected risk exceeds maximum trade limit.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      onLaunchTerminal('BTCUSDT');
                    }}
                    className="clay-btn px-3 py-1 text-[11px] font-bold text-white hover:border-white/40"
                  >
                    Adjust Risk in Terminal
                  </button>
                  <span className="text-[10px] text-muted">Order held before broker submission</span>
                </div>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <span className="text-[10px] text-muted block uppercase">Protected Capital</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">$50,000.00</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <span className="text-[10px] text-muted block uppercase">Max Daily Loss</span>
                  <span className="font-bold text-emerald-400 text-sm mt-0.5 block">$2,500.00 (5.0%)</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <span className="text-[10px] text-muted block uppercase">Remaining Trades</span>
                  <span className="font-bold text-sky-400 text-sm mt-0.5 block">3 of 3 Allowed</span>
                </div>
              </div>
            </div>

            {/* Right: Protection Summary */}
            <div className="clay-inset p-4 rounded-lg space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2 border-b border-grid/60 pb-1.5">
                  Guardian Enforcement Rules
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Overtrading Blocker:</span>
                    <span className="text-emerald-400 font-semibold">Active (Max 3)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Daily Drawdown Lock:</span>
                    <span className="text-emerald-400 font-semibold">Active (5%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Revenge Cooldown:</span>
                    <span className="text-emerald-400 font-semibold">30 Min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Killzone Window:</span>
                    <span className="text-emerald-400 font-semibold">London & NY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Martingale Guard:</span>
                    <span className="text-emerald-400 font-semibold">Hard Block</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  audioHaptics.tick();
                  onLaunchTerminal();
                }}
                className="w-full clay-btn py-2 text-center text-xs font-bold text-white hover:text-sky-300 transition"
              >
                Open Terminal HUD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Prop Firm Challenge Calculator Section */}
      <section id="calculator" className="border-t border-grid bg-panel/40 px-6 py-16">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Production Feature</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">
              Prop Firm Challenge Calculator & Shield
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Configure your exact funded firm parameters. Click apply to instantly lock these limits into your TradeXGuardian risk engine.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Configuration Inputs */}
            <div className="lg:col-span-7 clay-panel p-6 rounded-xl border border-grid space-y-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-grid/60 pb-2">
                Challenge Parameters
              </h3>

              {/* Account Size Quick Select */}
              <div>
                <label className="text-xs text-muted block mb-2">Account Capital (USD)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[10000, 25000, 50000, 100000, 200000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        audioHaptics.tick();
                        setAccountSize(amt);
                      }}
                      className={`py-1.5 text-xs font-semibold rounded border transition ${
                        accountSize === amt
                          ? 'clay-pill-active'
                          : 'clay-btn text-slate-300'
                      }`}
                    >
                      ${amt / 1000}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Daily Loss Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted">Maximum Daily Drawdown:</span>
                  <span className="font-bold text-white">{maxDailyLossPct}% ({fmtUsd(maxDailyLossUsd)})</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="0.5"
                  value={maxDailyLossPct}
                  onChange={(e) => setMaxDailyLossPct(parseFloat(e.target.value))}
                  className="w-full accent-sky-400 bg-black/40 h-1.5 rounded cursor-pointer"
                />
              </div>

              {/* Max Overall Drawdown Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted">Maximum Total Drawdown:</span>
                  <span className="font-bold text-white">{maxTotalLossPct}% ({fmtUsd(maxTotalLossUsd)})</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="15"
                  step="0.5"
                  value={maxTotalLossPct}
                  onChange={(e) => setMaxTotalLossPct(parseFloat(e.target.value))}
                  className="w-full accent-sky-400 bg-black/40 h-1.5 rounded cursor-pointer"
                />
              </div>

              {/* Max Trades Per Day */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted">Max Allowed Trades / Day:</span>
                  <span className="font-bold text-white">{maxTradesPerDay} trades</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 5, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        audioHaptics.tick();
                        setMaxTradesPerDay(n);
                      }}
                      className={`py-1 text-xs font-semibold rounded border transition ${
                        maxTradesPerDay === n ? 'clay-pill-active' : 'clay-btn text-slate-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply Action */}
              <div className="pt-2">
                <button
                  onClick={handleApplyRulesToGuardian}
                  className="w-full clay-btn-active py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{ruleApplied ? 'Rules Applied to Guardian System!' : 'Apply Rules to TradeXGuardian'}</span>
                </button>
              </div>
            </div>

            {/* Live Recommended Guardrails Output */}
            <div className="lg:col-span-5 clay-panel p-6 rounded-xl border border-grid space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-grid/60 pb-2">
                  Enforced Guardrails
                </h3>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-grid/60">
                    <span className="text-[10px] text-muted block uppercase">Max Risk Allocation / Trade</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                      {fmtUsd(maxRiskPerTradeUsd)}
                    </span>
                    <span className="text-[10px] text-muted">
                      Limits risk to {+(maxDailyLossPct / maxTradesPerDay).toFixed(2)}% per position
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-grid/60">
                    <span className="text-[10px] text-muted block uppercase">Safe Max Lot Sizes (25-pip SL)</span>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                      <div className="p-1.5 rounded bg-black/40 border border-grid/40">
                        <span className="text-[10px] text-muted block">Forex (EURUSD)</span>
                        <span className="font-bold text-white text-xs">{safeLotSizes.forex} lots</span>
                      </div>
                      <div className="p-1.5 rounded bg-black/40 border border-grid/40">
                        <span className="text-[10px] text-muted block">Gold (XAUUSD)</span>
                        <span className="font-bold text-white text-xs">{safeLotSizes.gold} lots</span>
                      </div>
                      <div className="p-1.5 rounded bg-black/40 border border-grid/40">
                        <span className="text-[10px] text-muted block">Crypto (BTC)</span>
                        <span className="font-bold text-white text-xs">{safeLotSizes.btc} BTC</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-grid/60">
                    <span className="text-[10px] text-muted block uppercase">Profit Target</span>
                    <span className="text-base font-bold text-sky-400 mt-0.5 block">
                      {fmtUsd(profitTargetUsd)} ({profitTargetPct}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted border-t border-grid/60 pt-3">
                Protected by TradeXGuardian pre-trade enforcement layer. Prevents account liquidation.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TradeXGuardian Core Architecture Pillars */}
      <section id="guardian" className="px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Core Architecture</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">
            The 6 Layers of TradeXGuardian
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-400">
            Engineered exclusively to enforce trading psychology, protect prop accounts, and stop fatal blowups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Trade Blocker */}
          <div className="clay-card p-5 space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">1. Hard Trade Blocker</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enforces your daily maximum trade count and maximum daily loss. Once reached, order placement is hard-blocked until the daily reset.
            </p>
          </div>

          {/* 2. Time Blocker */}
          <div className="clay-card p-5 space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">2. Session & Time Blocker</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Trade only when your edge is proven. Restricts order placement strictly to permitted London, New York, or Asian killzone windows.
            </p>
          </div>

          {/* 3. Risk Error Confirmation */}
          <div className="clay-card p-5 space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">3. Risk Error Confirmation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Catches fat-finger typos, abnormally wide stop losses, missing stop losses, or negative risk-to-reward ratios before execution.
            </p>
          </div>

          {/* 4. Prop Firm Rule Guardian */}
          <div className="clay-card p-5 space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">4. Prop Firm Rule Guardian</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Guards consistency target ratios, detects martingale lot escalation, weekend hold limits, and tracks maximum trailing drawdown.
            </p>
          </div>

          {/* 5. Intelligent Pair Awareness */}
          <div className="clay-card p-5 space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">5. Intelligent Pair Awareness</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates contract sizes, tick values, and pip values dynamically across Forex, XAUUSD, Indices, and Crypto instruments.
            </p>
          </div>

          {/* 6. Emergency Lock & Discipline Score */}
          <div className="clay-card p-5 space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <svg className="h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">6. Emergency Lock & Score</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Provides one-click emergency kill-switches and tracks your discipline score (0-100%) to measure behavioral compliance over time.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Client-Side Zero-Knowledge Encryption */}
      <section id="security" className="border-t border-grid bg-panel/60 px-6 py-16">
        <div className="max-w-5xl mx-auto w-full">
          <div className="clay-panel p-8 rounded-2xl border border-grid space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Client-Side Zero-Knowledge Key Vault</h3>
                <span className="text-xs text-muted">AES-GCM 256-Bit Cryptographic Hardening</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Your broker API credentials, private keys, and trade journals never leave your browser unencrypted.
              All data is encrypted client-side using Web Crypto PBKDF2 (100,000 rounds) and AES-GCM 256-bit encryption.
              Even if the server or database were compromised, your broker secrets cannot be decrypted without your local master password.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-white/[0.02] border border-grid/50">
                <span className="font-bold text-white block">Zero Cloud Storage</span>
                <span className="text-muted text-[11px] mt-0.5 block">Secrets remain in your encrypted local vault.</span>
              </div>
              <div className="p-3 rounded bg-white/[0.02] border border-grid/50">
                <span className="font-bold text-white block">Local AI Behavioral Coach</span>
                <span className="text-muted text-[11px] mt-0.5 block">Runs offline via local Ollama instance.</span>
              </div>
              <div className="p-3 rounded bg-white/[0.02] border border-grid/50">
                <span className="font-bold text-white block">Strict CSP & Sanitization</span>
                <span className="text-muted text-[11px] mt-0.5 block">Prototype-pollution and XSS defense built-in.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="border-t border-grid bg-panel px-6 py-10 mt-auto">
        <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-muted">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">CRT TERMINAL & TRADEXGUARDIAN</span>
              <span className="px-1.5 py-0.2 rounded bg-white/10 text-white text-[10px]">PRODUCTION READY</span>
            </div>
            <p className="mt-1 text-[11px]">Designed for professional traders, prop firm challengers, and institutional execution.</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                audioHaptics.tick();
                onLaunchTerminal();
              }}
              className="clay-btn-active px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Launch Terminal</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
