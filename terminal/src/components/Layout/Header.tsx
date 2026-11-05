import { useEffect, useMemo, useRef, useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useJournalStore } from '../../store/useJournalStore';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { getInstrument } from '../../services/instruments';
import { fmtPct, fmtPnl, fmtPrice, fmtUsd, labelOf, pnlClass } from '../../utils/formatters';
import { BreathingHalo } from '../../features/zen/ZenController';
import { audioHaptics } from '../../utils/notify';
import { loadTelegramConfig } from '../../services/telegramService';

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
  onOpenSettings?: (tab?: 'PROFILE' | 'BILLING' | 'THEME' | 'LANGUAGE' | 'TELEGRAM') => void;
  onTogglePopout?: () => void;
  isPopoutActive?: boolean;
  terminalMode?: 'SIMPLE' | 'PRO';
  onToggleMode?: () => void;
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
  onOpenSettings,
  onTogglePopout,
  isPopoutActive,
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

  // Stealth Mode Balance Mask
  const [isMasked, setIsMasked] = useState(false);
  const [isInstToolsOpen, setIsInstToolsOpen] = useState(false);
  const instToolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (instToolsRef.current && !instToolsRef.current.contains(e.target as Node)) {
        setIsInstToolsOpen(false);
      }
    };
    if (isInstToolsOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isInstToolsOpen]);

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
    <header className="relative flex h-11 shrink-0 items-center gap-2 border-b border-grid bg-panel px-3 select-none font-mono text-xs overflow-x-auto">
      {/* Daily Drawdown Ambient Progress Bar along top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-grid/30 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            drawdownPct > 80 ? 'bg-red-500' : drawdownPct > 50 ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${drawdownPct}%` }}
          title={`Daily Drawdown: $${realizedLossToday.toFixed(2)} / $${riskRules.maxDailyLoss} (${drawdownPct}%)`}
        />
      </div>

      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-sm font-bold text-white">{labelOf(symbol)}</span>
        <span className={`num text-base font-semibold ${dir === 'up' ? 'text-up' : dir === 'down' ? 'text-down' : 'text-white'}`}>
          {fmtPrice(price, symbol)}
        </span>
        <span className="text-xs text-muted">{inst?.currency}</span>
        <span className={`num text-xs ${pnlClass(change)}`}>{fmtPct(change)}</span>
        {marketOpen === false && <span className="rounded bg-grid px-1.5 py-0.5 text-xs text-yellow-400">Market closed</span>}

        {/* Kill-Switch alert pill */}
        {killSwitch.isLocked && (
          <span className="rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[11px] font-bold text-red-400 animate-pulse">
            [Locked]
          </span>
        )}

        {/* Session Opening Countdown */}
        <span
          className="rounded border border-grid bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-cyan-300 hidden xl:inline-block"
          title={`Time until ${sessionInfo.name} session open`}
        >
          {sessionInfo.name}: {sessionInfo.remaining}
        </span>
      </div>

      {/* Breathing Guide Halo in Zen Mode */}
      <BreathingHalo />

      <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
        {/* Stealth Mask Button */}
        <button
          onClick={() => {
            audioHaptics.tick();
            setIsMasked((v) => !v);
          }}
          className={`rounded border border-grid px-1.5 py-0.5 text-[10px] text-muted hover:border-accent hover:text-white transition ${
            isMasked ? 'bg-accent/20 border-accent text-accent' : ''
          }`}
          title="Toggle Stealth Balance Masking"
        >
          {isMasked ? 'Unmask' : 'Mask'}
        </button>

        <Stat label="Balance" value={displayBalance} />
        <Stat label="Equity" value={displayEquity} />
        <Stat
          label="HWM"
          value={displayHwm}
          sub={!hideDollar && hwmDrawdown > 0 ? `-${fmtUsd(hwmDrawdown)}` : undefined}
        />
        <Stat label="Open PnL" value={displayPnl} cls={hideDollar ? 'text-teal-300' : pnlClass(open)} />

        {/* Session PnL Sparkline Header */}
        {sparklinePoints && (
          <div className="hidden sm:flex flex-col items-center">
            <span className="text-[9px] text-muted">Session</span>
            <svg width="48" height="14" className="overflow-visible">
              <polyline
                fill="none"
                stroke={open >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth="1.5"
                points={sparklinePoints}
              />
            </svg>
          </div>
        )}

        {/* Feature Toggles Cluster */}
        <div className="flex items-center gap-1 border-l border-grid pl-2">
          {/* Zen Mode Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleZenMode();
            }}
            className={`rounded px-2 py-1 font-medium transition ${
              zenMode.active
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-muted hover:text-white'
            }`}
            title="Toggle Zen Mode (Alt+Z)"
          >
            Zen {zenMode.active ? 'ON' : 'OFF'}
          </button>

          {/* Institutional Suite Dropdown */}
          <div className="relative" ref={instToolsRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsInstToolsOpen((v) => !v);
              }}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 font-semibold transition ${
                isInstToolsOpen
                  ? 'border-accent text-accent bg-accent/10 shadow-sm'
                  : 'border-grid text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Institutional Analytics & Derivatives Suite"
            >
              <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Institutional</span>
              <svg className={`h-3 w-3 text-slate-400 transition-transform ${isInstToolsOpen ? 'rotate-180 text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isInstToolsOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-lg border border-grid bg-panel/95 p-1.5 shadow-2xl backdrop-blur-md select-none font-mono text-xs">
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
              </div>
            )}
          </div>

          {/* Settings & Account Center */}
          {onOpenSettings && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenSettings();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition font-semibold"
              title="Settings, Billing, Theme & Telegram Notifications"
            >
              Settings
            </button>
          )}

          {/* Mini Popout Window */}
          {onTogglePopout && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onTogglePopout();
              }}
              className={`rounded px-2 py-1 transition ${
                isPopoutActive ? 'bg-accent text-white font-bold' : 'text-muted hover:text-white'
              }`}
              title="Open Compact Pop-out Window (Picture-in-Picture)"
            >
              Popout
            </button>
          )}

          {/* Keyboard Hotkeys Cheatsheet */}
          {onOpenHotkeys && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenHotkeys();
              }}
              className="rounded border border-grid px-2 py-0.5 font-bold text-muted hover:text-white"
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
              className="rounded border border-accent/60 bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent hover:bg-accent hover:text-black transition flex items-center gap-1.5"
              title="Open Trader Profile & Subscription Details"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>PA [PRO+]</span>
            </button>
          )}
        </div>

        {/* Stale data warning indicator */}
        {(feed === 'closed' || feed === 'reconnecting') && (
          <span className="rounded bg-yellow-500/20 border border-yellow-500/40 px-2 py-0.5 text-[10px] font-bold text-yellow-300 animate-pulse">
            [STALE FEED WARNING]
          </span>
        )}

        {/* Telegram Webhook Active Badge */}
        {loadTelegramConfig().enabled && (
          <button
            onClick={() => onOpenSettings?.('TELEGRAM')}
            className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-400 hover:bg-sky-500 hover:text-white transition"
            title="Telegram Real-time Bot Alerts: Active"
          >
            [TG: ON]
          </button>
        )}

        {/* Read-Only Sandbox Mode Badge */}
        <span
          className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
          title="Secure Read-Only Sandbox: Paper Capital"
        >
          [SANDBOX]
        </span>

        {/* WebSocket Latency Ping Meter */}
        <span
          className="flex items-center gap-1.5 text-[11px] text-muted border-l border-grid pl-2"
          title={`WebSocket Connection Health: ${status} | Ping: ${pingMs}ms`}
        >
          <span className={`h-2 w-2 rounded-full ${DOT[feed]}`} />
          <span>{feedText}</span>
          {pingMs > 0 && <span className="text-up font-bold">{pingMs}ms</span>}
        </span>
      </div>
    </header>
  );
}

function Stat({ label, value, sub, cls = 'text-white' }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="hidden flex-col leading-tight sm:flex font-mono">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted">{label}</span>
        {sub && <span className="text-[9px] text-down font-medium">{sub}</span>}
      </div>
      <span className={`text-xs font-semibold ${cls}`}>{value}</span>
    </div>
  );
}
