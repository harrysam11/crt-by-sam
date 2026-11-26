import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle, PriceScaleMode,
  type CandlestickData, type IChartApi, type IPriceLine, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp,
} from 'lightweight-charts';
import { useTerminalStore, type ActivePineScript } from '../../store/useTerminalStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { liveCandleBus } from '../../hooks/useMarketFeed';
import { getInstrument, TIMEFRAMES } from '../../services/instruments';
import { ema, sma, rsi, bollingerBands, heikinAshi } from '../../services/indicatorMath';
import { generateOIHistory } from '../../services/nseOptionChain';
import { decimalsFor, fmtPrice, fmtQty, fmtUsd, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { Candle, ChartStyle, ChartTimezone, PriceScaleType, Timeframe } from '../../types/terminal';
import type { CanvasOrderLine } from '../../types/derivatives';
import type { ToolType, MagnetConfig } from '../drawing/types';
import ChartSkinsLayer from '../ChartSkinsLayer';
import ChartSkinsModal from '../ChartSkinsModal';
import GhostOverlay from '../ghost/GhostOverlay';
import CanvasOrderOverlay from '../canvas/CanvasOrderOverlay';
import ChartTradingOverlay from './ChartTradingOverlay';
import CreateAlertModal from '../Trading/CreateAlertModal';
import CandleCountdown from './CandleCountdown';
import FootprintChartOverlay from './FootprintChartOverlay';
import ChartRulerOverlay from './ChartRulerOverlay';
import StickyNotesOverlay from './StickyNotesOverlay';
import DrawingToolbar from '../drawing/DrawingToolbar';
import DrawingOverlay from '../drawing/DrawingOverlay';
import FavoritesBar from '../drawing/FavoritesBar';
import ManageDrawingsModal from '../drawing/ManageDrawingsModal';
import { useDrawingStore } from '../../store/useDrawingStore';
import { drawingEvents } from '../drawing/framework/DrawingEvents';
import IndicatorsModal from './IndicatorsModal';
import IndicatorSettingsDialog from './IndicatorSettingsDialog';
import SubPaneChart from './SubPaneChart';
import { INDICATOR_REGISTRY } from '../../services/indicators/registry';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import BarReplayController from './BarReplayController';
import ChartSettingsModal, { DEFAULT_CHART_SETTINGS, type ChartSettingsState } from './ChartSettingsModal';
import ChartLegendHUD, { type ActiveIndicatorInfo } from './ChartLegendHUD';
import VolumeProfileOverlay from './VolumeProfileOverlay';
import DeepStudiesOverlay from './DeepStudiesOverlay';
import PriceScaleActionFlyout from './PriceScaleActionFlyout';
import SymbolSearchModal from '../Search/SymbolSearchModal';
import PineDrawingsOverlay from './PineDrawingsOverlay';
import PeriodSeparatorsOverlay from './PeriodSeparatorsOverlay';
import PineSettingsModal from './PineSettingsModal';
import OnChartNewsOverlay from './OnChartNewsOverlay';
import CustomIntervalModal from './CustomIntervalModal';
import {
  parseTimeframeToSeconds,
  formatCountdownTimer,
  loadStoredCustomTimeframes,
  saveStoredCustomTimeframe,
  removeStoredCustomTimeframe,
  validateCustomInterval,
  type IntervalUnit,
} from '../../utils/timeframe';
import ChartContextMenu, { type ChartContextMenuPos } from './ChartContextMenu';
import { captureMultiCanvasSnapshot } from '../../services/journalService';
import RiskHUD from '../RiskHUD';
import { useLayoutStore } from '../../store/useLayoutStore';
import { chartSyncBus } from '../../services/crosshairSyncBus';
import { datafeedHub } from '../../services/datafeed';
import { computeActiveSessions } from '../../services/marketSessions';

const SMA_N = 20, EMA_N = 50, EMA_K = 2 / (EMA_N + 1);
const FAVORITE_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

const bar = (c: Candle) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });
const vol = (c: Candle) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(255,255,255,.45)' : 'rgba(113,113,122,.35)' });
const pts = (cs: Candle[], v: (number | null)[]) =>
  cs.flatMap((c, i) => (v[i] == null ? [] : [{ time: c.time as UTCTimestamp, value: v[i] as number }]));

const localTime = (t: Time) =>
  new Date((t as number) * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const tickLabel = (t: Time, type: number) => {
  const d = new Date((t as number) * 1000);
  if (type === 0) return String(d.getFullYear());
  if (type === 1) return d.toLocaleString('en-GB', { month: 'short' });
  if (type === 2) return String(d.getDate());
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

interface Api {
  chart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  barSeries: ISeriesApi<'Bar'>;
  lineSeries: ISeriesApi<'Line'>;
  areaSeries: ISeriesApi<'Area'>;
  baselineSeries: ISeriesApi<'Baseline'>;
  volume: ISeriesApi<'Histogram'>;
  sma: ISeriesApi<'Line'>;
  ema: ISeriesApi<'Line'>;
  vwap: ISeriesApi<'Line'>;
  bbUpper: ISeriesApi<'Line'>;
  bbLower: ISeriesApi<'Line'>;
  rsi: ISeriesApi<'Line'>;
  oi: ISeriesApi<'Histogram'>;
}
interface LiveInd { closes: number[]; lastTime: number; emaPrev: number | null; lastEma: number | null }

export interface TradingChartProps {
  paneId?: string;
  symbolOverride?: string;
  timeframeOverride?: Timeframe;
  hideTopToolbar?: boolean;
}

export default function TradingChart({
  paneId = 'pane-1',
  symbolOverride,
  timeframeOverride,
  hideTopToolbar,
}: TradingChartProps = {}) {
  const storeSymbol = useTerminalStore((s) => s.symbol);
  const symbol = symbolOverride ?? storeSymbol;
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const storeTimeframe = useTerminalStore((s) => s.timeframe);
  const timeframe = timeframeOverride ?? storeTimeframe;
  const setTimeframe = useTerminalStore((s) => s.setTimeframe);
  const candles = useTerminalStore((s) => s.candles);
  const error = useTerminalStore((s) => s.error);
  const isLoadingCandles = useTerminalStore((s) => s.isLoadingCandles);
  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const addAlert = useTerminalStore((s) => s.addAlert);
  const pinePlots = useTerminalStore((s) => s.pinePlots);
  const activePineScripts = useTerminalStore((s) => s.activePineScripts);
  const togglePineScript = useTerminalStore((s) => s.togglePineScript);
  const removePineScript = useTerminalStore((s) => s.removePineScript);
  const recalculatePineScripts = useTerminalStore((s) => s.recalculatePineScripts);
  const trades = useTerminalStore((s) => s.trades);

  // Layout & Multi-Chart Store
  const activePaneId = useLayoutStore((s) => s.activePaneId);
  const setActivePaneId = useLayoutStore((s) => s.setActivePaneId);
  const syncCrosshair = useLayoutStore((s) => s.syncCrosshair);
  const syncRange = useLayoutStore((s) => s.syncRange);
  const setPaneSymbol = useLayoutStore((s) => s.setPaneSymbol);
  const setPaneTimeframe = useLayoutStore((s) => s.setPaneTimeframe);
  const themeMode = useLayoutStore((s) => s.themeMode);
  const toggleThemeMode = useLayoutStore((s) => s.toggleThemeMode);
  const layout = useLayoutStore((s) => s.layout);
  const isMultiChart = layout !== '1x1';
  const isCurrentPaneActive = !paneId || paneId === activePaneId;

  // Independent candle fetching for secondary / overridden panes
  const isIndependentPane = Boolean(symbolOverride || timeframeOverride);
  const [localCandles, setLocalCandles] = useState<Candle[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoadingBars, setIsLoadingBars] = useState<boolean>(false);

  useEffect(() => {
    if (!isIndependentPane) return;
    const ctl = new AbortController();
    let cancelled = false;

    // Reset local candles immediately on symbol or timeframe change to prevent stale display
    setLocalCandles([]);

    const load = async () => {
      try {
        setIsLoadingBars(true);
        setLocalError(null);
        const { candles: fetched } = await datafeedHub.getBars(symbol, timeframe, undefined, undefined, ctl.signal);
        if (cancelled) return;
        setLocalCandles(fetched);
      } catch (err: unknown) {
        if (!cancelled && !(err instanceof DOMException)) {
          setLocalError(err instanceof Error ? err.message : 'Failed to load bars');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBars(false);
        }
      }
    };

    load();

    const onRealtimeBar = (bar: Candle) => {
      setLocalCandles((prev) => {
        if (!prev.length) return [bar];
        const last = prev[prev.length - 1];
        if (last.time === bar.time) {
          const next = [...prev];
          next[next.length - 1] = bar;
          return next;
        } else if (bar.time > last.time) {
          return [...prev, bar];
        }
        return prev;
      });
    };

    const subId = datafeedHub.subscribeBars(symbol, timeframe, onRealtimeBar);

    return () => {
      cancelled = true;
      ctl.abort();
      datafeedHub.unsubscribeBars(subId);
    };
  }, [symbol, timeframe, isIndependentPane]);

  const activeCandles = isIndependentPane ? localCandles : candles;
  const activeError = isIndependentPane ? localError : error;

  // Psychology and Skins Store
  const zenMode = usePsychologyStore((s) => s.zenMode);
  const themeConfig = usePsychologyStore((s) => s.themeConfig);
  const setThemeConfig = usePsychologyStore((s) => s.setThemeConfig);

  // Derivatives & Institutional Overlay Store
  const isGhostVisible = useDerivativesStore((s) => s.isGhostVisible);
  const toggleGhost = useDerivativesStore((s) => s.toggleGhost);
  const canvasOrderLines = useDerivativesStore((s) => s.canvasOrderLines);
  const initCanvasOrderLines = useDerivativesStore((s) => s.initCanvasOrderLines);
  const clearCanvasOrderLines = useDerivativesStore((s) => s.clearCanvasOrderLines);

  const provider = getInstrument(symbol)?.provider ?? 'binance';

  // Indicators & Chart Styles
  const layoutChartStyle = useLayoutStore((s) => s.chartStyle);
  const setLayoutChartStyle = useLayoutStore((s) => s.setChartStyle);
  const chartStyle = layoutChartStyle || 'CANDLE';
  const setChartStyle = setLayoutChartStyle;
  const [showSma, setShowSma] = useState(false);
  const [showEma, setShowEma] = useState(false);
  const [showVwap, setShowVwap] = useState(false);
  const [showBbands, setShowBbands] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showOI, setShowOI] = useState(false);
  const [showSessionOHL, setShowSessionOHL] = useState(false);

  // Custom Interval Direct Input State
  const [customVal, setCustomVal] = useState<number>(2);
  const [customUnit, setCustomUnit] = useState<IntervalUnit>('m');
  const [customInputError, setCustomInputError] = useState<string | null>(null);
  const [customIntervalList, setCustomIntervalList] = useState<string[]>([]);

  // Modals & Tools
  const [showRiskHUD, setShowRiskHUD] = useState(false);
  const [showSkinsModal, setShowSkinsModal] = useState(false);
  const [isScreenshotMenuOpen, setIsScreenshotMenuOpen] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState<string | null>(null);
  const screenshotMenuRef = useRef<HTMLDivElement>(null);
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // Drawing Tools & Magnet State
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const [showMobileDrawTools, setShowMobileDrawTools] = useState(false);
  const [isObjectTreeOpen, setIsObjectTreeOpen] = useState(false);
  const [drawingsCount, setDrawingsCount] = useState(0);
  const [clearDrawingTrigger, setClearDrawingTrigger] = useState(0);
  const [magnetConfig, setMagnetConfig] = useState<MagnetConfig>({ enabled: false, mode: 'WEAK' });
  const [isLockedAll, setIsLockedAll] = useState(false);
  const [isHiddenAll, setIsHiddenAll] = useState(false);
  const pineSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const hasFittedKeyRef = useRef<Record<string, boolean>>({});
  const lastDatasetKeyRef = useRef<string>('');
  const [countdownText, setCountdownText] = useState<string>('');
  const [isCustomIntervalModalOpen, setIsCustomIntervalModalOpen] = useState(false);
  const [activeTimeRange, setActiveTimeRange] = useState<string | null>(null);

  // Indicators Modal State
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false);
  const [selectedPineScriptForSettings, setSelectedPineScriptForSettings] = useState<ActivePineScript | null>(null);

  // Bar Replay Historical Time Machine State
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeedMs, setReplaySpeedMs] = useState(500);
  const [isSelectingCutPoint, setIsSelectingCutPoint] = useState(false);

  // Chart Settings State
  const [isChartSettingsOpen, setIsChartSettingsOpen] = useState(false);
  const [chartSettings, setChartSettings] = useState<ChartSettingsState>(() => {
    try {
      const stored = localStorage.getItem('crt_chart_settings');
      return stored ? { ...DEFAULT_CHART_SETTINGS, ...JSON.parse(stored) } : DEFAULT_CHART_SETTINGS;
    } catch {
      return DEFAULT_CHART_SETTINGS;
    }
  });

  const shouldShowTopToolbar = hideTopToolbar !== undefined ? !hideTopToolbar : Boolean(chartSettings.showSubToolbar);

  const updateChartSettings = (patch: Partial<ChartSettingsState>) => {
    setChartSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('crt_chart_settings', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('crt-chart-settings-changed', { detail: next }));
      } catch {}
      return next;
    });
  };

  const resetChartSettings = () => {
    setChartSettings(DEFAULT_CHART_SETTINGS);
    try {
      localStorage.setItem('crt_chart_settings', JSON.stringify(DEFAULT_CHART_SETTINGS));
      window.dispatchEvent(new CustomEvent('crt-chart-settings-changed', { detail: DEFAULT_CHART_SETTINGS }));
    } catch {}
  };

  useEffect(() => {
    const handleSettingsChanged = (e: any) => {
      if (e.detail) {
        setChartSettings((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('crt-chart-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('crt-chart-settings-changed', handleSettingsChanged);
  }, []);

  // Live inside-chart TradingView Legend HUD state
  const [currentOhlc, setCurrentOhlc] = useState<{ open: number; high: number; low: number; close: number; volume?: number } | null>(null);
  const [indicatorValues, setIndicatorValues] = useState<{
    sma?: number | null;
    ema?: number | null;
    vwap?: number | null;
    rsi?: number | null;
    oi?: number | null;
  }>({});
  const [scaleMode, setScaleMode] = useState<PriceScaleType>('NORMAL');
  const [timezone, setTimezone] = useState<ChartTimezone>('UTC');
  const [sessionData, setSessionData] = useState(() => computeActiveSessions());
  useEffect(() => {
    const timer = setInterval(() => setSessionData(computeActiveSessions()), 10000);
    return () => clearInterval(timer);
  }, []);
  const [showVolumeProfile, setShowVolumeProfile] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
  const [externalLineTrigger, setExternalLineTrigger] = useState<{ price: number; type: 'LINE' | 'RAY' } | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<ChartContextMenuPos | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const pointerDownAtRef = useRef<number | null>(null);
  const lastTouchTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isCreateAlertOpen, setIsCreateAlertOpen] = useState(false);
  const [alertInitialPrice, setAlertInitialPrice] = useState<number | undefined>(undefined);

  // Phase 3 Indicator Framework Store Hooks
  const activeInstances = useIndicatorsStore((s) => s.activeInstances);
  const toggleInstanceVisibility = useIndicatorsStore((s) => s.toggleVisibility);
  const removeInstance = useIndicatorsStore((s) => s.removeInstance);
  const clearAllInstances = useIndicatorsStore((s) => s.clearAllInstances);
  const openSettings = useIndicatorsStore((s) => s.openSettings);
  const [overlayValues, setOverlayValues] = useState<Record<string, number | null>>({});
  const overlaySeriesMap = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  // Top Toolbar Dropdown menus with fixed non-clipping viewport coordinates
  const [activeMenu, setActiveMenu] = useState<'TF' | 'STYLE' | 'COLOR' | 'LAYERS' | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);

  const isTfMenuOpen = activeMenu === 'TF';
  const isStyleMenuOpen = activeMenu === 'STYLE';
  const isColorMenuOpen = activeMenu === 'COLOR';
  const isLayersMenuOpen = activeMenu === 'LAYERS';

  const tfMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const layersMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  const closeAllMenus = useCallback(() => {
    setActiveMenu(null);
    setMenuAnchor(null);
    setIsScreenshotMenuOpen(false);
  }, []);

  const toggleTfMenu = useCallback(() => {
    if (activeMenu === 'TF') {
      closeAllMenus();
    } else {
      const rect = tfMenuRef.current?.getBoundingClientRect();
      const popoverWidth = Math.min(288, window.innerWidth - 16);
      if (rect) {
        const leftPos = window.innerWidth < 640
          ? Math.max(8, (window.innerWidth - popoverWidth) / 2)
          : Math.max(10, Math.min(window.innerWidth - 300, rect.left));
        setMenuAnchor({
          top: rect.bottom + 4,
          left: leftPos,
        });
      }
      setActiveMenu('TF');
    }
  }, [activeMenu, closeAllMenus]);

  const toggleStyleMenu = useCallback(() => {
    if (activeMenu === 'STYLE') {
      closeAllMenus();
    } else {
      const rect = styleMenuRef.current?.getBoundingClientRect();
      const popoverWidth = Math.min(240, window.innerWidth - 16);
      if (rect) {
        const leftPos = window.innerWidth < 640
          ? Math.max(8, (window.innerWidth - popoverWidth) / 2)
          : Math.max(10, Math.min(window.innerWidth - 260, rect.left));
        setMenuAnchor({
          top: rect.bottom + 4,
          left: leftPos,
        });
      }
      setActiveMenu('STYLE');
    }
  }, [activeMenu, closeAllMenus]);

  const toggleColorMenu = useCallback(() => {
    if (activeMenu === 'COLOR') {
      closeAllMenus();
    } else {
      const rect = colorMenuRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuAnchor({
          top: rect.bottom + 4,
          left: Math.max(10, Math.min(window.innerWidth - 280, rect.left)),
        });
      }
      setActiveMenu('COLOR');
    }
  }, [activeMenu, closeAllMenus]);

  const toggleLayersMenu = useCallback(() => {
    if (activeMenu === 'LAYERS') {
      closeAllMenus();
    } else {
      const rect = layersMenuRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuAnchor({
          top: rect.bottom + 4,
          left: Math.max(10, Math.min(window.innerWidth - 320, rect.left)),
        });
      }
      setActiveMenu('LAYERS');
    }
  }, [activeMenu, closeAllMenus]);

  useEffect(() => {
    const handleOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        (tfMenuRef.current && tfMenuRef.current.contains(target)) ||
        (styleMenuRef.current && styleMenuRef.current.contains(target)) ||
        (layersMenuRef.current && layersMenuRef.current.contains(target)) ||
        (colorMenuRef.current && colorMenuRef.current.contains(target)) ||
        (screenshotMenuRef.current && screenshotMenuRef.current.contains(target)) ||
        target.closest('[data-chart-toolbar-menu]')
      ) {
        return;
      }
      closeAllMenus();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    };
    if (activeMenu || isScreenshotMenuOpen) {
      window.addEventListener('pointerdown', handleOutside, true);
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('pointerdown', handleOutside, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [activeMenu, isScreenshotMenuOpen, closeAllMenus]);

  // TradingView-Style 1-Click Screenshot Handlers (Zero Eye-Mask Overlay)
  const handleDownloadScreenshot = async () => {
    setIsScreenshotMenuOpen(false);
    audioHaptics.tick();
    try {
      const dataUrl = await captureMultiCanvasSnapshot(box.current, chartApi);
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${symbol}_${timeframe}_${Date.now()}.png`;
        a.click();
        setSnapshotToast('Chart snapshot downloaded');
        setTimeout(() => setSnapshotToast(null), 3000);
      }
    } catch {
      setSnapshotToast('Snapshot download failed');
      setTimeout(() => setSnapshotToast(null), 3000);
    }
  };

  const handleCopyScreenshotImage = async () => {
    setIsScreenshotMenuOpen(false);
    audioHaptics.tick();
    try {
      const dataUrl = await captureMultiCanvasSnapshot(box.current, chartApi);
      if (dataUrl) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setSnapshotToast('Chart snapshot copied to clipboard');
        setTimeout(() => setSnapshotToast(null), 3000);
      }
    } catch {
      setSnapshotToast('Clipboard copy blocked by browser');
      setTimeout(() => setSnapshotToast(null), 3000);
    }
  };

  const handleCopyShareLink = async () => {
    setIsScreenshotMenuOpen(false);
    audioHaptics.tick();
    const url = `${window.location.origin}${window.location.pathname}?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`;
    try {
      await navigator.clipboard.writeText(url);
      setSnapshotToast('Chart link copied to clipboard');
    } catch {
      setSnapshotToast('Link copy failed');
    }
    setTimeout(() => setSnapshotToast(null), 3000);
  };

  // Expose global window triggers for active pane when unified topbar is active
  useEffect(() => {
    if (isCurrentPaneActive) {
      (window as any).__openIndicatorsModal = () => setIsIndicatorsModalOpen(true);
      (window as any).__openChartSettings = () => setIsChartSettingsOpen(true);
      (window as any).__toggleBarReplay = () => {
        if (isReplayActive) exitReplay();
        else startReplay();
      };
      (window as any).__openCreateAlert = () => {
        setAlertInitialPrice(currentPrice);
        setIsCreateAlertOpen(true);
      };
      (window as any).__openChartSkinsModal = () => setShowSkinsModal(true);
      (window as any).__updateChartSettings = (patch: any) => updateChartSettings(patch);
      (window as any).__getChartSettings = () => chartSettings;
      (window as any).__openObjectTree = () => setIsObjectTreeOpen(true);
      (window as any).__toggleVolumeProfile = () => setShowVolumeProfile((v) => !v);
      (window as any).__toggleGhost = () => toggleGhost();
      (window as any).__toggleSessionOHL = () => setShowSessionOHL((v) => !v);
      (window as any).__takeChartSnapshot = (action: 'download' | 'copy' | 'link') => {
        if (action === 'download') handleDownloadScreenshot();
        else if (action === 'copy') handleCopyScreenshotImage();
        else if (action === 'link') handleCopyShareLink();
      };
    }
    return () => {
      if (isCurrentPaneActive) {
        delete (window as any).__openIndicatorsModal;
        delete (window as any).__openChartSettings;
        delete (window as any).__toggleBarReplay;
        delete (window as any).__openCreateAlert;
        delete (window as any).__openChartSkinsModal;
        delete (window as any).__updateChartSettings;
        delete (window as any).__getChartSettings;
        delete (window as any).__openObjectTree;
        delete (window as any).__toggleVolumeProfile;
        delete (window as any).__toggleGhost;
        delete (window as any).__toggleSessionOHL;
        delete (window as any).__takeChartSnapshot;
      }
    };
  }, [isCurrentPaneActive, isReplayActive, currentPrice]);

  const favoriteTimeframes = useMemo(
    () => TIMEFRAMES[provider].filter((t) => FAVORITE_TIMEFRAMES.includes(t)),
    [provider]
  );

  const storedCustomTfs = useMemo(() => {
    return loadStoredCustomTimeframes().filter((tf) => !TIMEFRAMES[provider].includes(tf as any));
  }, [provider, isTfMenuOpen, isCustomIntervalModalOpen]);

  const activeLayersCount = useMemo(() => {
    return (
      (showVolumeProfile ? 1 : 0) +
      (isGhostVisible ? 1 : 0) +
      (showSessionOHL ? 1 : 0) +
      (canvasOrderLines.length > 0 ? 1 : 0) +
      (showRiskHUD ? 1 : 0) +
      (isRulerActive ? 1 : 0) +
      (isNotesOpen ? 1 : 0)
    );
  }, [showVolumeProfile, isGhostVisible, showSessionOHL, canvasOrderLines.length, showRiskHUD, isRulerActive, isNotesOpen]);

  const handleSetScaleMode = (mode: PriceScaleType) => {
    setScaleMode(mode);
    const a = api.current;
    if (!a) return;
    const pMode =
      mode === 'LOGARITHMIC'
        ? PriceScaleMode.Logarithmic
        : mode === 'PERCENTAGE'
        ? PriceScaleMode.Percentage
        : PriceScaleMode.Normal;
    a.candles.priceScale().applyOptions({ mode: pMode });
    a.barSeries.priceScale().applyOptions({ mode: pMode });
    a.lineSeries.priceScale().applyOptions({ mode: pMode });
    a.areaSeries.priceScale().applyOptions({ mode: pMode });
    a.baselineSeries.priceScale().applyOptions({ mode: pMode });
  };

  // Register global hotkey openers for symbol search, tool selection, and scale reset
  useEffect(() => {
    (window as any).__openSymbolSearch = () => setIsSymbolSearchOpen(true);
    (window as any).__openCreateAlert = (p?: number) => {
      setAlertInitialPrice(p ?? useTerminalStore.getState().currentPrice);
      setIsCreateAlertOpen(true);
    };
    (window as any).__selectDrawingTool = (tool: ToolType) => setActiveTool(tool);
    (window as any).__resetChartScale = () => {
      api.current?.candles.priceScale().applyOptions({ autoScale: true });
    };
    const unsubTool = drawingEvents.onSelectTool((tool) => setActiveTool(tool));
    return () => {
      delete (window as any).__openSymbolSearch;
      delete (window as any).__openCreateAlert;
      delete (window as any).__selectDrawingTool;
      delete (window as any).__resetChartScale;
      unsubTool();
    };
  }, []);

  // Active indicator list for in-chart legend controls
  const activeIndicatorsList = useMemo<ActiveIndicatorInfo[]>(() => {
    const list: ActiveIndicatorInfo[] = [];

    const openRegistrySettings = (indicatorId: string) => {
      const store = useIndicatorsStore.getState();
      let inst = store.activeInstances.find((i) => i.indicatorId === indicatorId);
      if (!inst) {
        inst = store.addInstance(indicatorId) || undefined;
      }
      if (inst) {
        store.openSettings(inst);
      }
    };

    if (showSma) {
      list.push({
        id: 'sma',
        name: 'SMA 20',
        color: '#f0b90b',
        value: indicatorValues.sma,
        visible: showSma,
        onToggleVisible: () => setShowSma((v) => !v),
        onOpenSettings: () => openRegistrySettings('sma'),
        onRemove: () => setShowSma(false),
      });
    }
    if (showEma) {
      list.push({
        id: 'ema',
        name: 'EMA 50',
        color: '#4c8dff',
        value: indicatorValues.ema,
        visible: showEma,
        onToggleVisible: () => setShowEma((v) => !v),
        onOpenSettings: () => openRegistrySettings('ema'),
        onRemove: () => setShowEma(false),
      });
    }
    if (showVwap) {
      list.push({
        id: 'vwap',
        name: 'VWAP',
        color: '#ec4899',
        value: indicatorValues.vwap,
        visible: showVwap,
        onToggleVisible: () => setShowVwap((v) => !v),
        onOpenSettings: () => openRegistrySettings('vwap'),
        onRemove: () => setShowVwap(false),
      });
    }
    if (showBbands) {
      list.push({
        id: 'bbands',
        name: 'BB 20 2',
        color: 'rgba(56, 189, 248, 0.85)',
        visible: showBbands,
        onToggleVisible: () => setShowBbands((v) => !v),
        onOpenSettings: () => openRegistrySettings('bbands'),
        onRemove: () => setShowBbands(false),
      });
    }
    if (showRsi) {
      list.push({
        id: 'rsi',
        name: 'RSI 14',
        color: '#c084fc',
        value: indicatorValues.rsi ? indicatorValues.rsi.toFixed(1) : undefined,
        visible: showRsi,
        onToggleVisible: () => setShowRsi((v) => !v),
        onOpenSettings: () => openRegistrySettings('rsi'),
        onRemove: () => setShowRsi(false),
      });
    }
    if (showOI) {
      list.push({
        id: 'oi',
        name: 'Open Interest',
        color: '#38bdf8',
        value: indicatorValues.oi ? fmtQty(indicatorValues.oi) : undefined,
        visible: showOI,
        onToggleVisible: () => setShowOI((v) => !v),
        onRemove: () => setShowOI(false),
      });
    }

    // Volume Histogram layer
    list.push({
      id: 'vol',
      name: 'Volume',
      color: '#a1a1aa',
      value: currentOhlc?.volume ? fmtQty(currentOhlc.volume) : undefined,
      visible: showVolume,
      onToggleVisible: () => {
        const next = !showVolume;
        setShowVolume(next);
        api.current?.volume.applyOptions({ visible: next });
      },
      onRemove: () => {
        setShowVolume(false);
        api.current?.volume.applyOptions({ visible: false });
      },
    });

    // Volume Profile (VPVR) layer
    if (showVolumeProfile) {
      list.push({
        id: 'vpvr',
        name: 'Volume Profile (VPVR)',
        color: '#38bdf8',
        visible: showVolumeProfile,
        onToggleVisible: () => setShowVolumeProfile(false),
        onRemove: () => setShowVolumeProfile(false),
      });
    }

    // 25+ Framework Active Indicators (both overlay and sub-pane oscillators)
    activeInstances.forEach((inst) => {
      const primaryStyle = Object.values(inst.styles)[0];
      const val = overlayValues[inst.instanceId];
      list.push({
        id: inst.instanceId,
        name: `${inst.name}`,
        color: primaryStyle?.color || '#38bdf8',
        value: val !== null && val !== undefined ? val.toFixed(2) : undefined,
        visible: inst.visible,
        onToggleVisible: () => toggleInstanceVisibility(inst.instanceId),
        onOpenSettings: () => openSettings(inst),
        onRemove: () => removeInstance(inst.instanceId),
      });
    });

    // Active Pine Script indicators in Chart Legend HUD
    activePineScripts.forEach((ps) => {
      list.push({
        id: ps.id,
        name: ps.name,
        color: '#38bdf8',
        visible: ps.visible,
        onToggleVisible: () => togglePineScript(ps.id),
        onOpenSettings: () => setSelectedPineScriptForSettings(ps),
        onRemove: () => removePineScript(ps.id),
      });
    });

    return list;
  }, [
    showSma,
    showEma,
    showVwap,
    showBbands,
    showRsi,
    showOI,
    showVolume,
    showVolumeProfile,
    currentOhlc,
    indicatorValues,
    activeInstances,
    overlayValues,
    activePineScripts,
    toggleInstanceVisibility,
    togglePineScript,
    openSettings,
    removeInstance,
    removePineScript,
  ]);

  // Automatically evaluate and synchronize active Pine Script indicators (e.g. CRT Model Pro by default)
  useEffect(() => {
    if (!candles || candles.length < 5) return;
    const timer = setTimeout(() => {
      recalculatePineScripts();
    }, 250);
    return () => clearTimeout(timer);
  }, [candles.length, symbol, timeframe, activePineScripts, recalculatePineScripts]);

  // Synchronize live candle OHLC and active indicators telemetry for Data Window panel
  useEffect(() => {
    useDrawingStore.getState().setActiveCandleOhlc(currentOhlc);
  }, [currentOhlc]);

  useEffect(() => {
    useDrawingStore.getState().setActiveIndicatorsTelemetry(activeIndicatorsList);
  }, [activeIndicatorsList]);

  const box = useRef<HTMLDivElement>(null);
  const ohlc = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const live = useRef<LiveInd>({ closes: [], lastTime: 0, emaPrev: null, lastEma: null });
  const hovering = useRef(false);

  // Expose chart APIs to state for overlay layers (Ghost / Canvas drag & drop)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<SeriesType> | null>(null);
  const [boxDimensions, setBoxDimensions] = useState<{ w: number; h: number }>({ w: 800, h: 500 });

  // Effective candles respecting Bar Replay slice
  const effectiveCandles = useMemo(() => {
    if (!isReplayActive) return activeCandles;
    return activeCandles.slice(0, Math.min(activeCandles.length, replayIndex + 1));
  }, [activeCandles, isReplayActive, replayIndex]);

  // Replay playback interval timer
  useEffect(() => {
    if (!isReplayActive || !isReplayPlaying) return;
    const targetCandles = activeCandles.length ? activeCandles : candles;
    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= targetCandles.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        audioHaptics.tick();
        const next = prev + 1;
        if (targetCandles[next]) {
          useTerminalStore.getState().updatePriceTick(symbol, targetCandles[next].close);
        }
        if (chartApi) {
          try {
            const logicalRange = chartApi.timeScale().getVisibleLogicalRange();
            if (logicalRange) {
              // Only auto-advance viewport if user is currently looking at playhead
              // If user panned/scrolled to earlier candles, do NOT yank their viewport
              const isFollowing = Math.abs(logicalRange.to - (prev + 8)) <= 25;
              if (isFollowing) {
                const span = Math.max(40, logicalRange.to - logicalRange.from);
                chartApi.timeScale().setVisibleLogicalRange({
                  from: Math.max(0, next - span + 8),
                  to: next + 8,
                });
              }
            }
          } catch {}
        }
        return next;
      });
    }, replaySpeedMs);
    return () => clearInterval(interval);
  }, [isReplayActive, isReplayPlaying, replaySpeedMs, activeCandles, candles, symbol, chartApi]);

  const startReplay = () => {
    audioHaptics.tick();
    setIsReplayActive(true);
    const targetCandles = activeCandles.length ? activeCandles : candles;
    const startIdx = Math.max(0, targetCandles.length - 40);
    setReplayIndex(startIdx);
    setIsReplayPlaying(false);
    if (targetCandles[startIdx]) {
      useTerminalStore.getState().updatePriceTick(symbol, targetCandles[startIdx].close);
    }
    setTimeout(() => {
      if (chartApi) {
        try {
          chartApi.timeScale().setVisibleLogicalRange({
            from: Math.max(0, startIdx - 80),
            to: startIdx + 8,
          });
        } catch {}
      }
    }, 50);
  };

  const exitReplay = () => {
    audioHaptics.tick();
    setIsReplayActive(false);
    setIsReplayPlaying(false);
    setIsSelectingCutPoint(false);
    setTimeout(() => {
      if (chartApi) {
        try {
          chartApi.timeScale().scrollToRealTime();
        } catch {}
      }
    }, 50);
  };

  const handleStepForward = () => {
    audioHaptics.tick();
    const targetCandles = activeCandles.length ? activeCandles : candles;
    setReplayIndex((prev) => {
      const next = Math.min(targetCandles.length - 1, prev + 1);
      if (targetCandles[next]) {
        useTerminalStore.getState().updatePriceTick(symbol, targetCandles[next].close);
      }
      if (chartApi) {
        try {
          const logicalRange = chartApi.timeScale().getVisibleLogicalRange();
          const span = logicalRange ? Math.max(40, logicalRange.to - logicalRange.from) : 80;
          chartApi.timeScale().setVisibleLogicalRange({
            from: Math.max(0, next - span + 8),
            to: next + 8,
          });
        } catch {}
      }
      return next;
    });
  };

  const handleRecenterReplay = () => {
    audioHaptics.tick();
    if (chartApi) {
      try {
        const curRange = chartApi.timeScale().getVisibleLogicalRange();
        const span = curRange && Number.isFinite(curRange.to - curRange.from)
          ? Math.max(50, Math.round(curRange.to - curRange.from))
          : 80;
        chartApi.timeScale().setVisibleLogicalRange({
          from: Math.max(0, replayIndex - span + 8),
          to: replayIndex + 8,
        });
      } catch {}
    }
  };

  const handleToggleIndicator = (key: string) => {
    audioHaptics.tick();
    if (key === 'sma') setShowSma((v) => !v);
    else if (key === 'ema') setShowEma((v) => !v);
    else if (key === 'vwap') setShowVwap((v) => !v);
    else if (key === 'bbands') setShowBbands((v) => !v);
    else if (key === 'rsi') setShowRsi((v) => !v);
    else if (key === 'oi') setShowOI((v) => !v);
    else if (key === 'sessionOhl') setShowSessionOHL((v) => !v);
  };

  const handleClearAllIndicators = () => {
    audioHaptics.tick();
    setShowSma(false);
    setShowEma(false);
    setShowVwap(false);
    setShowBbands(false);
    setShowRsi(false);
    setShowOI(false);
    setShowSessionOHL(false);
    api.current?.sma.applyOptions({ visible: false });
    api.current?.ema.applyOptions({ visible: false });
    api.current?.vwap.applyOptions({ visible: false });
    api.current?.bbUpper.applyOptions({ visible: false });
    api.current?.bbLower.applyOptions({ visible: false });
    api.current?.rsi.applyOptions({ visible: false });
    api.current?.oi.applyOptions({ visible: false });
    clearAllInstances();
    useTerminalStore.setState({ activePineScripts: [], pinePlots: [], pineDrawings: null });
  };

  const handleApplyCustomInterval = (valToApply?: number, unitToApply?: IntervalUnit) => {
    const v = valToApply ?? customVal;
    const u = unitToApply ?? customUnit;
    const res = validateCustomInterval(v, u);
    if (!res.ok) {
      setCustomInputError(res.error || 'Invalid interval');
      return;
    }
    setCustomInputError(null);
    audioHaptics.tick();
    const tfStr = `${v}${u}` as Timeframe;
    saveStoredCustomTimeframe(tfStr);
    setTimeframe(tfStr);
    setPaneTimeframe(paneId, tfStr);
    closeAllMenus();
  };



  // Trade Execution Hover Details Tooltip State & Cache
  interface HoveredExecution {
    type: 'ENTRY' | 'EXIT';
    side: 'BUY' | 'SELL';
    price: number;
    qty: number;
    pnl?: number;
    time: number;
    x: number;
    y: number;
  }
  const [hoveredExecution, setHoveredExecution] = useState<HoveredExecution | null>(null);
  const executionMarkersRef = useRef<Map<number, Omit<HoveredExecution, 'x' | 'y'>[]>>(new Map());

  useEffect(() => {
    if (!box.current) return;
    const updateSize = () => {
      if (box.current) {
        setBoxDimensions({
          w: box.current.clientWidth,
          h: box.current.clientHeight,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const writeOhlc = (c?: { open: number; high: number; low: number; close: number; volume?: number }) => {
    const sym = useTerminalStore.getState().symbol;
    const tf = useTerminalStore.getState().timeframe;
    if (!ohlc.current) return;
    if (!c) {
      ohlc.current.innerHTML = '';
      return;
    }
    const diff = c.close - c.open;
    const diffPct = c.open ? ((diff / c.open) * 100).toFixed(2) : '0.00';
    const isUp = diff >= 0;
    const diffColor = isUp ? '#22c55e' : '#ef4444';
    const diffSign = isUp ? '+' : '';

    ohlc.current.innerHTML = `
      <span class="font-bold text-white mr-2.5 tracking-wide">${labelOf(sym)} · ${tf}</span>
      <span class="text-slate-500 font-semibold mr-0.5">O</span><span class="${isUp ? 'text-up' : 'text-down'} font-medium mr-2">${fmtPrice(c.open, sym)}</span>
      <span class="text-slate-500 font-semibold mr-0.5">H</span><span class="${isUp ? 'text-up' : 'text-down'} font-medium mr-2">${fmtPrice(c.high, sym)}</span>
      <span class="text-slate-500 font-semibold mr-0.5">L</span><span class="${isUp ? 'text-up' : 'text-down'} font-medium mr-2">${fmtPrice(c.low, sym)}</span>
      <span class="text-slate-500 font-semibold mr-0.5">C</span><span class="${isUp ? 'text-up' : 'text-down'} font-medium mr-2.5">${fmtPrice(c.close, sym)}</span>
      <span style="color:${diffColor}" class="font-bold mr-2.5">${diffSign}${fmtPrice(diff, sym)} (${diffSign}${diffPct}%)</span>
      ${c.volume ? `<span class="text-slate-500 font-semibold mr-0.5">Vol</span><span class="text-slate-300 font-medium">${fmtQty(c.volume)}</span>` : ''}
    `;
  };

  // Create once, destroy on unmount.
  useEffect(() => {
    const isLightMode = themeMode === 'LIGHT' || (typeof document !== 'undefined' && document.documentElement.classList.contains('theme-light'));
    const isCustomBg = themeConfig.wallpaperType !== 'SOLID' && !!themeConfig.mediaUrl;
    const isZen = zenMode.active && zenMode.softPastelCandles;

    // #141413 is the legacy DARK default; it must not override LIGHT mode.
    const storedSolidBg = themeConfig.solidColor;
    const effectiveSolidBg = storedSolidBg && storedSolidBg.toLowerCase() !== '#141413'
      ? storedSolidBg
      : (isLightMode ? '#f4f4f6' : '#141413');
    const chartBgColor = isCustomBg ? 'rgba(0, 0, 0, 0)' : effectiveSolidBg;
    const chartTextColor = isLightMode ? '#555555' : '#828290';
    const chartGridColor = isLightMode ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.03)';
    const chartBorderColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : '#1e1e26';

    const chart = createChart(box.current!, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: chartBgColor },
        textColor: chartTextColor,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: chartGridColor },
        horzLines: { color: chartGridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isLightMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: isLightMode ? '#e4e4e7' : '#181820',
        },
        horzLine: {
          color: isLightMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: isLightMode ? '#e4e4e7' : '#181820',
        },
      },
      rightPriceScale: {
        borderColor: chartBorderColor,
        scaleMargins: { top: 0.04, bottom: 0.04 },
        autoScale: true,
        alignLabels: true,
        borderVisible: true,
      },
      timeScale: {
        borderColor: chartBorderColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: tickLabel,
        barSpacing: 12,
        minBarSpacing: 3,
        rightOffset: 20,
        borderVisible: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      kineticScroll: {
        touch: true,
        mouse: false,
      },
      localization: { timeFormatter: localTime },
    });

    const defaultUp = isLightMode ? '#16a34a' : '#ffffff';
    const defaultDown = isLightMode ? '#dc2626' : '#101015';
    const initialUp = chartSettings.candleUpColor && chartSettings.candleUpColor !== '#ffffff'
      ? chartSettings.candleUpColor
      : defaultUp;
    const initialDown = chartSettings.candleDownColor && chartSettings.candleDownColor !== '#101015'
      ? chartSettings.candleDownColor
      : defaultDown;

    const isDarkInit = initialDown === '#101015' || initialDown === '#050508';
    const borderDownInit = isLightMode ? initialDown : (isDarkInit ? '#71717a' : initialDown);
    const cs = chart.addCandlestickSeries({
      upColor: initialUp,
      downColor: initialDown,
      borderVisible: true,
      borderUpColor: initialUp,
      borderDownColor: borderDownInit,
      wickVisible: true,
      wickUpColor: initialUp,
      wickDownColor: borderDownInit,
      visible: chartStyle === 'CANDLE' || chartStyle === 'HOLLOW_CANDLE' || chartStyle === 'HEIKIN_ASHI' || chartStyle === 'FOOTPRINT',
    });
    cs.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });

    const barSeries = chart.addBarSeries({
      upColor: chartSettings.candleUpColor || '#ffffff',
      downColor: borderDownInit,
      visible: chartStyle === 'BAR',
    });
    barSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });

    const lineSeries = chart.addLineSeries({
      color: chartSettings.candleUpColor || '#ffffff',
      lineWidth: 2,
      visible: chartStyle === 'LINE',
    });
    lineSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });

    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(255, 255, 255, 0.28)',
      bottomColor: 'rgba(255, 255, 255, 0.02)',
      lineColor: chartSettings.candleUpColor || '#ffffff',
      lineWidth: 2,
      visible: chartStyle === 'AREA',
    });
    areaSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });

    const baselineSeries = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#089981',
      topFillColor1: 'rgba(8, 153, 129, 0.28)',
      topFillColor2: 'rgba(8, 153, 129, 0.05)',
      bottomLineColor: '#f23645',
      bottomFillColor1: 'rgba(242, 54, 69, 0.05)',
      bottomFillColor2: 'rgba(242, 54, 69, 0.28)',
      visible: chartStyle === 'BASELINE',
    });
    baselineSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });

    const vs = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      visible: showVolume,
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const lineOpts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: false };
    const smaS = chart.addLineSeries({ ...lineOpts, color: '#f0b90b' });
    const emaS = chart.addLineSeries({ ...lineOpts, color: '#4c8dff' });
    const vwapS = chart.addLineSeries({ ...lineOpts, color: '#ec4899' });

    // Bollinger Bands Lines
    const bbUpper = chart.addLineSeries({ ...lineOpts, color: 'rgba(56, 189, 248, 0.65)' });
    const bbLower = chart.addLineSeries({ ...lineOpts, color: 'rgba(56, 189, 248, 0.65)' });

    // RSI Line series sub-pane
    const rsiS = chart.addLineSeries({
      priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      priceScaleId: 'rsi',
      color: '#c084fc',
      lineWidth: 1,
      title: 'RSI 14',
      visible: false,
    });
    rsiS.priceScale().applyOptions({
      scaleMargins: { top: 0.76, bottom: 0 },
      visible: false,
    });

    // Open Interest (OI) histogram series sub-pane
    const ois = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'oi',
      title: 'Open Interest',
    });
    ois.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
      visible: false,
    });

    api.current = {
      chart,
      candles: cs,
      barSeries,
      lineSeries,
      areaSeries,
      baselineSeries,
      volume: vs,
      sma: smaS,
      ema: emaS,
      vwap: vwapS,
      bbUpper,
      bbLower,
      rsi: rsiS,
      oi: ois,
    };
    setChartApi(chart);
    setSeriesApi(cs);

    // Register globally for screenshot capture
    if (box.current) {
      (window as any).__chartContainer = box.current;
    }
    (window as any).__chartApi = chart;

    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(cs) as CandlestickData | undefined;
      hovering.current = !!d;

      // Check if hovering over a trade execution candle (entry or exit arrow)
      if (p.time && p.point) {
        const cTime = p.time as number;
        const execs = executionMarkersRef.current.get(cTime);
        if (execs && execs.length > 0) {
          setHoveredExecution({
            ...execs[0],
            x: p.point.x,
            y: p.point.y,
          });
        } else {
          setHoveredExecution(null);
        }
      } else {
        setHoveredExecution(null);
      }

      if (d) {
        const v = p.seriesData.get(vs) as { value?: number } | undefined;
        const sVal = p.seriesData.get(smaS) as { value?: number } | undefined;
        const eVal = p.seriesData.get(emaS) as { value?: number } | undefined;
        const vwVal = p.seriesData.get(vwapS) as { value?: number } | undefined;
        const rVal = p.seriesData.get(rsiS) as { value?: number } | undefined;
        const oVal = p.seriesData.get(ois) as { value?: number } | undefined;

        if (p.time && hovering.current) {
          chartSyncBus.emitCrosshair({
            sourcePaneId: paneId,
            time: p.time as number,
            price: d.close,
          });
        }
        writeOhlc({ open: d.open, high: d.high, low: d.low, close: d.close, volume: v?.value });
        setCurrentOhlc({ open: d.open, high: d.high, low: d.low, close: d.close, volume: v?.value });
        setIndicatorValues({
          sma: sVal?.value ?? null,
          ema: eVal?.value ?? null,
          vwap: vwVal?.value ?? null,
          rsi: rVal?.value ?? null,
          oi: oVal?.value ?? null,
        });
      } else {
        // Clear crosshair on other charts when mouse leaves candles
        if (hovering.current) {
          chartSyncBus.emitCrosshair({
            sourcePaneId: paneId,
            time: null,
            price: null,
          });
        }
      }
    });

    // Crosshair and Range Synchronization
    const onRangeChanged = (range: any) => {
      if (range && hovering.current) {
        chartSyncBus.emitRange({
          sourcePaneId: paneId,
          from: range.from,
          to: range.to,
        });
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChanged);

    const offCrosshair = chartSyncBus.subscribeCrosshair((e) => {
      if (e.sourcePaneId === paneId || !useLayoutStore.getState().syncCrosshair) return;
      if (!e.time) {
        try {
          chart.clearCrosshairPosition();
        } catch {}
      } else {
        try {
          const targetSeries = cs || lineSeries || areaSeries || barSeries;
          if (targetSeries) {
            chart.setCrosshairPosition(e.price ?? 0, e.time as any, targetSeries);
          }
        } catch {}
      }
    });

    const offRange = chartSyncBus.subscribeRange((e) => {
      if (e.sourcePaneId === paneId || !useLayoutStore.getState().syncRange) return;
      try {
        chart.timeScale().setVisibleLogicalRange({ from: e.from, to: e.to });
      } catch {}
    });

    const onThemeChange = () => {
      const isLight = document.documentElement.classList.contains('theme-light');
      const currentTheme = usePsychologyStore.getState().themeConfig;
      const hasCustomWallpaper = currentTheme.wallpaperType !== 'SOLID' && !!currentTheme.mediaUrl;
      const savedSolid = currentTheme.solidColor;
      const solidBackground = savedSolid && savedSolid.toLowerCase() !== '#141413'
        ? savedSolid
        : (isLight ? '#f4f4f6' : '#141413');
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: hasCustomWallpaper ? 'rgba(0, 0, 0, 0)' : solidBackground },
          textColor: isLight ? '#555555' : '#828290',
        },
        grid: {
          vertLines: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)' },
        },
        rightPriceScale: {
          borderColor: isLight ? '#e4e4e7' : '#1e1e26',
        },
        timeScale: {
          borderColor: isLight ? '#e4e4e7' : '#1e1e26',
        },
      });
    };
    window.addEventListener('crt-theme-change', onThemeChange);

    const onLive = (c: Candle) => {
      try {
        const st = live.current;
        const b = bar(c);
        const lPoint = { time: c.time as UTCTimestamp, value: c.close };
        cs.update(b);
        barSeries.update(b);
        lineSeries.update(lPoint);
        areaSeries.update(lPoint);
        baselineSeries.update(lPoint);
        vs.update(vol(c));
        if (c.time > st.lastTime) { st.emaPrev = st.lastEma; st.closes.push(c.close); st.lastTime = c.time; }
        else if (st.closes.length) st.closes[st.closes.length - 1] = c.close;
        else return;
        const n = st.closes.length;
        const time = c.time as UTCTimestamp;
        if (n >= SMA_N) {
          let sum = 0;
          for (let i = n - SMA_N; i < n; i++) sum += st.closes[i];
          smaS.update({ time, value: sum / SMA_N });
        }
        if (st.emaPrev !== null) {
          st.lastEma = EMA_K * c.close + (1 - EMA_K) * st.emaPrev;
          emaS.update({ time, value: st.lastEma });
        }
        if (!hovering.current) {
          writeOhlc(c);
          setCurrentOhlc({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
        }
      } catch { /* update raced a history reload */ }
    };
    liveCandleBus.add(onLive);

    return () => {
      window.removeEventListener('crt-theme-change', onThemeChange);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChanged);
      offCrosshair();
      offRange();
      liveCandleBus.delete(onLive);
      chart.remove();
      delete (window as any).__chartContainer;
      delete (window as any).__chartApi;
      api.current = null;
      setChartApi(null);
      setSeriesApi(null);
    };
  }, []);

  // Update background transparency & solid color when ChartSkins or solidColor changes
  useEffect(() => {
    if (!api.current) return;
    const isCustomBg = themeConfig.wallpaperType !== 'SOLID' && !!themeConfig.mediaUrl;
    const savedSolid = themeConfig.solidColor;
    const solidBg = savedSolid && savedSolid.toLowerCase() !== '#141413'
      ? savedSolid
      : (themeMode === 'LIGHT' ? '#f4f4f6' : '#141413');
    api.current.chart.applyOptions({
      layout: {
        background: {
          type: ColorType.Solid,
          color: isCustomBg ? 'rgba(0, 0, 0, 0)' : solidBg,
        },
      },
    });
  }, [themeConfig.wallpaperType, themeConfig.mediaUrl, themeConfig.solidColor, themeMode]);

  // Update pastel candle palette ONLY when Zen Mode is explicitly active
  useEffect(() => {
    if (!api.current) return;
    if (zenMode.active && zenMode.softPastelCandles) {
      const upColor = '#4a7c59';
      const downColor = '#8b5d5d';
      api.current.candles.applyOptions({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    }
  }, [zenMode.active, zenMode.softPastelCandles]);

  // Dynamic Chart Settings and Theme Synchronization
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const isLight = themeMode === 'LIGHT';
    const isCustomBg = themeConfig.wallpaperType !== 'SOLID' && !!themeConfig.mediaUrl;

    if (chartStyle !== 'FOOTPRINT') {
      const defaultUp = isLight ? '#16a34a' : '#ffffff';
      const defaultDown = isLight ? '#dc2626' : '#101015';

      const upColor = chartSettings.candleUpColor && chartSettings.candleUpColor !== '#ffffff'
        ? chartSettings.candleUpColor
        : defaultUp;
      const downColor = chartSettings.candleDownColor && chartSettings.candleDownColor !== '#101015'
        ? chartSettings.candleDownColor
        : defaultDown;

      const isDark = downColor === '#101015' || downColor === '#050508';
      const borderDown = chartSettings.borderDownColor || (isLight ? downColor : (isDark ? '#71717a' : downColor));
      const borderUp = chartSettings.borderUpColor || upColor;
      const wickDown = chartSettings.wickDownColor || borderDown;
      const wickUp = chartSettings.wickUpColor || upColor;

      a.candles.applyOptions({
        upColor: chartSettings.candleBodyVisible !== false ? upColor : 'transparent',
        downColor: chartSettings.candleBodyVisible !== false ? downColor : 'transparent',
        borderVisible: chartSettings.candleBorderVisible !== false,
        borderUpColor: borderUp,
        borderDownColor: borderDown,
        wickVisible: chartSettings.candleWickVisible !== false,
        wickUpColor: wickUp,
        wickDownColor: wickDown,
        lastValueVisible: chartSettings.showLastPriceLine,
        priceLineVisible: chartSettings.showLastPriceLine,
      });

      a.barSeries.applyOptions({
        upColor,
        downColor: borderDown,
      });

      a.lineSeries.applyOptions({
        color: upColor,
      });

      if (chartSettings.topMarginPercent !== undefined && chartSettings.bottomMarginPercent !== undefined) {
        a.candles.priceScale().applyOptions({
          scaleMargins: {
            top: chartSettings.topMarginPercent / 100,
            bottom: chartSettings.bottomMarginPercent / 100,
          },
        });
      }
    }

    const gridBase = isLight ? '0, 0, 0' : '255, 255, 255';
    const savedSolid = themeConfig.solidColor;
    const effectiveSolid = savedSolid && savedSolid.toLowerCase() !== '#141413'
      ? savedSolid
      : (isLight ? '#f4f4f6' : '#141413');
    const chartBg = isCustomBg ? 'rgba(0, 0, 0, 0)' : effectiveSolid;
    const chartText = isLight ? '#555555' : '#828290';
    const chartBorder = isLight ? 'rgba(0, 0, 0, 0.1)' : '#1e1e26';

    a.chart.applyOptions({
      layout: {
        background: {
          type: ColorType.Solid,
          color: chartBg,
        },
        textColor: chartText,
      },
      grid: {
        vertLines: {
          visible: chartSettings.gridLines === 'both' || chartSettings.gridLines === 'vertical',
          color: `rgba(${gridBase}, ${chartSettings.gridOpacity})`,
        },
        horzLines: {
          visible: chartSettings.gridLines === 'both' || chartSettings.gridLines === 'horizontal',
          color: `rgba(${gridBase}, ${chartSettings.gridOpacity})`,
        },
      },
      crosshair: {
        vertLine: {
          color: isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)',
          labelBackgroundColor: isLight ? '#e4e4e7' : '#181820',
        },
        horzLine: {
          color: isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)',
          labelBackgroundColor: isLight ? '#e4e4e7' : '#181820',
        },
      },
      rightPriceScale: {
        borderColor: chartBorder,
      },
      timeScale: {
        borderColor: chartBorder,
      },
    });

    if (chartSettings.timezone && chartSettings.timezone !== timezone) {
      setTimezone(chartSettings.timezone as ChartTimezone);
    }
  }, [chartSettings, timezone, themeMode, themeConfig.wallpaperType, themeConfig.mediaUrl, chartStyle]);

  // Synchronize Lightweight Charts Crosshair Visibility with Selected Drawing Tool
  useEffect(() => {
    const a = api.current;
    if (!a?.chart) return;
    try {
      if (activeTool === 'CURSOR_ARROW' || activeTool === 'CURSOR_ERASER') {
        a.chart.applyOptions({
          crosshair: {
            mode: CrosshairMode.Hidden,
            vertLine: { visible: false },
            horzLine: { visible: false },
          },
        });
      } else {
        a.chart.applyOptions({
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { visible: true },
            horzLine: { visible: true },
          },
        });
      }
    } catch {}
  }, [activeTool]);

  // Trade Execution & Order Fill Markers on Candlestick Series (Clean TradingView arrows without text watermark)
  useEffect(() => {
    const a = api.current;
    if (!a || !effectiveCandles.length) return;

    if (!chartSettings.showExecutionsOnChart) {
      try {
        a.candles.setMarkers([]);
        executionMarkersRef.current.clear();
      } catch {}
      return;
    }

    const s = useTerminalStore.getState();
    const symbolTrades = s.trades.filter((t) => t.symbol === symbol);
    const pos = s.positions[symbol];

    executionMarkersRef.current.clear();

    if (!symbolTrades.length && !pos) {
      try {
        a.candles.setMarkers([]);
      } catch {}
      return;
    }

    // Helper to snap a timestamp to the closest candle time
    const snapToCandleTime = (tsMs: number): UTCTimestamp | null => {
      const sec = tsMs > 1e11 ? Math.floor(tsMs / 1000) : tsMs;
      if (!effectiveCandles.length) return null;
      let closest = effectiveCandles[0].time;
      let minDiff = Infinity;
      for (let i = 0; i < effectiveCandles.length; i++) {
        const ct = effectiveCandles[i].time;
        const diff = Math.abs(ct - sec);
        if (diff < minDiff) {
          minDiff = diff;
          closest = ct;
        }
      }
      return closest as UTCTimestamp;
    };

    const markers: any[] = [];

    const recordExecution = (cTime: number, exec: Omit<HoveredExecution, 'x' | 'y'>) => {
      const list = executionMarkersRef.current.get(cTime) || [];
      list.push(exec);
      executionMarkersRef.current.set(cTime, list);
    };

    // 1. Closed historical trades (Entry arrow + Exit opposite arrow)
    for (const t of symbolTrades) {
      // Entry marker (clean arrow without text watermark)
      const entryTime = snapToCandleTime(t.entryTime || t.time);
      if (entryTime) {
        markers.push({
          time: entryTime,
          position: t.side === 'LONG' ? 'belowBar' : 'aboveBar',
          color: t.side === 'LONG' ? '#22c55e' : '#ef4444',
          shape: t.side === 'LONG' ? 'arrowUp' : 'arrowDown',
          id: `entry_${t.id}`,
        });
        recordExecution(entryTime as number, {
          type: 'ENTRY',
          side: t.side === 'LONG' ? 'BUY' : 'SELL',
          price: t.entry,
          qty: t.qty,
          time: t.entryTime || t.time,
        });
      }

      // Exit marker (opposite arrow at exit candle)
      const exitTime = snapToCandleTime(t.time);
      if (exitTime) {
        markers.push({
          time: exitTime,
          position: t.side === 'LONG' ? 'aboveBar' : 'belowBar',
          color: t.side === 'LONG' ? '#f43f5e' : '#10b981',
          shape: t.side === 'LONG' ? 'arrowDown' : 'arrowUp',
          id: `exit_${t.id}`,
        });
        recordExecution(exitTime as number, {
          type: 'EXIT',
          side: t.side === 'LONG' ? 'SELL' : 'BUY',
          price: t.exit,
          qty: t.qty,
          pnl: t.pnl,
          time: t.time,
        });
      }
    }

    // 2. Currently active open position entry marker
    if (pos && pos.entryTime) {
      const activeTime = snapToCandleTime(pos.entryTime);
      if (activeTime) {
        markers.push({
          time: activeTime,
          position: pos.side === 'LONG' ? 'belowBar' : 'aboveBar',
          color: pos.side === 'LONG' ? '#22c55e' : '#ef4444',
          shape: pos.side === 'LONG' ? 'arrowUp' : 'arrowDown',
          id: `active_${symbol}`,
        });
        recordExecution(activeTime as number, {
          type: 'ENTRY',
          side: pos.side === 'LONG' ? 'BUY' : 'SELL',
          price: pos.entryPrice,
          qty: pos.size,
          time: pos.entryTime,
        });
      }
    }

    markers.sort((m1, m2) => (m1.time as number) - (m2.time as number));

    try {
      a.candles.setMarkers(markers);
    } catch {}
  }, [trades, symbol, chartSettings.showExecutionsOnChart, effectiveCandles.length]);

  // History load / symbol / timeframe / Bar Replay switch.
  useEffect(() => {
    const a = api.current;
    if (!a || !effectiveCandles.length) return;

    // Use standard or Heikin-Ashi transformed candles
    const displayCandles = chartStyle === 'HEIKIN_ASHI' ? heikinAshi(effectiveCandles) : effectiveCandles;
    const closes = displayCandles.map((c) => c.close);

    const s = sma(closes, SMA_N);
    const e = ema(closes, EMA_N);
    const r = rsi(closes, 14);
    const bb = bollingerBands(closes, 20, 2);
    const n = displayCandles.length;

    const d = decimalsFor(symbol, closes[n - 1]);
    const priceFormat = { type: 'price' as const, precision: d, minMove: Math.pow(10, -d) };
    a.candles.applyOptions({ priceFormat });
    a.barSeries.applyOptions({ priceFormat });
    a.lineSeries.applyOptions({ priceFormat });
    a.areaSeries.applyOptions({ priceFormat });
    a.baselineSeries.applyOptions({ priceFormat });
    a.sma.applyOptions({ priceFormat });
    a.ema.applyOptions({ priceFormat });
    a.vwap.applyOptions({ priceFormat });
    a.bbUpper.applyOptions({ priceFormat });
    a.bbLower.applyOptions({ priceFormat });

    const barData = displayCandles.map(bar);
    const lineData = displayCandles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }));
    a.candles.setData(barData);
    a.barSeries.setData(barData);
    a.lineSeries.setData(lineData);
    a.areaSeries.setData(lineData);
    a.baselineSeries.setData(lineData);
    a.volume.setData(displayCandles.map(vol));
    a.sma.setData(pts(displayCandles, s));
    a.ema.setData(pts(displayCandles, e));
    a.bbUpper.setData(pts(displayCandles, bb.upper));
    a.bbLower.setData(pts(displayCandles, bb.lower));
    a.rsi.setData(pts(displayCandles, r));

    // Calculate anchored VWAP
    let cumVol = 0;
    let cumTpVol = 0;
    const vwapPoints = displayCandles.map((c) => {
      const tp = (c.high + c.low + c.close) / 3;
      cumVol += c.volume;
      cumTpVol += tp * c.volume;
      return {
        time: c.time as UTCTimestamp,
        value: cumVol > 0 ? cumTpVol / cumVol : tp,
      };
    });
    a.vwap.setData(vwapPoints);

    // Feed Open Interest data
    const oiBars = generateOIHistory(displayCandles);
    a.oi.setData(
      oiBars.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.totalOI,
        color: b.changeOI >= 0 ? 'rgba(76, 141, 255, 0.45)' : 'rgba(239, 83, 80, 0.45)',
      }))
    );

    live.current = { closes, lastTime: displayCandles[n - 1].time, emaPrev: e[n - 2] ?? null, lastEma: e[n - 1] ?? null };

    // Fit viewport on initial load or whenever symbol / timeframe resolution changes
    const datasetKey = `${symbol}_${timeframe}`;
    const needsFit = !hasFittedKeyRef.current[datasetKey] || lastDatasetKeyRef.current !== datasetKey;
    if (needsFit) {
      hasFittedKeyRef.current[datasetKey] = true;
      lastDatasetKeyRef.current = datasetKey;
      try {
        a.chart.timeScale().resetTimeScale();
        a.chart.timeScale().fitContent();
      } catch {}
    }

    try {
      a.chart.applyOptions({
        timeScale: {
          secondsVisible: /s$/.test(timeframe),
        },
      });
    } catch {}

    const lastBar = displayCandles[n - 1];
    writeOhlc(lastBar);
    setCurrentOhlc({ open: lastBar.open, high: lastBar.high, low: lastBar.low, close: lastBar.close, volume: lastBar.volume });
    setIndicatorValues({
      sma: s[n - 1] ?? null,
      ema: e[n - 1] ?? null,
      vwap: cumVol > 0 ? cumTpVol / cumVol : lastBar.close,
      rsi: r[n - 1] ?? null,
      oi: oiBars.length ? oiBars[oiBars.length - 1].totalOI : null,
    });
  }, [effectiveCandles, symbol, timeframe, chartStyle]);

  // Live Countdown to Bar Close Timer
  useEffect(() => {
    if (!chartSettings.showCountdownTimer || !effectiveCandles.length) {
      setCountdownText('');
      return;
    }

    const dur = parseTimeframeToSeconds(timeframe);

    const tickCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const lastCandle = effectiveCandles[effectiveCandles.length - 1];
      if (!lastCandle || dur <= 0) {
        setCountdownText('');
        return;
      }
      let nextClose = lastCandle.time + dur;
      if (nextClose <= nowSec) {
        nextClose = Math.ceil((nowSec + 1) / dur) * dur;
      }
      const diff = Math.max(0, nextClose - nowSec);
      setCountdownText(formatCountdownTimer(diff));
    };

    tickCountdown();
    const interval = setInterval(tickCountdown, 1000);
    return () => clearInterval(interval);
  }, [timeframe, effectiveCandles, chartSettings.showCountdownTimer]);

  // Dynamically compute and sync active overlay indicators on main price chart
  useEffect(() => {
    const chart = api.current?.chart;
    if (!chart || !effectiveCandles.length) return;

    const overlayInstances = activeInstances.filter((inst) => inst.overlay);
    const activeSeriesKeys = new Set<string>();
    const latestOverlayValues: Record<string, number | null> = {};

    overlayInstances.forEach((inst) => {
      const def = INDICATOR_REGISTRY.find((d) => d.id === inst.indicatorId);
      if (!def) return;

      const calcResult = def.calculate(effectiveCandles, inst.inputs);

      Object.entries(calcResult.plots).forEach(([plotKey, points]) => {
        const key = `${inst.instanceId}_${plotKey}`;
        activeSeriesKeys.add(key);

        const style = inst.styles[plotKey] || def.defaultStyles[plotKey];
        let series = overlaySeriesMap.current.get(key);

        if (!series) {
          series = chart.addLineSeries({
            color: style?.color || '#38bdf8',
            lineWidth: (style?.lineWidth || 2) as 1 | 2 | 3 | 4,
            lineStyle:
              style?.lineStyle === 'dashed'
                ? LineStyle.Dashed
                : style?.lineStyle === 'dotted'
                ? LineStyle.Dotted
                : LineStyle.Solid,
            visible: inst.visible && (style?.visible ?? true),
          });
          overlaySeriesMap.current.set(key, series);
        } else {
          series.applyOptions({
            color: style?.color || '#38bdf8',
            lineWidth: (style?.lineWidth || 2) as 1 | 2 | 3 | 4,
            lineStyle:
              style?.lineStyle === 'dashed'
                ? LineStyle.Dashed
                : style?.lineStyle === 'dotted'
                ? LineStyle.Dotted
                : LineStyle.Solid,
            visible: inst.visible && (style?.visible ?? true),
          });
        }

        const seriesData = points
          .filter((p) => p.value !== null && !isNaN(p.value))
          .map((p) => ({
            time: p.time as UTCTimestamp,
            value: p.value as number,
          }));

        series.setData(seriesData);

        if (seriesData.length > 0) {
          latestOverlayValues[inst.instanceId] = seriesData[seriesData.length - 1].value;
        }
      });
    });

    // Remove any series no longer active
    overlaySeriesMap.current.forEach((series, key) => {
      if (!activeSeriesKeys.has(key)) {
        try {
          chart.removeSeries(series);
        } catch {}
        overlaySeriesMap.current.delete(key);
      }
    });

    setOverlayValues(latestOverlayValues);
  }, [effectiveCandles, activeInstances]);

  // Technical Price lines: Session OHL Laser Lines (Positions and Orders handled cleanly via ChartTradingOverlay)
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const lines: IPriceLine[] = [];

    // Session OHL Laser Lines (without cluttering price scale axis)
    if (showSessionOHL && candles.length > 0) {
      const todaySec = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
      const todayCandles = candles.filter((c) => c.time >= todaySec);
      const refCandles = todayCandles.length > 0 ? todayCandles : candles.slice(-24);
      if (refCandles.length > 0) {
        const sOpen = refCandles[0].open;
        const sHigh = Math.max(...refCandles.map((c) => c.high));
        const sLow = Math.min(...refCandles.map((c) => c.low));
        lines.push(a.candles.createPriceLine({ price: sOpen, color: '#38bdf8', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: 'Session Open' }));
        lines.push(a.candles.createPriceLine({ price: sHigh, color: '#089981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: 'Session High' }));
        lines.push(a.candles.createPriceLine({ price: sLow, color: '#f23645', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: 'Session Low' }));
      }
    }

    return () => { try { lines.forEach((l) => a.candles.removePriceLine(l)); } catch { /* ignore */ } };
  }, [showSessionOHL, candles]);

  // Indicator visibility toggles
  useEffect(() => { api.current?.sma.applyOptions({ visible: showSma }); }, [showSma]);
  useEffect(() => { api.current?.ema.applyOptions({ visible: showEma }); }, [showEma]);
  useEffect(() => { api.current?.vwap.applyOptions({ visible: showVwap }); }, [showVwap]);
  useEffect(() => {
    api.current?.bbUpper.applyOptions({ visible: showBbands });
    api.current?.bbLower.applyOptions({ visible: showBbands });
  }, [showBbands]);
  useEffect(() => { api.current?.rsi.applyOptions({ visible: showRsi }); }, [showRsi]);
  useEffect(() => { api.current?.oi.applyOptions({ visible: showOI }); }, [showOI]);

  // Adjust series visibility, styling & active series API when chartStyle or chartSettings changes
  useEffect(() => {
    const a = api.current;
    if (!a) return;

    // Toggle series visibility
    a.candles.applyOptions({
      visible: chartStyle === 'CANDLE' || chartStyle === 'HOLLOW_CANDLE' || chartStyle === 'HEIKIN_ASHI' || chartStyle === 'FOOTPRINT',
    });
    a.barSeries.applyOptions({ visible: chartStyle === 'BAR' });
    a.lineSeries.applyOptions({ visible: chartStyle === 'LINE' });
    a.areaSeries.applyOptions({ visible: chartStyle === 'AREA' });
    a.baselineSeries.applyOptions({ visible: chartStyle === 'BASELINE' });

    // Set active series for drawings and scales
    if (chartStyle === 'BAR') setSeriesApi(a.barSeries);
    else if (chartStyle === 'LINE') setSeriesApi(a.lineSeries);
    else if (chartStyle === 'AREA') setSeriesApi(a.areaSeries);
    else if (chartStyle === 'BASELINE') setSeriesApi(a.baselineSeries);
    else setSeriesApi(a.candles);

    const isLight = themeMode === 'LIGHT';
    const defaultUp = isLight ? '#16a34a' : '#ffffff';
    const defaultDown = isLight ? '#dc2626' : '#101015';
    // Match the theme-aware defaults used by the live settings effect above.
    const upCol = chartSettings.candleUpColor && chartSettings.candleUpColor !== '#ffffff'
      ? chartSettings.candleUpColor
      : defaultUp;
    const downCol = chartSettings.candleDownColor && chartSettings.candleDownColor !== '#101015'
      ? chartSettings.candleDownColor
      : defaultDown;
    const borderUp = chartSettings.borderUpColor || upCol;
    const isDarkDown = downCol === '#101015' || downCol === '#050508';
    const borderDown = chartSettings.borderDownColor || (isLight ? downCol : (isDarkDown ? '#71717a' : downCol));
    const wickUp = chartSettings.wickUpColor || borderUp;
    const wickDown = chartSettings.wickDownColor || borderDown;

    if (chartStyle === 'FOOTPRINT') {
      a.candles.applyOptions({
        upColor: 'transparent',
        downColor: 'transparent',
        borderVisible: false,
        wickVisible: true,
        wickUpColor: 'rgba(255, 255, 255, 0.25)',
        wickDownColor: 'rgba(255, 255, 255, 0.25)',
      });
    } else {
      const isHollow = chartStyle === 'HOLLOW_CANDLE';
      a.candles.applyOptions({
        upColor: isHollow || chartSettings.candleBodyVisible === false ? 'transparent' : upCol,
        downColor: chartSettings.candleBodyVisible === false ? 'transparent' : downCol,
        borderVisible: chartSettings.candleBorderVisible !== false,
        borderUpColor: borderUp,
        borderDownColor: borderDown,
        wickVisible: chartSettings.candleWickVisible !== false,
        wickUpColor: wickUp,
        wickDownColor: wickDown,
      });
      a.barSeries.applyOptions({
        upColor: upCol,
        downColor: downCol,
      });
      a.lineSeries.applyOptions({
        color: upCol,
      });
      a.areaSeries.applyOptions({
        lineColor: upCol,
      });
    }
  }, [chartStyle, chartSettings, themeMode]);

  // Dynamic Pine Script Indicator Series rendering
  useEffect(() => {
    const chart = chartApi || api.current?.chart;
    if (!chart) return;

    // Remove existing pine series
    for (const s of pineSeriesRef.current) {
      try {
        chart.removeSeries(s);
      } catch {}
    }
    pineSeriesRef.current = [];

    if (!pinePlots || !pinePlots.length) return;

    const PALETTE = ['#38bdf8', '#f59e0b', '#a855f7', '#10b981', '#f43f5e', '#3b82f6', '#ec4899', '#14b8a6'];
    let plotIdx = 0;
    for (const plot of pinePlots) {
      if (!plot.data || !plot.data.length) continue;
      try {
        const lowerCol = (plot.color || '').toLowerCase();
        const isBoring = !plot.color || lowerCol === '#ffffff' || lowerCol === '#787b86' || lowerCol === '#000000' || lowerCol === 'white' || lowerCol === 'gray';
        const distinctColor = isBoring ? PALETTE[plotIdx % PALETTE.length] : plot.color;
        plotIdx++;

        const line = chart.addLineSeries({
          color: distinctColor,
          lineWidth: 2,
          title: plot.title,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
        });
        line.setData(plot.data as any);
        pineSeriesRef.current.push(line);
      } catch (err) {
        console.warn('Failed to add Pine Script line series:', err);
      }
    }
  }, [pinePlots, chartApi]);

  // Handler for placing order from Canvas Drag-and-Drop Order lines
  const handleExecuteCanvasOrders = (entry: CanvasOrderLine, sl?: CanvasOrderLine, tp?: CanvasOrderLine) => {
    audioHaptics.tick();
    placeOrder({
      symbol,
      side: entry.side,
      type: 'LIMIT',
      price: entry.price,
      qty: entry.qty,
      leverage: 10,
      stopLoss: sl?.price,
      takeProfit: tp?.price,
    });
  };

  const handleSelectTimeRange = (range: string) => {
    audioHaptics.tick();
    setActiveTimeRange(range);

    const rangeToTf: Record<string, Timeframe> = {
      '1D': '5m',
      '5D': '15m',
      '1M': '1h',
      '3M': '2h',
      '6M': '4h',
      'YTD': '1d',
      '1Y': '1d',
      'ALL': '1w',
    };

    const targetTf = rangeToTf[range];
    if (targetTf) {
      setTimeframe(targetTf);
      setPaneTimeframe(paneId, targetTf);
    }

    const a = api.current;
    if (!a) return;

    if (range === 'ALL') {
      try {
        a.chart.timeScale().resetTimeScale();
        a.chart.timeScale().fitContent();
      } catch {}
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    let seconds = 86400; // 1D
    if (range === '1D') seconds = 86400;
    else if (range === '5D') seconds = 5 * 86400;
    else if (range === '1M') seconds = 30 * 86400;
    else if (range === '3M') seconds = 90 * 86400;
    else if (range === '6M') seconds = 180 * 86400;
    else if (range === 'YTD') {
      const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
      seconds = now - startOfYear;
    } else if (range === '1Y') seconds = 365 * 86400;

    const fromTime = (now - seconds) as UTCTimestamp;
    const toTime = (now + 3600) as UTCTimestamp;
    try {
      a.chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
    } catch {
      try {
        a.chart.timeScale().resetTimeScale();
        a.chart.timeScale().fitContent();
      } catch {}
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-bg overflow-hidden select-none font-mono">
      {/* ChartSkins Background Layer (Video / Wallpaper / GIF) */}
      <ChartSkinsLayer />

      {/* Institutional TradingView-Style Chart Top Toolbar */}
      {shouldShowTopToolbar && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="chart-top-toolbar relative z-30 flex items-center justify-between border-b border-grid bg-panel px-2.5 py-1 select-none text-xs gap-2 overflow-visible"
        >
        {/* Left Section: Symbol, Timeframes, Candle Style, Indicators, Replay, Alert, Undo/Redo, Layers */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0 flex-1 py-0.5">
          {/* Symbol Search Trigger */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsSymbolSearchOpen(true);
            }}
            className="flex items-center gap-1.5 clay-pill px-2.5 py-1 text-xs font-bold text-white transition cursor-pointer shrink-0"
            title="Search symbols (/ or Ctrl+K)"
          >
            <span>{labelOf(symbol)}</span>
            <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <span className="h-4 w-px bg-grid shrink-0" />

          {/* Timeframe Favorites & Dropdown */}
          <div className="relative flex items-center shrink-0" ref={tfMenuRef}>
            {/* Mobile: Prominent Unified Timeframe Selector Button */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => {
                  audioHaptics.tick();
                  toggleTfMenu();
                }}
                className="flex items-center gap-1.5 clay-pill-active px-2.5 py-1 text-xs font-bold transition rounded-lg"
                title="Select Chart Timeframe"
              >
                <span>{timeframe}</span>
                <svg className={`h-3 w-3 text-slate-300 transition-transform ${isTfMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Desktop: Quick Favorite Timeframe Pills + Dropdown Toggle */}
            <div className="hidden md:flex items-center gap-0.5">
              {favoriteTimeframes.map((t) => (
                <button
                  key={t}
                  className={`px-2 py-0.5 text-xs transition rounded ${
                    t === timeframe
                      ? 'clay-pill-active font-bold'
                      : 'clay-pill text-slate-300 hover:text-white'
                  }`}
                  onClick={() => {
                    audioHaptics.tick();
                    setActiveTimeRange(null);
                    setTimeframe(t);
                    setPaneTimeframe(paneId, t);
                  }}
                >
                  {t}
                </button>
              ))}
              {!favoriteTimeframes.includes(timeframe) && (
                <button
                  onClick={() => {
                    audioHaptics.tick();
                    toggleTfMenu();
                  }}
                  className="px-2 py-0.5 text-xs clay-pill-active font-bold rounded"
                  title="Active Custom Timeframe (Click to manage)"
                >
                  {timeframe}
                </button>
              )}
              {/* Quick + Custom Interval Button */}
              <button
                onClick={() => {
                  audioHaptics.tick();
                  toggleTfMenu();
                }}
                className="px-1.5 py-0.5 text-xs clay-pill text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition rounded font-bold"
                title="Add Custom Interval"
              >
                +
              </button>
              {/* Timeframe Dropdown Toggle */}
              <button
                onClick={() => {
                  audioHaptics.tick();
                  toggleTfMenu();
                }}
                className="p-1 rounded-full clay-btn transition ml-0.5"
                title="All Timeframes"
              >
                <svg className={`h-3 w-3 transition-transform ${isTfMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Timeframe Dropdown Menu with Direct User Input */}
            {isTfMenuOpen && (
              <div
                style={{
                  top: `${menuAnchor?.top ?? 45}px`,
                  left: `${menuAnchor?.left ?? 10}px`,
                }}
                data-chart-toolbar-menu className="fixed z-50 w-72 max-w-[calc(100vw-16px)] clay-popover p-2.5 shadow-2xl font-mono text-xs max-h-[80vh] overflow-y-auto"
              >
                {/* Direct User Input Form for Custom Interval */}
                <div className="p-2 border border-[#2d2d3e] bg-black/60 rounded-xl mb-2.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#38bdf8] mb-1.5">
                    <span>Direct Custom Interval</span>
                    {customInputError && <span className="text-rose-400 text-[9px] lowercase">{customInputError}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={customVal}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCustomVal(isNaN(v) ? 1 : Math.max(1, v));
                        setCustomInputError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCustomInterval();
                        }
                      }}
                      className="w-16 rounded-lg bg-[#181824] px-2 py-1 text-center text-xs font-mono text-white border border-[#2d2d3e] focus:border-[#38bdf8] focus:outline-none"
                      placeholder="e.g. 2"
                      autoFocus
                    />
                    <select
                      value={customUnit}
                      onChange={(e) => {
                        setCustomUnit(e.target.value as IntervalUnit);
                        setCustomInputError(null);
                      }}
                      className="rounded-lg bg-[#181824] px-1.5 py-1 text-xs font-mono text-white border border-[#2d2d3e] focus:border-[#38bdf8] focus:outline-none flex-1 cursor-pointer"
                    >
                      <option value="m">Minutes (m)</option>
                      <option value="h">Hours (h)</option>
                      <option value="d">Days (d)</option>
                      <option value="s">Seconds (s)</option>
                    </select>
                    <button
                      onClick={() => handleApplyCustomInterval()}
                      className="px-2.5 py-1 rounded-lg bg-[#38bdf8] text-black font-bold text-xs hover:bg-[#38bdf8]/90 transition"
                      title="Apply & Save Custom Interval (Enter)"
                    >
                      Apply
                    </button>
                  </div>

                  {/* Fast One-Click Presets */}
                  <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-white/5">
                    <span className="text-[9px] text-slate-400 font-medium">Quick:</span>
                    {['2m', '3m', '7m', '10m', '12m', '45m', '2h', '8h', '2d'].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          const num = parseInt(p, 10);
                          const u = p.replace(/\d+/g, '') as IntervalUnit;
                          handleApplyCustomInterval(num, u);
                        }}
                        className={`text-[9.5px] px-1.5 py-0.5 rounded transition ${
                          timeframe === p
                            ? 'bg-[#38bdf8] text-black font-bold'
                            : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved Custom Intervals */}
                {storedCustomTfs.length > 0 && (
                  <div className="mb-2 border-b border-grid/60 pb-2">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#38bdf8] mb-1">
                      Saved Custom Intervals
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {storedCustomTfs.map((t) => (
                        <div
                          key={t}
                          className={`flex w-full items-center justify-between px-2.5 py-1 rounded-lg transition group ${
                            t === timeframe
                              ? 'clay-btn-active font-bold'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <button
                            onClick={() => {
                              audioHaptics.tick();
                              setTimeframe(t as Timeframe);
                              setPaneTimeframe(paneId, t as Timeframe);
                              closeAllMenus();
                            }}
                            className="flex-1 text-left flex items-center gap-1.5"
                          >
                            <span>{t}</span>
                            {t === timeframe && (
                              <svg className="h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              audioHaptics.tick();
                              removeStoredCustomTimeframe(t);
                            }}
                            className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 p-0.5 text-xs transition"
                            title={`Delete ${t}`}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Standard Timeframes */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1">
                  Standard Timeframes
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {TIMEFRAMES[provider].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        audioHaptics.tick();
                        setTimeframe(t);
                        setPaneTimeframe(paneId, t);
                        closeAllMenus();
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition ${
                        t === timeframe
                          ? 'clay-btn-active font-bold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span>{t}</span>
                      {t === timeframe && (
                        <svg className="h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    audioHaptics.tick();
                    closeAllMenus();
                    setIsCustomIntervalModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-2 mt-2 rounded-lg text-[#38bdf8] hover:bg-[#38bdf8]/15 border-t border-[#262634] transition text-left font-medium"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Advanced Interval Dialog...</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    audioHaptics.tick();
                    closeAllMenus();
                    if (isReplayActive) exitReplay();
                    else startReplay();
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-2 mt-1 rounded-lg text-accent hover:bg-accent/10 transition text-left font-semibold"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M5 5v14l12-7-12-7z" />
                  </svg>
                  <span>{isReplayActive ? 'Exit Bar Replay' : 'Start Bar Replay'}</span>
                </button>
              </div>
            )}
          </div>

          <span className="h-4 w-px bg-grid shrink-0" />

          {/* Candle Style Dropdown */}
          <div className="relative shrink-0" ref={styleMenuRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                toggleStyleMenu();
              }}
              className="flex items-center gap-1.5 clay-pill px-3 py-1 text-xs font-semibold text-white transition"
              title="Chart Style (Candles, Heikin-Ashi, Footprint)"
            >
              {chartStyle === 'CANDLE' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="9" y1="2" x2="9" y2="6" strokeLinecap="round" />
                  <rect x="6" y="6" width="6" height="10" rx="1" fill="currentColor" fillOpacity={0.2} />
                  <line x1="9" y1="16" x2="9" y2="22" strokeLinecap="round" />
                  <line x1="17" y1="4" x2="17" y2="8" strokeLinecap="round" />
                  <rect x="14" y="8" width="6" height="8" rx="1" fill="currentColor" fillOpacity={0.2} />
                  <line x1="17" y1="16" x2="17" y2="20" strokeLinecap="round" />
                </svg>
              )}
              {chartStyle === 'BAR' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="12" y1="2" x2="12" y2="22" strokeLinecap="round" />
                  <line x1="8" y1="7" x2="12" y2="7" strokeLinecap="round" />
                  <line x1="12" y1="17" x2="16" y2="17" strokeLinecap="round" />
                </svg>
              )}
              {chartStyle === 'HOLLOW_CANDLE' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="9" y1="2" x2="9" y2="6" strokeLinecap="round" />
                  <rect x="6" y="6" width="6" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth={1.5} />
                  <line x1="9" y1="16" x2="9" y2="22" strokeLinecap="round" />
                </svg>
              )}
              {chartStyle === 'HEIKIN_ASHI' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="8" y1="3" x2="8" y2="21" strokeLinecap="round" />
                  <rect x="5" y="7" width="6" height="10" rx="1" fill="currentColor" fillOpacity={0.2} />
                  <line x1="16" y1="5" x2="16" y2="19" strokeLinecap="round" />
                  <rect x="13" y="9" width="6" height="7" rx="1" fill="currentColor" fillOpacity={0.2} />
                </svg>
              )}
              {chartStyle === 'LINE' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
                </svg>
              )}
              {chartStyle === 'AREA' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8v13H3z" fill="currentColor" fillOpacity={0.2} />
                </svg>
              )}
              {chartStyle === 'BASELINE' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="2 2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 15l5-6 4 3 8-7" />
                </svg>
              )}
              {chartStyle === 'FOOTPRINT' && (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="4" y="4" width="7" height="4" rx="0.5" fill="currentColor" fillOpacity={0.4} />
                  <rect x="13" y="4" width="7" height="4" rx="0.5" fill="currentColor" fillOpacity={0.7} />
                  <rect x="4" y="10" width="9" height="4" rx="0.5" fill="currentColor" fillOpacity={0.8} />
                  <rect x="15" y="10" width="5" height="4" rx="0.5" fill="currentColor" fillOpacity={0.3} />
                  <rect x="4" y="16" width="6" height="4" rx="0.5" fill="currentColor" fillOpacity={0.3} />
                  <rect x="12" y="16" width="8" height="4" rx="0.5" fill="currentColor" fillOpacity={0.6} />
                </svg>
              )}
              <span className="hidden sm:inline">{
                chartStyle === 'CANDLE' ? 'Candles' :
                chartStyle === 'BAR' ? 'Bars' :
                chartStyle === 'HOLLOW_CANDLE' ? 'Hollow' :
                chartStyle === 'HEIKIN_ASHI' ? 'Heikin-Ashi' :
                chartStyle === 'LINE' ? 'Line' :
                chartStyle === 'AREA' ? 'Area' :
                chartStyle === 'BASELINE' ? 'Baseline' : 'Footprint'
              }</span>
              <svg className={`h-3 w-3 text-slate-400 transition-transform ${isStyleMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Candle Style Menu */}
            {isStyleMenuOpen && (
              <div
                style={{
                  top: `${menuAnchor?.top ?? 45}px`,
                  left: `${menuAnchor?.left ?? 10}px`,
                }}
                data-chart-toolbar-menu className="fixed z-50 w-60 clay-popover p-2 shadow-2xl font-mono text-xs max-h-80 overflow-y-auto"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1">
                  Chart Style
                </div>
                {[
                  { id: 'CANDLE', label: 'Candlestick', desc: 'Standard OHLC price bars' },
                  { id: 'BAR', label: 'Bar Chart', desc: 'High/Low bars with open/close ticks' },
                  { id: 'HOLLOW_CANDLE', label: 'Hollow Candles', desc: 'TradingView hollow body bars' },
                  { id: 'HEIKIN_ASHI', label: 'Heikin-Ashi', desc: 'Smoothed trend calculation' },
                  { id: 'LINE', label: 'Line Chart', desc: 'Continuous close price line' },
                  { id: 'AREA', label: 'Area Chart', desc: 'Filled gradient baseline' },
                  { id: 'BASELINE', label: 'Baseline Chart', desc: 'Price relative to baseline' },
                  { id: 'FOOTPRINT', label: 'Footprint Clusters', desc: 'Institutional Bid x Ask order flow' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      audioHaptics.tick();
                      setChartStyle(s.id as ChartStyle);
                      closeAllMenus();
                    }}
                    className={`flex w-full items-start justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                      chartStyle === s.id
                        ? 'clay-btn-active font-bold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">{s.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{s.desc}</div>
                    </div>
                    {chartStyle === s.id && (
                      <svg className="h-3.5 w-3.5 text-black shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="h-4 w-px bg-grid shrink-0" />

          {/* Candle Colors / Theme Dropdown */}
          <div className="relative shrink-0" ref={colorMenuRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                toggleColorMenu();
              }}
              className="flex items-center gap-1.5 clay-pill px-3 py-1 text-xs font-semibold text-white transition"
              title="Candle Colors & Themes"
            >
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-xs"
                  style={{ backgroundColor: chartSettings.candleUpColor }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white/40 shadow-xs"
                  style={{ backgroundColor: chartSettings.candleDownColor }}
                />
              </span>
              <span>Theme</span>
              <svg className={`h-3 w-3 text-slate-400 transition-transform ${isColorMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isColorMenuOpen && (
              <div
                style={{
                  top: `${menuAnchor?.top ?? 45}px`,
                  left: `${menuAnchor?.left ?? 10}px`,
                }}
                data-chart-toolbar-menu className="fixed z-50 w-64 clay-popover p-3 shadow-2xl font-mono text-xs select-none max-h-[80vh] overflow-y-auto"
              >
                <div className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-2 flex items-center justify-between">
                  <span>Candle Palette</span>
                  <button
                    onClick={() => {
                      audioHaptics.tick();
                      resetChartSettings();
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
                      chartSettings.candleUpColor.toLowerCase() === preset.up.toLowerCase() &&
                      chartSettings.candleDownColor.toLowerCase() === preset.down.toLowerCase();
                    return (
                      <button
                        key={preset.name}
                        onClick={() => {
                          audioHaptics.tick();
                          updateChartSettings({
                            candleUpColor: preset.up,
                            candleDownColor: preset.down,
                            borderUpColor: preset.up,
                            borderDownColor: preset.down,
                            wickUpColor: preset.up,
                            wickDownColor: preset.down,
                          });
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                          isSelected ? 'clay-btn-active font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
                          <svg className="h-3.5 w-3.5 text-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartSettings.candleUpColor }} />
                        Bull / Up Candle
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{chartSettings.candleUpColor}</span>
                        <input
                          type="color"
                          value={chartSettings.candleUpColor}
                          onChange={(e) => updateChartSettings({ candleUpColor: e.target.value })}
                          className="h-6 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Pick Bull Candle Color"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartSettings.candleDownColor }} />
                        Bear / Down Candle
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{chartSettings.candleDownColor}</span>
                        <input
                          type="color"
                          value={chartSettings.candleDownColor}
                          onChange={(e) => updateChartSettings({ candleDownColor: e.target.value })}
                          className="h-6 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Pick Bear Candle Color"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-300">Up Candle Border</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{chartSettings.borderUpColor || chartSettings.candleUpColor}</span>
                        <input type="color" value={chartSettings.borderUpColor || chartSettings.candleUpColor} onChange={(e) => updateChartSettings({ borderUpColor: e.target.value })} className="h-7 w-8 rounded cursor-pointer border-0 bg-transparent p-0" title="Pick Up Candle Border Color" aria-label="Up candle border color" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-300">Down Candle Border</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{chartSettings.borderDownColor || '#71717a'}</span>
                        <input type="color" value={chartSettings.borderDownColor || '#71717a'} onChange={(e) => updateChartSettings({ borderDownColor: e.target.value })} className="h-7 w-8 rounded cursor-pointer border-0 bg-transparent p-0" title="Pick Down Candle Border Color" aria-label="Down candle border color" />
                      </div>
                    </div>

                    {/* Canvas Custom Solid Background Color */}
                    <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full border border-white/20"
                          style={{ backgroundColor: themeConfig.solidColor || '#141413' }}
                        />
                        Canvas Solid Background
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {themeConfig.solidColor || '#141413'}
                        </span>
                        <input
                          type="color"
                          value={themeConfig.solidColor || '#141413'}
                          onChange={(e) => {
                            audioHaptics.tick();
                            setThemeConfig({
                              wallpaperType: 'SOLID',
                              mediaUrl: null,
                              solidColor: e.target.value,
                            });
                          }}
                          className="h-6 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Pick Chart Canvas Background Color"
                        />
                      </div>
                    </div>

                    {/* Canvas Background Presets */}
                    <div className="pt-1">
                      <div className="text-[9px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Canvas Presets</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {[
                          { name: 'Charcoal', color: '#141413' },
                          { name: 'Pitch Black', color: '#000000' },
                          { name: 'Deep Void', color: '#080808' },
                          { name: 'Slate', color: '#181817' },
                          { name: 'Navy', color: '#0b0e14' },
                          { name: 'White', color: '#ffffff' },
                        ].map((bg) => (
                          <button
                            key={bg.name}
                            type="button"
                            onClick={() => {
                              audioHaptics.tick();
                              setThemeConfig({
                                wallpaperType: 'SOLID',
                                mediaUrl: null,
                                solidColor: bg.color,
                              });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] border flex items-center gap-1 transition ${
                              (themeConfig.solidColor || '#141413').toLowerCase() === bg.color.toLowerCase()
                                ? 'border-white text-white font-bold bg-white/10'
                                : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full border border-white/30" style={{ backgroundColor: bg.color }} />
                            {bg.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="h-4 w-px bg-grid shrink-0" />

          {/* fx Indicators Icon Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsIndicatorsModalOpen(true);
            }}
            className="relative flex items-center justify-center p-1.5 rounded hover:bg-surface text-secondary hover:text-primary transition shrink-0"
            title="Indicators, Metrics & Strategies (fx)"
          >
            <span className="font-bold text-xs tracking-tight">fx</span>
            {activeIndicatorsList.filter((i) => i.id !== 'vol').length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.1 min-w-[14px] text-center rounded-full bg-accent text-black text-[9px] font-bold">
                {activeIndicatorsList.filter((i) => i.id !== 'vol').length}
              </span>
            )}
          </button>

          {/* Indicator Templates Quick Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsIndicatorsModalOpen(true);
            }}
            className="flex items-center justify-center p-1.5 rounded hover:bg-surface text-secondary hover:text-primary transition shrink-0"
            title="Institutional Indicator Templates & Saved Presets"
          >
            <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>

          {/* Quick Volume Histogram Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              const next = !showVolume;
              setShowVolume(next);
              api.current?.volume.applyOptions({ visible: next });
            }}
            className={`flex items-center justify-center p-1.5 rounded transition shrink-0 ${
              showVolume
                ? 'bg-surface text-primary font-bold'
                : 'text-secondary hover:text-primary hover:bg-surface/50'
            }`}
            title="Toggle Bottom Volume Bars"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

          {/* Quick Visible Range Volume Profile (VPVR) Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setShowVolumeProfile((v) => !v);
            }}
            className={`flex items-center justify-center p-1.5 rounded transition shrink-0 ${
              showVolumeProfile
                ? 'bg-surface text-primary font-bold'
                : 'text-secondary hover:text-primary hover:bg-surface/50'
            }`}
            title="Toggle Visible Range Volume Profile (VPVR & POC/VAH/VAL lines)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 10h10M4 14h14M4 18h8" />
            </svg>
          </button>

          {/* Bar Replay Historical Time Machine Trigger */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if (isReplayActive) exitReplay();
              else startReplay();
            }}
            className={`flex items-center justify-center p-1.5 rounded transition shrink-0 ${
              isReplayActive
                ? 'bg-surface text-accent font-bold'
                : 'text-secondary hover:text-primary hover:bg-surface/50'
            }`}
            title="Bar Replay Historical Time Machine (Space: Play/Pause, Shift+Right: Step)"
            aria-label={isReplayActive ? 'Exit Bar Replay' : 'Start Bar Replay'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          {/* Create Alert Dialog Trigger Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setAlertInitialPrice(currentPrice);
              setIsCreateAlertOpen(true);
            }}
            className="flex items-center justify-center p-1.5 rounded hover:bg-surface text-secondary hover:text-primary transition shrink-0"
            title="Create Institutional Alert (Alt+A)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Quick Trade History Execution Markers Toggle Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              updateChartSettings({ showExecutionsOnChart: !chartSettings.showExecutionsOnChart });
            }}
            className={`flex items-center justify-center p-1.5 rounded transition shrink-0 ${
              chartSettings.showExecutionsOnChart
                ? 'bg-surface text-primary font-bold'
                : 'text-secondary hover:text-primary hover:bg-surface/50'
            }`}
            title={chartSettings.showExecutionsOnChart ? 'Hide Trade History Markers on Chart' : 'Show Trade History Markers on Chart'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>

          {/* Undo / Redo Controls */}
          <div className="flex items-center gap-0.5 border-l border-grid pl-1 shrink-0">
            <button
              onClick={() => {
                audioHaptics.tick();
                drawingEvents.undo();
              }}
              className="p-1.5 rounded hover:bg-surface text-secondary hover:text-primary transition shrink-0"
              title="Undo Drawing (Ctrl+Z)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
              </svg>
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                drawingEvents.redo();
              }}
              className="p-1.5 rounded hover:bg-surface text-secondary hover:text-primary transition shrink-0"
              title="Redo Drawing (Ctrl+Y)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
              </svg>
            </button>
          </div>

          <span className="h-4 w-px bg-grid shrink-0" />

          {/* Institutional Layers & Overlays Dropdown */}
          <div className="relative shrink-0" ref={layersMenuRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                toggleLayersMenu();
              }}
              className={`relative flex items-center justify-center p-1.5 rounded transition shrink-0 ${
                activeLayersCount > 0
                  ? 'bg-surface text-primary font-bold'
                  : 'text-secondary hover:text-primary hover:bg-surface/50'
              }`}
              title="Chart Overlays & Layers"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {activeLayersCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.1 min-w-[14px] text-center rounded-full bg-accent text-black text-[9px] font-bold">
                  {activeLayersCount}
                </span>
              )}
            </button>

            {/* Layers Dropdown Menu */}
            {isLayersMenuOpen && (
              <div
                style={{
                  top: `${menuAnchor?.top ?? 45}px`,
                  left: `${menuAnchor?.left ?? 10}px`,
                }}
                data-chart-toolbar-menu className="fixed z-50 w-72 clay-popover p-2.5 shadow-2xl font-mono text-xs select-none max-h-[80vh] overflow-y-auto"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1.5">
                  Chart Overlays & Tools
                </div>

                <div className="flex flex-col gap-1">
                  {[
                    {
                      id: 'vpvr',
                      label: 'Volume Profile (VPVR)',
                      desc: 'Visible Range dynamic POC, VAH, VAL',
                      active: showVolumeProfile,
                      onToggle: () => setShowVolumeProfile((v) => !v),
                    },
                    {
                      id: 'ghost',
                      label: 'Ghost HTF Overlay',
                      desc: 'Higher-timeframe candlestick silhouette',
                      active: isGhostVisible,
                      onToggle: () => toggleGhost(),
                    },
                    {
                      id: 'ohl',
                      label: 'Session OHL Lines',
                      desc: 'Daily Open, High, Low projection laser lines',
                      active: showSessionOHL,
                      onToggle: () => setShowSessionOHL((v) => !v),
                    },
                    {
                      id: 'orderlines',
                      label: 'Canvas Order Lines',
                      desc: 'Drag limit order, TP, and SL on chart',
                      active: canvasOrderLines.length > 0,
                      onToggle: () => {
                        if (canvasOrderLines.length > 0) clearCanvasOrderLines();
                        else initCanvasOrderLines(currentPrice, 'BUY', 0.1);
                      },
                    },
                    {
                      id: 'riskHud',
                      label: 'Position Risk HUD',
                      desc: '1-Click % risk calculator & sizing',
                      active: showRiskHUD,
                      onToggle: () => setShowRiskHUD((v) => !v),
                    },
                    {
                      id: 'ruler',
                      label: 'Measurement Ruler',
                      desc: 'Measure price distance, bars, ticks and %',
                      active: isRulerActive,
                      onToggle: () => setIsRulerActive((v) => !v),
                    },
                    {
                      id: 'notes',
                      label: 'Candle Sticky Notes',
                      desc: 'Pin trade rationale and notes to bars',
                      active: isNotesOpen,
                      onToggle: () => setIsNotesOpen((v) => !v),
                    },
                    {
                      id: 'quicktrade',
                      label: 'Buy / Sell Quick Buttons',
                      desc: 'Instant in-chart market buy, sell & size pill',
                      active: chartSettings.showQuickTradeButtons !== false,
                      onToggle: () => {
                        setChartSettings((prev) => ({
                          ...prev,
                          showQuickTradeButtons: prev.showQuickTradeButtons === false ? true : false,
                        }));
                      },
                    },
                    {
                      id: 'newsEvents',
                      label: 'News & Macro Events',
                      desc: 'Interactive economic release flags & news articles',
                      active: chartSettings.showEventsOnChart !== false,
                      onToggle: () => {
                        setChartSettings((prev) => ({
                          ...prev,
                          showEventsOnChart: prev.showEventsOnChart === false ? true : false,
                        }));
                      },
                    },
                    {
                      id: 'executions',
                      label: 'Trade History Markers',
                      desc: 'Show buy/sell fills & executions on candles',
                      active: chartSettings.showExecutionsOnChart,
                      onToggle: () => updateChartSettings({ showExecutionsOnChart: !chartSettings.showExecutionsOnChart }),
                    },
                  ].map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => {
                        audioHaptics.tick();
                        layer.onToggle();
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-left transition w-full"
                    >
                      <div className="flex flex-col pr-2">
                        <span className={`font-semibold ${layer.active ? 'text-white' : 'text-slate-400'}`}>
                          {layer.label}
                        </span>
                        <span className="text-[10px] text-slate-500">{layer.desc}</span>
                      </div>
                      <div className={`w-8 h-4.5 rounded-full p-0.5 transition shrink-0 ${layer.active ? 'bg-white' : 'bg-zinc-800'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full transition transform ${layer.active ? 'translate-x-3.5 bg-black' : 'translate-x-0 bg-zinc-400'}`} />
                      </div>
                    </button>
                  ))}

                  <div className="border-t border-grid/60 my-1 pt-1">
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        setShowSkinsModal(true);
                        closeAllMenus();
                      }}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">Chart Wallpaper & Skins</span>
                        <span className="text-[10px] text-slate-500">Solid, gradient, anime or video backgrounds</span>
                      </div>
                      <span className="text-white text-[11px] font-bold">Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Snapshot, Theme, Settings, Fullscreen */}
        <div className="chart-top-toolbar-right flex items-center gap-1 shrink-0 ml-auto">
          {/* Chart Snapshot Dropdown Popover (TradingView-style, NO eye-mask) */}
          <div className="relative hidden sm:block" ref={screenshotMenuRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsScreenshotMenuOpen((v) => !v);
              }}
              className={`p-1.5 rounded-full transition shrink-0 ${
                isScreenshotMenuOpen ? 'clay-btn-active text-white' : 'clay-btn text-slate-300 hover:text-white'
              }`}
              title="Take Chart Snapshot (Download PNG / Copy Image)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {isScreenshotMenuOpen && (
              <div data-chart-toolbar-menu className="absolute right-0 top-full mt-1.5 z-50 w-52 clay-popover p-1.5 rounded-xl shadow-2xl select-none font-mono text-xs border border-white/10 backdrop-blur-md">
                <button
                  onClick={handleDownloadScreenshot}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition text-left"
                >
                  <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Image (PNG)</span>
                </button>
                <button
                  onClick={handleCopyScreenshotImage}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition text-left"
                >
                  <svg className="h-4 w-4 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <span>Copy Image</span>
                </button>
                <button
                  onClick={handleCopyShareLink}
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

          {/* Quick Theme Switcher Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleThemeMode();
            }}
            className="p-1.5 rounded-full clay-btn transition hidden sm:inline-flex"
            title={`Toggle Theme (Current: ${themeMode})`}
          >
            {themeMode === 'DARK' ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Chart Settings Gear Icon */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsChartSettingsOpen(true);
            }}
            className="p-1.5 rounded-full clay-btn transition"
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
            className="p-1.5 rounded-full clay-btn transition hidden sm:inline-flex"
            title="Toggle Fullscreen"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>

          {/* Mobile Drawing Tools Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setShowMobileDrawTools((v) => !v);
            }}
            className={`p-1.5 rounded-full clay-btn transition md:hidden ${
              showMobileDrawTools ? 'clay-btn-active text-white' : 'text-slate-300'
            }`}
            title="Toggle Drawing Tools"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>
      )}


      {/* Chart Center Area: Docked Left Rail + Canvas */}
      <div className="relative flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Docked Left Drawing Rail (responsive: slideout overlay on mobile, docked rail on desktop) */}
        {(!isMultiChart || isCurrentPaneActive) && (
          <div className={`${showMobileDrawTools ? 'flex absolute left-0 top-0 bottom-0 z-40 bg-[#0d0e15]/95 shadow-2xl border-r border-white/10' : 'hidden'} md:relative md:flex flex-shrink-0 h-full`}>
            <DrawingToolbar
              activeTool={activeTool}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                setShowMobileDrawTools(false);
              }}
              onClearAll={() => setClearDrawingTrigger(Date.now())}
              drawingsCount={drawingsCount}
              magnetConfig={magnetConfig}
              onToggleMagnet={() =>
                setMagnetConfig((prev) => ({
                  ...prev,
                  enabled: !prev.enabled,
                  mode: prev.mode === 'WEAK' ? 'STRONG' : 'WEAK',
                }))
              }
              isLockedAll={isLockedAll}
              onToggleLockAll={() => setIsLockedAll((v) => !v)}
              isHiddenAll={isHiddenAll}
              onToggleHideAll={() => setIsHiddenAll((v) => !v)}
              onOpenObjectTree={() => setIsObjectTreeOpen(true)}
            />
          </div>
        )}

        {/* Main Chart Canvas & Overlays Container */}
        <div className="relative min-h-0 flex-1 h-full overflow-hidden flex flex-col">
          {/* Main Price Chart Pane */}
          <div
            className={`relative flex-1 min-h-0 w-full overflow-hidden ${isSelectingCutPoint ? 'cursor-crosshair' : ''}`}
            onClick={(e) => {
              if (!isSelectingCutPoint || !chartApi || !box.current) return;
              const rect = box.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const targetCandles = activeCandles.length ? activeCandles : candles;
              if (!targetCandles.length) return;

              // Use logical coordinate for exact bar mapping
              const logical = chartApi.timeScale().coordinateToLogical(x);
              let idx = -1;
              if (logical !== null && Number.isFinite(logical)) {
                idx = Math.max(0, Math.min(targetCandles.length - 1, Math.round(logical)));
              } else {
                const time = chartApi.timeScale().coordinateToTime(x);
                if (time) {
                  idx = targetCandles.findIndex((c) => c.time >= (time as number));
                  if (idx === -1 && targetCandles.length) idx = targetCandles.length - 1;
                }
              }

              if (idx !== -1) {
                audioHaptics.tick();
                setIsReplayActive(true);
                setReplayIndex(idx);
                setIsSelectingCutPoint(false);
                if (targetCandles[idx]) {
                  useTerminalStore.getState().updatePriceTick(symbol, targetCandles[idx].close);
                }

                // Smoothly anchor the viewport to the cut candle while preserving zoom level
                setTimeout(() => {
                  try {
                    const curRange = chartApi.timeScale().getVisibleLogicalRange();
                    const span = curRange && Number.isFinite(curRange.to - curRange.from)
                      ? Math.max(50, Math.round(curRange.to - curRange.from))
                      : 80;
                    chartApi.timeScale().setVisibleLogicalRange({
                      from: Math.max(0, idx - span),
                      to: idx + 8,
                    });
                  } catch {}
                }, 40);
              }
            }}
          >
          {/* Floating Cut Tool Hint Pill */}
          {isSelectingCutPoint && (
            <div className="clay-popover absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 font-mono text-xs text-white border border-accent/60 shadow-2xl pointer-events-none animate-pulse">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-semibold">Click any candle on chart to cut history at that point</span>
            </div>
          )}
          {/* Institutional TradingView-Grade In-Chart Legend HUD */}
          <ChartLegendHUD
            symbol={symbol}
            timeframe={timeframe}
            currentOhlc={currentOhlc}
            indicators={activeIndicatorsList}
            onOpenSymbolSearch={() => setIsSymbolSearchOpen(true)}
            countdownText={countdownText}
            onClearAllIndicators={handleClearAllIndicators}
          />

          <div ref={ohlc} className="hidden" />

          {/* Watermark */}
          {chartSettings.showWatermark && (
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.035] text-4xl sm:text-6xl font-black tracking-widest text-white select-none">
              {chartSettings.watermarkText}
            </div>
          )}

          {/* Bar Replay Historical Time Machine Scrubber Bar */}
          <BarReplayController
            isActive={isReplayActive}
            onExit={exitReplay}
            totalCandles={candles.length}
            currentReplayIndex={replayIndex}
            isPlaying={isReplayPlaying}
            onTogglePlay={() => setIsReplayPlaying((v) => !v)}
            onStepForward={handleStepForward}
            onSelectCutPoint={() => setIsSelectingCutPoint((v) => !v)}
            isSelectingCutPoint={isSelectingCutPoint}
            speedMs={replaySpeedMs}
            onSpeedChange={setReplaySpeedMs}
            currentTimeString={candles[replayIndex] ? new Date(candles[replayIndex].time * 1000).toLocaleString() : undefined}
            onRecenter={handleRecenterReplay}
          />

          {/* Candle-Close Countdown Floating Timer */}
          {chartSettings.showCountdownTimer && (
            <CandleCountdown
              timeframe={timeframe}
              lastCandleTime={effectiveCandles[effectiveCandles.length - 1]?.time}
            />
          )}

          {/* Lightweight Charts mounting container */}
          <div
            ref={box}
            className="absolute inset-0 z-10"
            // Prevent Android double-tap zoom from cancelling the second tap.
            // Pan and pinch gestures remain available to the chart.
            style={{ touchAction: 'manipulation' }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch' || !seriesApi || !chartApi || !box.current) return;
              if (longPressTimer.current) clearTimeout(longPressTimer.current);
              pointerDownAtRef.current = Date.now();
              longPressFiredRef.current = false;
              longPressOrigin.current = { x: e.clientX, y: e.clientY };
              const clientX = e.clientX;
              const clientY = e.clientY;
              longPressTimer.current = setTimeout(() => {
                const rect = box.current?.getBoundingClientRect();
                if (!rect || !seriesApi || !chartApi) return;
                const x = clientX - rect.left;
                const y = clientY - rect.top;
                const price = seriesApi.coordinateToPrice(y) ?? currentPrice;
                const time = chartApi.timeScale().coordinateToTime(x);
                longPressFiredRef.current = true;
                lastTouchTapRef.current = null;
                setContextMenuPos({
                  x: clientX,
                  y: clientY,
                  price,
                  time: typeof time === 'number' ? time : undefined,
                });
                longPressTimer.current = null;
              }, 550);
            }}
            onPointerMove={(e) => {
              if (!longPressOrigin.current || !longPressTimer.current) return;
              if (Math.hypot(e.clientX - longPressOrigin.current.x, e.clientY - longPressOrigin.current.y) > 12) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
                longPressOrigin.current = null;
              }
            }}
            onPointerUp={(e) => {
              const downAt = pointerDownAtRef.current;
              const tapOrigin = longPressOrigin.current;
              const wasLongPress = longPressFiredRef.current;
              const isQuickTouchTap =
                e.pointerType === 'touch' &&
                !wasLongPress &&
                downAt !== null &&
                tapOrigin !== null &&
                Date.now() - downAt <= 280 &&
                Math.hypot(e.clientX - tapOrigin.x, e.clientY - tapOrigin.y) <= 12;

              // Match TradingView: double-tap chart settings works with the default crosshair or arrow cursor.
              if (isQuickTouchTap && (activeTool === 'CURSOR_ARROW' || activeTool === 'CURSOR_CROSSHAIR')) {
                const target = e.target as HTMLElement | null;
                const isInteractiveTarget = Boolean(
                  target?.closest(
                    '[data-drawing-element], [data-drawing-context-bar], [data-drawing-settings-modal], button, input, select, textarea'
                  )
                );

                if (!isInteractiveTarget) {
                  const now = Date.now();
                  const previousTap = lastTouchTapRef.current;
                  if (
                    previousTap &&
                    now - previousTap.time <= 380 &&
                    Math.hypot(e.clientX - previousTap.x, e.clientY - previousTap.y) <= 28
                  ) {
                    lastTouchTapRef.current = null;
                    audioHaptics.tick();
                    setIsChartSettingsOpen(true);
                  } else {
                    lastTouchTapRef.current = { x: e.clientX, y: e.clientY, time: now };
                  }
                } else {
                  lastTouchTapRef.current = null;
                }
              } else if (e.pointerType === 'touch') {
                lastTouchTapRef.current = null;
              }

              pointerDownAtRef.current = null;
              longPressFiredRef.current = false;
              if (longPressTimer.current) clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
              longPressOrigin.current = null;
            }}
            onPointerCancel={() => {
              pointerDownAtRef.current = null;
              longPressFiredRef.current = false;
              lastTouchTapRef.current = null;
              if (longPressTimer.current) clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
              longPressOrigin.current = null;
            }}
            onDoubleClick={(e) => {
              const target = e.target as HTMLElement | SVGElement | null;
              if (
                target &&
                (target.closest('[data-drawing-element]') ||
                  target.closest('[data-drawing-context-bar]') ||
                  target.closest('[data-drawing-settings-modal]') ||
                  target.tagName.toLowerCase() === 'svg' ||
                  target.tagName.toLowerCase() === 'path' ||
                  target.tagName.toLowerCase() === 'line' ||
                  target.tagName.toLowerCase() === 'circle' ||
                  target.tagName.toLowerCase() === 'rect')
              ) {
                return;
              }
              audioHaptics.tick();
              setIsChartSettingsOpen(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!seriesApi || !chartApi || !box.current) return;
              const rect = box.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const price = seriesApi.coordinateToPrice(y) ?? currentPrice;
              const time = chartApi.timeScale().coordinateToTime(x);
              setContextMenuPos({
                x: e.clientX,
                y: e.clientY,
                price,
                time: typeof time === 'number' ? time : undefined,
              });
            }}
          />

          {/* Real-time Footprint / Cluster Chart Overlay */}
          {chartStyle === 'FOOTPRINT' && (
            <FootprintChartOverlay
              chartApi={chartApi}
              seriesApi={seriesApi}
              candles={effectiveCandles}
              containerWidth={boxDimensions.w}
              containerHeight={boxDimensions.h}
            />
          )}

          {/* Institutional Visible Range Volume Profile (VPVR) */}
          <VolumeProfileOverlay
            chartApi={chartApi}
            seriesApi={seriesApi}
            candles={effectiveCandles}
            containerWidth={boxDimensions.w}
            containerHeight={boxDimensions.h}
            isVisible={showVolumeProfile}
            symbol={symbol}
          />

          {/* Multi-Timeframe Ghost Charts Canvas Layer */}
          <GhostOverlay chartApi={chartApi} seriesApi={seriesApi} />

          {/* Deep Institutional Studies Overlay (Big Trades, GEX, Deep Zones) */}
          {activeInstances.some((i) => (i.indicatorId === 'big_trades' || i.indicatorId === 'gex' || i.indicatorId === 'deep_effort') && i.visible) && (
            <DeepStudiesOverlay
              chartApi={chartApi}
              seriesApi={seriesApi}
              candles={effectiveCandles}
              symbol={symbol}
              currentPrice={currentPrice}
              containerWidth={boxDimensions.w}
              containerHeight={boxDimensions.h}
            />
          )}

          {/* TradingView-Style SVG Drawing Tools Canvas Layer */}
          <DrawingOverlay
            paneId={paneId}
            symbol={symbol}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            seriesApi={seriesApi}
            chartApi={chartApi}
            candles={effectiveCandles}
            magnetConfig={magnetConfig}
            isLockedAll={isLockedAll}
            isHiddenAll={isHiddenAll}
            onDrawingsCountChange={setDrawingsCount}
            clearTrigger={clearDrawingTrigger}
            externalLineTrigger={externalLineTrigger}
          />

          {/* Floating Favorites Toolbar */}
          <FavoritesBar />

          {/* TradingView Price Scale Hover Action Flyout */}
          <PriceScaleActionFlyout
            seriesApi={seriesApi}
            containerHeight={boxDimensions.h}
            symbol={symbol}
            onAddHorizontalLine={(price) => setExternalLineTrigger({ price, type: 'LINE' })}
          />

          {/* Interactive In-Chart Measurement Ruler */}
          <ChartRulerOverlay
            isActive={isRulerActive}
            onClose={() => setIsRulerActive(false)}
            chartApi={chartApi}
            seriesApi={seriesApi}
          />

          {/* Sticky Candle Quick-Notes Overlay */}
          <StickyNotesOverlay
            symbol={symbol}
            chartApi={chartApi}
            isOpen={isNotesOpen}
            onClose={() => setIsNotesOpen(false)}
          />

          {/* Drag-and-Drop Canvas Order Lines */}
          <CanvasOrderOverlay
            seriesApi={seriesApi}
            chartApi={chartApi}
            onExecuteOrders={handleExecuteCanvasOrders}
          />

          {/* TradingView-Style Period Separators & Session Breaks */}
          <PeriodSeparatorsOverlay
            chartApi={chartApi}
          />

          {/* Pine Script Geometry & Drawings Overlay (CRT Boxes, Lines, Labels, Tables) */}
          <PineDrawingsOverlay
            chartApi={chartApi}
            seriesApi={seriesApi}
          />

          {/* Interactive In-Chart Trading & Order Drag Overlay */}
          <ChartTradingOverlay
            symbol={symbol}
            seriesApi={seriesApi}
            chartApi={chartApi}
            showPositions={chartSettings.showPositionsOnChart}
            showOrders={chartSettings.showOrdersOnChart}
            showQuickTrade={chartSettings.showQuickTradeButtons !== false}
          />

          {/* TradingView-Style On-Chart News & Macro Events Overlay */}
          <OnChartNewsOverlay
            chartApi={chartApi}
            seriesApi={seriesApi}
            symbol={symbol}
            visible={chartSettings.showEventsOnChart !== false}
          />

          {/* Risk Sizing HUD Widget */}
          {showRiskHUD && (
            <RiskHUD
              onClose={() => setShowRiskHUD(false)}
              onApplySize={(qty, slPrice, tpPrice) => {
                if (window.__setExecutionValues) {
                  window.__setExecutionValues({ qty: String(qty), sl: slPrice ? String(slPrice) : '', tp: tpPrice ? String(tpPrice) : '' });
                }
                setShowRiskHUD(false);
              }}
            />
          )}

          {/* Trade Execution Arrow Hover Details Tooltip */}
          {hoveredExecution && (
            <div
              style={{
                left: `${Math.min(hoveredExecution.x + 16, (boxDimensions.w || 800) - 220)}px`,
                top: `${Math.max(hoveredExecution.y - 75, 15)}px`,
              }}
              className="pointer-events-none absolute z-40 flex flex-col gap-1 rounded-lg border border-white/10 bg-[#0c0d14]/95 p-2.5 shadow-2xl backdrop-blur-md font-mono text-[11px]"
            >
              <div className="flex items-center gap-1.5 font-bold">
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                    hoveredExecution.side === 'BUY'
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                      : 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {hoveredExecution.type === 'ENTRY' ? `${hoveredExecution.side} ENTRY` : `${hoveredExecution.side} EXIT`}
                </span>
                <span className="text-white font-bold">{symbol}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-300 text-[10px]">
                <span className="text-slate-500">Price:</span>
                <span className="font-bold text-white font-mono">${fmtPrice(hoveredExecution.price, symbol)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-300 text-[10px]">
                <span className="text-slate-500">Size:</span>
                <span className="font-mono text-slate-200">{fmtQty(hoveredExecution.qty)}</span>
              </div>
              {hoveredExecution.pnl !== undefined && (
                <div className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="text-slate-500">Realized PnL:</span>
                  <span className={`font-bold font-mono ${hoveredExecution.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {hoveredExecution.pnl >= 0 ? `+${fmtUsd(hoveredExecution.pnl)}` : `-${fmtUsd(Math.abs(hoveredExecution.pnl))}`}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 text-[9px] text-slate-500 pt-0.5 border-t border-white/10">
                <span>Time:</span>
                <span>{new Date(hoveredExecution.time).toLocaleTimeString()}</span>
              </div>
            </div>
          )}

          {/* Active candle fetching HUD indicator */}
          {(isIndependentPane ? isLoadingBars : isLoadingCandles) && (
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 border border-cyan-400/40 text-[11px] text-cyan-300 font-mono shadow-xl backdrop-blur-md pointer-events-none animate-pulse">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Updating {timeframe} candles...</span>
            </div>
          )}

          {/* Loading overlay */}
          {!activeCandles.length && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-6 text-center">
              {activeError
                ? <p className="max-w-sm text-down">{activeError}</p>
                : <p className="text-muted">Loading {labelOf(symbol)}...</p>}
            </div>
          )}
        </div>

        {/* SubPane Indicator Charts (Oscillators: RSI, MACD, Stoch, etc.) */}
        {activeInstances
          .filter((inst) => !inst.overlay)
          .map((inst) => (
            <SubPaneChart
              key={inst.instanceId}
              instance={inst}
              candles={effectiveCandles}
              mainChartApi={chartApi}
              mainSeriesApi={seriesApi}
            />
          ))}
      </div>
    </div>

      {/* TradingView Bottom Range & Scale Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-7 shrink-0 border-t border-grid bg-panel px-2 flex items-center justify-between text-[10px] select-none font-mono z-10 overflow-x-auto scrollbar-none"
      >
        {/* Left: Time Range Presets */}
        <div className="flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none">
          {(['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectTimeRange(r);
              }}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold transition cursor-pointer ${
                activeTimeRange === r
                  ? 'bg-accent text-white font-bold shadow-sm'
                  : 'bg-surface hover:bg-surface/80 text-muted hover:text-white border border-grid'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Right: Scale, Separators, Sessions & Timezone */}
        <div className="flex items-center gap-1 text-[9.5px] shrink-0 ml-auto pl-2">
          {/* Live Market Sessions & Killzones Indicator Pill */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if ((window as any).__openSessionsModal) {
                (window as any).__openSessionsModal();
              } else if ((window as any).__openSessions) {
                (window as any).__openSessions();
              }
            }}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition flex items-center gap-1 cursor-pointer shrink-0 ${
              sessionData.isLondonNyOverlap
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : sessionData.activeKillzones.filter((k: any) => k.isActive).length > 0
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : sessionData.activeCount > 0
                ? 'border-slate-500/40 bg-slate-500/10 text-slate-300'
                : 'bg-surface text-zinc-400 border-grid'
            }`}
            title={`Market Sessions: ${sessionData.sessions.filter((s: any) => s.isActive).map((s: any) => s.name).join(', ') || 'Inter-Session'} (Click to open Sessions Dialog)`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${
              sessionData.isLondonNyOverlap ? 'bg-emerald-400 animate-pulse' :
              sessionData.activeKillzones.filter((k: any) => k.isActive).length > 0 ? 'bg-amber-400 animate-pulse' :
              sessionData.activeCount > 0 ? 'bg-cyan-400' : 'bg-zinc-500'
            }`} />
            <span>
              {sessionData.isLondonNyOverlap
                ? 'LON/NY'
                : sessionData.activeKillzones.filter((k: any) => k.isActive).length > 0
                ? sessionData.activeKillzones.filter((k: any) => k.isActive)[0].name.toUpperCase()
                : sessionData.sessions.filter((s: any) => s.isActive).length > 0
                ? sessionData.sessions.filter((s: any) => s.isActive)[0].name.toUpperCase()
                : 'INTER-SESSION'}
            </span>
          </button>

          {/* Period Separators Toggle Badge */}
          <button
            onClick={() => {
              audioHaptics.tick();
              useTerminalStore.getState().togglePeriodSeparators();
            }}
            className={`px-1.5 py-0.5 rounded border border-grid font-mono transition cursor-pointer ${
              useTerminalStore.getState().showPeriodSeparators
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-bold'
                : 'bg-surface text-muted hover:text-white'
            }`}
            title="Toggle Period Separators / Session Breaks (also in right-click menu)"
          >
            SEP
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              const tzs: ChartTimezone[] = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
              const nextTz = tzs[(tzs.indexOf(timezone) + 1) % tzs.length];
              setTimezone(nextTz);
            }}
            className="px-1.5 py-0.5 rounded bg-surface hover:bg-surface/80 text-muted hover:text-white border border-grid font-mono transition cursor-pointer"
            title={`Timezone: ${timezone} (Click to toggle)`}
          >
            {timezone === 'UTC' ? 'UTC' : timezone === 'Asia/Kolkata' ? 'IST' : timezone === 'America/New_York' ? 'EDT' : timezone === 'Europe/London' ? 'GMT' : 'JST'}
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              api.current?.candles.priceScale().applyOptions({ autoScale: true });
            }}
            className="px-1.5 py-0.5 rounded bg-surface hover:bg-surface/80 text-white font-bold border border-grid transition cursor-pointer"
            title="Auto scale (or double-click price scale)"
          >
            auto
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              handleSetScaleMode('NORMAL');
            }}
            className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer ${
              scaleMode === 'NORMAL'
                ? 'bg-accent text-white font-bold shadow-sm'
                : 'bg-surface text-muted hover:text-white border border-grid'
            }`}
            title="Linear / Normal scale"
          >
            lin
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              handleSetScaleMode('LOGARITHMIC');
            }}
            className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer ${
              scaleMode === 'LOGARITHMIC'
                ? 'bg-accent text-white font-bold shadow-sm'
                : 'bg-surface text-muted hover:text-white border border-grid'
            }`}
            title="Logarithmic scale"
          >
            log
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              handleSetScaleMode('PERCENTAGE');
            }}
            className={`px-1.5 py-0.5 rounded font-semibold transition cursor-pointer ${
              scaleMode === 'PERCENTAGE'
                ? 'bg-accent text-white font-bold shadow-sm'
                : 'bg-surface text-muted hover:text-white border border-grid'
            }`}
            title="Percentage scale"
          >
            %
          </button>
        </div>
      </div>

      {/* Indicators, Metrics & Strategies Modal */}
      <IndicatorsModal
        isOpen={isIndicatorsModalOpen}
        onClose={() => setIsIndicatorsModalOpen(false)}
        activeIndicators={{
          sma: showSma,
          ema: showEma,
          vwap: showVwap,
          bbands: showBbands,
          rsi: showRsi,
          oi: showOI,
          sessionOhl: showSessionOHL,
        }}
        onToggleIndicator={handleToggleIndicator}
      />

      {/* Indicator Settings Dialog (Inputs, Style, Visibility) */}
      <IndicatorSettingsDialog />

      {/* Chart Settings Modal */}
      <ChartSettingsModal
        isOpen={isChartSettingsOpen}
        onClose={() => setIsChartSettingsOpen(false)}
        settings={chartSettings}
        onUpdateSettings={updateChartSettings}
        onResetDefaults={resetChartSettings}
      />

      {/* Object Tree & Manage Drawings Inspector Modal */}
      <ManageDrawingsModal
        isOpen={isObjectTreeOpen}
        onClose={() => setIsObjectTreeOpen(false)}
        symbol={symbol}
      />

      {/* Skins Customization Modal */}
      <ChartSkinsModal isOpen={showSkinsModal} onClose={() => setShowSkinsModal(false)} />

      {/* Snapshot Action Toast Notification */}
      {snapshotToast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-emerald-500/40 bg-[#090b10]/95 px-4 py-2 text-xs font-mono font-semibold text-emerald-400 shadow-2xl backdrop-blur pointer-events-none">
          {snapshotToast}
        </div>
      )}

      {/* Institutional Symbol Search Modal */}
      <SymbolSearchModal
        isOpen={isSymbolSearchOpen}
        onClose={() => setIsSymbolSearchOpen(false)}
        onSelect={(inst) => setPaneSymbol(paneId, inst.id)}
      />

      {/* TradingView-Style In-Chart Canvas Context Menu */}
      <ChartContextMenu
        pos={contextMenuPos}
        symbol={symbol}
        chartStyle={chartStyle}
        onSetChartStyle={setChartStyle}
        scaleMode={scaleMode}
        onSetScaleMode={handleSetScaleMode}
        timezone={timezone}
        onSetTimezone={setTimezone}
        onClose={() => setContextMenuPos(null)}
        onResetScale={() => {
          audioHaptics.tick();
          api.current?.candles.priceScale().applyOptions({ autoScale: true });
        }}
        onAddAlert={(price) => {
          audioHaptics.tick();
          setAlertInitialPrice(price);
          setIsCreateAlertOpen(true);
        }}
        onCreateOrder={(price) => {
          audioHaptics.tick();
          placeOrder({
            symbol,
            side: price < currentPrice ? 'BUY' : 'SELL',
            type: 'LIMIT',
            price,
            qty: 0.1,
            leverage: 10,
          });
        }}
        onAddHorizontalLine={(price) => setExternalLineTrigger({ price, type: 'LINE' })}
        onAddHorizontalRay={(price) => setExternalLineTrigger({ price, type: 'RAY' })}
        onStartReplayAtTime={(time) => {
          const idx = candles.findIndex((c) => c.time >= time);
          if (idx !== -1) {
            audioHaptics.tick();
            setReplayIndex(idx);
            setIsReplayActive(true);
            if (candles[idx]) {
              useTerminalStore.getState().updatePriceTick(symbol, candles[idx].close);
            }
          }
        }}
        onOpenRuler={() => setIsRulerActive(true)}
        onOpenIndicators={() => setIsIndicatorsModalOpen(true)}
        onOpenSettings={() => setIsChartSettingsOpen(true)}
        onClearDrawings={() => setClearDrawingTrigger(Date.now())}
        onOpenObjectTree={() => setIsObjectTreeOpen(true)}
      />

      {/* TradingView-Style Institutional Create Alert Dialog */}
      <CreateAlertModal
        isOpen={isCreateAlertOpen}
        onClose={() => setIsCreateAlertOpen(false)}
        initialPrice={alertInitialPrice}
      />

      {/* Custom Time Interval Modal */}
      <CustomIntervalModal
        isOpen={isCustomIntervalModalOpen}
        onClose={() => setIsCustomIntervalModalOpen(false)}
        activeTimeframe={timeframe}
        onSelectTimeframe={(tf) => {
          setTimeframe(tf);
          setPaneTimeframe(paneId, tf);
        }}
      />

      {/* TradingView-Style Pine Script Indicator Settings Dialog */}
      <PineSettingsModal
        script={selectedPineScriptForSettings}
        isOpen={!!selectedPineScriptForSettings}
        onClose={() => setSelectedPineScriptForSettings(null)}
      />
    </div>
  );
}
