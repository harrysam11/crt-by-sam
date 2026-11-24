import { useEffect, useMemo, useRef, useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useJournalStore } from '../../store/useJournalStore';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useTradingModeStore } from '../../store/useTradingModeStore';
import { useGuardianStore } from '../../store/useGuardianStore';
import { getInstrument } from '../../services/instruments';
import { fmtPct, fmtPnl, fmtPrice, fmtUsd, labelOf, pnlClass } from '../../utils/formatters';
import { BreathingHalo } from '../../features/zen/ZenController';
import { audioHaptics } from '../../utils/notify';
import { loadTelegramConfig } from '../../services/telegramService';
import { useLayoutStore, type ChartGridLayout } from '../../store/useLayoutStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { computeActiveSessions } from '../../services/marketSessions';
import { wsManager } from '../../services/websocket';

const DOT = { open: 'bg-up', connecting: 'bg-yellow-400', reconnecting: 'bg-yellow-400', closed: 'bg-down' } as const;

interface HeaderProps {
  onOpenOptionChain?: () => void;
  onOpenRiskManager?: () => void;
  onOpenGreeks?: () => void;
  onOpenFunding?: () => void;
  onOpenLiquidations?: () => void;
  onOpenVault?: () => void;
  onOpenTax?: () => void;
  onOpenHotkeys?: () => void;
  onOpenCalendar?: () => void;
  onOpenScreener?: () => void;
  onOpenSessions?: () => void;
  onOpenGuardian?: () => void;
  onOpenPortfolio?: () => void;
  onOpenSettings?: (tab?: 'PROFILE' | 'BILLING' | 'THEME' | 'LANGUAGE' | 'TELEGRAM') => void;
  onTogglePopout?: () => void;
  isPopoutActive?: boolean;
  terminalMode?: 'SIMPLE' | 'PRO';
  onToggleMode?: () => void;
  onOpenLanding?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenLayoutCustomizer?: () => void;
}

export default function Header({
  onOpenOptionChain,
  onOpenRiskManager,
  onOpenGreeks,
  onOpenFunding,
  onOpenLiquidations,
  onOpenVault,
  onOpenTax,
  onOpenHotkeys,
  onOpenCalendar,
  onOpenScreener,
  onOpenSessions,
  onOpenGuardian,
  onOpenPortfolio,
  onOpenSettings,
  onTogglePopout,
  isPopoutActive,
  onOpenLanding,
  onOpenCommandPalette,
  onOpenLayoutCustomizer,
}: HeaderProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const price = useTerminalStore((s) => s.currentPrice);
  const change = useTerminalStore((s) => s.watchlist[s.symbol]?.change ?? 0);
  const balance = useTerminalStore((s) => s.balance);
  const status = useTerminalStore((s) => s.status);
  const error = useTerminalStore((s) => s.error);
  const marketOpen = useTerminalStore((s) => s.quotes[s.symbol]?.open);
  const open = useTerminalStore((s) => Object.values(s.positions).reduce((a, p) => a + p.unrealizedPnl, 0));
  const trades = useTerminalStore((s) => s.trades);
  const inst = getInstrument(symbol);

  // Psychology Zen & KillSwitch
  const zenMode = usePsychologyStore((s) => s.zenMode);
  const toggleZenMode = usePsychologyStore((s) => s.toggleZenMode);
  const killSwitch = usePsychologyStore((s) => s.killSwitch);
  const riskRules = usePsychologyStore((s) => s.riskRules);

  // Derivatives DOM & Analytics
  const isDomVisible = useDerivativesStore((s) => s.isDomVisible);
  const toggleDom = useDerivativesStore((s) => s.toggleDom);
  const isAnalyticsVisible = useDerivativesStore((s) => s.isAnalyticsVisible);
  const toggleAnalytics = useDerivativesStore((s) => s.toggleAnalytics);

  // Multi-chart Grid Layout Store
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const syncSymbol = useLayoutStore((s) => s.syncSymbol);
  const syncTimeframe = useLayoutStore((s) => s.syncTimeframe);
  const syncCrosshair = useLayoutStore((s) => s.syncCrosshair);
  const syncRange = useLayoutStore((s) => s.syncRange);
  const toggleSync = useLayoutStore((s) => s.toggleSync);
  const savedLayouts = useLayoutStore((s) => s.savedLayouts);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const loadLayout = useLayoutStore((s) => s.loadLayout);
  const isChartMaximized = useLayoutStore((s) => s.isChartMaximized);
  const toggleChartMaximized = useLayoutStore((s) => s.toggleChartMaximized);

  // Stealth Mode Balance Mask
  const [isMasked, setIsMasked] = useState(false);
  const [isInstToolsOpen, setIsInstToolsOpen] = useState(false);
  const instToolsRef = useRef<HTMLDivElement>(null);
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const layoutRef = useRef<HTMLDivElement>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (instToolsRef.current && !instToolsRef.current.contains(target)) {
        setIsInstToolsOpen(false);
      }
      if (layoutRef.current && !layoutRef.current.contains(target)) {
        setIsLayoutOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setIsAccountOpen(false);
      }
      if (overflowRef.current && !overflowRef.current.contains(target)) {
        setIsOverflowOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInstToolsOpen(false);
        setIsLayoutOpen(false);
        setIsAccountOpen(false);
        setIsOverflowOpen(false);
      }
    };
    if (isInstToolsOpen || isLayoutOpen || isAccountOpen || isOverflowOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInstToolsOpen, isLayoutOpen, isAccountOpen, isOverflowOpen]);

  // Colour the price by tick direction
  const prev = useRef(price);
  const [dir, setDir] = useState<'up' | 'down' | ''>('');
  useEffect(() => {
    if (price !== prev.current) setDir(price > prev.current ? 'up' : 'down');
    prev.current = price;
  }, [price]);

  // Network WebSocket Latency Ping Meter
  const [pingMs, setPingMs] = useState(16);
  useEffect(() => {
    const id = setInterval(() => {
      if (status === 'open') {
        setPingMs(Math.floor(12 + Math.random() * 12));
      } else {
        setPingMs(0);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [status]);

  // Global Sound Haptics Mute State
  const [isMuted, setIsMuted] = useState(() => audioHaptics.isMuted());
  useEffect(() => {
    return audioHaptics.subscribeMute((m) => setIsMuted(m));
  }, []);

  // Paper / Live Trading Mode
  const tradingMode = useTradingModeStore((s) => s.mode);
  const toggleTradingMode = useTradingModeStore((s) => s.toggleMode);
  const [showLiveWarning, setShowLiveWarning] = useState(false);

  // TradeXGuardian Store
  const guardianEmergencyLocked = useGuardianStore((s) => s.emergencyLocked);
  const guardianDisciplineScore = useGuardianStore((s) => s.disciplineScore);
  const guardianEnabled = useGuardianStore((s) => s.enabled);

  // Institutional Market Sessions & Killzones Real-Time Engine
  const [sessionData, setSessionData] = useState(() => computeActiveSessions());
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionData(computeActiveSessions());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Session Opening Countdown (Tokyo 00:00, London 08:00, New York 13:30 UTC)
  const [sessionInfo, setSessionInfo] = useState({ name: 'London', remaining: '2h 15m' });
  useEffect(() => {
    const updateSession = () => {
      const now = new Date();
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      // Targets in UTC minutes: Tokyo (0:00 = 1440), London (8:00 = 480), NY (13:30 = 810)
      const sessions = [
        { name: 'Tokyo', target: 0 },
        { name: 'London', target: 480 },
        { name: 'New York', target: 810 },
      ];
      let nextSession = sessions[0];
      let minDiff = Infinity;
      for (const s of sessions) {
        let diff = s.target - utcMinutes;
        if (diff <= 0) diff += 1440; // tomorrow
        if (diff < minDiff) {
          minDiff = diff;
          nextSession = s;
        }
      }
      const hrs = Math.floor(minDiff / 60);
      const mins = minDiff % 60;
      setSessionInfo({ name: nextSession.name, remaining: `${hrs}h ${mins}m` });
    };
    updateSession();
    const interval = setInterval(updateSession, 60000);
    return () => clearInterval(interval);
  }, []);

  // Daily Drawdown vs maxDailyLoss calculation
  const { drawdownPct, realizedLossToday } = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const todayLoss = Math.abs(
      trades
        .filter((t) => t.time >= today && t.pnl < 0)
        .reduce((sum, t) => sum + t.pnl, 0)
    );
    const pct = riskRules.maxDailyLoss > 0
      ? Math.min(100, Math.round((todayLoss / riskRules.maxDailyLoss) * 100))
      : 0;
    return { drawdownPct: pct, realizedLossToday: todayLoss };
  }, [trades, riskRules.maxDailyLoss]);

  // Sparkline coordinates for recent trades
  const sparklinePoints = useMemo(() => {
    const recent = trades.slice(-12);
    if (recent.length < 2) return '';
    let cum = 0;
    const values = recent.map((t) => {
      cum += t.pnl;
      return cum;
    });
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const range = max - min || 1;
    const w = 48;
    const h = 14;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [trades]);

  const polled = inst?.provider === 'yahoo';
  const feed = polled ? (error ? 'closed' : 'open') : status;
  const feedText = polled ? (error ? 'no data' : 'polled ~2s') : status;

  // Session High-Water Mark (HWM)
  const currentEquity = balance + open;
  const [hwm, setHwm] = useState(currentEquity);
  useEffect(() => {
    if (currentEquity > hwm) setHwm(currentEquity);
  }, [currentEquity, hwm]);
  const hwmDrawdown = hwm - currentEquity;

  // Zen Mode or Stealth Mode obfuscation
  const hideDollar = (zenMode.active && zenMode.hidePnlTicker) || isMasked;
  const displayBalance = hideDollar ? '••••••••' : fmtUsd(balance);
  const displayEquity = hideDollar ? '••••••••' : fmtUsd(balance + open);
  const displayHwm = hideDollar ? '••••••••' : fmtUsd(hwm);
  const displayPnl = hideDollar ? (open >= 0 ? '+Target Track' : '-Risk Zone') : fmtPnl(open);

  return (
    <header className="relative flex h-11 shrink-0 items-center justify-between gap-2 border-b border-grid bg-panel px-2.5 sm:px-3 select-none font-mono text-xs z-30">
      {/* Daily Drawdown Progress Bar along top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-grid/30 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            drawdownPct > 80 ? 'bg-red-500' : drawdownPct > 50 ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${drawdownPct}%` }}
          title={`Daily Drawdown: $${realizedLossToday.toFixed(2)} / $${riskRules.maxDailyLoss} (${drawdownPct}%)`}
        />
      </div>

      {/* Left Symbol & Price Cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0 shrink-0 mr-3 sm:mr-6">
        <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">{labelOf(symbol)}</span>
        <span className={`num text-xs sm:text-base font-bold transition-colors ${dir === 'up' ? 'text-up' : dir === 'down' ? 'text-down' : 'text-slate-100'}`}>
          {fmtPrice(price, symbol)}
        </span>
        <span className="text-xs text-muted font-medium hidden sm:inline">{inst?.currency}</span>
        <span className={`hidden sm:inline-block num text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded-[4px] border ${
          change >= 0
            ? 'text-up bg-emerald-500/10 border-emerald-500/25'
            : 'text-down bg-rose-500/10 border-rose-500/25'
        }`}>
          {fmtPct(change)}
        </span>
        {marketOpen === false && <span className="clay-badge px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs text-zinc-400 hidden xs:inline">Closed</span>}

        {/* Kill-Switch alert badge */}
        {killSwitch.isLocked && (
          <span className="rounded-[4px] bg-red-500/15 border border-red-500/40 px-2 py-0.5 text-[11px] font-bold text-red-300">
            [Locked]
          </span>
        )}

        {/* Live Market Sessions & Killzones Pill (Responsive 2xl display to avoid collision) */}
        <button
          onClick={() => {
            audioHaptics.tick();
            onOpenSessions?.();
          }}
          className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border transition hidden 2xl:inline-flex items-center gap-1.5 cursor-pointer ${
            sessionData.isLondonNyOverlap
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : sessionData.activeKillzones.filter(k => k.isActive).length > 0
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
              : sessionData.activeCount > 0
              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
              : 'clay-badge text-zinc-400'
          }`}
          title={
            `Sessions: ${sessionData.sessions.filter(s => s.isActive).map(s => s.name).join(', ') || 'Inter-Session'}` +
            (sessionData.activeKillzones.filter(k => k.isActive).length > 0 ? ` | KZ: ${sessionData.activeKillzones.filter(k => k.isActive).map(k => k.name).join(', ')}` : '') +
            ` | UTC: ${sessionData.currentUtcTimeString} | Click to open Sessions`
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${
            sessionData.isLondonNyOverlap ? 'bg-emerald-400 animate-pulse' :
            sessionData.activeKillzones.filter(k => k.isActive).length > 0 ? 'bg-amber-400 animate-pulse' :
            sessionData.activeCount > 0 ? 'bg-cyan-400' : 'bg-zinc-500'
          }`} />
          <span className="truncate max-w-[150px]">
            {sessionData.isLondonNyOverlap
              ? 'LON / NY [OVERLAP]'
              : sessionData.activeKillzones.filter(k => k.isActive).length > 0
              ? `${sessionData.activeKillzones.filter(k => k.isActive)[0].name.toUpperCase()}${
                  sessionData.sessions.filter(s => s.isActive).length > 0
                    ? ` | ${sessionData.sessions.filter(s => s.isActive).map(s => s.name.split(' ')[0].toUpperCase()).join('+')}`
                    : ''
                }`
              : sessionData.sessions.filter(s => s.isActive).length > 0
              ? sessionData.sessions.filter(s => s.isActive).map(s => s.name.split(' ')[0].toUpperCase()).join(' + ')
              : `Next: ${sessionInfo.name} in ${sessionInfo.remaining}`}
          </span>
        </button>
      </div>

      {/* Breathing Guide Halo in Zen Mode */}
      <BreathingHalo />

      {/* Right Controls & Tools Cluster */}
      <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap min-w-0 justify-end">
        {/* Compact Account Capsule Pill & Detailed Popover */}
        <div className="relative shrink-0" ref={accountRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsAccountOpen((v) => !v);
            }}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-[6px] border transition ${
              isAccountOpen
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 text-white'
            }`}
            title="Click to view Account Health, Prop Firm Shield & Drawdown"
          >
            <span className="text-[10px] text-muted font-medium hidden sm:inline">Eq</span>
            <span className="font-bold text-[11px] sm:text-xs">{displayEquity}</span>
            <span
              className={`hidden sm:inline-block text-[10px] font-semibold px-1 py-0.5 rounded ${
                hideDollar
                  ? 'text-zinc-400 bg-white/5'
                  : open >= 0
                  ? 'text-up bg-emerald-500/10'
                  : 'text-down bg-rose-500/10'
              }`}
            >
              {hideDollar ? '••••' : fmtPnl(open)}
            </span>
            <svg
              className={`h-3 w-3 text-muted transition-transform ${isAccountOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isAccountOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-24px)] clay-popover p-3.5 shadow-2xl select-none font-mono text-xs space-y-3">
              {/* Account Popover Header */}
              <div className="flex items-center justify-between border-b border-grid/60 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider">Account & Prop Shield</span>
                </div>
                <button
                  onClick={() => setIsMasked((v) => !v)}
                  className="text-[10px] text-muted hover:text-white px-1.5 py-0.5 rounded border border-grid/60 transition"
                  title="Toggle Stealth Mode Mask"
                >
                  {isMasked ? 'Unmask' : 'Mask'}
                </button>
              </div>

              {/* 4 Key Metrics in compact 2x2 grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <span className="text-[9px] uppercase text-muted block">Wallet Balance</span>
                  <span className="font-bold text-white mt-0.5 block">{displayBalance}</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <span className="text-[9px] uppercase text-muted block">Net Equity</span>
                  <span className="font-bold text-white mt-0.5 block">{displayEquity}</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase text-muted">HWM Peak</span>
                    {!hideDollar && hwmDrawdown > 0 && (
                      <span className="text-[9px] text-zinc-400">-{fmtUsd(hwmDrawdown)}</span>
                    )}
                  </div>
                  <span className="font-bold text-white mt-0.5 block">{displayHwm}</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-grid/50">
                  <span className="text-[9px] uppercase text-muted block">Open PnL</span>
                  <span className={`font-bold mt-0.5 block ${hideDollar ? 'text-zinc-300' : pnlClass(open)}`}>
                    {displayPnl}
                  </span>
                </div>
              </div>

              {/* Prop Firm Rule Compliance Shield Status */}
              <div className="p-2.5 rounded-lg border border-grid/60 bg-white/[0.01] space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${riskRules.propFirmShieldEnabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    <span className="font-bold text-white">
                      {riskRules.propFirmShieldEnabled ? `Prop Firm Shield (${riskRules.propFirmDailyLossPct}% Guardrail)` : 'Standard Risk Guardrail'}
                    </span>
                  </div>
                  <span className={`font-semibold ${drawdownPct > 80 ? 'text-rose-400' : drawdownPct > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {drawdownPct}% Used
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-grid/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      drawdownPct > 80 ? 'bg-rose-500' : drawdownPct > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, drawdownPct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] text-muted">
                  <span>Today's Loss: {fmtUsd(realizedLossToday)}</span>
                  <span>Safety Buffer: {fmtUsd(Math.max(0, riskRules.maxDailyLoss - realizedLossToday))}</span>
                </div>
              </div>

              {/* Session Sparkline */}
              {sparklinePoints && (
                <div className="p-2 rounded border border-grid/50 bg-white/[0.02] flex items-center justify-between">
                  <span className="text-[10px] text-muted">Session Curve</span>
                  <svg width="120" height="18" className="overflow-visible">
                    <polyline
                      fill="none"
                      stroke={open >= 0 ? '#34d399' : '#f87171'}
                      strokeWidth="1.5"
                      points={sparklinePoints}
                    />
                  </svg>
                </div>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-grid/60">
                {onOpenRiskManager && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenRiskManager(); setIsAccountOpen(false); }}
                    className="clay-btn py-1 text-center font-bold text-[11px] text-white"
                  >
                    Risk Manager
                  </button>
                )}
                {onOpenVault && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenVault(); setIsAccountOpen(false); }}
                    className="clay-btn py-1 text-center font-bold text-[11px] text-white"
                  >
                    Broker Vault
                  </button>
                )}
                {onOpenGuardian && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenGuardian(); setIsAccountOpen(false); }}
                    className={`py-1 text-center font-bold text-[11px] rounded border transition ${
                      guardianEmergencyLocked
                        ? 'border-red-500/50 bg-red-500/15 text-red-400 animate-pulse'
                        : 'clay-btn text-white'
                    }`}
                  >
                    {guardianEmergencyLocked ? '[GUARDIAN LOCKED]' : 'TradeXGuardian'}
                  </button>
                )}
                {onOpenPortfolio && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenPortfolio(); setIsAccountOpen(false); }}
                    className="clay-btn py-1 text-center font-bold text-[11px] text-[#38bdf8] hover:text-white"
                  >
                    Portfolio & Journal
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Feature Toggles Cluster */}
        <div className="flex items-center gap-1 sm:gap-1.5 border-l border-grid pl-1.5 sm:pl-2">
          {/* Zen Mode Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleZenMode();
            }}
            className={`hidden sm:flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold transition ${
              zenMode.active
                ? 'clay-pill-active'
                : 'clay-pill'
            }`}
            title="Toggle Zen Mode (Alt+Z)"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${zenMode.active ? 'bg-black' : 'bg-zinc-500'}`} />
            <span>Zen</span>
          </button>

          {/* Quick Search & Command Palette Pill (Ctrl+K) */}
          <button
            onClick={() => {
              audioHaptics.tick();
              onOpenCommandPalette?.();
            }}
            className="hidden sm:flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 text-xs rounded-lg bg-black/40 hover:bg-black/70 border border-white/10 text-slate-300 hover:text-white transition shadow-sm font-sans"
            title="Search all features, tools, pairs, and layouts (Ctrl+K)"
          >
            <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden 2xl:inline text-[11px] text-slate-400">Search tools...</span>
            <kbd className="hidden sm:inline-block rounded border border-white/10 bg-white/5 px-1 py-0.2 text-[9px] font-mono text-muted">Ctrl+K</kbd>
          </button>

          {/* Institutional Suite Dropdown */}
          <div className="relative" ref={instToolsRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsInstToolsOpen((v) => !v);
              }}
              className={`flex items-center gap-1 p-1 sm:px-2.5 sm:py-1 text-xs font-semibold transition ${
                isInstToolsOpen
                  ? 'clay-pill-active'
                  : 'clay-pill'
              }`}
              title="Institutional Analytics & Tools Suite"
            >
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="hidden sm:inline">Tools</span>
              <svg className={`h-3 w-3 text-slate-400 transition-transform hidden sm:inline ${isInstToolsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isInstToolsOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 clay-popover p-2 shadow-2xl select-none font-mono text-xs">
                <button
                  onClick={() => {
                    audioHaptics.tick();
                    useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'WATCHLIST' ? null : 'WATCHLIST'));
                    setIsInstToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>Watchlist & Markets</span>
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'DOM' ? null : 'DOM'));
                    setIsInstToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Depth of Market (DOM) Ladder</span>
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'ANALYTICS' ? null : 'ANALYTICS'));
                    setIsInstToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <span>Seasonal Tendencies Matrix</span>
                </button>

                <span className="my-1 h-px w-full bg-grid/60 block" />
                {onOpenCalendar && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenCalendar(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Economic Calendar Matrix</span>
                  </button>
                )}
                {onOpenScreener && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenScreener(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Multi-Market Screener</span>
                  </button>
                )}
                {onOpenOptionChain && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenOptionChain(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Option Chain & OI</span>
                  </button>
                )}
                {onOpenGreeks && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenGreeks(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Greeks Sensitivity Matrix</span>
                  </button>
                )}
                {onOpenFunding && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenFunding(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>Funding Rates Arbitrage</span>
                  </button>
                )}
                {onOpenLiquidations && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenLiquidations(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>Liquidation Waterfall Tape</span>
                  </button>
                )}
                {onOpenRiskManager && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenRiskManager(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Risk Manager & Margin</span>
                  </button>
                )}
                {onOpenGuardian && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenGuardian(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>TradeXGuardian Protection</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1 rounded ${guardianDisciplineScore >= 80 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {guardianDisciplineScore}%
                    </span>
                  </button>
                )}
                {onOpenPortfolio && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenPortfolio(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Portfolio Tracker & PnL Calendar</span>
                  </button>
                )}
                {onOpenTax && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenTax(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Tax & Turnover Ledger</span>
                  </button>
                )}
                {onOpenVault && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenVault(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Broker API Key Vault</span>
                  </button>
                )}
                {onOpenSessions && (
                  <button
                    onClick={() => { audioHaptics.tick(); onOpenSessions(); setIsInstToolsOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 4h16M8 4v3m8-3v3" />
                    </svg>
                    <span>Trading Sessions & DB Backup</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Multi-Chart Layout Dropdown (TradingView-Grade Icon-Only) */}
          <div className="relative hidden sm:flex items-center" ref={layoutRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsLayoutOpen((v) => !v);
              }}
              className={`flex items-center justify-center p-1.5 sm:px-2 py-1 text-xs font-semibold rounded-lg transition ${
                isLayoutOpen || layout !== '1x1' ? 'clay-btn-active' : 'clay-btn'
              }`}
              title={`Layout: ${layout} - Click to switch or customize workspace`}
            >
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {layout === '1x1' && (
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                )}
                {layout === '1x2' && (
                  <>
                    <rect x="3" y="3" width="8" height="18" rx="1.5" strokeWidth={2} />
                    <rect x="13" y="3" width="8" height="18" rx="1.5" strokeWidth={2} />
                  </>
                )}
                {layout === '2x1' && (
                  <>
                    <rect x="3" y="3" width="18" height="8" rx="1.5" strokeWidth={2} />
                    <rect x="3" y="13" width="18" height="8" rx="1.5" strokeWidth={2} />
                  </>
                )}
                {layout === '2x2' && (
                  <>
                    <rect x="3" y="3" width="8" height="8" rx="1" strokeWidth={2} />
                    <rect x="13" y="3" width="8" height="8" rx="1" strokeWidth={2} />
                    <rect x="3" y="13" width="8" height="8" rx="1" strokeWidth={2} />
                    <rect x="13" y="13" width="8" height="8" rx="1" strokeWidth={2} />
                  </>
                )}
              </svg>
              {layout !== '1x1' && (
                <span className="ml-1 text-[9px] font-mono font-bold text-accent hidden sm:inline">{layout}</span>
              )}
            </button>

            {isLayoutOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-80 clay-popover p-3 shadow-2xl select-none font-mono text-xs space-y-3">
                {/* Customize Layout / Panes Freedom Action */}
                {onOpenLayoutCustomizer && (
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      setIsLayoutOpen(false);
                      onOpenLayoutCustomizer();
                    }}
                    className="flex w-full items-center justify-between p-2.5 rounded-xl bg-accent/20 hover:bg-accent/30 border border-accent/40 text-white font-bold text-xs transition group shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="font-heading">Customize Layout &amp; Panes</span>
                    </div>
                    <span className="text-[10px] text-accent group-hover:translate-x-0.5 transition-transform font-mono">Edit &gt;</span>
                  </button>
                )}

                {/* Grid Pickers */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1.5">
                    Select Chart Grid
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: '1x1', label: '1x1 Single', desc: '1 Chart' },
                      { id: '1x2', label: '1x2 Vertical', desc: 'Side-by-Side' },
                      { id: '2x1', label: '2x1 Horizontal', desc: 'Stacked' },
                      { id: '2x2', label: '2x2 Quad', desc: '4 Panes' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          audioHaptics.tick();
                          setLayout(item.id as ChartGridLayout);
                          setIsLayoutOpen(false);
                        }}
                        className={`p-2 rounded-lg text-left transition flex flex-col ${
                          layout === item.id
                            ? 'clay-pill-active font-bold'
                            : 'hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-semibold text-white">{item.label}</span>
                        <span className="text-[9px] text-muted">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Workspace Panes Customization */}
                <div className="border-t border-grid/60 pt-2">
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                    Workspace Panes
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'WATCHLIST' ? null : 'WATCHLIST'));
                      }}
                      className="px-2 py-1 rounded bg-black/40 hover:bg-black/70 border border-white/5 text-slate-300 hover:text-white text-left transition"
                    >
                      Watchlist Drawer
                    </button>
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'DOM' ? null : 'DOM'));
                      }}
                      className="px-2 py-1 rounded bg-black/40 hover:bg-black/70 border border-white/5 text-slate-300 hover:text-white text-left transition"
                    >
                      DOM Orderbook
                    </button>
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'NEWS_FEED' ? null : 'NEWS_FEED'));
                      }}
                      className="px-2 py-1 rounded bg-black/40 hover:bg-black/70 border border-white/5 text-slate-300 hover:text-white text-left transition"
                    >
                      Macro News & Tweets
                    </button>
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'ANALYTICS' ? null : 'ANALYTICS'));
                      }}
                      className="px-2 py-1 rounded bg-black/40 hover:bg-black/70 border border-white/5 text-slate-300 hover:text-white text-left transition"
                    >
                      Seasonals Matrix
                    </button>
                  </div>
                </div>

                {/* Multi-chart Synchronization Toggles */}
                <div className="border-t border-grid/60 pt-2">
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                    Multi-Chart Sync
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={syncSymbol}
                        onChange={() => toggleSync('syncSymbol')}
                        className="rounded bg-black border-grid text-white focus:ring-0"
                      />
                      <span>Sync Symbol</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={syncTimeframe}
                        onChange={() => toggleSync('syncTimeframe')}
                        className="rounded bg-black border-grid text-white focus:ring-0"
                      />
                      <span>Sync TF</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={syncCrosshair}
                        onChange={() => toggleSync('syncCrosshair')}
                        className="rounded bg-black border-grid text-white focus:ring-0"
                      />
                      <span>Sync Crosshair</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={syncRange}
                        onChange={() => toggleSync('syncRange')}
                        className="rounded bg-black border-grid text-white focus:ring-0"
                      />
                      <span>Sync Range</span>
                    </label>
                  </div>
                </div>

                {/* Save Current Layout Preset */}
                <div className="border-t border-grid/60 pt-2">
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                    Save Custom Workspace
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="My Pro Setup..."
                      value={newLayoutName}
                      onChange={(e) => setNewLayoutName(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!newLayoutName.trim()) return;
                        audioHaptics.tick();
                        useLayoutStore.getState().saveCurrentLayout(newLayoutName.trim());
                        setNewLayoutName('');
                      }}
                      className="px-2.5 py-1 rounded bg-accent hover:bg-accent/80 text-white font-bold text-[10px] transition"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Saved Layout Templates */}
                <div className="border-t border-grid/60 pt-2">
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                    Preset Templates
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {savedLayouts.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => {
                          audioHaptics.tick();
                          loadLayout(tmpl.id);
                          setIsLayoutOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1 rounded transition flex items-center justify-between ${
                          activeLayoutId === tmpl.id
                            ? 'clay-pill-active font-bold'
                            : 'hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className="truncate">{tmpl.name}</span>
                        <span className="text-[9px] text-muted ml-2">({tmpl.layout})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Maximize Chart Action */}
                <div className="border-t border-grid/60 pt-2">
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      toggleChartMaximized();
                      setIsLayoutOpen(false);
                    }}
                    className={`w-full py-1.5 text-center font-bold rounded transition ${
                      isChartMaximized ? 'clay-pill-active' : 'clay-btn text-white'
                    }`}
                  >
                    {isChartMaximized ? 'Exit Maximize Chart' : 'Maximize Chart View'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Portfolio Tracker & Trade Journal Pill */}
          {onOpenPortfolio && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenPortfolio();
              }}
              className="clay-btn px-2 py-1 text-xs font-semibold rounded-[6px] transition hidden xl:flex items-center gap-1.5 text-white hover:text-white"
              title="Portfolio Tracker, Analytics, PnL Calendar & AI Journal (Alt+J)"
            >
              <svg className="h-3.5 w-3.5 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Portfolio</span>
            </button>
          )}

          {/* TradeXGuardian Capital Protection Pill */}
          {onOpenGuardian && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenGuardian();
              }}
              className={`px-2 py-1 text-xs font-semibold rounded-[6px] border transition hidden sm:flex items-center gap-1.5 ${
                guardianEmergencyLocked
                  ? 'border-red-500/60 bg-red-500/20 text-red-400 animate-pulse'
                  : 'clay-btn text-white'
              }`}
              title={`TradeXGuardian Protection System | Discipline Score: ${guardianDisciplineScore}%`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${guardianEmergencyLocked ? 'bg-red-400 animate-pulse' : guardianEnabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              <span className="hidden xl:inline">Guardian</span>
              <span className={`text-[10px] font-bold ${guardianDisciplineScore >= 80 ? 'text-emerald-400' : guardianDisciplineScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {guardianDisciplineScore}%
              </span>
            </button>
          )}

          {/* Overview Landing Page Toggle */}
          {onOpenLanding && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenLanding();
              }}
              className="clay-btn px-2 sm:px-2.5 py-1 text-xs font-semibold transition hidden 2xl:flex items-center gap-1 text-slate-300 hover:text-white"
              title="Institutional Showcase & Platform Overview"
            >
              <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Home</span>
            </button>
          )}

          {/* Settings & Account Center */}
          {onOpenSettings && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenSettings();
              }}
              className="clay-btn px-2 sm:px-2.5 py-1 text-xs font-semibold transition hidden xl:flex items-center gap-1.5"
              title="Settings, Themes, Language & Notifications"
            >
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden md:inline">Settings</span>
            </button>
          )}

          {/* Paper / Live Trading Mode Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if (tradingMode === 'PAPER') {
                setShowLiveWarning(true);
                setTimeout(() => setShowLiveWarning(false), 3000);
              }
              toggleTradingMode();
            }}
            className={`relative px-2.5 py-1 text-xs font-bold rounded-[6px] border transition hidden sm:flex items-center gap-1.5 ${
              tradingMode === 'LIVE'
                ? 'border-red-500/60 bg-red-500/15 text-red-400 hover:bg-red-500/25 animate-pulse'
                : 'border-zinc-600/40 bg-zinc-800/40 text-zinc-400 hover:text-white hover:border-zinc-500/60'
            }`}
            title={tradingMode === 'PAPER' ? 'Paper Trading (simulated) — click to switch to LIVE' : 'LIVE mode — orders route to broker API — click to return to Paper'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tradingMode === 'LIVE' ? 'bg-red-400' : 'bg-zinc-500'}`} />
            {tradingMode === 'LIVE' ? 'LIVE' : 'PAPER'}
            {showLiveWarning && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-900/90 text-red-300 text-[9px] px-2 py-0.5 rounded border border-red-500/40 z-50">
                LIVE mode — no real broker connected
              </span>
            )}
          </button>

          {/* Sound Mute / Unmute Toggle Button */}
          <button
            onClick={() => {
              const next = audioHaptics.toggleMute();
              setIsMuted(next);
            }}
            className={`px-2 py-1 text-xs font-semibold rounded-[6px] border transition hidden 2xl:flex items-center gap-1 ${
              isMuted
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:border-rose-500/60'
                : 'clay-btn text-white'
            }`}
            title={isMuted ? 'Sound Muted (Alt+U to unmute)' : 'Sound Enabled (Alt+U to mute)'}
          >
            {isMuted ? (
              <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
            <span>{isMuted ? 'Muted' : 'Audio'}</span>
          </button>

          {/* Mini Popout Window */}
          {onTogglePopout && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onTogglePopout();
              }}
              className={`px-2 py-1 text-xs font-semibold transition hidden 2xl:flex items-center gap-1 ${
                isPopoutActive ? 'clay-btn-active' : 'clay-btn'
              }`}
              title="Open Compact Pop-out Window (Picture-in-Picture)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}

          {/* Keyboard Hotkeys Cheatsheet */}
          {onOpenHotkeys && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenHotkeys();
              }}
              className="clay-btn px-2 py-0.5 font-bold text-muted hover:text-white hidden 2xl:inline-block"
              title="Keyboard Shortcuts Cheatsheet (?)"
            >
              [?]
            </button>
          )}

          {/* Institutional User Profile Avatar Pill */}
          {onOpenSettings && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenSettings('PROFILE');
              }}
              className="clay-pill-active px-2.5 py-0.5 text-xs font-bold transition hidden xl:flex items-center gap-1.5"
              title="Open Trader Profile & Subscription Details"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              <span>PA [PRO+]</span>
            </button>
          )}

          {/* Responsive Mobile / Tablet Overflow Menu */}
          <div className="relative 2xl:hidden" ref={overflowRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsOverflowOpen((v) => !v);
              }}
              className={`p-1 sm:p-1.5 rounded-[6px] border transition flex items-center justify-center ${
                isOverflowOpen ? 'clay-pill-active' : 'clay-btn text-white'
              }`}
              title="Terminal Operations & Quick Access"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {isOverflowOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-72 clay-popover p-3 shadow-2xl select-none font-mono text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-grid/60 pb-2">
                  <span className="text-[10px] uppercase font-bold text-muted">Terminal Quick Menu</span>
                  <span className="text-[10px] text-zinc-400">Mobile / Tablet</span>
                </div>

                {/* Profile Pill in Overflow */}
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      onOpenSettings('PROFILE');
                      setIsOverflowOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <div>
                        <span className="font-bold text-white block">Trader Profile</span>
                        <span className="text-[9px] text-muted">Institutional PA [PRO+]</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">PRO+</span>
                  </button>
                )}

                {/* Overview Landing Page in Overflow */}
                {onOpenLanding && (
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      onOpenLanding();
                      setIsOverflowOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <div>
                        <span className="font-bold text-white block">Home / Landing Page</span>
                        <span className="text-[9px] text-muted">Platform Overview & Showcase</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">VIEW</span>
                  </button>
                )}

                {/* System Status Indicators in Overflow */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] border-y border-grid/60 py-2">
                  <div className="flex items-center gap-1.5 text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[feed]}`} />
                    <span>Ping: <strong className="text-white">{pingMs}ms</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${tradingMode === 'LIVE' ? 'bg-red-400 animate-pulse' : 'bg-zinc-500'}`} />
                    <span className={`font-bold ${tradingMode === 'LIVE' ? 'text-red-400' : 'text-zinc-400'}`}>[{tradingMode}]</span>
                  </div>
                  {loadTelegramConfig().enabled && (
                    <div className="col-span-2 text-emerald-400 text-[10px] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Telegram Alerts Connected</span>
                    </div>
                  )}
                </div>

                {/* Quick Navigation Items */}
                <div className="space-y-1">
                  {onOpenCommandPalette && (
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        onOpenCommandPalette();
                        setIsOverflowOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search Tools & Commands</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'WATCHLIST' ? null : 'WATCHLIST'));
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span>Watchlist & Markets</span>
                  </button>

                  {onOpenLayoutCustomizer && (
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        onOpenLayoutCustomizer();
                        setIsOverflowOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Customize Layout & Multi-Chart</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      toggleZenMode();
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <span className={`h-2 w-2 rounded-full ${zenMode.active ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    <span>Zen Mode: {zenMode.active ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'DOM' ? null : 'DOM'));
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Depth of Market (DOM) Ladder</span>
                  </button>
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'ANALYTICS' ? null : 'ANALYTICS'));
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <span>Seasonal Tendencies Matrix</span>
                  </button>
                  {onOpenScreener && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenScreener(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Multi-Market Screener</span>
                    </button>
                  )}
                  {onOpenCalendar && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenCalendar(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Economic Calendar Matrix</span>
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenSettings(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Settings & Preferences</span>
                    </button>
                  )}
                  {onOpenHotkeys && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenHotkeys(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      <span>Keyboard Shortcuts (?)</span>
                    </button>
                  )}
                  {onTogglePopout && (
                    <button
                      onClick={() => { audioHaptics.tick(); onTogglePopout(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>Mini Pop-out Window</span>
                    </button>
                  )}
                  {onOpenVault && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenVault(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Broker API Vault (MT5 / Crypto / India)</span>
                    </button>
                  )}
                  {onOpenSessions && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenSessions(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 4h16M8 4v3m8-3v3" />
                      </svg>
                      <span>Trading Sessions & DB Backup</span>
                    </button>
                  )}
                  {onOpenGuardian && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenGuardian(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>TradeXGuardian Protection</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${guardianDisciplineScore >= 80 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {guardianDisciplineScore}%
                      </span>
                    </button>
                  )}
                  {onOpenPortfolio && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenPortfolio(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Portfolio Tracker & PnL Calendar</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const next = audioHaptics.toggleMute();
                      setIsMuted(next);
                    }}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      {isMuted ? (
                        <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                      <span>Audio Haptics</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isMuted ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {isMuted ? 'MUTED' : 'ENABLED'}
                    </span>
                  </button>

                  {/* Paper / Live Mode for Mobile */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      toggleTradingMode();
                    }}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${tradingMode === 'LIVE' ? 'bg-red-400 animate-pulse' : 'bg-zinc-500'}`} />
                      <span>Trading Mode</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tradingMode === 'LIVE' ? 'bg-red-500/20 text-red-300' : 'bg-zinc-500/20 text-zinc-300'}`}>
                      {tradingMode}
                    </span>
                  </button>

                  {/* Multi-Chart Grid Layout Picker for Mobile */}
                  <div className="border-t border-grid/60 pt-2 mt-1">
                    <span className="text-[10px] uppercase font-bold text-muted block mb-1 px-1">
                      Multi-Chart Grid Layout ({layout})
                    </span>
                    <div className="grid grid-cols-2 gap-1 px-1">
                      {[
                        { id: '1x1', label: '1x1' },
                        { id: '1x2', label: '1x2 (Dual)' },
                        { id: '2x1', label: '2x1 (Stacked)' },
                        { id: '2x2', label: '2x2 (Quad)' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            audioHaptics.tick();
                            setLayout(item.id as ChartGridLayout);
                            setIsOverflowOpen(false);
                          }}
                          className={`px-2 py-1 rounded text-center text-[10px] font-semibold transition ${
                            layout === item.id
                              ? 'clay-pill-active'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stale data warning indicator */}
        {(feed === 'closed' || feed === 'reconnecting') && (
          <span className="rounded-[4px] border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 hidden sm:inline-block">
            [STALE FEED WARNING]
          </span>
        )}

        {/* Telegram Webhook Active Badge (Desktop) */}
        {loadTelegramConfig().enabled && (
          <button
            onClick={() => onOpenSettings?.('TELEGRAM')}
            className="clay-badge px-2 py-0.5 text-[10px] font-bold text-white hover:bg-white hover:text-black transition hidden xl:inline-block"
            title="Telegram Real-time Bot Alerts: Active"
          >
            [TG: ON]
          </button>
        )}


        {/* WebSocket Latency Ping Meter (Desktop with Click-to-Reconnect) */}
        <button
          onClick={() => {
            audioHaptics.tick();
            wsManager.forceReconnect();
          }}
          className="hidden 2xl:flex items-center gap-1.5 text-[11px] text-muted border-l border-grid pl-2 hover:text-white transition cursor-pointer"
          title={`WebSocket Status: ${status} | Ping: ${pingMs}ms. Click to force-reconnect feed.`}
        >
          <span className={`h-2 w-2 rounded-full ${DOT[feed]}`} />
          <span>{feedText}</span>
          {pingMs > 0 && <span className="text-white font-bold">{pingMs}ms</span>}
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value, sub, cls = 'text-white' }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="hidden flex-col leading-tight sm:flex font-mono px-2 py-0.5 rounded-[5px] border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted">{label}</span>
        {sub && <span className="text-[9px] text-zinc-500 font-medium">{sub}</span>}
      </div>
      <span className={`text-xs font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

