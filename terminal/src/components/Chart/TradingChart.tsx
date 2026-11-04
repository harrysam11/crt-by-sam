import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type CandlestickData, type IChartApi, type IPriceLine, type ISeriesApi, type Time, type UTCTimestamp,
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
import type { Candle, Timeframe } from '../../types/terminal';
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
import IndicatorsModal from './IndicatorsModal';
import BarReplayController from './BarReplayController';
import ChartSettingsModal, { DEFAULT_CHART_SETTINGS, type ChartSettingsState } from './ChartSettingsModal';
import ShareChartModal from '../share/ShareChartModal';
import RiskHUD from '../RiskHUD';

const SMA_N = 20, EMA_N = 50, EMA_K = 2 / (EMA_N + 1);

const bar = (c: Candle) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });
const vol = (c: Candle) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(38,166,154,.4)' : 'rgba(239,83,80,.4)' });
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
  const [chartStyle, setChartStyle] = useState<'CANDLE' | 'HEIKIN_ASHI' | 'FOOTPRINT'>('CANDLE');
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
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick'> | null>(null);
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
    const upColor = isZen ? '#4a7c59' : '#26a69a';
    const downColor = isZen ? '#8b5d5d' : '#ef5350';

    const chart = createChart(box.current!, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: isCustomBg ? 'transparent' : '#0b0e14' },
        textColor: '#8b93a7',
        fontSize: 11,
      },
      grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e222d' },
      localization: { timeFormatter: localTime },
      timeScale: { borderColor: '#1e222d', timeVisible: true, secondsVisible: true, tickMarkFormatter: tickLabel },
    });

    const cs = chart.addCandlestickSeries({
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
    cs.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });

    const vs = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
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
        writeOhlc({ open: d.open, high: d.high, low: d.low, close: d.close, volume: v?.value });
      }
    });

    const onLive = (c: Candle) => {
      try {
        const st = live.current;
        cs.update(bar(c));
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
        if (!hovering.current) writeOhlc(c);
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

  // Update pastel candle palette when Zen Mode toggles
  useEffect(() => {
    if (!api.current) return;
    const isZen = zenMode.active && zenMode.softPastelCandles;
    const upColor = isZen ? '#4a7c59' : '#26a69a';
    const downColor = isZen ? '#8b5d5d' : '#ef5350';
    api.current.candles.applyOptions({
      upColor,
      downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
  }, [zenMode.active, zenMode.softPastelCandles]);

  // Dynamic Chart Settings synchronization
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.candles.applyOptions({
      upColor: chartSettings.candleUpColor,
      downColor: chartSettings.candleDownColor,
      borderUpColor: chartSettings.candleUpColor,
      borderDownColor: chartSettings.candleDownColor,
      wickUpColor: chartSettings.candleUpColor,
      wickDownColor: chartSettings.candleDownColor,
      lastValueVisible: chartSettings.showLastPriceLine,
      priceLineVisible: chartSettings.showLastPriceLine,
    });
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
    a.sma.applyOptions({ priceFormat });
    a.ema.applyOptions({ priceFormat });
    a.vwap.applyOptions({ priceFormat });
    a.bbUpper.applyOptions({ priceFormat });
    a.bbLower.applyOptions({ priceFormat });

    a.candles.setData(displayCandles.map(bar));
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
    writeOhlc(displayCandles[n - 1]);
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
    if (p) add(p.entryPrice, p.side === 'LONG' ? '#26a69a' : '#ef5350', `${p.side} ${fmtQty(p.size)}`, true);

    // Orders
    for (const o of s.orders) {
      if (o.status !== 'PENDING' || o.symbol !== s.symbol) continue;
      if (o.type === 'LIMIT') add(o.price, '#4c8dff', `${o.side} limit`);
      else add(o.triggerPrice ?? 0, o.type === 'STOP_LOSS' ? '#ef5350' : '#26a69a', o.type === 'STOP_LOSS' ? 'SL' : 'TP');
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
        add(sHigh, '#22c55e', 'Session High');
        add(sLow, '#f43f5e', 'Session Low');
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

  // Adjust candle opacity when Footprint cluster chart mode is active
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (chartStyle === 'FOOTPRINT') {
      a.candles.applyOptions({
        upColor: 'rgba(38, 166, 154, 0.12)',
        downColor: 'rgba(239, 83, 80, 0.12)',
        borderUpColor: 'rgba(38, 166, 154, 0.25)',
        borderDownColor: 'rgba(239, 83, 80, 0.25)',
        wickUpColor: 'rgba(38, 166, 154, 0.25)',
        wickDownColor: 'rgba(239, 83, 80, 0.25)',
      });
    } else {
      a.candles.applyOptions({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
    }
  }, [chartStyle]);

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

  const btn = (on: boolean) => `rounded px-2 py-1 text-xs transition ${on ? 'bg-grid text-white font-semibold' : 'text-muted hover:text-white'}`;

  return (
    <div className="relative flex h-full flex-col bg-bg overflow-hidden select-none font-mono">
      {/* ChartSkins Background Layer (Video / Wallpaper / GIF) */}
      <ChartSkinsLayer />

      {/* Chart Toolbar */}
      <div className="relative z-10 flex items-center gap-1 overflow-x-auto border-b border-grid bg-panel/70 px-2 py-1 backdrop-blur-sm">
        <span className="mr-2 whitespace-nowrap font-semibold text-white">{labelOf(symbol)}</span>
        {TIMEFRAMES[provider].map((t) => (
          <button
            key={t}
            className={btn(t === timeframe)}
            onClick={() => {
              audioHaptics.tick();
              setTimeframe(t);
            }}
          >
            {t}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-grid" />

        {/* Chart Style Switcher (Candles, Heikin-Ashi, Footprint) */}
        <div className="flex items-center rounded border border-grid bg-slate-900/60 p-0.5 text-xs">
          {(['CANDLE', 'HEIKIN_ASHI', 'FOOTPRINT'] as const).map((style) => (
            <button
              key={style}
              className={`rounded px-2 py-0.5 transition ${
                chartStyle === style
                  ? 'bg-accent/20 border border-accent text-accent font-semibold'
                  : 'text-muted hover:text-white'
              }`}
              onClick={() => {
                audioHaptics.tick();
                setChartStyle(style);
              }}
              title={
                style === 'CANDLE'
                  ? 'Standard Candlestick Mode'
                  : style === 'HEIKIN_ASHI'
                  ? 'Heikin-Ashi Smoothed Trend Mode'
                  : 'Institutional Bid x Ask Footprint Cluster Mode'
              }
            >
              {style === 'CANDLE' ? 'Candles' : style === 'HEIKIN_ASHI' ? 'Heikin-Ashi' : 'Footprint'}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-grid" />

        {/* fx Indicators Button */}
        <button
          onClick={() => {
            audioHaptics.tick();
            setIsIndicatorsModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded border border-grid bg-slate-900/60 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-accent hover:text-white transition"
          title="Indicators, Metrics & Strategies (fx)"
        >
          <span className="font-bold text-accent">fx</span>
          <span>Indicators</span>
        </button>

        {/* Indicators Cluster Quick Toggles */}
        <button className={btn(showSma)} onClick={() => setShowSma((v) => !v)}>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f0b90b]" />SMA
        </button>
        <button className={btn(showEma)} onClick={() => setShowEma((v) => !v)}>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#4c8dff]" />EMA
        </button>
        <button className={btn(showVwap)} onClick={() => setShowVwap((v) => !v)}>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ec4899]" />VWAP
        </button>
        <button className={btn(showBbands)} onClick={() => setShowBbands((v) => !v)} title="Bollinger Bands (20, 2)">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />BB
        </button>
        <button className={btn(showRsi)} onClick={() => setShowRsi((v) => !v)} title="RSI (14) Oscillator">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-400" />RSI
        </button>
        <button className={btn(showOI)} onClick={() => setShowOI((v) => !v)} title="Toggle Open Interest (OI) Sub-pane">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400" />OI
        </button>

        <span className="mx-1 h-4 w-px bg-grid" />

        {/* Bar Replay Historical Time Machine Trigger */}
        <button
          onClick={() => {
            if (isReplayActive) exitReplay();
            else startReplay();
          }}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold transition ${
            isReplayActive
              ? 'bg-accent text-black font-bold ring-1 ring-accent'
              : 'text-muted hover:text-white'
          }`}
          title="Bar Replay Historical Time Machine (Space: Play/Pause, Shift+Right: Step)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
          <span>Replay</span>
        </button>

        <span className="mx-1 h-4 w-px bg-grid" />

        {/* Session OHL Lines Toggle */}
        <button
          className={btn(showSessionOHL)}
          onClick={() => {
            audioHaptics.tick();
            setShowSessionOHL((v) => !v);
          }}
          title="Toggle Daily Open, High, Low Laser Lines"
        >
          OHL
        </button>

        {/* Ruler Measurement Tool Toggle */}
        <button
          className={btn(isRulerActive)}
          onClick={() => {
            audioHaptics.tick();
            setIsRulerActive((v) => !v);
          }}
          title="Interactive Distance, Ticks & % Ruler Tool"
        >
          Ruler
        </button>

        {/* Sticky Candle Quick-Notes */}
        <button
          className={btn(isNotesOpen)}
          onClick={() => {
            audioHaptics.tick();
            setIsNotesOpen((v) => !v);
          }}
          title="Pin Sticky Notes to Candle Action"
        >
          Notes
        </button>

        {/* Ghost Overlay Toggle */}
        <button
          className={btn(isGhostVisible)}
          onClick={() => {
            audioHaptics.tick();
            toggleGhost();
          }}
          title="Toggle Multi-Timeframe Ghost Chart Overlay"
        >
          Ghost HTF
        </button>

        {/* Drag-and-Drop Canvas Order Lines */}
        <button
          className={btn(canvasOrderLines.length > 0)}
          onClick={() => {
            audioHaptics.tick();
            if (canvasOrderLines.length > 0) clearCanvasOrderLines();
            else initCanvasOrderLines(currentPrice, 'BUY', 0.1);
          }}
          title="Interactive Drag-and-Drop Order Lines on Canvas"
        >
          Order Lines
        </button>

        {/* Risk-Bot 1-Click Sizing HUD */}
        <button
          className={btn(showRiskHUD)}
          onClick={() => {
            audioHaptics.tick();
            setShowRiskHUD((v) => !v);
          }}
          title="Open 1-Click Position Sizing HUD"
        >
          Risk HUD
        </button>

        {/* ChartSkins Theme Picker */}
        <button
          className={btn(themeConfig.wallpaperType !== 'SOLID')}
          onClick={() => {
            audioHaptics.tick();
            setShowSkinsModal(true);
          }}
          title="Configure Chart Wallpaper & Video Loops"
        >
          Skins
        </button>

        {/* Share Chart Snapshot Modal Trigger */}
        <button
          onClick={() => {
            audioHaptics.tick();
            setIsShareModalOpen(true);
          }}
          className="rounded border border-accent/60 bg-accent/15 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-black transition"
          title="Export Watermarked Snapshot or Copy Chart Link"
        >
          Snapshot
        </button>

        {/* Chart Settings Gear Icon */}
        <button
          onClick={() => {
            audioHaptics.tick();
            setIsChartSettingsOpen(true);
          }}
          className="p-1 rounded text-muted hover:text-white hover:bg-slate-800 transition"
          title="Chart Settings"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
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
          <div ref={ohlc} className="num pointer-events-none absolute left-4 top-1 z-30 text-[11px] text-muted" />

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
          <div ref={box} className="absolute inset-0 z-10" />

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
      <div className="h-7 shrink-0 border-t border-grid bg-panel/90 px-3 flex items-center justify-between text-[11px] text-slate-400 select-none font-mono">
        {/* Left: Time Range Presets */}
        <div className="flex items-center gap-1">
          {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'].map((r) => (
            <button
              key={r}
              onClick={() => {
                audioHaptics.tick();
                api.current?.chart.timeScale().fitContent();
              }}
              className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition text-[10px]"
            >
              {r}
            </button>
          ))}
        </div>

        {/* Right: Scale & Timezone */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="font-mono text-slate-400">UTC</span>
          <button
            onClick={() => {
              audioHaptics.tick();
              api.current?.chart.timeScale().resetTimeScale();
            }}
            className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 font-bold"
            title="Auto scale"
          >
            auto
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
            }}
            className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 font-bold"
            title="Logarithmic scale"
          >
            log
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
    </div>
  );
}
