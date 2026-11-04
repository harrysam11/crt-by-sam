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
import PopoutWindow from './components/popout/PopoutWindow';
import MiniTerminalPopout from './components/popout/MiniTerminalPopout';
import { useMarketFeed } from './hooks/useMarketFeed';
import { useKeyboardHotkeys } from './hooks/useKeyboardHotkeys';
import { useTerminalStore } from './store/useTerminalStore';
import { useDerivativesStore } from './store/useDerivativesStore';
import { getInstrument } from './services/instruments';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function App() {
  useMarketFeed();
  const provider = useTerminalStore((s) => getInstrument(s.symbol)?.provider ?? 'binance');
  const isDomVisible = useDerivativesStore((s) => s.isDomVisible || s.isFootprintVisible);
  const isAnalyticsVisible = useDerivativesStore((s) => s.isAnalyticsVisible);

  const [rightW, setRightW] = useState(300);
  const [bottomH, setBottomH] = useState(240);

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
  const [settingsTab, setSettingsTab] = useState<'PROFILE' | 'BILLING' | 'THEME' | 'LANGUAGE' | 'TELEGRAM'>('PROFILE');
  const [isPopoutOpen, setIsPopoutOpen] = useState(false);

  // Global Keyboard Hotkeys Listener
  useKeyboardHotkeys({
    onOpenCheatsheet: () => setIsHotkeyOpen(true),
  });

  // Dark & Light Theme Synchronizer
  useEffect(() => {
    const applyTheme = () => {
      const mode = localStorage.getItem('crt_theme_mode') || 'DARK';
      if (mode === 'LIGHT') {
        document.documentElement.classList.add('theme-light');
      } else {
        document.documentElement.classList.remove('theme-light');
      }
    };
    applyTheme();
    window.addEventListener('storage', applyTheme);
    window.addEventListener('crt-theme-change', applyTheme);
    return () => {
      window.removeEventListener('storage', applyTheme);
      window.removeEventListener('crt-theme-change', applyTheme);
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg text-slate-200 overflow-hidden font-mono">
      {/* Background Zen Controller (Hotkey Alt+Z) */}
      <ZenController />

      {/* Overtrading Hard-Lock Kill-Switch Overlay */}
      <KillSwitchOverlay />

      {/* Trade Psychology & Screenshot Journal Review Drawer */}
      <JournalModal />

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

      {/* Global Terminal Header */}
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
        onOpenSettings={(tab) => {
          if (tab) setSettingsTab(tab);
          setIsSettingsOpen(true);
        }}
        onTogglePopout={() => setIsPopoutOpen((v) => !v)}
        isPopoutActive={isPopoutOpen}
      />

      <div className="flex min-h-0 flex-1">
        <Watchlist />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <MultiChartGrid />
          </div>
          <Splitter dir="h" onDrag={(d) => setBottomH((h) => clamp(h - d, 120, 500))} />
          <div style={{ height: bottomH }} className="shrink-0">
            <PositionsTable />
          </div>
        </main>

        {/* Institutional Depth of Market & Footprint Sidebar */}
        {isDomVisible && <FootprintDOM />}

        {/* Institutional Seasonals, Technicals & Live News Sidebar */}
        {isAnalyticsVisible && <AnalyticsPanel />}

        <Splitter dir="v" onDrag={(d) => setRightW((w) => clamp(w - d, 260, 520))} />
        <aside style={{ width: rightW }} className="hidden shrink-0 flex-col lg:flex">
          {provider === 'binance' ? <OrderBook /> : <QuotePanel />}
          <ExecutionPanel />
        </aside>
      </div>
    </div>
  );
}
