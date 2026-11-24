import { useState, useEffect } from 'react';
import Header from './components/Layout/Header';
import Splitter from './components/Layout/Splitter';
import MultiChartGrid from './components/Chart/MultiChartGrid';
import Watchlist from './components/Watchlist/Watchlist';
import OrderBook from './components/Trading/OrderBook';
import QuotePanel from './components/Trading/QuotePanel';
import ExecutionPanel from './components/Trading/ExecutionPanel';
import PositionsTable from './components/Trading/PositionsTable';
import KillSwitchOverlay from './components/KillSwitchOverlay';
import JournalModal from './features/journal/JournalModal';
import ZenController from './features/zen/ZenController';
import FootprintDOM from './components/dom/FootprintDOM';
import AnalyticsPanel from './components/analytics/AnalyticsPanel';
import OptionChainModal from './components/fno/OptionChainModal';
import RiskManagerModal from './components/risk/RiskManagerModal';
import GreeksMatrixModal from './components/fno/GreeksMatrixModal';
import FundingArbitrageModal from './components/fno/FundingArbitrageModal';
import LiquidationWaterfall from './components/fno/LiquidationWaterfall';
import ApiVaultModal from './components/vault/ApiVaultModal';
import TaxLedgerModal from './components/tax/TaxLedgerModal';
import HotkeyModal from './components/hotkeys/HotkeyModal';
import EconomicCalendarModal from './components/calendar/EconomicCalendarModal';
import MarketScreenerModal from './components/screener/MarketScreenerModal';
import SettingsModal from './components/settings/SettingsModal';
import SessionManagerModal from './components/session/SessionManagerModal';
import PopoutWindow from './components/popout/PopoutWindow';
import MiniTerminalPopout from './components/popout/MiniTerminalPopout';
import ObjectTreePanel from './components/Chart/ObjectTreePanel';
import DataWindowPanel from './components/Chart/DataWindowPanel';
import GuardianModal from './components/guardian/GuardianModal';
import PortfolioDashboardModal from './components/portfolio/PortfolioDashboardModal';
import LandingPage from './components/landing/LandingPage';
import CommandPaletteModal from './components/common/CommandPaletteModal';
import MacroNewsPanel from './components/news/MacroNewsPanel';
import XAlphaNewsPanel from './components/news/XAlphaNewsPanel';
import ShareChartModal from './components/share/ShareChartModal';
import LayoutCustomizerModal from './components/Layout/LayoutCustomizerModal';
import AppDownloadModal from './components/landing/AppDownloadModal';
import QuantAIAgentModal from './features/ai/QuantAIAgentModal';
import AuthModal from './components/auth/AuthModal';
import CloudStorageModal from './components/storage/CloudStorageModal';
import { useMarketFeed } from './hooks/useMarketFeed';
import { useKeyboardHotkeys } from './hooks/useKeyboardHotkeys';
import { useTerminalStore } from './store/useTerminalStore';
import { useDerivativesStore } from './store/useDerivativesStore';
import { useLayoutStore } from './store/useLayoutStore';
import { useDrawingStore } from './store/useDrawingStore';
import { useGuardianStore } from './store/useGuardianStore';
import { useAuthStore } from './store/useAuthStore';
import { useCloudStorageStore } from './store/useCloudStorageStore';
import { getInstrument } from './services/instruments';

import { audioHaptics } from './utils/notify';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

if (typeof window !== 'undefined') {
  (window as any).useTerminalStore = useTerminalStore;
  (window as any).__terminalStore = useTerminalStore;
}

export default function App() {
  useMarketFeed();
  const provider = useTerminalStore((s) => getInstrument(s.symbol)?.provider ?? 'binance');
  const isDomVisible = useDerivativesStore((s) => s.isDomVisible || s.isFootprintVisible);
  const isAnalyticsVisible = useDerivativesStore((s) => s.isAnalyticsVisible);
  const isChartMaximized = useLayoutStore((s) => s.isChartMaximized);
  const themeMode = useLayoutStore((s) => s.themeMode);

  const [rightW, setRightW] = useState(() => {
    try {
      const saved = localStorage.getItem('crt_right_w');
      return saved ? Number(saved) : 300;
    } catch {
      return 300;
    }
  });
  const [bottomH, setBottomH] = useState(() => {
    try {
      const saved = localStorage.getItem('crt_bottom_h');
      const val = saved ? Number(saved) : 220;
      return Math.max(120, Math.min(520, isNaN(val) ? 220 : val));
    } catch {
      return 220;
    }
  });
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('crt_bottom_collapsed');
      return saved !== null ? saved === 'true' : true; // Default to closed for maximum chart real estate
    } catch {
      return true;
    }
  });
  const [isBottomMaximized, setIsBottomMaximized] = useState(false);
  const activeRightDrawer = useDrawingStore((s) => s.activeRightDrawer);
  const setActiveRightDrawer = useDrawingStore((s) => s.setActiveRightDrawer);
  const isLeftOrderPaneOpen = useDrawingStore((s) => s.isLeftOrderPaneOpen);
  const closeLeftOrderPane = useDrawingStore((s) => s.closeLeftOrderPane);
  const leftOrderSide = useDrawingStore((s) => s.leftOrderSide);

  const handleToggleBottomCollapse = () => {
    setIsBottomCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('crt_bottom_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleBottomMaximize = () => {
    setIsBottomMaximized((v) => !v);
    if (isBottomCollapsed) setIsBottomCollapsed(false);
  };

  const handleResizeRightW = (delta: number) => {
    setRightW((prev) => {
      const next = clamp(prev - delta, 260, 520);
      try {
        localStorage.setItem('crt_right_w', String(next));
      } catch {}
      return next;
    });
  };

  const handleResizeBottomH = (delta: number) => {
    setBottomH((prev) => {
      const next = clamp(prev - delta, 120, 520);
      try {
        localStorage.setItem('crt_bottom_h', String(next));
      } catch {}
      return next;
    });
  };

  // Modal visibility states
  const [isOptionChainOpen, setIsOptionChainOpen] = useState(false);
  const [isRiskManagerOpen, setIsRiskManagerOpen] = useState(false);
  const [isGreeksOpen, setIsGreeksOpen] = useState(false);
  const [isFundingOpen, setIsFundingOpen] = useState(false);
  const [isLiquidationsOpen, setIsLiquidationsOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isTaxOpen, setIsTaxOpen] = useState(false);
  const [isHotkeyOpen, setIsHotkeyOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isScreenerOpen, setIsScreenerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    'PROFILE' | 'BILLING' | 'THEME' | 'LANGUAGE' | 'TELEGRAM' | 'MCP_AI' | 'X_TWITTER'
  >('PROFILE');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSessionManagerOpen, setIsSessionManagerOpen] = useState(false);
  const [isPopoutOpen, setIsPopoutOpen] = useState(false);
  const [isGuardianOpen, setIsGuardianOpen] = useState(false);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isQuantAIOpen, setIsQuantAIOpen] = useState(false);
  const [quantAIInitialPrompt, setQuantAIInitialPrompt] = useState<string | undefined>(undefined);

  useEffect(() => {
    (window as any).__terminalStore = useTerminalStore;
    (window as any).__guardianStore = useGuardianStore;
    (window as any).__drawingStore = useDrawingStore;
    (window as any).__cloudStorageStore = useCloudStorageStore;
    (window as any).__authStore = useAuthStore;
    (window as any).__openSettings = (tab?: any) => {
      if (tab) setSettingsTab(tab);
      setIsSettingsOpen(true);
    };
    (window as any).__openShareModal = () => {
      setIsShareModalOpen(true);
    };
    window.__openQuantAI = (prompt?: string) => {
      setQuantAIInitialPrompt(prompt);
      setIsQuantAIOpen(true);
    };
    (window as any).__openPortfolio = () => {
      setIsPortfolioOpen(true);
    };
    (window as any).__closePortfolio = () => {
      setIsPortfolioOpen(false);
    };
    (window as any).__openSessions = () => {
      setIsSessionManagerOpen(true);
    };
    (window as any).__openSessionsModal = () => {
      setIsSessionManagerOpen(true);
    };
    return () => {
      delete (window as any).__authStore;
      delete (window as any).__openSettings;
      delete (window as any).__openShareModal;
      delete window.__openQuantAI;
      delete (window as any).__openPortfolio;
      delete (window as any).__closePortfolio;
      delete (window as any).__openSessions;
      delete (window as any).__openSessionsModal;
    };
  }, []);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  // View Mode: TERMINAL or LANDING showcase (Router based on pathname)
  const [viewMode, setViewMode] = useState<'TERMINAL' | 'LANDING'>(() => {
    try {
      const path = window.location.pathname;
      const search = window.location.search;
      if (path === '/app' || search.includes('symbol=') || search.includes('view=terminal')) {
        return 'TERMINAL';
      }
      if (path === '/' || path === '') {
        return 'LANDING';
      }
    } catch {}
    return 'LANDING';
  });

  // Init Auth Session & Popstate History Navigation
  useEffect(() => {
    useAuthStore.getState().initSession();

    const handlePopState = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      if (path === '/app' || search.includes('symbol=') || search.includes('view=terminal')) {
        setViewMode('TERMINAL');
      } else {
        setViewMode('LANDING');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // Global Keyboard Hotkeys Listener
  useKeyboardHotkeys({
    onOpenCheatsheet: () => setIsHotkeyOpen(true),
    onOpenPortfolio: () => setIsPortfolioOpen(true),
  });

  // Ctrl+K / Cmd+K Command Palette hotkey
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // openModal helper for CommandPaletteModal
  const handleOpenModalByName = (name: string) => {
    switch (name) {
      case 'GUARDIAN': setIsGuardianOpen(true); break;
      case 'PORTFOLIO': setIsPortfolioOpen(true); break;
      case 'OPTIONS': setIsOptionChainOpen(true); break;
      case 'GREEKS': setIsGreeksOpen(true); break;
      case 'FUNDING': setIsFundingOpen(true); break;
      case 'LIQUIDATIONS': setIsLiquidationsOpen(true); break;
      case 'VAULT': setIsVaultOpen(true); break;
      case 'TAX': setIsTaxOpen(true); break;
      case 'SCREENER': setIsScreenerOpen(true); break;
      case 'CALENDAR': setIsCalendarOpen(true); break;
      case 'SESSIONS': setIsSessionManagerOpen(true); break;
      case 'LAYOUT_CUSTOMIZER': setIsLayoutCustomizerOpen(true); break;
      case 'DOWNLOAD': setIsDownloadModalOpen(true); break;
      default: break;
    }
  };

  // Global window openers for Screener, Calendar, Portfolio, and Layout Customizer
  useEffect(() => {
    (window as any).__openScreener = () => setIsScreenerOpen(true);
    (window as any).__openCalendar = () => setIsCalendarOpen(true);
    (window as any).__openPortfolio = () => setIsPortfolioOpen(true);
    (window as any).__openLayoutCustomizer = () => setIsLayoutCustomizerOpen(true);
    return () => {
      delete (window as any).__openScreener;
      delete (window as any).__openCalendar;
      delete (window as any).__openPortfolio;
      delete (window as any).__openLayoutCustomizer;
    };
  }, []);

  // Dark & Light Theme Synchronizer
  useEffect(() => {
    const isLight = themeMode === 'LIGHT';
    if (isLight) {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
    }
  }, [themeMode]);

  // Landing Page View
  if (viewMode === 'LANDING') {
    return (
      <div id="landing-scroll-container" className="h-screen overflow-y-auto overflow-x-hidden bg-bg text-slate-200 font-mono">
        <LandingPage
          onLaunchTerminal={(targetSymbol) => {
            if (targetSymbol) {
              useTerminalStore.getState().setSymbol(targetSymbol);
            }
            window.history.pushState(null, '', '/app');
            setViewMode('TERMINAL');
          }}
          onOpenGuardian={() => {
            window.history.pushState(null, '', '/app');
            setViewMode('TERMINAL');
            setIsGuardianOpen(true);
          }}
          onOpenPortfolio={() => {
            window.history.pushState(null, '', '/app');
            setViewMode('TERMINAL');
            setIsPortfolioOpen(true);
          }}
        />
        <AuthModal />

        <GuardianModal
          isOpen={isGuardianOpen}
          onClose={() => setIsGuardianOpen(false)}
        />
        <PortfolioDashboardModal
          isOpen={isPortfolioOpen}
          onClose={() => setIsPortfolioOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg text-slate-200 overflow-hidden font-mono">
      {/* Background Zen Controller (Hotkey Alt+Z) */}
      <ZenController />

      {/* Overtrading Hard-Lock Kill-Switch Overlay */}
      <KillSwitchOverlay />

      {/* TradeXGuardian Capital Protection System */}
      <GuardianModal
        isOpen={isGuardianOpen}
        onClose={() => setIsGuardianOpen(false)}
      />

      {/* Trade Psychology & Screenshot Journal Review Drawer */}
      <JournalModal />

      {/* Portfolio Tracker, Analytics, PnL Calendar & AI Journal Suite */}
      <PortfolioDashboardModal
        isOpen={isPortfolioOpen}
        onClose={() => setIsPortfolioOpen(false)}
      />

      {/* NSE & Crypto Option Chain Modal */}
      <OptionChainModal
        isOpen={isOptionChainOpen}
        onClose={() => setIsOptionChainOpen(false)}
      />

      {/* Risk Manager & Margin Ratio Modal */}
      <RiskManagerModal
        isOpen={isRiskManagerOpen}
        onClose={() => setIsRiskManagerOpen(false)}
      />

      {/* Black-Scholes Greeks Sensitivity Matrix */}
      <GreeksMatrixModal
        isOpen={isGreeksOpen}
        onClose={() => setIsGreeksOpen(false)}
      />

      {/* Cross-Exchange Funding Rates & Basis Spread Arbitrage */}
      <FundingArbitrageModal
        isOpen={isFundingOpen}
        onClose={() => setIsFundingOpen(false)}
      />

      {/* Real-time Liquidation Waterfall & Whale Tape */}
      <LiquidationWaterfall
        isOpen={isLiquidationsOpen}
        onClose={() => setIsLiquidationsOpen(false)}
      />

      {/* Encrypted Client-Side Broker Key Vault & Backup */}
      <ApiVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
      />

      {/* FnO Regulatory Turnover & Tax Audit Ledger */}
      <TaxLedgerModal
        isOpen={isTaxOpen}
        onClose={() => setIsTaxOpen(false)}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <HotkeyModal
        isOpen={isHotkeyOpen}
        onClose={() => setIsHotkeyOpen(false)}
      />

      {/* Global Macro & Economic Calendar Matrix Modal */}
      {isCalendarOpen && (
        <EconomicCalendarModal onClose={() => setIsCalendarOpen(false)} />
      )}

      {/* Multi-Market Asset Screener Modal */}
      <MarketScreenerModal
        isOpen={isScreenerOpen}
        onClose={() => setIsScreenerOpen(false)}
      />

      {/* Platform Settings, Billing, Theme & Telegram Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
      />

      {/* Share Chart Snapshot & Social Post Modal */}
      <ShareChartModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Trading Sessions & Database Engine Modal */}
      <SessionManagerModal
        isOpen={isSessionManagerOpen}
        onClose={() => setIsSessionManagerOpen(false)}
      />

      {/* Standalone Pop-out Window (Picture-in-Picture) */}
      <PopoutWindow
        title="Mini Terminal"
        width={380}
        height={540}
        isOpen={isPopoutOpen}
        onClose={() => setIsPopoutOpen(false)}
      >
        <MiniTerminalPopout onClose={() => setIsPopoutOpen(false)} />
      </PopoutWindow>

      {/* Global Command Palette & Quick Search (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenModal={handleOpenModalByName}
      />

      {/* User Authentication & Cloud Sync Modal */}
      <AuthModal />

      {/* Multi-Chart Workspace & Panes Customizer Modal */}
      <LayoutCustomizerModal
        isOpen={isLayoutCustomizerOpen}
        onClose={() => setIsLayoutCustomizerOpen(false)}
      />

      {/* iOS, Android & Desktop Download App Modal */}
      <AppDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      {/* Global Terminal Header */}
      {!isChartMaximized && (
        <Header
          onOpenOptionChain={() => setIsOptionChainOpen(true)}
          onOpenRiskManager={() => setIsRiskManagerOpen(true)}
          onOpenGreeks={() => setIsGreeksOpen(true)}
          onOpenFunding={() => setIsFundingOpen(true)}
          onOpenLiquidations={() => setIsLiquidationsOpen(true)}
          onOpenVault={() => setIsVaultOpen(true)}
          onOpenTax={() => setIsTaxOpen(true)}
          onOpenHotkeys={() => setIsHotkeyOpen(true)}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          onOpenScreener={() => setIsScreenerOpen(true)}
          onOpenSessions={() => setIsSessionManagerOpen(true)}
          onOpenGuardian={() => setIsGuardianOpen(true)}
          onOpenPortfolio={() => setIsPortfolioOpen(true)}
          onOpenSettings={(tab) => {
            if (tab) setSettingsTab(tab);
            setIsSettingsOpen(true);
          }}
          onTogglePopout={() => setIsPopoutOpen((v) => !v)}
          isPopoutActive={isPopoutOpen}
          onOpenLanding={() => {
            window.history.pushState(null, '', '/');
            setViewMode('LANDING');
          }}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenLayoutCustomizer={() => setIsLayoutCustomizerOpen(true)}
          onOpenQuantAI={() => setIsQuantAIOpen(true)}
        />
      )}


      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* Left Order Execution Drawer (TradingView-Style Left Order Pane) */}
        {isLeftOrderPaneOpen && (
          <aside className="shrink-0 flex flex-col h-full w-[310px] sm:w-[330px] bg-panel border-r border-grid z-30 shadow-2xl relative select-none animate-in slide-in-from-left duration-150 overflow-y-auto fixed md:relative inset-y-0 left-0 md:inset-auto">
            <ExecutionPanel
              initialSide={leftOrderSide}
              showHeader={true}
              onClose={closeLeftOrderPane}
            />
          </aside>
        )}

        {/* Main Center Area: Chart + Bottom Positions */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isBottomMaximized && (
            <div className="min-h-0 flex-1 relative">
              <MultiChartGrid />
            </div>
          )}
          {!isChartMaximized && (
            <>
              {!isBottomMaximized && (
                <Splitter
                  dir="h"
                  onDrag={(delta) => {
                    if (isBottomCollapsed) setIsBottomCollapsed(false);
                    handleResizeBottomH(delta);
                  }}
                />
              )}
              <div
                style={{ height: isBottomMaximized ? '100%' : isBottomCollapsed ? 38 : bottomH }}
                className={`${isBottomMaximized ? 'flex-1 h-full' : 'shrink-0'} overflow-hidden transition-all duration-150 relative bg-panel z-10`}
              >
                <PositionsTable
                  isCollapsed={isBottomCollapsed}
                  onToggleCollapse={handleToggleBottomCollapse}
                  isMaximized={isBottomMaximized}
                  onToggleMaximize={handleToggleBottomMaximize}
                />
              </div>
            </>
          )}
        </main>

        {/* Collapsible Right Slideout Drawer */}
        {!isChartMaximized && activeRightDrawer && (
          <>
            <div className="hidden md:block">
              <Splitter dir="v" onDrag={handleResizeRightW} />
            </div>
            <div
              style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : rightW }}
              className="shrink-0 flex flex-col h-full overflow-hidden bg-panel border-l border-grid z-30 shadow-2xl fixed md:relative inset-y-0 right-0 md:inset-auto w-full md:w-auto"
            >
              {/* Mobile Drawer Close Header */}
              <div className="md:hidden flex items-center justify-between px-3 py-2 bg-base border-b border-grid">
                <span className="text-xs font-bold font-mono text-white uppercase">{activeRightDrawer}</span>
                <button
                  onClick={() => setActiveRightDrawer(null)}
                  className="px-2.5 py-1 rounded text-xs bg-slate-800 text-slate-300 hover:text-white"
                >
                  Close
                </button>
              </div>
              {activeRightDrawer === 'WATCHLIST' && <Watchlist />}
              {activeRightDrawer === 'DOM' && <FootprintDOM />}
              {activeRightDrawer === 'TRADE' && (
                <div className="flex flex-col h-full overflow-y-auto">
                  {provider === 'binance' ? <OrderBook /> : <QuotePanel />}
                  <ExecutionPanel />
                </div>
              )}
              {activeRightDrawer === 'ANALYTICS' && <AnalyticsPanel />}
              {activeRightDrawer === 'DATA_WINDOW' && (
                <DataWindowPanel onClose={() => setActiveRightDrawer(null)} />
              )}
              {activeRightDrawer === 'OBJECT_TREE' && (
                <ObjectTreePanel onClose={() => setActiveRightDrawer(null)} />
              )}
              {activeRightDrawer === 'NEWS_FEED' && <MacroNewsPanel />}
              {activeRightDrawer === 'X_FEED' && <XAlphaNewsPanel />}
            </div>
          </>
        )}

        {/* TradingView-Style Far Right Vertical Icon Dock Rail */}
        {!isChartMaximized && (
          <aside className="hidden md:flex w-[48px] shrink-0 border-l border-grid bg-panel flex-col items-center py-3 gap-2.5 z-20 select-none font-mono shadow-clay-card">
            {/* Quant & AI Assistant Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsQuantAIOpen(true);
              }}
              className="p-2.5 rounded-xl transition clay-btn text-accent hover:text-white"
              title="Quant & AI Assistant (Ollama Local / Cloud)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            {/* Watchlist Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'WATCHLIST' ? null : 'WATCHLIST'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'WATCHLIST' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="Watchlist & Markets"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>

            {/* DOM & Footprint Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'DOM' ? null : 'DOM'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'DOM' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="Depth of Market (DOM) Ladder & Order Flow"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Trade Execution & Order Book Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'TRADE' ? null : 'TRADE'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'TRADE' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="Order Entry & Live Order Book"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            {/* Analytics Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'ANALYTICS' ? null : 'ANALYTICS'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'ANALYTICS' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="Seasonals, Liquidity & News"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </button>

            {/* Data Window Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'DATA_WINDOW' ? null : 'DATA_WINDOW'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'DATA_WINDOW' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="TradingView Data Window (OHLC & Indicator Telemetry)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            {/* Object Tree (Layers) Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'OBJECT_TREE' ? null : 'OBJECT_TREE'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'OBJECT_TREE' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="TradingView Object Tree & Layers"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>

            <span className="my-1 h-px w-6 bg-grid" />

            {/* Macro News Wire Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'NEWS_FEED' ? null : 'NEWS_FEED'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'NEWS_FEED' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="Macro News Wire & Forex Factory Calendar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </button>

            {/* X.com (Twitter) Market Wire Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setActiveRightDrawer((prev) => (prev === 'X_FEED' ? null : 'X_FEED'));
              }}
              className={`p-2.5 rounded-xl transition ${
                activeRightDrawer === 'X_FEED' ? 'clay-btn-active' : 'clay-btn text-slate-300'
              }`}
              title="X.com Alpha Wire (Market-Moving Posts from @DeItaone, @tier10k, @federalreserve)"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>

            {/* Option Chain Button */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsOptionChainOpen(true);
              }}
              className="p-2.5 rounded-xl clay-btn text-slate-300 transition"
              title="Option Chain Matrix"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
            </button>

            {/* Portfolio & PnL Dashboard */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsPortfolioOpen(true);
              }}
              className="p-2.5 rounded-xl clay-btn text-slate-300 transition"
              title="Portfolio Dashboard & PnL Analytics"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Economic Calendar */}
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsCalendarOpen(true);
              }}
              className="p-2.5 rounded-xl clay-btn text-slate-300 transition"
              title="Macro Economic Calendar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </aside>
        )}

      </div>

      {/* Institutional Quant & AI Assistant Modal */}
      <QuantAIAgentModal
        isOpen={isQuantAIOpen}
        onClose={() => {
          setIsQuantAIOpen(false);
          setQuantAIInitialPrompt(undefined);
        }}
        initialPrompt={quantAIInitialPrompt}
      />

      {/* Bring-Your-Own-Storage (BYOS) Modal */}
      <CloudStorageModal />
    </div>
  );
}
