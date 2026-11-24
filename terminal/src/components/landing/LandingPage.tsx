/**
 * LandingPage.tsx
 * Institutional Landing Page & Feature Showcase for TerminalX & TradeXGuardian.
 *
 * Designed to Linear / Raycast / TradingView institutional standard:
 * - Soft-card clay panels with subtle borders and micro-interactions.
 * - Interactive Prop Firm Challenge Calculator wired to real useGuardianStore.
 * - Live market ticker strip connected to real useTerminalStore quotes.
 * - Cloud workspace persistence (PostgreSQL / SQLite) with Argon2id auth.
 * - 0s Real-time Spot Gold (XAUUSD), Silver (XAGUSD), and Forex feeds.
 * - ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useGuardianStore } from '../../store/useGuardianStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useAuthStore } from '../../store/useAuthStore';
import { fmtPrice, fmtPct, fmtUsd } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import AppDownloadModal from './AppDownloadModal';

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

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  // Prop Firm Challenge Calculator State
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

  const handleLaunch = (symbol?: string) => {
    audioHaptics.tick();
    if (symbol) {
      useTerminalStore.getState().setSymbol(symbol);
    }
    onLaunchTerminal(symbol);
  };

  return (
    <div className="min-h-screen bg-bg text-slate-200 font-mono flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Announcement & Live Market Ticker Strip */}
      <div className="border-b border-grid bg-panel/70 backdrop-blur-md px-4 py-2 text-xs flex items-center justify-between overflow-x-auto gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-white text-[11px] uppercase tracking-wider">Live Feeds (0s Delay)</span>
        </div>

        <div className="flex items-center gap-4 text-xs whitespace-nowrap overflow-x-auto py-0.5">
          {['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'EURUSD', 'SOLUSDT'].map((sym) => {
            const item = watchlist[sym];
            const p = quotes[sym]?.price ?? item?.price ?? 0;
            const chg = item?.change ?? 0;
            return (
              <button
                key={sym}
                onClick={() => handleLaunch(sym)}
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
          <div className="flex items-center justify-center h-8 w-8 rounded bg-cyan-400 text-black font-black text-xs font-mono shadow-xs">
            TX
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-wider text-sm font-heading">TERMINALX</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                PRO RISK
              </span>
            </div>
            <span className="text-[10px] text-muted block -mt-0.5">Institutional Platform & TradeXGuardian</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs text-slate-300">
          <a href="#features" className="hover:text-white transition">Platform Features</a>
          <a href="#guardian" className="hover:text-white transition">Guardian Shield</a>
          <a href="#calculator" className="hover:text-white transition">Prop Calculator</a>
          <a href="#security" className="hover:text-white transition">Cloud & Security</a>
        </div>

        <div className="flex items-center gap-2.5">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-xs">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span className="text-white font-bold">{user?.username}</span>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('LOGIN')}
              className="clay-btn px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white flex items-center gap-1.5"
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => {
              audioHaptics.tick();
              setIsDownloadModalOpen(true);
            }}
            className="clay-btn px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hidden sm:flex items-center gap-1.5"
            title="Download App for iOS, Android, and Desktop"
          >
            <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden md:inline">Download</span>
          </button>

          <button
            onClick={() => handleLaunch()}
            className="clay-btn-active px-4 py-1.5 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg bg-cyan-400 hover:bg-cyan-300 text-black font-heading"
          >
            <span>Launch Terminal</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span>Zero Exchange Delay • 0s Spot Gold & Forex • Institutional Prop Shield</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl leading-tight font-heading">
          Institutional Speed. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
            Uncompromising Capital Discipline.
          </span>
        </h1>

        <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed font-sans">
          TerminalX pairs zero-second latency direct market feeds with the TradeXGuardian pre-trade risk engine.
          Block revenge trading, eliminate fat-finger errors, and pass funded account challenges with mathematical certainty.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => handleLaunch()}
            className="clay-btn-active px-6 py-2.5 text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-xl font-heading bg-cyan-400 hover:bg-cyan-300 text-black"
          >
            <span>Enter Live Terminal</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          {!isAuthenticated && (
            <button
              onClick={() => openAuthModal('REGISTER')}
              className="clay-btn px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:text-white transition flex items-center gap-2"
            >
              <span>Create Free Account</span>
            </button>
          )}

          <a
            href="#calculator"
            className="clay-btn px-5 py-2.5 text-sm font-semibold text-slate-200 hover:text-white transition flex items-center gap-2"
          >
            <span>Configure Prop Shield</span>
          </a>
        </div>

        {/* Live Terminal Preview Soft Card */}
        <div className="mt-12 w-full clay-panel p-4 rounded-xl border border-grid shadow-2xl text-left font-mono">
          <div className="flex items-center justify-between border-b border-grid/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs text-muted ml-2 font-medium">TerminalX v2.0 • Live Prevention Engine</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Guardian Active</span>
              <span className="text-white font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10">100% Discipline Score</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Chart & Killzone Radar */}
            <div className="lg:col-span-2 clay-inset p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-white">XAUUSD Spot Gold</span>
                  <span className="text-xs text-cyan-300 ml-2 font-medium">Direct MetaQuotes 0s Feed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-up bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    London / NY Session Active
                  </span>
                </div>
              </div>

              {/* Intercept Alert */}
              <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-bold text-amber-300">Guardian Pre-Trade Intercept Active</span>
                  </div>
                  <span className="text-[10px] text-amber-400 uppercase font-semibold">Risk Guardrail Protected</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Planned trade risk conforms to maximum allowable daily loss ($2,500.00). Trailing drawdown buffer: 7.2%.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleLaunch('XAUUSD')}
                    className="clay-btn px-3 py-1 text-[11px] font-bold text-white hover:border-white/40"
                  >
                    Open Live XAUUSD Chart
                  </button>
                  <span className="text-[10px] text-muted">Zero delay execution environment</span>
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
                  <span className="font-bold text-cyan-400 text-sm mt-0.5 block">3 of 3 Allowed</span>
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
                    <span className="text-emerald-400 font-semibold">30 Min Locked</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Killzone Window:</span>
                    <span className="text-emerald-400 font-semibold">London &amp; NY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Martingale Guard:</span>
                    <span className="text-emerald-400 font-semibold">Hard Block</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleLaunch()}
                className="w-full clay-btn py-2 text-center text-xs font-bold text-white hover:text-cyan-300 transition"
              >
                Launch Trading Workspace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Core Institutional Capabilities Section */}
      <section id="features" className="border-t border-grid bg-panel/30 px-6 py-16">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Institutional Suite</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2 font-heading">
              Built for Professional Operators
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              TerminalX brings institutional hedge-fund grade tools directly to your browser with zero bloat and absolute security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. 0s Latency Feed */}
            <div className="clay-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">0s Direct Metals &amp; Forex</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Real-time WebSocket tick streamer for Spot Gold (XAUUSD), Silver (XAGUSD), and Forex. Bypasses 15-minute exchange delays completely.
              </p>
            </div>

            {/* 2. TradingView Precision Drawings */}
            <div className="clay-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">TradingView Precision Vectors</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Trendlines, Fibonacci levels, Pitchforks, Gann fans, and Brush tools with custom opacity sliders, border widths, and multi-selection.
              </p>
            </div>

            {/* 3. PineScript Runtime */}
            <div className="clay-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">PineScript v5 Runtime</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Execute custom PineScript indicator algorithms directly client-side. Zero remote compilation latency.
              </p>
            </div>

            {/* 4. TradeXGuardian */}
            <div className="clay-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">Prop Firm Risk Shield</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Enforce daily drawdown limits, maximum contracts, and lockout periods before orders ever reach your broker API.
              </p>
            </div>

            {/* 5. Cloud Workspace Persistence */}
            <div className="clay-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">PostgreSQL &amp; SQLite Sync</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Seamless cloud sync for your chart drawings, custom indicator setups, chart wallpaper skins, and multi-pane grid layouts.
              </p>
            </div>

            {/* 6. Order Flow & Footprint DOM */}
            <div className="clay-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">Microstructure &amp; Order Flow</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Real-time Footprint delta clusters, Volume Profile (VPVR), Depth of Market (DOM) ladder, and liquidation waterfall tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Prop Firm Challenge Calculator Section */}
      <section id="calculator" className="border-t border-grid bg-panel/40 px-6 py-16">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Funded Trader Engine</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2 font-heading">
              Prop Firm Challenge Calculator
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 font-sans">
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
                  className="w-full accent-cyan-400 bg-black/40 h-1.5 rounded cursor-pointer"
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
                  className="w-full accent-cyan-400 bg-black/40 h-1.5 rounded cursor-pointer"
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
                  className="w-full clay-btn-active py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer bg-cyan-400 hover:bg-cyan-300 text-black font-heading"
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
                    <span className="text-base font-bold text-cyan-300 mt-0.5 block">{fmtUsd(maxRiskPerTradeUsd)}</span>
                    <span className="text-[10px] text-muted block mt-1">
                      Allowed risk per trade based on {maxTradesPerDay} max daily executions
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-grid/60">
                    <span className="text-[10px] text-muted block uppercase">Profit Target</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                      {profitTargetPct}% ({fmtUsd(profitTargetUsd)})
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-grid/60">
                    <span className="text-[10px] text-muted block uppercase">Max Total Loss Limit</span>
                    <span className="text-base font-bold text-rose-400 mt-0.5 block">
                      {maxTotalLossPct}% ({fmtUsd(maxTotalLossUsd)})
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleLaunch()}
                className="w-full clay-btn py-2 text-center text-xs font-bold text-white hover:text-cyan-300 transition"
              >
                Launch Terminal with These Limits
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Client-Side Encryption */}
      <section id="security" className="border-t border-grid bg-panel/60 px-6 py-16">
        <div className="max-w-5xl mx-auto w-full">
          <div className="clay-panel p-8 rounded-2xl border border-grid space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-heading">Security &amp; Encryption Standards</h3>
                <span className="text-xs text-muted">Argon2id Hashing • JWT Session Security • AES-GCM 256 Vault</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
              TerminalX protects your assets with defense-in-depth security. User passwords are encrypted using memory-hard Argon2id, while broker API credentials are encrypted client-side using Web Crypto PBKDF2 (100,000 rounds) and AES-GCM 256. Cloud layouts and workspace drawings are seamlessly synced to your dedicated PostgreSQL or SQLite instance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-white/[0.02] border border-grid/50">
                <span className="font-bold text-white block">Postgres &amp; SQLite Sync</span>
                <span className="text-muted text-[11px] mt-0.5 block">Drawings and layouts backed up to cloud.</span>
              </div>
              <div className="p-3 rounded bg-white/[0.02] border border-grid/50">
                <span className="font-bold text-white block">Token-Bucket Rate Limiter</span>
                <span className="text-muted text-[11px] mt-0.5 block">Axum rate-limiter prevents brute-force.</span>
              </div>
              <div className="p-3 rounded bg-white/[0.02] border border-grid/50">
                <span className="font-bold text-white block">Zero Cloud Broker Keys</span>
                <span className="text-muted text-[11px] mt-0.5 block">Secrets remain in your encrypted local vault.</span>
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
              <span className="font-bold text-white font-heading">TERMINALX &amp; TRADEXGUARDIAN</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-400 text-black text-[10px] font-mono font-bold">PRODUCTION READY</span>
            </div>
            <p className="mt-1 text-[11px] font-sans">Designed for professional traders, prop firm challengers, and institutional execution.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsDownloadModalOpen(true);
              }}
              className="clay-btn px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              Download App
            </button>
            <button
              onClick={() => handleLaunch()}
              className="clay-btn-active px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer font-heading bg-cyan-400 hover:bg-cyan-300 text-black"
            >
              <span>Launch Terminal</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </footer>

      {/* Download and Installation Modal */}
      <AppDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </div>
  );
}
