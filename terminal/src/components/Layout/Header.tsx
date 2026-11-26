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
import MobileConnectModal from '../Network/MobileConnectModal';
import SymbolSearchModal from '../Search/SymbolSearchModal';
import { drawingEvents } from '../drawing/framework/DrawingEvents';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCloudStorageStore } from '../../store/useCloudStorageStore';
import TerminalXLogo from '../common/TerminalXLogo';
import type { ChartStyle, Timeframe } from '../../types/terminal';

import { TIMEFRAMES } from '../../services/instruments';

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
  onOpenQuantAI?: () => void;
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
  onOpenQuantAI,
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
  const accounts = useTerminalStore((s) => s.accounts || []);
  const activeAccountId = useTerminalStore((s) => s.activeAccountId);
  const switchAccount = useTerminalStore((s) => s.switchAccount);
  const createAccount = useTerminalStore((s) => s.createAccount);
  const resetAccountBalance = useTerminalStore((s) => s.resetAccountBalance);
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [isMobileConnectOpen, setIsMobileConnectOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'PAPER' | 'PROP_FIRM' | 'BINANCE_FUTURES' | 'BYBIT' | 'DEMO'>('PROP_FIRM');
  const [newAccBalance, setNewAccBalance] = useState('50000');
  const [newAccCurrency, setNewAccCurrency] = useState('USD');
  const [newAccFirm, setNewAccFirm] = useState('Apex Trader Funding');
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

  // TradingView / DMCharts Unified Chart Navigation State
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const setTimeframe = useTerminalStore((s) => s.setTimeframe);
  const activePaneId = useLayoutStore((s) => s.activePaneId);
  const setPaneSymbol = useLayoutStore((s) => s.setPaneSymbol);
  const setPaneTimeframe = useLayoutStore((s) => s.setPaneTimeframe);
  const chartStyle = useLayoutStore((s) => s.chartStyle) || 'CANDLE';
  const setChartStyle = useLayoutStore((s) => s.setChartStyle);
  const activeIndicators = useIndicatorsStore((s) => s.activeInstances);

  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
  const [isTfMenuOpen, setIsTfMenuOpen] = useState(false);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isCandleColorOpen, setIsCandleColorOpen] = useState(false);
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState(false);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const tfMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const candleColorRef = useRef<HTMLDivElement>(null);
  const layersMenuRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const syncWorkspace = useAuthStore((s) => s.syncWorkspace);
  const isSyncing = useAuthStore((s) => s.isSyncing);
  const logout = useAuthStore((s) => s.logout);


  // Live Candle Color sync
  const [candleSettings, setCandleSettings] = useState<{ candleUpColor: string; candleDownColor: string }>(() => {
    try {
      const s = localStorage.getItem('crt_chart_settings');
      return s ? JSON.parse(s) : { candleUpColor: '#ffffff', candleDownColor: '#101015' };
    } catch {
      return { candleUpColor: '#ffffff', candleDownColor: '#101015' };
    }
  });

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setCandleSettings({
          candleUpColor: e.detail.candleUpColor || '#ffffff',
          candleDownColor: e.detail.candleDownColor || '#101015',
        });
      }
    };
    window.addEventListener('crt-chart-settings-changed', handleSync);
    return () => window.removeEventListener('crt-chart-settings-changed', handleSync);
  }, []);

  const applyCandlePreset = (up: string, down: string) => {
    setCandleSettings({ candleUpColor: up, candleDownColor: down });
    try {
      const raw = localStorage.getItem('crt_chart_settings');
      const prev = raw ? JSON.parse(raw) : {};
      // Palette presets update the complete candle appearance, not only the body fill.
      const next = {
        ...prev,
        candleUpColor: up,
        candleDownColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      };
      localStorage.setItem('crt_chart_settings', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('crt-chart-settings-changed', { detail: next }));
    } catch {}
    if ((window as any).__updateChartSettings) {
      (window as any).__updateChartSettings({
        candleUpColor: up,
        candleDownColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      });
    }
  };

  const updateCustomCandleColor = (key: 'candleUpColor' | 'candleDownColor', value: string) => {
    setCandleSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        const raw = localStorage.getItem('crt_chart_settings');
        const prevFull = raw ? JSON.parse(raw) : {};
        const nextFull = { ...prevFull, [key]: value };
        localStorage.setItem('crt_chart_settings', JSON.stringify(nextFull));
        window.dispatchEvent(new CustomEvent('crt-chart-settings-changed', { detail: nextFull }));
      } catch {}
      if ((window as any).__updateChartSettings) {
        (window as any).__updateChartSettings({ [key]: value });
      }
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
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
      if (tfMenuRef.current && !tfMenuRef.current.contains(target)) {
        setIsTfMenuOpen(false);
      }
      if (styleMenuRef.current && !styleMenuRef.current.contains(target)) {
        setIsStyleMenuOpen(false);
      }
      if (candleColorRef.current && !candleColorRef.current.contains(target)) {
        setIsCandleColorOpen(false);
      }
      if (layersMenuRef.current && !layersMenuRef.current.contains(target)) {
        setIsLayersMenuOpen(false);
      }
      if (snapshotRef.current && !snapshotRef.current.contains(target)) {
        setIsSnapshotOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInstToolsOpen(false);
        setIsLayoutOpen(false);
        setIsAccountOpen(false);
        setIsOverflowOpen(false);
        setIsTfMenuOpen(false);
        setIsStyleMenuOpen(false);
        setIsCandleColorOpen(false);
        setIsLayersMenuOpen(false);
        setIsSnapshotOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    if (isInstToolsOpen || isLayoutOpen || isAccountOpen || isOverflowOpen || isTfMenuOpen || isStyleMenuOpen || isCandleColorOpen || isLayersMenuOpen || isSnapshotOpen || isUserMenuOpen) {
      window.addEventListener('pointerdown', handleClickOutside, true);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('pointerdown', handleClickOutside, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInstToolsOpen, isLayoutOpen, isAccountOpen, isOverflowOpen, isTfMenuOpen, isStyleMenuOpen, isCandleColorOpen, isLayersMenuOpen, isSnapshotOpen, isUserMenuOpen]);


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
    <header className="terminal-main-header relative flex h-[38px] shrink-0 items-center justify-between gap-1.5 border-b border-grid bg-panel px-2 sm:px-2.5 select-none font-mono text-xs z-30">
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

      {/* Left Section: Symbol, Timeframes, Candle Style, Indicators, Replay, Undo/Redo */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-visible min-w-0 shrink py-0.5">
        {/* Brand Pill */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            audioHaptics.tick();
            if (onOpenLanding) {
              onOpenLanding();
            } else {
              window.history.pushState(null, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
          className="flex items-center gap-2 shrink-0 px-2 py-0.5 rounded hover:bg-white/10 transition group cursor-pointer"
          title="TerminalX Home & Landing"
        >
          <TerminalXLogo size={20} variant="white" />
          <span className="hidden lg:inline text-xs font-black tracking-tight text-white group-hover:text-slate-200 transition font-heading">
            TerminalX
          </span>
        </a>


        <span className="h-4 w-px bg-grid shrink-0" />

        {/* Symbol Search Trigger Button */}
        <button
          onClick={() => {
            audioHaptics.tick();
            setIsSymbolSearchOpen(true);
          }}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 text-white font-bold text-xs transition shrink-0 group border border-white/5 hover:border-white/20"
          title="Search symbols (/ or Ctrl+K)"
        >
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight">{labelOf(symbol)}</span>
          <span className={`num text-xs font-bold transition-colors ${dir === 'up' ? 'text-up' : dir === 'down' ? 'text-down' : 'text-primary'}`}>
            {fmtPrice(price, symbol)}
          </span>
          <span className={`hidden sm:inline-block num text-[10px] font-semibold px-1 py-0.2 rounded border ${
            change >= 0
              ? 'text-up bg-emerald-500/10 border-emerald-500/25'
              : 'text-down bg-rose-500/10 border-rose-500/25'
          }`}>
            {fmtPct(change)}
          </span>
          <svg className="h-3 w-3 text-slate-400 group-hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <span className="h-4 w-px bg-grid shrink-0" />

        {/* Timeframe Chips & Dropdown */}
        <div className="relative flex items-center shrink-0" ref={tfMenuRef}>
          <div className="flex items-center gap-0.5">
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  audioHaptics.tick();
                  setTimeframe(t);
                  setPaneTimeframe(activePaneId, t);
                }}
                className={`px-1.5 py-0.5 text-xs rounded transition ${(['4h', '1d'].includes(t) && timeframe !== t) ? 'hidden sm:inline-flex' : ''} ${
                  t === timeframe
                    ? 'bg-white/20 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
            {!['1m', '5m', '15m', '1h', '4h', '1d'].includes(timeframe) && (
              <button
                onClick={() => setIsTfMenuOpen((v) => !v)}
                className="px-1.5 py-0.5 text-xs bg-white/20 text-white font-bold rounded"
              >
                {timeframe}
              </button>
            )}
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsTfMenuOpen((v) => !v);
              }}
              className="p-1 rounded text-slate-400 hover:text-white transition"
              title="All Timeframes"
            >
              <svg className={`h-3 w-3 transition-transform ${isTfMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {isTfMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-44 clay-popover p-2 shadow-2xl font-mono text-xs max-h-72 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1">
                Timeframes
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {['1s', '5s', '15s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      audioHaptics.tick();
                      setTimeframe(t as Timeframe);
                      setPaneTimeframe(activePaneId, t as Timeframe);
                      setIsTfMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-2 py-1 rounded transition text-left ${
                      t === timeframe ? 'bg-white/20 text-white font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{t}</span>
                    {t === timeframe && (
                      <svg className="h-3 w-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="h-4 w-px bg-grid shrink-0" />

        {/* Candle Style Dropdown */}
        <div className="relative shrink-0" ref={styleMenuRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsStyleMenuOpen((v) => !v);
            }}
            className="flex items-center gap-1 p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Chart Style"
          >
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="9" y1="2" x2="9" y2="6" strokeLinecap="round" />
              <rect x="6" y="6" width="6" height="10" rx="1" fill="currentColor" fillOpacity={0.2} />
              <line x1="9" y1="16" x2="9" y2="22" strokeLinecap="round" />
              <line x1="17" y1="4" x2="17" y2="8" strokeLinecap="round" />
              <rect x="14" y="8" width="6" height="8" rx="1" fill="currentColor" fillOpacity={0.2} />
              <line x1="17" y1="16" x2="17" y2="20" strokeLinecap="round" />
            </svg>
            <svg className={`h-3 w-3 text-slate-400 transition-transform ${isStyleMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isStyleMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-52 clay-popover p-1.5 shadow-2xl font-mono text-xs">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1">
                Chart Style
              </div>
              {[
                { id: 'CANDLE', label: 'Candlestick' },
                { id: 'BAR', label: 'Bar Chart' },
                { id: 'HOLLOW_CANDLE', label: 'Hollow Candles' },
                { id: 'HEIKIN_ASHI', label: 'Heikin-Ashi' },
                { id: 'LINE', label: 'Line Chart' },
                { id: 'AREA', label: 'Area Chart' },
                { id: 'BASELINE', label: 'Baseline Chart' },
                { id: 'FOOTPRINT', label: 'Footprint Clusters' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setChartStyle(s.id as ChartStyle);
                    setIsStyleMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded text-left transition ${
                    chartStyle === s.id ? 'bg-white/20 text-white font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{s.label}</span>
                  {chartStyle === s.id && (
                    <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Candle Colors & Palette Popover */}
        <div className="relative shrink-0" ref={candleColorRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsCandleColorOpen((v) => !v);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Candle Colors & Themes"
          >
            <span className="flex items-center gap-0.5">
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-xs"
                style={{ backgroundColor: candleSettings.candleUpColor || '#ffffff' }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/40 shadow-xs"
                style={{ backgroundColor: candleSettings.candleDownColor || '#101015' }}
              />
            </span>
            <svg className={`h-2.5 w-2.5 text-slate-400 transition-transform ${isCandleColorOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isCandleColorOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-64 clay-popover p-3 shadow-2xl font-mono text-xs select-none max-h-[80vh] overflow-y-auto">
              <div className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-2 flex items-center justify-between">
                <span>Candle Palette</span>
                <button
                  onClick={() => {
                    audioHaptics.tick();
                    applyCandlePreset('#ffffff', '#101015');
                  }}
                  className="text-[10px] text-slate-400 hover:text-white transition"
                >
                  Reset
                </button>
              </div>

              <div className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase">Presets</div>
              <div className="grid grid-cols-1 gap-1 mb-3">
                {[
                  { name: 'Claymorph B&W', up: '#ffffff', down: '#101015' },
                  { name: 'TradingView Classic', up: '#089981', down: '#f23645' },
                  { name: 'Cyberpunk Neon', up: '#00ffcc', down: '#ff0055' },
                  { name: 'Solar Amber', up: '#f59e0b', down: '#64748b' },
                  { name: 'Emerald Matrix', up: '#22c55e', down: '#18181b' },
                ].map((preset) => {
                  const isSelected =
                    (candleSettings.candleUpColor || '#ffffff').toLowerCase() === preset.up.toLowerCase() &&
                    (candleSettings.candleDownColor || '#101015').toLowerCase() === preset.down.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        audioHaptics.tick();
                        applyCandlePreset(preset.up, preset.down);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                        isSelected ? 'clay-btn-active font-bold text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: preset.up }} />
                          <span className="w-2.5 h-2.5 rounded-full border border-white/40" style={{ backgroundColor: preset.down }} />
                        </span>
                        <span>{preset.name}</span>
                      </div>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-grid/60 pt-2 mb-1">
                <div className="text-[10px] text-slate-400 font-semibold mb-2 uppercase">Custom Colors</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: candleSettings.candleUpColor || '#ffffff' }} />
                      Bull / Up Candle
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{candleSettings.candleUpColor || '#ffffff'}</span>
                      <input
                        type="color"
                        value={candleSettings.candleUpColor || '#ffffff'}
                        onChange={(e) => updateCustomCandleColor('candleUpColor', e.target.value)}
                        className="h-6 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: candleSettings.candleDownColor || '#101015' }} />
                      Bear / Down Candle
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{candleSettings.candleDownColor || '#101015'}</span>
                      <input
                        type="color"
                        value={candleSettings.candleDownColor || '#101015'}
                        onChange={(e) => updateCustomCandleColor('candleDownColor', e.target.value)}
                        className="h-6 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <span className="h-4 w-px bg-grid shrink-0" />

        {/* fx Indicators Button */}
        <button
          onClick={() => {
            audioHaptics.tick();
            if ((window as any).__openIndicatorsModal) {
              (window as any).__openIndicatorsModal();
            }
          }}
          className="relative flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
          title="Indicators, Metrics & Strategies (fx)"
        >
          <span className="font-bold text-xs tracking-tight text-accent">fx</span>
          <span className="text-xs font-semibold hidden md:inline">Indicators</span>
          {activeIndicators.length > 0 && (
            <span className="px-1 py-0.1 min-w-[14px] text-center rounded-full bg-accent text-black text-[9px] font-bold">
              {activeIndicators.length}
            </span>
          )}
        </button>

        {/* Institutional Layers & Overlays Menu */}
        <div className="relative shrink-0" ref={layersMenuRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsLayersMenuOpen((v) => !v);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
            title="Chart Layers, Overlays & Indicators"
          >
            <svg className="h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs font-semibold hidden md:inline">Layers</span>
            <svg className={`h-2.5 w-2.5 text-slate-400 transition-transform ${isLayersMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isLayersMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-72 clay-popover p-2.5 shadow-2xl font-mono text-xs select-none max-h-[80vh] overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1.5 flex items-center justify-between">
                <span>Chart Overlays & Layers</span>
                <span className="text-[9px] text-[#38bdf8]">Dynamic</span>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    audioHaptics.tick();
                    (window as any).__toggleVolumeProfile?.();
                    setIsLayersMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-slate-300 hover:text-white transition"
                >
                  <div>
                    <div className="font-semibold text-xs text-white">Volume Profile (VPVR)</div>
                    <div className="text-[10px] text-slate-400">Dynamic POC, VAH, VAL levels</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    (window as any).__toggleGhost?.();
                    setIsLayersMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-slate-300 hover:text-white transition"
                >
                  <div>
                    <div className="font-semibold text-xs text-white">Ghost HTF Candles</div>
                    <div className="text-[10px] text-slate-400">Higher timeframe candle silhouettes</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    (window as any).__toggleSessionOHL?.();
                    setIsLayersMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-slate-300 hover:text-white transition"
                >
                  <div>
                    <div className="font-semibold text-xs text-white">Session OHL Laser Lines</div>
                    <div className="text-[10px] text-slate-400">Daily Open, High, Low projections</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    useTerminalStore.getState().togglePeriodSeparators();
                    setIsLayersMenuOpen(false);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-slate-300 hover:text-white transition"
                >
                  <div>
                    <div className="font-semibold text-xs text-white">Period / Session Separators</div>
                    <div className="text-[10px] text-slate-400">Vertical day / session partition lines</div>
                  </div>
                </button>

                <div className="border-t border-grid/60 my-1" />

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    (window as any).__openObjectTree?.();
                    setIsLayersMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-[#38bdf8] transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="font-semibold">Object Tree & Drawings...</span>
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    (window as any).__openChartSkinsModal?.();
                    setIsLayersMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-slate-300 hover:text-white transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold">Chart Skins & Wallpapers...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bar Replay Button */}
        <button
          onClick={() => {
            audioHaptics.tick();
            if ((window as any).__toggleBarReplay) {
              (window as any).__toggleBarReplay();
            }
          }}
          className="flex items-center gap-1 p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
          title="Bar Replay Historical Time Machine"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
          <span className="text-xs hidden 2xl:inline">Replay</span>
        </button>

        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-0.5 border-l border-grid pl-1 shrink-0">
          <button
            onClick={() => {
              audioHaptics.tick();
              drawingEvents.undo();
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition shrink-0"
            title="Undo Drawing (Ctrl+Z)"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
            </svg>
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              drawingEvents.redo();
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition shrink-0"
            title="Redo Drawing (Ctrl+Y)"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
            </svg>
          </button>
        </div>

        {/* Kill-Switch alert badge */}
        {killSwitch.isLocked && (
          <span className="rounded-[4px] bg-red-500/15 border border-red-500/40 px-2 py-0.5 text-[11px] font-bold text-red-300">
            [Locked]
          </span>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-w-2" />

      {/* Breathing Guide Halo in Zen Mode */}
      <BreathingHalo />

      {/* Right Controls & Tools Cluster */}
      <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap min-w-0 justify-end ml-auto">
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
            {/* Account Type Badge (e.g. SIM, APEX, TS, BN) */}
            <span className="hidden sm:inline-block px-1 py-0.2 rounded text-[8.5px] font-bold uppercase bg-accent/20 text-accent border border-accent/30">
              {activeAccount?.type === 'PAPER' ? 'SIM' : activeAccount?.type === 'PROP_FIRM' ? (activeAccount?.name.split(' ')[0] || 'PROP') : activeAccount?.type === 'BINANCE_FUTURES' ? 'BN' : 'ACC'}
            </span>
            <span className="text-[10px] text-muted font-medium hidden sm:inline">Eq</span>
            <span className="font-bold text-[11px] sm:text-xs">{displayEquity}</span>
            <span
              className={`hidden 2xl:inline-block text-[10px] font-semibold px-1 py-0.5 rounded ${
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
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-84 max-w-[calc(100vw-24px)] clay-popover p-3.5 shadow-2xl select-none font-mono text-xs space-y-3">
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

              {/* Institutional Multi-Account Switcher Section */}
              <div className="p-2.5 rounded-lg border border-accent/20 bg-accent/[0.04] space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-slate-300">Trading Account</span>
                  <button
                    onClick={() => setIsNewAccountModalOpen(true)}
                    className="text-accent hover:underline flex items-center gap-0.5 font-semibold text-[10px]"
                  >
                    <span>+ Add Account</span>
                  </button>
                </div>

                {/* Account Selector Dropdown */}
                <select
                  value={activeAccountId}
                  onChange={(e) => {
                    audioHaptics.tick();
                    switchAccount(e.target.value);
                  }}
                  className="w-full bg-[#0a0a10] border border-grid/80 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) — {acc.currency} {acc.balance.toLocaleString()}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Acc #: <strong className="text-white">{activeAccount?.accountNumber || 'SIM-94812'}</strong></span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Reset balance of ${activeAccount?.name}?`)) {
                        resetAccountBalance(activeAccount?.id || '');
                      }
                    }}
                    className="text-slate-400 hover:text-rose-400 transition"
                    title="Reset Account to Starting Balance"
                  >
                    Reset Balance
                  </button>
                </div>
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
          {/* Quant & AI Assistant Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if (onOpenQuantAI) onOpenQuantAI();
              else if (window.__openQuantAI) window.__openQuantAI();
            }}
            className="flex items-center justify-center p-1.5 text-xs rounded-lg border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent transition"
            title="Open Quant & AI Assistant (Ollama Local / Cloud)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {/* Institutional Suite Dropdown */}
          <div className="relative" ref={instToolsRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsInstToolsOpen((v) => !v);
              }}
              className={`flex items-center justify-center p-1.5 text-xs rounded-lg transition ${
                isInstToolsOpen ? 'clay-pill-active' : 'clay-pill text-secondary hover:text-primary'
              }`}
              title="Institutional Analytics & Tools Suite"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>

            {isInstToolsOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 clay-popover p-2 shadow-2xl select-none font-mono text-xs">
                <button
                  onClick={() => {
                    audioHaptics.tick();
                    useDrawingStore.getState().toggleLeftOrderPane();
                    setIsInstToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Order Execution Pane</span>
                </button>

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

          {/* TradeXGuardian Capital Protection Pill */}
          {onOpenGuardian && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onOpenGuardian();
              }}
              className={`px-1.5 py-1 text-xs font-semibold rounded-lg border transition flex items-center gap-1 ${
                guardianEmergencyLocked
                  ? 'border-red-500/60 bg-red-500/20 text-red-400 animate-pulse'
                  : 'clay-btn text-primary'
              }`}
              title={`TradeXGuardian Protection System | Discipline Score: ${guardianDisciplineScore}%`}
            >
              <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className={`text-[10px] font-bold ${guardianDisciplineScore >= 80 ? 'text-emerald-400' : guardianDisciplineScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {guardianDisciplineScore}%
              </span>
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
            className={`relative px-2 py-0.5 text-[10.5px] font-bold rounded-lg border transition flex items-center gap-1.5 ${
              tradingMode === 'LIVE'
                ? 'border-red-500/60 bg-red-500/15 text-red-400 hover:bg-red-500/25 animate-pulse'
                : 'border-grid bg-surface text-secondary hover:text-primary'
            }`}
            title={tradingMode === 'PAPER' ? 'Paper Trading (simulated) — click to switch to LIVE' : 'LIVE mode — orders route to broker API — click to return to Paper'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tradingMode === 'LIVE' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <span>{tradingMode}</span>
            {showLiveWarning && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-900/90 text-red-300 text-[9px] px-2 py-0.5 rounded border border-red-500/40 z-50">
                LIVE mode — no real broker connected
              </span>
            )}
          </button>

          {/* Create Alert Dialog Trigger Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if ((window as any).__openCreateAlert) {
                (window as any).__openCreateAlert();
              }
            }}
            className="flex items-center justify-center p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
            title="Create Alert (Alt+A)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Chart Snapshot Dropdown Popover (TradingView-Style) */}
          <div className="relative shrink-0" ref={snapshotRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsSnapshotOpen((v) => !v);
              }}
              className="flex items-center justify-center p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
              title="Take Chart Snapshot (Download PNG / Copy Image)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {isSnapshotOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-52 clay-popover p-1.5 rounded-xl shadow-2xl select-none font-mono text-xs border border-white/10 backdrop-blur-md">
                <button
                  onClick={() => {
                    setIsSnapshotOpen(false);
                    audioHaptics.tick();
                    (window as any).__takeChartSnapshot?.('download');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition text-left"
                >
                  <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Image (PNG)</span>
                </button>
                <button
                  onClick={() => {
                    setIsSnapshotOpen(false);
                    audioHaptics.tick();
                    (window as any).__takeChartSnapshot?.('copy');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition text-left"
                >
                  <svg className="h-4 w-4 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <span>Copy Image</span>
                </button>
                <button
                  onClick={() => {
                    setIsSnapshotOpen(false);
                    audioHaptics.tick();
                    (window as any).__takeChartSnapshot?.('link');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition text-left"
                >
                  <svg className="h-4 w-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Copy Chart Link</span>
                </button>
              </div>
            )}
          </div>

          {/* Chart Settings Gear Icon */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if ((window as any).__openChartSettings) {
                (window as any).__openChartSettings();
              } else if (onOpenSettings) {
                onOpenSettings();
              }
            }}
            className="flex items-center justify-center p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
            title="Chart Settings (Alt+S)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
            }}
            className="flex items-center justify-center p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0 hidden sm:inline-flex"
            title="Toggle Fullscreen"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>

          {/* User Account & Cloud Sync Pill */}
          <div className="relative shrink-0" ref={userMenuRef}>
            {isAuthenticated ? (
              <button
                onClick={() => {
                  audioHaptics.tick();
                  setIsUserMenuOpen((v) => !v);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white border border-white/15 text-xs font-semibold transition"
                title="User Account & Cloud Workspace Sync"
              >
                <span className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400'}`} />
                <span className="hidden md:inline font-bold text-white text-[11px]">{user?.username}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  audioHaptics.tick();
                  openAuthModal('LOGIN');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white border border-white/15 text-xs font-bold transition font-mono shrink-0"
                title="Sign In to sync your workspace"
              >
                <svg className="h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {isUserMenuOpen && isAuthenticated && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-60 clay-popover p-2.5 rounded-xl shadow-2xl select-none font-mono text-xs border border-white/10 backdrop-blur-md space-y-2">
                <div className="border-b border-grid/60 pb-2">
                  <div className="font-bold text-white">{user?.username}</div>
                  <div className="text-[10px] text-muted truncate">{user?.email}</div>
                </div>

                <button
                  onClick={async () => {
                    audioHaptics.tick();
                    await syncWorkspace();
                    setIsUserMenuOpen(false);
                  }}
                  disabled={isSyncing}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-200 hover:text-white transition"
                >
                  <span className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Sync Workspace</span>
                  </span>
                  {isSyncing && <span className="text-[9px] text-amber-300">Syncing...</span>}
                </button>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    setIsUserMenuOpen(false);
                    useCloudStorageStore.getState().openModal();
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-200 hover:text-white transition"
                >
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span>Cloud Storage (BYOS)</span>
                </button>

                {onOpenSettings && (
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      setIsUserMenuOpen(false);
                      onOpenSettings('PROFILE');
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-200 hover:text-white transition"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Profile Settings</span>
                  </button>
                )}


                <div className="border-t border-grid/60 pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition text-left"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* Responsive Overflow Quick Menu */}
          <div className="relative shrink-0" ref={overflowRef}>
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
              <div className="absolute right-0 top-full mt-2 z-50 w-72 clay-popover p-3 shadow-2xl select-none font-mono text-xs space-y-2.5 max-h-[calc(100vh-50px)] overflow-y-auto scrollbar-thin">
                <div className="flex items-center justify-between border-b border-grid/60 pb-2">
                  <span className="text-[10px] uppercase font-bold text-muted">Terminal Menu</span>
                  <span className="text-[10px] text-zinc-400">Quick Access</span>
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
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <div>
                        <span className="font-bold text-white block">Trader Profile</span>
                        <span className="text-[9px] text-muted">Institutional PA [PRO+]</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">PRO+</span>
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <div>
                        <span className="font-bold text-white block">Home / Landing Page</span>
                        <span className="text-[9px] text-muted">Platform Overview & Showcase</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">VIEW</span>
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
                    <div className="col-span-2 text-slate-300 text-[10px] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>Telegram Alerts Connected</span>
                    </div>
                  )}
                </div>

                {/* Quick Navigation Items */}
                <div className="space-y-0.5">
                  {/* Object Tree & Layers */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      useDrawingStore.getState().setActiveRightDrawer((prev) => (prev === 'OBJECT_TREE' ? null : 'OBJECT_TREE'));
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Object Tree & Layers</span>
                  </button>

                  {/* Chart Skins & Background Themes */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      if ((window as any).__openChartSkinsModal) {
                        (window as any).__openChartSkinsModal();
                      }
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Chart Skins & Themes</span>
                  </button>

                  {/* Mobile & WiFi Connect */}
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      setIsMobileConnectOpen(true);
                      setIsOverflowOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Mobile & WiFi Sync</span>
                  </button>

                  {onOpenCommandPalette && (
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        onOpenCommandPalette();
                        setIsOverflowOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <span className={`h-2 w-2 rounded-full ${zenMode.active ? 'bg-slate-300' : 'bg-zinc-500'}`} />
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
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <span>Seasonal Tendencies Matrix</span>
                  </button>

                  {onOpenScreener && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenScreener(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 4h16M8 4v3m8-3v3" />
                      </svg>
                      <span>Trading Sessions & DB Backup</span>
                    </button>
                  )}

                  <button
                    onClick={() => { audioHaptics.tick(); useCloudStorageStore.getState().openModal(); setIsOverflowOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  >
                    <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span>Cloud Storage (BYOS - Gist / OPFS)</span>
                  </button>

                  {onOpenGuardian && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenGuardian(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>TradeXGuardian Protection</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-200 border border-white/10">
                        {guardianDisciplineScore}%
                      </span>
                    </button>
                  )}

                  {onOpenPortfolio && (
                    <button
                      onClick={() => { audioHaptics.tick(); onOpenPortfolio(); setIsOverflowOpen(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      <span>Audio Haptics</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-200 border border-white/10">
                      {isMuted ? 'MUTED' : 'ENABLED'}
                    </span>
                  </button>

                  {/* Paper / Live Mode */}
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

      {/* New Custom Account Modal */}
      {isNewAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none">
          <div className="w-full max-w-md clay-popover p-5 shadow-2xl border border-white/15 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-grid/60">
              <span className="font-bold text-white text-xs uppercase tracking-wider">Connect New Trading Account</span>
              <button
                onClick={() => setIsNewAccountModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase text-muted block mb-1">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. TopStep 150K Funded"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-[#0d0d14] border border-grid rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-muted block mb-1">Account Type</label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as any)}
                  className="w-full bg-[#0d0d14] border border-grid rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
                >
                  <option value="PROP_FIRM">Prop Firm Funded Account</option>
                  <option value="PAPER">Paper Trading Simulation</option>
                  <option value="BINANCE_FUTURES">Binance Futures Live</option>
                  <option value="BYBIT">Bybit Derivatives Live</option>
                  <option value="DEMO">Demo Scalping</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-muted block mb-1">Starting Balance</label>
                  <input
                    type="number"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full bg-[#0d0d14] border border-grid rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted block mb-1">Currency</label>
                  <select
                    value={newAccCurrency}
                    onChange={(e) => setNewAccCurrency(e.target.value)}
                    className="w-full bg-[#0d0d14] border border-grid rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="USDT">USDT</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-grid/60">
              <button
                onClick={() => setIsNewAccountModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const bal = parseFloat(newAccBalance);
                  if (!newAccName.trim() || isNaN(bal) || bal <= 0) return;
                  createAccount({
                    name: newAccName.trim(),
                    type: newAccType,
                    balance: bal,
                    currency: newAccCurrency,
                    leverageLimit: newAccType === 'PROP_FIRM' ? 20 : 100,
                    accountNumber: `${newAccType.slice(0, 3)}-${Math.floor(10000 + Math.random() * 90000)}`,
                  });
                  setIsNewAccountModalOpen(false);
                  setNewAccName('');
                }}
                className="px-4 py-1.5 rounded text-xs font-bold text-black bg-accent hover:brightness-110 transition"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Symbol Search Modal Triggered from Header */}
      <SymbolSearchModal
        isOpen={isSymbolSearchOpen}
        onClose={() => setIsSymbolSearchOpen(false)}
        onSelect={(selectedInst) => {
          setSymbol(selectedInst.id);
          setPaneSymbol(activePaneId, selectedInst.id);
          setIsSymbolSearchOpen(false);
        }}
      />

      {/* Mobile & WiFi Connect Modal */}
      <MobileConnectModal
        isOpen={isMobileConnectOpen}
        onClose={() => setIsMobileConnectOpen(false)}
      />
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

