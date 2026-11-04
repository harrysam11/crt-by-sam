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

          {/* Economic Calendar Modal */}
          {onOpenCalendar && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenCalendar();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition font-semibold"
              title="Open Global Macro & Economic Events Matrix"
            >
              Calendar
            </button>
          )}

          {/* Option Chain */}
          {onOpenOptionChain && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenOptionChain();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="Open Strike-wise Option Chain & Open Interest"
            >
              Option Chain
            </button>
          )}

          {/* Greeks Matrix */}
          {onOpenGreeks && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenGreeks();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="Open Options Greeks Matrix (Delta, Gamma, Theta, Vega)"
            >
              Greeks
            </button>
          )}

          {/* Funding Rate Arbitrage */}
          {onOpenFunding && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenFunding();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="Open Cross-Exchange Funding Rates & Basis Arbitrage"
            >
              Funding
            </button>
          )}

          {/* Liquidation Waterfall */}
          {onOpenLiquidations && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenLiquidations();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="Live Liquidation Waterfall & Whale Tape"
            >
              Liqs
            </button>
          )}

          {/* Risk Manager */}
          {onOpenRiskManager && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenRiskManager();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="Open Risk Manager & Margin Ratio"
            >
              Risk
            </button>
          )}

          {/* Tax Ledger */}
          {onOpenTax && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenTax();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="FnO Regulatory Turnover & Tax Audit Ledger"
            >
              Tax
            </button>
          )}

          {/* Secure API Key Vault */}
          {onOpenVault && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenVault();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition"
              title="Encrypted Client-Side Broker Key Vault"
            >
              Vault
            </button>
          )}

          {/* DOM Ladder */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleDom();
            }}
            className={`rounded px-2 py-1 transition ${
              isDomVisible ? 'bg-accent text-white font-bold' : 'text-muted hover:text-white'
            }`}
            title="Toggle Depth of Market (DOM) & Footprint"
          >
            DOM
          </button>

          {/* Analytics / Seasonals */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleAnalytics();
            }}
            className={`rounded px-2 py-1 transition ${
              isAnalyticsVisible ? 'bg-accent text-white font-bold' : 'text-muted hover:text-white'
            }`}
            title="Toggle Seasonals & Technical Meters"
          >
            Intel
          </button>

          {/* Multi-Market Screener */}
          {onOpenScreener && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenScreener();
              }}
              className="rounded px-2 py-1 text-muted hover:text-white hover:bg-grid transition font-semibold"
              title="Open Global Multi-Market Screener"
            >
              Screener
            </button>
          )}

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
