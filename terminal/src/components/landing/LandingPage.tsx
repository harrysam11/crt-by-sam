/**
 * LandingPage.tsx
 * Institutional Landing Page & Feature Showcase for TerminalX & TradeXGuardian.
 * Reverse-engineered from DMCharts & TradingView institutional architecture.
 *
 * ZERO NEON POLICY STRICTLY ENFORCED:
 *  - Monochromatic, matte, dark charcoal background (#141413 / #0f1013 / #191a1f).
 *  - Crisp white typography, subtle slate borders, and zero glowing shadows.
 *  - High-contrast solid white primary action buttons with black text.
 *  - Standard institutional TradingView green (#089981) and red (#f23645) for financial data.
 *  - Official monochromatic TerminalX Brand Logo.
 *  - ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useGuardianStore } from '../../store/useGuardianStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useAuthStore } from '../../store/useAuthStore';
import { fmtPrice, fmtUsd } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import TerminalXLogo from '../common/TerminalXLogo';
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

  // Hero Preview Active Tab
  const [heroTab, setHeroTab] = useState<'FOOTPRINT' | 'HEATMAP' | 'DOM' | 'OPTIONS'>('FOOTPRINT');
  const [selectedHeroSymbol, setSelectedHeroSymbol] = useState<'BTCUSDT' | 'XAUUSD' | 'EURUSD' | 'NVDA'>('BTCUSDT');

  // Tour Feature Active Slide
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // MCP AI Section State
  const [mcpAiTab, setMcpAiTab] = useState<'CLAUDE' | 'CHATGPT' | 'CLAUDE_CODE' | 'OLLAMA'>('CLAUDE');
  const [copiedField, setCopiedField] = useState<'URL' | 'PROMPT' | null>(null);

  // FAQ Accordion Active Item
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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

  const handleCopy = (text: string, type: 'URL' | 'PROMPT') => {
    audioHaptics.tick();
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // 9 Features data aligned with DMCharts architectural standard
  const features = [
    {
      id: 'footprint',
      title: 'See Inside Every Candle',
      badge: 'Footprint Order Flow',
      desc: 'Footprint charts show the actual aggressive buying and selling executed at each price inside every bar. Volume imbalances, delta divergence, and Bar Stats underneath sum up every candle: bought volume, sold volume, total volume, and finished delta.',
      bullets: ['Bid/Ask delta cluster distribution', 'Volume Imbalance highlighting (300%+)', 'Bar Stats delta and cumulative delta', 'Real-time absorption and exhaustion tracking'],
      tag: 'Order Flow Engine',
    },
    {
      id: 'heatmap',
      title: 'Resting Liquidity & Heatmap',
      badge: 'Order Book Heatmap',
      desc: 'Visualize resting limit orders directly on your price scale. Track historical depth walls, spoofing orders, liquidity sweeps, and large market participant absorption as depth intensity heatmaps.',
      bullets: ['Multi-depth limit order visualization', 'Dynamic depth scale and contrast controls', 'Aggressive market orders rendered as bubbles', 'Detect iceberg orders before breakouts'],
      tag: 'Market Microstructure',
    },
    {
      id: 'dom',
      title: 'The Order Book, Price by Price',
      badge: 'DOM Ladder',
      desc: 'The institutional Depth of Market ladder shows resting bids and asks in real time as trades hit the tape. One-click bracket order placement with dynamic tick-by-tick volume profile.',
      bullets: ['Real-time resting bid/ask volumes', 'Last traded price and size velocity', '1-click Limit and Stop placement', 'Integrated footprint cumulative volume'],
      tag: 'Execution Precision',
    },
    {
      id: 'indicators',
      title: 'Add as Many Indicators as You Want',
      badge: 'Zero Limit Indicators',
      desc: 'No artificial paywalls and no 3-indicator limits. Stack moving averages, Bollinger Bands, Anchored VWAP, MACD, Cumulative Volume Delta (CVD), Open Interest, and custom Pine Scripts on a single multi-pane canvas.',
      bullets: ['Unlimited indicators per chart pane', 'Anchored VWAP by session, week, or user click', 'Cumulative Volume Delta (CVD) tracking', 'Multi-timeframe momentum oscillators'],
      tag: 'No Paywalls',
    },
    {
      id: 'options',
      title: 'Options Volatility on the Same Chart',
      badge: 'Derivatives Volatility',
      desc: 'IV Candles color every price bar by implied volatility: blue when options are historically cheap, amber-red when expensive. Analyze 25-delta risk reversals, ATM IV, gamma levels, call/put walls, and open interest by strike.',
      bullets: ['Implied volatility colored price bars', '25-delta Risk Reversal skew tracking', 'Gamma exposure (GEX) levels and flip points', 'Call and Put wall distribution by strike'],
      tag: 'Institutional Quant',
    },
    {
      id: 'mcp-ai',
      title: 'Ask AI & Model Context Protocol',
      badge: 'MCP Client-Side Engine',
      desc: 'Connect Claude 3.5, ChatGPT, Gemini, or local desktop Ollama directly to your chart. AI inspects live order flow, calculates position sizing, enforces risk rules, and writes PineScript indicators with zero inference load on our servers.',
      bullets: ['Universal Model Context Protocol client', 'Direct Anthropic, OpenAI, and Gemini tool calling', 'Local Ollama execution for offline privacy', 'Client-side tool loops with zero server latency'],
      tag: 'Autonomous Intelligence',
    },
    {
      id: 'byos',
      title: 'Bring Your Own Storage (BYOS)',
      badge: 'Zero-Cost Cloud Persistence',
      desc: 'Store your drawings, indicator templates, multi-pane layouts, and video skins directly in your personal GitHub Gist or local browser OPFS disk. Enjoy permanent, lifetime access independent of any server downtime or storage subscription.',
      bullets: ['Free private GitHub Gist sync with revisions', 'Local Origin Private File System (OPFS) virtual disk', 'Zero bandwidth or cloud storage fees', 'Encrypted browser-side credential vault'],
      tag: 'User Sovereignty',
    },
    {
      id: 'replay',
      title: 'Bar-by-Bar Market Replay',
      badge: 'Historical Simulator',
      desc: 'Pick any historical point and replay market action forward bar by bar. The order book heatmap and footprint stop at the replayed bar, ensuring zero lookahead bias while practicing your execution.',
      bullets: ['Tick-accurate historical replay engine', 'Hidden future bars with realistic execution', 'Practice long and short trades during playback', 'Real-time PnL and trade journaling tracker'],
      tag: 'Deliberate Practice',
    },
    {
      id: 'history',
      title: 'As Far Back as the Data Goes',
      badge: 'Deep History',
      desc: 'Scroll left and older bars keep loading seamlessly. There is no cut-off at a few thousand candles. Historical data extends back to listing day across crypto, spot gold, indices, and forex.',
      bullets: ['Infinite scroll with background pagination', '1-second to monthly timeframe aggregation', 'Multi-exchange aggregated order flow archives', 'Instant tick-level zoom on macro charts'],
      tag: 'Deep Archives',
    },
  ];

  // FAQ Items reverse-engineered from DMCharts
  const faqs = [
    {
      q: 'Is TerminalX really free?',
      a: 'Yes. The charts, technical indicators, order flow tools (Footprint, DOM, Volume Profile), options volatility analytics, and risk management tools are completely free to use without paywalls.',
    },
    {
      q: 'Do I need to sign up or create an account to start?',
      a: 'No. You can launch the terminal immediately with one click. Your drawings, layouts, and configurations stay saved locally in your browser. If you want multi-device cloud synchronization, you can sign in or connect your free GitHub Gist.',
    },
    {
      q: 'Which markets can I chart on TerminalX?',
      a: 'Crypto across major derivatives exchanges, 0-second real-time Spot Gold (XAUUSD) and Silver (XAGUSD), major FX pairs (EURUSD, GBPUSD, USDJPY), global indices (SPX500, NAS100, US30, NIFTY50), and leading US equities.',
    },
    {
      q: 'Which order flow and market microstructure tools are included?',
      a: 'Footprint charts with Bid/Ask volume clusters and delta divergence, Bar Stats tables, the Depth of Market (DOM) ladder, Cumulative Volume Delta (CVD), Volume Profile (VPVR), and liquidation waterfall tracking.',
    },
    {
      q: 'How does the Model Context Protocol (MCP) AI integration work?',
      a: 'TerminalX implements an in-browser MCP client compatible with dmcharts standards. You can connect Claude 3.5, ChatGPT, Gemini, or local desktop Ollama. The AI calls client-side tools directly in your browser to inspect quotes, evaluate orderflow, and check risk rules without sending data to any intermediary server.',
    },
    {
      q: 'Where is my workspace data and chart drawings stored?',
      a: 'Through our Bring Your Own Storage (BYOS) architecture, you have complete sovereignty. Your workspace can be synced to your private GitHub Gist, saved to your local disk via browser OPFS, or synced to the TerminalX database. Your secrets never leave your encrypted browser vault.',
    },
    {
      q: 'Is TerminalX a free alternative to TradingView and Bookmap?',
      a: 'Yes. TerminalX provides unlimited indicators and multi-pane layouts without TradingView subscription tiers, and adds advanced footprint charts, DOM ladders, and MCP AI capabilities that usually cost hundreds of dollars per year on proprietary platforms.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#141413] text-slate-200 font-sans flex flex-col selection:bg-white/20 selection:text-white">
      {/* Top Announcement & Live Market Ticker Strip */}
      <div className="border-b border-[#242422] bg-[#181817] px-4 py-2 text-xs flex items-center justify-between overflow-x-auto gap-4 font-mono">
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#089981]" />
            <span className="text-[11px] font-bold text-white tracking-wider uppercase">Market Feeds Active</span>
          </div>

          {/* Live Quote Chips */}
          <div className="flex items-center gap-4 text-[11px]">
            {['BTCUSDT', 'XAUUSD', 'EURUSD', 'NVDA', 'SPX500'].map((sym) => {
              const q = quotes[sym];
              const w = watchlist[sym];
              const pr = q?.price ?? w?.price ?? (sym === 'XAUUSD' ? 3568.86 : sym === 'BTCUSDT' ? 96420.5 : 1.054);
              const chg = w?.change ?? (sym === 'XAUUSD' ? 0.42 : sym === 'BTCUSDT' ? 1.85 : -0.15);
              const isUp = chg >= 0;

              return (
                <div
                  key={sym}
                  onClick={() => handleLaunch(sym)}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-white transition py-0.5 px-1.5 rounded hover:bg-white/5"
                  title={`Launch ${sym} chart`}
                >
                  <span className="font-bold text-slate-400">{sym}</span>
                  <span className="font-mono text-white">{fmtPrice(pr, sym)}</span>
                  <span className={`text-[10px] font-bold ${isUp ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                    {isUp ? '+' : ''}{chg.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-400 hidden sm:inline">0s Latency Spot Gold &amp; Forex</span>
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleThemeMode();
            }}
            className="px-2 py-0.5 rounded border border-[#2e2e2a] text-[10px] font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition"
            title="Toggle Dark / Light Theme"
          >
            {themeMode === 'DARK' ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>
      </div>

      {/* Primary Sticky Header Bar (TradingView / DMCharts Style) */}
      <header className="border-b border-[#242422] bg-[#141413]/95 backdrop-blur-md px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="#top" className="flex items-center gap-3 group cursor-pointer" title="TerminalX Institutional Charting">
            <TerminalXLogo size={30} variant="white" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-white tracking-wider text-base">
                  TERMINALX
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-200 border border-white/15 font-mono">
                  FREE PRO
                </span>
              </div>
              <span className="text-[10px] text-slate-400 -mt-0.5 font-mono">Order Flow &bull; MCP AI &bull; BYOS</span>
            </div>
          </a>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300 font-mono">
          <a href="#top" className="hover:text-white transition">Home</a>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#connect-ai" className="hover:text-white transition font-semibold text-white">Connect AI (MCP)</a>
          <a href="#byos" className="hover:text-white transition">Cloud BYOS</a>
          <a href="#calculator" className="hover:text-white transition">Prop Shield</a>
          <a href="#compare" className="hover:text-white transition">vs TradingView</a>
          <a href="#faq" className="hover:text-white transition">FAQ</a>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-[#089981]" />
              <span className="text-white font-bold">{user?.username}</span>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('LOGIN')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg border border-[#2e2e2a] hover:border-slate-500 transition font-mono"
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => {
              audioHaptics.tick();
              setIsDownloadModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hidden sm:flex items-center gap-1.5 rounded-lg border border-[#2e2e2a] hover:border-slate-500 transition font-mono"
            title="Download App for Desktop, iOS & Android"
          >
            <svg className="h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden md:inline">Download</span>
          </button>

          <button
            onClick={() => handleLaunch()}
            className="px-4 py-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer rounded-lg bg-white hover:bg-slate-200 text-black font-heading shadow-sm"
          >
            <span>Launch Terminal</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative px-6 pt-16 pb-20 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-300 text-xs font-mono font-semibold mb-6">
          <span className="h-2 w-2 rounded-full bg-white" />
          <span>Free TradingView &bull; Bookmap &bull; Exocharts Alternative &bull; Zero Paywalls</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl leading-[1.15] font-heading">
          Free Charting Platform <br />
          <span className="text-white">
            For Every Market.
          </span>
        </h1>

        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
          Crypto, stocks, FX, commodities, and futures on one ultra-fast canvas. Order book heatmap, footprint order flow, DOM ladder, and BYOK AI built in. Zero limits. No sign-up, no login.
        </p>

        {/* Primary CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 font-mono">
          <button
            onClick={() => handleLaunch()}
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-200 text-black font-bold text-sm transition flex items-center gap-2 cursor-pointer font-heading shadow-md"
          >
            <span>Launch Terminal</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          <a
            href="#connect-ai"
            className="px-5 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition flex items-center gap-2 cursor-pointer font-heading"
          >
            <span>Connect AI (MCP)</span>
          </a>

          <a
            href="#features"
            className="px-5 py-3 rounded-xl border border-[#2e2e2a] hover:border-slate-500 text-slate-400 hover:text-white font-semibold text-sm transition cursor-pointer"
          >
            Explore Order Flow
          </a>
        </div>

        {/* Live Interactive Hero Chart Frame Mockup */}
        <div className="mt-14 w-full max-w-6xl rounded-2xl border border-[#282826] bg-[#181817] shadow-2xl overflow-hidden text-left relative">
          {/* Mockup Window Header */}
          <div className="px-4 py-3 border-b border-[#282826] bg-[#1d1d1b] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-slate-600" />
                <span className="h-3 w-3 rounded-full bg-slate-600" />
                <span className="h-3 w-3 rounded-full bg-slate-600" />
              </div>

              <div className="h-4 w-px bg-[#282826]" />

              {/* Symbol Selector */}
              <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-[#2e2e2a]">
                {(['BTCUSDT', 'XAUUSD', 'EURUSD', 'NVDA'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      audioHaptics.tick();
                      setSelectedHeroSymbol(s);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                      selectedHeroSymbol === s
                        ? 'bg-white/15 text-white border border-white/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-400 hidden sm:flex">
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-bold text-white">1m</span>
                <span className="px-1.5 py-0.5 rounded hover:bg-white/5 transition">5m</span>
                <span className="px-1.5 py-0.5 rounded hover:bg-white/5 transition">15m</span>
                <span className="px-1.5 py-0.5 rounded hover:bg-white/5 transition">1h</span>
              </div>
            </div>

            {/* View Modality Pills */}
            <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-[#2e2e2a]">
              {[
                { id: 'FOOTPRINT', label: 'Footprint Delta' },
                { id: 'HEATMAP', label: 'Order Book Heatmap' },
                { id: 'DOM', label: 'DOM Ladder' },
                { id: 'OPTIONS', label: 'Options IV' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setHeroTab(tab.id as any);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                    heroTab === tab.id
                      ? 'bg-white text-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mockup Canvas Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px] bg-[#141413] relative font-mono text-xs">
            {/* Chart Area */}
            <div className="lg:col-span-9 p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#282826] relative overflow-hidden">
              {/* Heatmap Layers */}
              {heroTab === 'HEATMAP' && (
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="w-full h-8 bg-amber-500/30 absolute top-12" />
                  <div className="w-full h-12 bg-slate-300/20 absolute top-32" />
                  <div className="w-full h-6 bg-amber-500/25 absolute bottom-24" />
                  <div className="w-full h-10 bg-slate-200/20 absolute bottom-10" />
                </div>
              )}

              {/* Chart Legend HUD */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base font-heading">{selectedHeroSymbol}</span>
                  <span className="text-[#089981] font-bold text-sm">
                    {selectedHeroSymbol === 'XAUUSD' ? '$3,568.86' : selectedHeroSymbol === 'BTCUSDT' ? '$96,420.50' : selectedHeroSymbol === 'EURUSD' ? '1.0542' : '$142.80'}
                  </span>
                  <span className="text-[#089981] font-bold text-xs bg-[#089981]/15 px-1.5 py-0.5 rounded border border-[#089981]/30">
                    +1.42%
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">0s Tick Feed</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>EMA (20, 50, 200)</span>
                  <span>VWAP</span>
                  <span>CVD</span>
                </div>
              </div>

              {/* Graphic Footprint / Candlestick Simulation */}
              <div className="my-auto py-6 grid grid-cols-6 gap-3 items-end h-56 relative z-10">
                {[
                  { o: 20, c: 60, buy: '1.2k', sell: '840', delta: '+360', isUp: true },
                  { o: 60, c: 45, buy: '650', sell: '920', delta: '-270', isUp: false },
                  { o: 45, c: 85, buy: '2.4k', sell: '1.1k', delta: '+1.3k', isUp: true },
                  { o: 85, c: 75, buy: '1.1k', sell: '1.4k', delta: '-300', isUp: false },
                  { o: 75, c: 92, buy: '3.1k', sell: '1.8k', delta: '+1.3k', isUp: true },
                  { o: 92, c: 96, buy: '1.8k', sell: '950', delta: '+850', isUp: true },
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center justify-end h-full group">
                    <div className="w-px h-6 bg-slate-600" />
                    <div
                      className={`w-full rounded border flex flex-col justify-between p-1.5 text-[9px] font-mono transition ${
                        bar.isUp
                          ? 'bg-[#089981]/20 border-[#089981]/50 text-[#089981]'
                          : 'bg-[#f23645]/20 border-[#f23645]/50 text-[#f23645]'
                      }`}
                      style={{ height: `${bar.c}%` }}
                    >
                      {heroTab === 'FOOTPRINT' ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{bar.sell}</span>
                            <span className="font-bold text-white">{bar.buy}</span>
                          </div>
                          <div className="text-center font-bold text-[8px] bg-black/50 rounded px-1 mt-auto">
                            {bar.delta}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-current opacity-20 rounded" />
                      )}
                    </div>
                    <div className="w-px h-4 bg-slate-600" />
                  </div>
                ))}
              </div>

              {/* Bottom Bar Stats Table */}
              <div className="border-t border-[#282826] pt-3 flex items-center justify-between text-[10px] text-slate-400 relative z-10">
                <div className="flex items-center gap-4">
                  <span>Delta: <strong className="text-[#089981] font-bold">+3,240 Vol</strong></span>
                  <span>CVD: <strong className="text-white font-bold">+18.5k</strong></span>
                  <span>Volume: <strong className="text-white font-bold">142,500 Contracts</strong></span>
                </div>
                <button
                  onClick={() => handleLaunch(selectedHeroSymbol)}
                  className="text-white hover:text-slate-300 font-bold flex items-center gap-1 transition"
                >
                  <span>Open Full Chart</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>

            {/* Right DOM Ladder / Microstructure Pane */}
            <div className="lg:col-span-3 p-4 bg-[#181817] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#282826] pb-2 mb-3">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider">DOM Order Book</span>
                  <span className="text-[10px] text-[#089981] font-bold">Spread: 0.1</span>
                </div>

                <div className="space-y-1 text-[10px] font-mono">
                  {/* Asks (Sell depth) */}
                  {[
                    { p: '96,423.5', size: '14.2', depth: 85 },
                    { p: '96,422.0', size: '8.5', depth: 60 },
                    { p: '96,421.0', size: '3.1', depth: 25 },
                  ].map((row, idx) => (
                    <div key={idx} className="relative flex items-center justify-between px-1.5 py-0.5 rounded overflow-hidden text-[#f23645]">
                      <div className="absolute right-0 top-0 bottom-0 bg-[#f23645]/15" style={{ width: `${row.depth}%` }} />
                      <span className="relative z-10 font-bold">{row.p}</span>
                      <span className="relative z-10 text-slate-400">{row.size}</span>
                    </div>
                  ))}

                  {/* Current Spread Price */}
                  <div className="py-1 px-1.5 my-1 bg-white/10 rounded border border-white/15 text-center font-bold text-white">
                    96,420.50 &bull; LIVE TAPE
                  </div>

                  {/* Bids (Buy depth) */}
                  {[
                    { p: '96,420.0', size: '6.4', depth: 40 },
                    { p: '96,419.0', size: '12.8', depth: 75 },
                    { p: '96,418.0', size: '19.5', depth: 95 },
                  ].map((row, idx) => (
                    <div key={idx} className="relative flex items-center justify-between px-1.5 py-0.5 rounded overflow-hidden text-[#089981]">
                      <div className="absolute right-0 top-0 bottom-0 bg-[#089981]/15" style={{ width: `${row.depth}%` }} />
                      <span className="relative z-10 font-bold">{row.p}</span>
                      <span className="relative z-10 text-slate-400">{row.size}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1-Click Launch Button in Mockup */}
              <button
                onClick={() => handleLaunch(selectedHeroSymbol)}
                className="w-full py-2 mt-4 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs text-center transition cursor-pointer"
              >
                Launch Active Workspace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9-Feature "Everything in One Chart" Showcase (DMCharts reverse-engineered) */}
      <section id="features" className="border-t border-[#242422] bg-[#181817] px-6 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Platform Capabilities</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 font-heading tracking-tight">
              Everything in One Chart.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              No subscription tiers. No feature gating. Institutional order flow and analytics built directly into your web browser.
            </p>
          </div>

          {/* Feature Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 font-mono text-xs">
            {features.map((f, idx) => (
              <button
                key={f.id}
                onClick={() => {
                  audioHaptics.tick();
                  setActiveFeatureIndex(idx);
                }}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  activeFeatureIndex === idx
                    ? 'bg-white text-black font-bold border-white'
                    : 'bg-white/5 border-[#2e2e2a] text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                {f.badge}
              </button>
            ))}
          </div>

          {/* Active Feature Showcase Card */}
          {(() => {
            const active = features[activeFeatureIndex];
            return (
              <div className="rounded-2xl border border-[#282826] bg-[#141413] p-8 lg:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-slate-200 text-xs font-mono font-semibold">
                    <span>{active.tag}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white font-heading">
                    {active.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed font-sans">
                    {active.desc}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-xs">
                    {active.bullets.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-300">
                        <svg className="h-4 w-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => handleLaunch()}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-bold text-xs transition flex items-center gap-2 cursor-pointer font-heading"
                    >
                      <span>Try {active.badge} Live</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>

                {/* Right Visual Highlight Box */}
                <div className="lg:col-span-5 rounded-xl border border-[#282826] bg-[#181817] p-6 space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-[#282826] pb-2">
                    <span className="text-slate-400 uppercase text-[10px]">Real-Time Feature Status</span>
                    <span className="text-white font-bold">100% Client-Side</span>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-[#2e2e2a] space-y-2">
                    <div className="text-[11px] text-white font-bold">Zero Remote Latency</div>
                    <p className="text-[11px] text-slate-400 leading-normal font-sans">
                      Runs locally in your browser memory via WebGL / HTML5 Canvas. No subscription paywalls or rate limits.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2.5 rounded bg-white/[0.03] border border-[#282826]">
                      <span className="text-slate-400 block">Server Load</span>
                      <span className="font-bold text-white text-xs mt-0.5 block">0% CPU / 0 MB</span>
                    </div>
                    <div className="p-2.5 rounded bg-white/[0.03] border border-[#282826]">
                      <span className="text-slate-400 block">Data Privacy</span>
                      <span className="font-bold text-[#089981] text-xs mt-0.5 block">100% Encrypted</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* "Connect Your AI to the Chart" (MCP Section - reverse-engineered from dmcharts) */}
      <section id="connect-ai" className="border-t border-[#242422] bg-[#141413] px-6 py-20 relative">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Model Context Protocol</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 font-heading tracking-tight">
              Connect Your AI to the Chart.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Claude or ChatGPT writes, tests, and executes indicators live on your chart. Runs 100% client-side with zero inference load on our servers.
            </p>
          </div>

          {/* AI App Selector Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8 font-mono text-xs">
            {[
              { id: 'CLAUDE', label: 'Claude 3.5' },
              { id: 'CHATGPT', label: 'ChatGPT / OpenRouter' },
              { id: 'CLAUDE_CODE', label: 'Claude Code CLI' },
              { id: 'OLLAMA', label: 'Local Ollama' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  audioHaptics.tick();
                  setMcpAiTab(tab.id as any);
                }}
                className={`px-4 py-2 rounded-lg font-bold border transition ${
                  mcpAiTab === tab.id
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-[#2e2e2a] text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* MCP Integration Setup Box */}
          <div className="rounded-2xl border border-[#282826] bg-[#181817] p-8 lg:p-10 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center font-mono">
            <div className="lg:col-span-7 space-y-5">
              {/* Server URL Copy Box */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 block uppercase">TerminalX MCP Connector URL</span>
                <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-[#2e2e2a] text-xs">
                  <code className="text-white font-mono truncate">https://terminalx.app/mcp</code>
                  <button
                    onClick={() => handleCopy('https://terminalx.app/mcp', 'URL')}
                    className="ml-3 px-3 py-1 rounded bg-white hover:bg-slate-200 text-black font-bold text-xs transition"
                  >
                    {copiedField === 'URL' ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>

              {/* Step by Step instructions */}
              <div className="space-y-2 text-xs text-slate-300">
                <div className="font-bold text-white uppercase text-[11px] tracking-wider mb-1">
                  How it works, step by step:
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                  <span>In Claude or your AI app, open <strong>Customize &rarr; Connectors &rarr; Add Custom Connector</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                  <span>Name it <strong>TerminalX Quant Scripting</strong>, paste the server URL, and authorize browser access.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                  <span>Ask your AI to inspect order flow, check risk rules, and calculate position sizes live.</span>
                </div>
              </div>

              {/* Sample Prompt Box */}
              <div className="space-y-1.5 pt-2">
                <span className="text-xs text-slate-400 block uppercase">Then ask your AI:</span>
                <div className="p-3 rounded-lg bg-black/40 border border-[#2e2e2a] text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="italic text-slate-300 leading-normal font-sans">
                    "Use TerminalX MCP tools to analyze XAUUSD 1m order flow imbalance and suggest position size for a $500 risk limit."
                  </p>
                  <button
                    onClick={() =>
                      handleCopy(
                        'Use TerminalX MCP tools to analyze XAUUSD 1m order flow imbalance and suggest position size for a $500 risk limit.',
                        'PROMPT'
                      )
                    }
                    className="shrink-0 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition"
                  >
                    {copiedField === 'PROMPT' ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Interactive AI Execution Terminal */}
            <div className="lg:col-span-5 rounded-xl border border-[#282826] bg-[#141413] p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#282826] pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  <span className="font-bold text-white text-[11px] uppercase">MCP Tool Execution Stream</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">6 Tools Connected</span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 rounded bg-black/40 border border-[#2e2e2a]">
                  <div className="text-slate-400 text-[10px] uppercase">Executed Tool</div>
                  <div className="text-white font-bold mt-0.5">get_orderflow_imbalance("XAUUSD", "1m")</div>
                  <div className="text-[10px] text-slate-400 mt-1">Output: Bullish Delta (+1,840 Vol) &bull; Absorption at $3,565.00</div>
                </div>

                <div className="p-2.5 rounded bg-black/40 border border-[#2e2e2a]">
                  <div className="text-slate-400 text-[10px] uppercase">Executed Tool</div>
                  <div className="text-white font-bold mt-0.5">calculate_position_size(entry: 3568.5, sl: 3563.5, risk: 500)</div>
                  <div className="text-[10px] text-slate-400 mt-1">Recommended Size: 1.00 Lot &bull; Max Drawdown Adherence: 100%</div>
                </div>
              </div>

              <button
                onClick={() => handleLaunch()}
                className="w-full py-2.5 rounded-lg bg-white hover:bg-slate-200 text-black font-bold text-xs text-center transition font-heading cursor-pointer mt-2"
              >
                Open MCP Quant Assistant in Chart
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bring Your Own Storage (BYOS) Architecture */}
      <section id="byos" className="border-t border-[#242422] bg-[#181817] px-6 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Zero-Cost Infrastructure</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 font-heading tracking-tight">
              Bring Your Own Storage (BYOS).
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Your drawings, layouts, and custom wallpaper skins stay in your own personal cloud. Free, permanent, and private.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="p-6 rounded-2xl border border-[#282826] bg-[#141413] space-y-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">GitHub Gist Sync (Free)</h3>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">
                Synchronize your workspaces directly to private GitHub Gists. Unlimited storage, zero server costs, and full Git revision version history.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#282826] bg-[#141413] space-y-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 4h16M8 4v3m8-3v3" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">Browser OPFS Virtual Disk</h3>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">
                Origin Private File System provides a local sandboxed hard disk inside your browser. High-res video wallpapers and tick archives load with 0ms network lag.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#282826] bg-[#141413] space-y-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white font-heading">Encrypted Local Vault</h3>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">
                Broker API credentials and keys are encrypted using AES-GCM 256. Secrets never leave your browser memory, keeping your trading capital safe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Prop Firm Challenge Calculator Section */}
      <section id="calculator" className="border-t border-[#242422] bg-[#141413] px-6 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Funded Trader Engine</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 font-heading tracking-tight">
              Prop Firm Challenge Calculator.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Configure your exact funded firm parameters. Click apply to instantly lock these limits into your TradeXGuardian risk engine.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
            {/* Configuration Inputs */}
            <div className="lg:col-span-7 rounded-2xl border border-[#282826] bg-[#181817] p-6 sm:p-8 space-y-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#282826] pb-2">
                Challenge Parameters
              </h3>

              {/* Account Size Quick Select */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Account Capital (USD)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[10000, 25000, 50000, 100000, 200000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        audioHaptics.tick();
                        setAccountSize(amt);
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg border transition ${
                        accountSize === amt
                          ? 'bg-white text-black font-bold border-white'
                          : 'bg-white/5 border-[#2e2e2a] text-slate-400 hover:text-white'
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
                  <span className="text-slate-400">Maximum Daily Drawdown:</span>
                  <span className="font-bold text-white">{maxDailyLossPct}% ({fmtUsd(maxDailyLossUsd)})</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="0.5"
                  value={maxDailyLossPct}
                  onChange={(e) => setMaxDailyLossPct(parseFloat(e.target.value))}
                  className="w-full accent-white bg-black/40 h-2 rounded cursor-pointer"
                />
              </div>

              {/* Max Overall Drawdown Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Maximum Total Drawdown:</span>
                  <span className="font-bold text-white">{maxTotalLossPct}% ({fmtUsd(maxTotalLossUsd)})</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="15"
                  step="0.5"
                  value={maxTotalLossPct}
                  onChange={(e) => setMaxTotalLossPct(parseFloat(e.target.value))}
                  className="w-full accent-white bg-black/40 h-2 rounded cursor-pointer"
                />
              </div>

              {/* Max Trades Per Day */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Max Allowed Trades / Day:</span>
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
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                        maxTradesPerDay === n
                          ? 'bg-white text-black font-bold border-white'
                          : 'bg-white/5 border-[#2e2e2a] text-slate-400 hover:text-white'
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
                  className="w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer bg-white hover:bg-slate-200 text-black font-heading shadow-md"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{ruleApplied ? 'Rules Applied to TradeXGuardian!' : 'Apply Rules to TradeXGuardian'}</span>
                </button>
              </div>
            </div>

            {/* Live Recommended Guardrails Output */}
            <div className="lg:col-span-5 rounded-2xl border border-[#282826] bg-[#181817] p-6 sm:p-8 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#282826] pb-2">
                  Enforced Guardrails
                </h3>

                <div className="mt-4 space-y-3">
                  <div className="p-3.5 rounded-lg bg-black/40 border border-[#2e2e2a]">
                    <span className="text-[10px] text-slate-400 block uppercase">Max Risk Allocation / Trade</span>
                    <span className="text-base font-bold text-white mt-0.5 block">{fmtUsd(maxRiskPerTradeUsd)}</span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Calculated from {maxTradesPerDay} max daily executions
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-black/40 border border-[#2e2e2a]">
                    <span className="text-[10px] text-slate-400 block uppercase">Profit Target</span>
                    <span className="text-base font-bold text-[#089981] mt-0.5 block">
                      {profitTargetPct}% ({fmtUsd(profitTargetUsd)})
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-black/40 border border-[#2e2e2a]">
                    <span className="text-[10px] text-slate-400 block uppercase">Max Total Loss Limit</span>
                    <span className="text-base font-bold text-[#f23645] mt-0.5 block">
                      {maxTotalLossPct}% ({fmtUsd(maxTotalLossUsd)})
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleLaunch()}
                className="w-full py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white text-center text-xs font-bold transition font-heading cursor-pointer mt-4"
              >
                Launch Terminal with These Limits
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix (vs TradingView, Bookmap, Exocharts) */}
      <section id="compare" className="border-t border-[#242422] bg-[#181817] px-6 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Uncompromising Value</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 font-heading tracking-tight">
              Compare TerminalX.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Why professional operators, quants, and prop firm traders choose TerminalX.
            </p>
          </div>

          <div className="rounded-2xl border border-[#282826] bg-[#141413] overflow-x-auto shadow-xl font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#282826] bg-[#1d1d1b] text-slate-300">
                  <th className="p-4 font-bold">Feature</th>
                  <th className="p-4 font-black text-white text-sm">TerminalX</th>
                  <th className="p-4 text-slate-400">TradingView</th>
                  <th className="p-4 text-slate-400">Bookmap</th>
                  <th className="p-4 text-slate-400">Exocharts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282826] text-slate-300">
                <tr>
                  <td className="p-4 font-bold text-white">Active Indicators</td>
                  <td className="p-4 font-bold text-white bg-white/[0.03]">Unlimited (Free)</td>
                  <td className="p-4 text-slate-400">2 to 25 ($15-$60/mo)</td>
                  <td className="p-4 text-slate-400">Add-ons extra</td>
                  <td className="p-4 text-slate-400">Tier limited</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Footprint &amp; Delta Clusters</td>
                  <td className="p-4 font-bold text-white bg-white/[0.03]">Built-in (Free)</td>
                  <td className="p-4 text-slate-400">Not supported</td>
                  <td className="p-4 text-slate-400">Requires $40/mo package</td>
                  <td className="p-4 text-slate-400">&euro;35/mo subscription</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">DOM Order Book &amp; Heatmap</td>
                  <td className="p-4 font-bold text-white bg-white/[0.03]">Built-in (Free)</td>
                  <td className="p-4 text-slate-400">Broker login needed</td>
                  <td className="p-4 text-slate-400">Core ($49/mo)</td>
                  <td className="p-4 text-slate-400">Tier 2</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Model Context Protocol (MCP AI)</td>
                  <td className="p-4 font-bold text-white bg-white/[0.03]">Universal Browser MCP</td>
                  <td className="p-4 text-slate-400">None</td>
                  <td className="p-4 text-slate-400">None</td>
                  <td className="p-4 text-slate-400">None</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Cloud Storage &amp; Persistence</td>
                  <td className="p-4 font-bold text-white bg-white/[0.03]">BYOS: GitHub Gist + OPFS</td>
                  <td className="p-4 text-slate-400">Proprietary Cloud</td>
                  <td className="p-4 text-slate-400">Local desktop file</td>
                  <td className="p-4 text-slate-400">Proprietary Cloud</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Prop Firm Risk Shield</td>
                  <td className="p-4 font-bold text-white bg-white/[0.03]">TradeXGuardian Enforced</td>
                  <td className="p-4 text-slate-400">None</td>
                  <td className="p-4 text-slate-400">None</td>
                  <td className="p-4 text-slate-400">None</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Pricing</td>
                  <td className="p-4 font-black text-[#089981] text-sm bg-white/[0.03]">$0 Free &bull; Open Web</td>
                  <td className="p-4 text-slate-400">$180 &ndash; $720 / year</td>
                  <td className="p-4 text-slate-400">$480 &ndash; $960 / year</td>
                  <td className="p-4 text-slate-400">&euro;420 / year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion (DMCharts reverse-engineered) */}
      <section id="faq" className="border-t border-[#242422] bg-[#141413] px-6 py-20">
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Frequently Asked Questions</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 font-heading tracking-tight">
              Questions &amp; Answers.
            </h2>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[#282826] bg-[#181817] overflow-hidden transition"
                >
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      setOpenFaqIndex(isOpen ? null : idx);
                    }}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-bold text-white hover:text-slate-300 transition cursor-pointer"
                  >
                    <span className="text-sm font-heading">{faq.q}</span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ml-4 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-slate-300 font-sans text-xs sm:text-sm leading-relaxed border-t border-[#282826]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="border-t border-[#242422] bg-[#0f0f0e] px-6 py-12 mt-auto font-mono text-xs text-slate-400">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <TerminalXLogo size={26} variant="white" />
              <span className="font-heading font-black text-white text-base">
                TERMINALX
              </span>
            </div>
            <p className="text-slate-400 font-sans text-xs leading-normal">
              Institutional charting, order flow, options analytics, and MCP AI platform for every market.
            </p>
            <div className="pt-2 text-[11px] text-slate-400">
              Zero Server Compute &bull; BYOS Cloud
            </div>
          </div>

          <div>
            <div className="font-bold text-white uppercase tracking-wider mb-3 text-[11px]">Free Tools</div>
            <ul className="space-y-2 text-slate-400">
              <li><button onClick={() => handleLaunch()} className="hover:text-white transition">Footprint Chart</button></li>
              <li><button onClick={() => handleLaunch()} className="hover:text-white transition">Order Book Heatmap</button></li>
              <li><button onClick={() => handleLaunch()} className="hover:text-white transition">DOM Ladder</button></li>
              <li><button onClick={() => handleLaunch()} className="hover:text-white transition">Options Volatility</button></li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-white uppercase tracking-wider mb-3 text-[11px]">Platform</div>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#connect-ai" className="hover:text-white transition">Connect AI (MCP)</a></li>
              <li><a href="#byos" className="hover:text-white transition">BYOS GitHub Storage</a></li>
              <li><a href="#calculator" className="hover:text-white transition">Prop Firm Calculator</a></li>
              <li><button onClick={() => setIsDownloadModalOpen(true)} className="hover:text-white transition">Download Desktop App</button></li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-white uppercase tracking-wider mb-3 text-[11px]">Terminal Access</div>
            <button
              onClick={() => handleLaunch()}
              className="w-full py-2.5 rounded-lg bg-white hover:bg-slate-200 text-black font-bold text-xs font-heading transition cursor-pointer shadow-sm"
            >
              Launch Terminal Now
            </button>
            <p className="mt-2 text-[10px] text-slate-500 font-sans">
              No registration or credit card required. Works across Chrome, Brave, Safari, and Firefox.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full pt-6 border-t border-[#242422] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>
            &copy; 2026 TerminalX Institutional Trading Systems. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">Security: Argon2id &bull; AES-GCM 256</span>
            <span className="text-white font-bold">V2.0.0 PRO</span>
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
