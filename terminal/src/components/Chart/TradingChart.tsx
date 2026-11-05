import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle, PriceScaleMode,
  type CandlestickData, type IChartApi, type IPriceLine, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp,
} from 'lightweight-charts';
import { useTerminalStore } from '../../store/useTerminalStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { liveCandleBus } from '../../hooks/useMarketFeed';
import { getInstrument, TIMEFRAMES } from '../../services/instruments';
import { ema, sma, rsi, bollingerBands, heikinAshi } from '../../services/indicatorMath';
import { generateOIHistory } from '../../services/nseOptionChain';
import { decimalsFor, fmtPrice, fmtQty, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { Candle, ChartStyle, ChartTimezone, PriceScaleType, Timeframe } from '../../types/terminal';
import type { CanvasOrderLine } from '../../types/derivatives';
import type { ToolType, MagnetConfig } from '../drawing/types';
import ChartSkinsLayer from '../ChartSkinsLayer';
import ChartSkinsModal from '../ChartSkinsModal';
import GhostOverlay from '../ghost/GhostOverlay';
import CanvasOrderOverlay from '../canvas/CanvasOrderOverlay';
import CandleCountdown from './CandleCountdown';
import FootprintChartOverlay from './FootprintChartOverlay';
import ChartRulerOverlay from './ChartRulerOverlay';
import StickyNotesOverlay from './StickyNotesOverlay';
import DrawingToolbar from '../drawing/DrawingToolbar';
import DrawingOverlay from '../drawing/DrawingOverlay';
import FavoritesBar from '../drawing/FavoritesBar';
import { drawingEvents } from '../drawing/framework/DrawingEvents';
import IndicatorsModal from './IndicatorsModal';
import BarReplayController from './BarReplayController';
import ChartSettingsModal, { DEFAULT_CHART_SETTINGS, type ChartSettingsState } from './ChartSettingsModal';
import ChartLegendHUD, { type ActiveIndicatorInfo } from './ChartLegendHUD';
import VolumeProfileOverlay from './VolumeProfileOverlay';
import PriceScaleActionFlyout from './PriceScaleActionFlyout';
import SymbolSearchModal from '../Search/SymbolSearchModal';
import ChartContextMenu, { type ChartContextMenuPos } from './ChartContextMenu';
import ShareChartModal from '../share/ShareChartModal';
import RiskHUD from '../RiskHUD';

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
}

export default function TradingChart({
  paneId = 'pane-1',
  symbolOverride,
  timeframeOverride,
}: TradingChartProps = {}) {
  const storeSymbol = useTerminalStore((s) => s.symbol);
  const symbol = symbolOverride ?? storeSymbol;
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const storeTimeframe = useTerminalStore((s) => s.timeframe);
  const timeframe = timeframeOverride ?? storeTimeframe;
  const setTimeframe = useTerminalStore((s) => s.setTimeframe);
  const candles = useTerminalStore((s) => s.candles);
  const error = useTerminalStore((s) => s.error);
  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const addAlert = useTerminalStore((s) => s.addAlert);
  const pinePlots = useTerminalStore((s) => s.pinePlots);

  // Psychology and Skins Store
  const zenMode = usePsychologyStore((s) => s.zenMode);
  const themeConfig = usePsychologyStore((s) => s.themeConfig);

  // Derivatives & Institutional Overlay Store
  const isGhostVisible = useDerivativesStore((s) => s.isGhostVisible);
  const toggleGhost = useDerivativesStore((s) => s.toggleGhost);
  const canvasOrderLines = useDerivativesStore((s) => s.canvasOrderLines);
  const initCanvasOrderLines = useDerivativesStore((s) => s.initCanvasOrderLines);
  const clearCanvasOrderLines = useDerivativesStore((s) => s.clearCanvasOrderLines);

  const provider = getInstrument(symbol)?.provider ?? 'binance';

  // Indicators & Chart Styles
  const [chartStyle, setChartStyle] = useState<ChartStyle>('CANDLE');
  const [showSma, setShowSma] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showBbands, setShowBbands] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showOI, setShowOI] = useState(false);
  const [showSessionOHL, setShowSessionOHL] = useState(true);

  // Modals & Tools
  const [showRiskHUD, setShowRiskHUD] = useState(false);
  const [showSkinsModal, setShowSkinsModal] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // Drawing Tools & Magnet State
  const [activeTool, setActiveTool] = useState<ToolType>('CURSOR_CROSSHAIR');
  const [drawingsCount, setDrawingsCount] = useState(0);
  const [clearDrawingTrigger, setClearDrawingTrigger] = useState(0);
  const [magnetConfig, setMagnetConfig] = useState<MagnetConfig>({ enabled: false, mode: 'WEAK' });
  const [isLockedAll, setIsLockedAll] = useState(false);
  const [isHiddenAll, setIsHiddenAll] = useState(false);
  const pineSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // Indicators Modal State
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false);

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

  const updateChartSettings = (patch: Partial<ChartSettingsState>) => {
    setChartSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('crt_chart_settings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetChartSettings = () => {
    setChartSettings(DEFAULT_CHART_SETTINGS);
    try {
      localStorage.setItem('crt_chart_settings', JSON.stringify(DEFAULT_CHART_SETTINGS));
    } catch {}
  };

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
  const [showVolumeProfile, setShowVolumeProfile] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
  const [externalLineTrigger, setExternalLineTrigger] = useState<{ price: number; type: 'LINE' | 'RAY' } | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<ChartContextMenuPos | null>(null);

  // Top Toolbar Dropdown menus
  const [isTfMenuOpen, setIsTfMenuOpen] = useState(false);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);

  const tfMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const layersMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tfMenuRef.current && !tfMenuRef.current.contains(target)) {
        setIsTfMenuOpen(false);
      }
      if (styleMenuRef.current && !styleMenuRef.current.contains(target)) {
        setIsStyleMenuOpen(false);
      }
      if (layersMenuRef.current && !layersMenuRef.current.contains(target)) {
        setIsLayersMenuOpen(false);
      }
      if (colorMenuRef.current && !colorMenuRef.current.contains(target)) {
        setIsColorMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTfMenuOpen(false);
        setIsStyleMenuOpen(false);
        setIsLayersMenuOpen(false);
        setIsColorMenuOpen(false);
      }
    };
    if (isTfMenuOpen || isStyleMenuOpen || isLayersMenuOpen || isColorMenuOpen) {
      window.addEventListener('mousedown', handleOutside);
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isTfMenuOpen, isStyleMenuOpen, isLayersMenuOpen, isColorMenuOpen]);

  const favoriteTimeframes = useMemo(
    () => TIMEFRAMES[provider].filter((t) => FAVORITE_TIMEFRAMES.includes(t)),
    [provider]
  );

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

  const toggleTfMenu = () => {
    setIsStyleMenuOpen(false);
    setIsLayersMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsTfMenuOpen((v) => !v);
  };
  const toggleStyleMenu = () => {
    setIsTfMenuOpen(false);
    setIsLayersMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsStyleMenuOpen((v) => !v);
  };
  const toggleColorMenu = () => {
    setIsTfMenuOpen(false);
    setIsStyleMenuOpen(false);
    setIsLayersMenuOpen(false);
    setIsColorMenuOpen((v) => !v);
  };
  const toggleLayersMenu = () => {
    setIsTfMenuOpen(false);
    setIsStyleMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsLayersMenuOpen((v) => !v);
  };

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
    (window as any).__selectDrawingTool = (tool: ToolType) => setActiveTool(tool);
    (window as any).__resetChartScale = () => {
      api.current?.candles.priceScale().applyOptions({ autoScale: true });
    };
    const unsubTool = drawingEvents.onSelectTool((tool) => setActiveTool(tool));
    return () => {
      delete (window as any).__openSymbolSearch;
      delete (window as any).__selectDrawingTool;
      delete (window as any).__resetChartScale;
      unsubTool();
    };
  }, []);

  // Active indicator list for in-chart legend controls
  const activeIndicatorsList = useMemo<ActiveIndicatorInfo[]>(() => {
    const list: ActiveIndicatorInfo[] = [];
    if (showSma) {
      list.push({
        id: 'sma',
        name: 'SMA 20',
        color: '#f0b90b',
        value: indicatorValues.sma,
        visible: showSma,
        onToggleVisible: () => setShowSma((v) => !v),
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

    return list;
  }, [showSma, showEma, showVwap, showBbands, showRsi, showOI, showVolume, showVolumeProfile, currentOhlc, indicatorValues]);

  // Effective candles respecting Bar Replay slice
  const effectiveCandles = useMemo(() => {
    if (!isReplayActive) return candles;
    return candles.slice(0, Math.min(candles.length, replayIndex + 1));
  }, [candles, isReplayActive, replayIndex]);

  // Replay playback interval timer
  useEffect(() => {
    if (!isReplayActive || !isReplayPlaying) return;
    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= candles.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        audioHaptics.tick();
        return prev + 1;
      });
    }, replaySpeedMs);
    return () => clearInterval(interval);
  }, [isReplayActive, isReplayPlaying, replaySpeedMs, candles.length]);

  const startReplay = () => {
    audioHaptics.tick();
    setIsReplayActive(true);
    setReplayIndex(Math.max(0, candles.length - 40));
    setIsReplayPlaying(false);
  };

  const exitReplay = () => {
    audioHaptics.tick();
    setIsReplayActive(false);
    setIsReplayPlaying(false);
    setIsSelectingCutPoint(false);
  };

  const handleStepForward = () => {
    audioHaptics.tick();
    setReplayIndex((prev) => Math.min(candles.length - 1, prev + 1));
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

  const box = useRef<HTMLDivElement>(null);
  const ohlc = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const live = useRef<LiveInd>({ closes: [], lastTime: 0, emaPrev: null, lastEma: null });
  const hovering = useRef(false);

  // Expose chart APIs to state for overlay layers (Ghost / Canvas drag & drop)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<SeriesType> | null>(null);
  const [boxDimensions, setBoxDimensions] = useState<{ w: number; h: number }>({ w: 800, h: 500 });

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

  // Primitive signature of everything drawn as a price line
  const lineKey = useTerminalStore((s) => {
    const p = s.positions[s.symbol];
    const o = s.orders.filter((x) => x.status === 'PENDING' && x.symbol === s.symbol).map((x) => `${x.type}:${x.side}:${x.triggerPrice ?? x.price}`).join('|');
    const a = s.alerts.filter((x) => !x.triggered && x.symbol === s.symbol).map((x) => x.price).join('|');
    return `${s.symbol}#${p ? `${p.side}:${p.entryPrice}:${p.size}` : ''}#${o}#${a}#${showSessionOHL}`;
  });

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
    const isCustomBg = themeConfig.wallpaperType !== 'SOLID' && !!themeConfig.mediaUrl;
    const isZen = zenMode.active && zenMode.softPastelCandles;
    const upColor = '#ffffff';
    const downColor = '#101015';

    const chart = createChart(box.current!, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: isCustomBg ? 'transparent' : '#050508' },
        textColor: '#828290',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255, 255, 255, 0.35)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#181820',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.35)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#181820',
        },
      },
      rightPriceScale: {
        borderColor: '#1e1e26',
        scaleMargins: { top: 0.08, bottom: 0.12 },
        autoScale: true,
        alignLabels: true,
        borderVisible: true,
      },
      timeScale: {
        borderColor: '#1e1e26',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: tickLabel,
        barSpacing: 12,
        minBarSpacing: 3,
        rightOffset: 12,
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

    const isDarkInit = chartSettings.candleDownColor === '#101015' || chartSettings.candleDownColor === '#050508';
    const borderDownInit = isDarkInit ? '#71717a' : chartSettings.candleDownColor;
    const cs = chart.addCandlestickSeries({
      upColor: chartSettings.candleUpColor || '#ffffff',
      downColor: chartSettings.candleDownColor || '#101015',
      borderVisible: true,
      borderUpColor: chartSettings.candleUpColor || '#ffffff',
      borderDownColor: borderDownInit,
      wickVisible: true,
      wickUpColor: chartSettings.candleUpColor || '#ffffff',
      wickDownColor: borderDownInit,
      visible: chartStyle === 'CANDLE' || chartStyle === 'HOLLOW_CANDLE' || chartStyle === 'HEIKIN_ASHI' || chartStyle === 'FOOTPRINT',
    });
    cs.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.12 } });

    const barSeries = chart.addBarSeries({
      upColor: chartSettings.candleUpColor || '#ffffff',
      downColor: borderDownInit,
      visible: chartStyle === 'BAR',
    });
    barSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.12 } });

    const lineSeries = chart.addLineSeries({
      color: chartSettings.candleUpColor || '#ffffff',
      lineWidth: 2,
      visible: chartStyle === 'LINE',
    });
    lineSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.12 } });

    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(255, 255, 255, 0.28)',
      bottomColor: 'rgba(255, 255, 255, 0.02)',
      lineColor: chartSettings.candleUpColor || '#ffffff',
      lineWidth: 2,
      visible: chartStyle === 'AREA',
    });
    areaSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.12 } });

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
    baselineSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.12 } });

    const vs = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      visible: showVolume,
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const lineOpts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
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

    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(cs) as CandlestickData | undefined;
      hovering.current = !!d;
      if (d) {
        const v = p.seriesData.get(vs) as { value?: number } | undefined;
        const sVal = p.seriesData.get(smaS) as { value?: number } | undefined;
        const eVal = p.seriesData.get(emaS) as { value?: number } | undefined;
        const vwVal = p.seriesData.get(vwapS) as { value?: number } | undefined;
        const rVal = p.seriesData.get(rsiS) as { value?: number } | undefined;
        const oVal = p.seriesData.get(ois) as { value?: number } | undefined;

        writeOhlc({ open: d.open, high: d.high, low: d.low, close: d.close, volume: v?.value });
        setCurrentOhlc({ open: d.open, high: d.high, low: d.low, close: d.close, volume: v?.value });
        setIndicatorValues({
          sma: sVal?.value ?? null,
          ema: eVal?.value ?? null,
          vwap: vwVal?.value ?? null,
          rsi: rVal?.value ?? null,
          oi: oVal?.value ?? null,
        });
      }
    });

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
      liveCandleBus.delete(onLive);
      chart.remove();
      api.current = null;
      setChartApi(null);
      setSeriesApi(null);
    };
  }, []);

  // Update background transparency when ChartSkins changes
  useEffect(() => {
    if (!api.current) return;
    const isCustomBg = themeConfig.wallpaperType !== 'SOLID' && !!themeConfig.mediaUrl;
    api.current.chart.applyOptions({
      layout: {
        background: {
          type: ColorType.Solid,
          color: isCustomBg ? 'transparent' : '#0b0e14',
        },
      },
    });
  }, [themeConfig.wallpaperType, themeConfig.mediaUrl]);

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

  // Dynamic Chart Settings synchronization
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (chartStyle !== 'FOOTPRINT') {
      const isDark = chartSettings.candleDownColor === '#101015' || chartSettings.candleDownColor === '#050508';
      const borderDown = isDark ? '#71717a' : chartSettings.candleDownColor;
      a.candles.applyOptions({
        upColor: chartSettings.candleUpColor,
        downColor: chartSettings.candleDownColor,
        borderVisible: true,
        borderUpColor: chartSettings.candleUpColor,
        borderDownColor: borderDown,
        wickVisible: true,
        wickUpColor: chartSettings.candleUpColor,
        wickDownColor: borderDown,
        lastValueVisible: chartSettings.showLastPriceLine,
        priceLineVisible: chartSettings.showLastPriceLine,
      });
    }
    a.chart.applyOptions({
      grid: {
        vertLines: {
          visible: chartSettings.gridLines === 'both' || chartSettings.gridLines === 'vertical',
          color: `rgba(255, 255, 255, ${chartSettings.gridOpacity})`,
        },
        horzLines: {
          visible: chartSettings.gridLines === 'both' || chartSettings.gridLines === 'horizontal',
          color: `rgba(255, 255, 255, ${chartSettings.gridOpacity})`,
        },
      },
    });
  }, [chartSettings]);

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
    a.chart.timeScale().fitContent();
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
  }, [effectiveCandles, symbol, chartStyle]);

  // Price lines for positions, orders, alerts, and Session OHL Laser Lines
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const s = useTerminalStore.getState();
    const lines: IPriceLine[] = [];
    const add = (price: number, color: string, title: string, solid = false) =>
      lines.push(a.candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: solid ? LineStyle.Solid : LineStyle.Dashed, axisLabelVisible: true, title }));

    // Active position line
    const p = s.positions[s.symbol];
    if (p) add(p.entryPrice, p.side === 'LONG' ? '#089981' : '#f23645', `${p.side} ${fmtQty(p.size)}`, true);

    // Orders
    for (const o of s.orders) {
      if (o.status !== 'PENDING' || o.symbol !== s.symbol) continue;
      if (o.type === 'LIMIT') add(o.price, '#4c8dff', `${o.side} limit`);
      else add(o.triggerPrice ?? 0, o.type === 'STOP_LOSS' ? '#f23645' : '#089981', o.type === 'STOP_LOSS' ? 'SL' : 'TP');
    }

    // Alerts
    for (const al of s.alerts) if (!al.triggered && al.symbol === s.symbol) add(al.price, '#f0b90b', 'Alert');

    // Session OHL Laser Lines
    if (showSessionOHL && candles.length > 0) {
      const todaySec = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
      const todayCandles = candles.filter((c) => c.time >= todaySec);
      const refCandles = todayCandles.length > 0 ? todayCandles : candles.slice(-24);
      if (refCandles.length > 0) {
        const sOpen = refCandles[0].open;
        const sHigh = Math.max(...refCandles.map((c) => c.high));
        const sLow = Math.min(...refCandles.map((c) => c.low));
        add(sOpen, '#38bdf8', 'Session Open');
        add(sHigh, '#089981', 'Session High');
        add(sLow, '#f23645', 'Session Low');
      }
    }

    return () => { try { lines.forEach((l) => a.candles.removePriceLine(l)); } catch { /* ignore */ } };
  }, [lineKey, showSessionOHL, candles]);

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

    const isDark = chartSettings.candleDownColor === '#101015' || chartSettings.candleDownColor === '#050508';
    const borderDown = isDark ? '#71717a' : chartSettings.candleDownColor;

    if (chartStyle === 'FOOTPRINT') {
      a.candles.applyOptions({
        upColor: 'transparent',
        downColor: 'transparent',
        borderVisible: false,
        wickUpColor: 'rgba(255, 255, 255, 0.25)',
        wickDownColor: 'rgba(255, 255, 255, 0.25)',
      });
    } else if (chartStyle === 'HOLLOW_CANDLE') {
      a.candles.applyOptions({
        upColor: 'transparent',
        downColor: chartSettings.candleDownColor || '#101015',
        borderVisible: true,
        borderUpColor: chartSettings.candleUpColor || '#ffffff',
        borderDownColor: borderDown,
        wickVisible: true,
        wickUpColor: chartSettings.candleUpColor || '#ffffff',
        wickDownColor: borderDown,
      });
    } else {
      a.candles.applyOptions({
        upColor: chartSettings.candleUpColor || '#ffffff',
        downColor: chartSettings.candleDownColor || '#101015',
        borderVisible: true,
        borderUpColor: chartSettings.candleUpColor || '#ffffff',
        borderDownColor: borderDown,
        wickVisible: true,
        wickUpColor: chartSettings.candleUpColor || '#ffffff',
        wickDownColor: borderDown,
      });
      a.barSeries.applyOptions({
        upColor: chartSettings.candleUpColor || '#ffffff',
        downColor: borderDown,
      });
      a.lineSeries.applyOptions({
        color: chartSettings.candleUpColor || '#ffffff',
      });
      a.areaSeries.applyOptions({
        lineColor: chartSettings.candleUpColor || '#ffffff',
      });
    }
  }, [chartStyle, chartSettings]);

  // Dynamic Pine Script Indicator Series rendering
  useEffect(() => {
    const chart = api.current?.chart;
    if (!chart) return;

    // Remove existing pine series
    for (const s of pineSeriesRef.current) {
      try {
        chart.removeSeries(s);
      } catch {}
    }
    pineSeriesRef.current = [];

    if (!pinePlots || !pinePlots.length) return;

    for (const plot of pinePlots) {
      if (!plot.data || !plot.data.length) continue;
      try {
        const line = chart.addLineSeries({
          color: plot.color || '#ffffff',
          lineWidth: 1,
          title: plot.title,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
        });
        line.setData(plot.data as any);
        pineSeriesRef.current.push(line);
      } catch (err) {
        console.warn('Failed to add Pine Script line series:', err);
      }
    }
  }, [pinePlots]);

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
    const a = api.current;
    if (!a || !effectiveCandles.length) return;
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
    else if (range === 'ALL') {
      a.chart.timeScale().fitContent();
      return;
    }

    const fromTime = (now - seconds) as UTCTimestamp;
    const toTime = (now + 3600) as UTCTimestamp;
    try {
      a.chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
    } catch {
      a.chart.timeScale().fitContent();
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-bg overflow-hidden select-none font-mono">
      {/* ChartSkins Background Layer (Video / Wallpaper / GIF) */}
      <ChartSkinsLayer />

      {/* Institutional TradingView-Style Chart Top Toolbar */}
      <div className="relative z-20 flex items-center justify-between border-b border-grid bg-panel px-2.5 py-1.5 select-none text-xs shadow-clay-card">
        {/* Left Section: Symbol, Timeframes, Candle Style, Indicators, Replay, Alert, Undo/Redo, Layers */}
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
          {/* Symbol Search Trigger */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsSymbolSearchOpen(true);
            }}
            className="flex items-center gap-1.5 clay-pill px-3 py-1 text-xs font-bold text-white transition cursor-pointer shrink-0"
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
            <div className="flex items-center gap-1">
              {favoriteTimeframes.map((t) => (
                <button
                  key={t}
                  className={`px-2.5 py-0.5 text-xs transition ${
                    t === timeframe
                      ? 'clay-pill-active'
                      : 'clay-pill'
                  }`}
                  onClick={() => {
                    audioHaptics.tick();
                    setTimeframe(t);
                  }}
                >
                  {t}
                </button>
              ))}
              {!favoriteTimeframes.includes(timeframe) && (
                <button
                  className="px-2.5 py-0.5 text-xs clay-pill-active"
                >
                  {timeframe}
                </button>
              )}
            </div>

            {/* Timeframe Dropdown Toggle */}
            <button
              onClick={() => {
                audioHaptics.tick();
                toggleTfMenu();
              }}
              className="p-1 rounded-full clay-btn transition ml-1"
              title="All Timeframes"
            >
              <svg className={`h-3 w-3 transition-transform ${isTfMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Timeframe Dropdown Menu */}
            {isTfMenuOpen && (
              <div className="absolute left-0 top-full mt-2 z-50 w-44 clay-popover p-2 shadow-2xl font-mono text-xs">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-grid/60 mb-1">
                  Select Timeframe
                </div>
                {TIMEFRAMES[provider].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      audioHaptics.tick();
                      setTimeframe(t);
                      setIsTfMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg transition ${
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
              <span>{
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
              <div className="absolute left-0 top-full mt-2 z-50 w-60 clay-popover p-2 shadow-2xl font-mono text-xs max-h-80 overflow-y-auto">
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
                      setIsStyleMenuOpen(false);
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
              <div className="absolute left-0 top-full mt-2 z-50 w-64 clay-popover p-3 shadow-2xl font-mono text-xs select-none">
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
                          updateChartSettings({ candleUpColor: preset.up, candleDownColor: preset.down });
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
              setIsIndicatorsModalOpen(true);
            }}
            className="flex items-center gap-1.5 clay-pill px-3 py-1 text-xs font-semibold text-white transition shrink-0"
            title="Indicators, Metrics & Strategies (fx)"
          >
            <span className="font-bold text-white">fx</span>
            <span>Indicators</span>
            {activeIndicatorsList.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-white text-black text-[10px] font-bold">
                {activeIndicatorsList.length}
              </span>
            )}
          </button>

          {/* Quick Volume Histogram Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              const next = !showVolume;
              setShowVolume(next);
              api.current?.volume.applyOptions({ visible: next });
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
              showVolume ? 'clay-pill-active' : 'clay-pill text-slate-400 hover:text-white'
            }`}
            title="Toggle Bottom Volume Bars"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Vol</span>
          </button>

          {/* Quick Visible Range Volume Profile (VPVR) Toggle */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setShowVolumeProfile((v) => !v);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
              showVolumeProfile ? 'clay-pill-active' : 'clay-pill text-slate-400 hover:text-white'
            }`}
            title="Toggle Visible Range Volume Profile (VPVR & POC/VAH/VAL lines)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h10M4 14h14M4 18h8" />
            </svg>
            <span>VPVR</span>
          </button>

          {/* Bar Replay Historical Time Machine Trigger */}
          <button
            onClick={() => {
              audioHaptics.tick();
              if (isReplayActive) exitReplay();
              else startReplay();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition shrink-0 ${
              isReplayActive
                ? 'clay-pill-active'
                : 'clay-pill'
            }`}
            title="Bar Replay Historical Time Machine (Space: Play/Pause, Shift+Right: Step)"
          >
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span>Replay</span>
          </button>

          {/* Quick Alert Trigger Button */}
          <button
            onClick={() => {
              audioHaptics.tick();
              addAlert(symbol, currentPrice, 'PRICE');
            }}
            className="flex items-center gap-1.5 clay-pill px-3 py-1 text-xs font-semibold text-white transition shrink-0"
            title="Create Alert at Current Price (Alt+A)"
          >
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Alert</span>
          </button>

          {/* Undo / Redo Controls */}
          <div className="flex items-center gap-1 border-l border-grid pl-1.5 shrink-0">
            <button
              onClick={() => {
                audioHaptics.tick();
                drawingEvents.undo();
              }}
              className="p-1 rounded-full clay-btn transition"
              title="Undo Drawing (Ctrl+Z)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
              </svg>
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                drawingEvents.redo();
              }}
              className="p-1 rounded-full clay-btn transition"
              title="Redo Drawing (Ctrl+Y)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
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
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition ${
                activeLayersCount > 0
                  ? 'clay-pill-active'
                  : 'clay-pill'
              }`}
              title="Chart Overlays & Layers"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Layers</span>
              {activeLayersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-black text-white text-[10px] font-bold">
                  {activeLayersCount}
                </span>
              )}
              <svg className={`h-3 w-3 transition-transform ${isLayersMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Layers Dropdown Menu */}
            {isLayersMenuOpen && (
              <div className="absolute left-0 top-full mt-2 z-50 w-72 clay-popover p-2.5 shadow-2xl font-mono text-xs select-none">
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
                        setIsLayersMenuOpen(false);
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

        {/* Right Section: Session, Scale, Timezone, Snapshot, Settings, Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Market Session Status Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${provider === 'binance' ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-slate-400 font-semibold">
              {provider === 'binance' ? '24/7 LIVE' : 'REGULAR'}
            </span>
          </div>

          {/* Scale Mode Switcher */}
          <button
            onClick={() => {
              audioHaptics.tick();
              const nextMode: PriceScaleType =
                scaleMode === 'NORMAL' ? 'LOGARITHMIC' : scaleMode === 'LOGARITHMIC' ? 'PERCENTAGE' : 'NORMAL';
              handleSetScaleMode(nextMode);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold clay-pill text-slate-300 hover:text-white transition shrink-0"
            title={`Price Scale Mode: ${scaleMode} (Click to toggle Normal / Log / %)`}
          >
            <span className="text-[10px] text-slate-400 font-normal">Scale:</span>
            <span className="font-bold text-white text-[11px]">{scaleMode === 'NORMAL' ? 'Lin' : scaleMode === 'LOGARITHMIC' ? 'Log' : '%'}</span>
          </button>

          {/* Timezone Switcher */}
          <button
            onClick={() => {
              audioHaptics.tick();
              const tzs: ChartTimezone[] = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
              const nextTz = tzs[(tzs.indexOf(timezone) + 1) % tzs.length];
              setTimezone(nextTz);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold clay-pill text-slate-400 hover:text-white transition shrink-0"
            title={`Chart Timezone: ${timezone} (Click to cycle UTC / IST / EDT / GMT / JST)`}
          >
            <span className="text-[10px] font-mono text-slate-300">
              {timezone === 'UTC' ? 'UTC' : timezone === 'Asia/Kolkata' ? 'IST' : timezone === 'America/New_York' ? 'EDT' : timezone === 'Europe/London' ? 'GMT' : 'JST'}
            </span>
          </button>
          {/* Share Chart Snapshot Modal Trigger */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsShareModalOpen(true);
            }}
            className="flex items-center gap-1.5 clay-pill-active px-3 py-1 text-xs font-semibold transition"
            title="Export Watermarked Snapshot or Copy Chart Link"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Snapshot</span>
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
            className="p-1.5 rounded-full clay-btn transition"
            title="Toggle Fullscreen"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>


      {/* Chart Center Area: Docked Left Rail + Canvas */}
      <div className="relative flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Docked Left Drawing Rail */}
        <DrawingToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
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
        />

        {/* Main Chart Canvas & Overlays Container */}
        <div
          className="relative min-h-0 flex-1 h-full overflow-hidden"
          onClick={(e) => {
            if (!isSelectingCutPoint || !chartApi || !box.current) return;
            const rect = box.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = chartApi.timeScale().coordinateToTime(x);
            if (time) {
              const idx = candles.findIndex((c) => c.time >= (time as number));
              if (idx !== -1) {
                audioHaptics.tick();
                setReplayIndex(idx);
                setIsSelectingCutPoint(false);
              }
            }
          }}
        >
          {/* Institutional TradingView-Grade In-Chart Legend HUD */}
          <ChartLegendHUD
            symbol={symbol}
            timeframe={timeframe}
            currentOhlc={currentOhlc}
            indicators={activeIndicatorsList}
            onOpenSymbolSearch={() => setIsSymbolSearchOpen(true)}
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
          />

          {/* Candle-Close Countdown Floating Timer */}
          {chartSettings.showCountdownTimer && <CandleCountdown timeframe={timeframe} />}

          {/* Lightweight Charts mounting container */}
          <div
            ref={box}
            className="absolute inset-0 z-10"
            onDoubleClick={() => {
              audioHaptics.tick();
              api.current?.candles.priceScale().applyOptions({ autoScale: true });
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

          {/* TradingView-Style SVG Drawing Tools Canvas Layer */}
          <DrawingOverlay
            symbol={symbol}
            activeTool={activeTool}
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
            onExecuteOrders={handleExecuteCanvasOrders}
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

          {/* Loading overlay */}
          {!candles.length && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-6 text-center">
              {error
                ? <p className="max-w-sm text-down">{error}</p>
                : <p className="text-muted">Loading {labelOf(symbol)}...</p>}
            </div>
          )}
        </div>
      </div>

      {/* TradingView Bottom Range & Scale Bar */}
      <div className="h-8 shrink-0 border-t border-grid bg-panel px-3 flex items-center justify-between text-[11px] text-slate-300 select-none font-mono shadow-clay-card">
        {/* Left: Time Range Presets */}
        <div className="flex items-center gap-1.5">
          {(['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleSelectTimeRange(r)}
              className="px-2 py-0.5 rounded-full clay-btn text-[10px] font-semibold transition"
            >
              {r}
            </button>
          ))}
        </div>

        {/* Right: Scale & Timezone */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <button
            onClick={() => {
              audioHaptics.tick();
              const tzs: ChartTimezone[] = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
              const nextTz = tzs[(tzs.indexOf(timezone) + 1) % tzs.length];
              setTimezone(nextTz);
            }}
            className="px-2 py-0.5 rounded-full clay-btn font-mono text-slate-300 hover:text-white transition"
            title={`Timezone: ${timezone} (Click to toggle)`}
          >
            {timezone === 'UTC' ? 'UTC' : timezone === 'Asia/Kolkata' ? 'IST' : timezone === 'America/New_York' ? 'EDT' : timezone === 'Europe/London' ? 'GMT' : 'JST'}
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              api.current?.candles.priceScale().applyOptions({ autoScale: true });
            }}
            className="px-2 py-0.5 rounded-full clay-pill-active text-[10px] font-bold transition"
            title="Auto scale (or double-click price scale)"
          >
            auto
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              handleSetScaleMode('NORMAL');
            }}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
              scaleMode === 'NORMAL' ? 'clay-pill-active' : 'clay-pill'
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
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
              scaleMode === 'LOGARITHMIC' ? 'clay-pill-active' : 'clay-pill'
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
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
              scaleMode === 'PERCENTAGE' ? 'clay-pill-active' : 'clay-pill'
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

      {/* Chart Settings Modal */}
      <ChartSettingsModal
        isOpen={isChartSettingsOpen}
        onClose={() => setIsChartSettingsOpen(false)}
        settings={chartSettings}
        onUpdateSettings={updateChartSettings}
        onResetDefaults={resetChartSettings}
      />

      {/* Skins Customization Modal */}
      <ChartSkinsModal isOpen={showSkinsModal} onClose={() => setShowSkinsModal(false)} />

      {/* Share Chart Snapshot Modal */}
      <ShareChartModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />

      {/* Institutional Symbol Search Modal */}
      <SymbolSearchModal
        isOpen={isSymbolSearchOpen}
        onClose={() => setIsSymbolSearchOpen(false)}
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
          addAlert(symbol, price, 'PRICE');
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
          }
        }}
        onOpenRuler={() => setIsRulerActive(true)}
        onOpenIndicators={() => setIsIndicatorsModalOpen(true)}
        onOpenSettings={() => setIsChartSettingsOpen(true)}
        onClearDrawings={() => setClearDrawingTrigger(Date.now())}
      />
    </div>
  );
}
