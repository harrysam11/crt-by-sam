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
import type { Candle } from '../../types/terminal';
import type { CanvasOrderLine } from '../../types/derivatives';
import type { ToolType } from '../drawing/types';
import ChartSkinsLayer from '../ChartSkinsLayer';
import ChartSkinsModal from '../ChartSkinsModal';
import GhostOverlay from '../ghost/GhostOverlay';
import CanvasOrderOverlay from '../canvas/CanvasOrderOverlay';
import CandleCountdown from './CandleCountdown';
import ChartRulerOverlay from './ChartRulerOverlay';
import StickyNotesOverlay from './StickyNotesOverlay';
import DrawingToolbar from '../drawing/DrawingToolbar';
import DrawingOverlay from '../drawing/DrawingOverlay';
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

export default function TradingChart() {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const timeframe = useTerminalStore((s) => s.timeframe);
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
  const [chartStyle, setChartStyle] = useState<'CANDLE' | 'HEIKIN_ASHI'>('CANDLE');
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

  // Drawing Tools State
  const [activeTool, setActiveTool] = useState<ToolType>('CURSOR_CROSSHAIR');
  const [drawingsCount, setDrawingsCount] = useState(0);
  const [clearDrawingTrigger, setClearDrawingTrigger] = useState(0);

  const box = useRef<HTMLDivElement>(null);
  const ohlc = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const live = useRef<LiveInd>({ closes: [], lastTime: 0, emaPrev: null, lastEma: null });
  const hovering = useRef(false);

  // Expose chart APIs to state for overlay layers (Ghost / Canvas drag & drop)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick'> | null>(null);

  // Primitive signature of everything drawn as a price line
  const lineKey = useTerminalStore((s) => {
    const p = s.positions[s.symbol];
    const o = s.orders.filter((x) => x.status === 'PENDING' && x.symbol === s.symbol).map((x) => `${x.type}:${x.side}:${x.triggerPrice ?? x.price}`).join('|');
    const a = s.alerts.filter((x) => !x.triggered && x.symbol === s.symbol).map((x) => x.price).join('|');
    return `${s.symbol}#${p ? `${p.side}:${p.entryPrice}:${p.size}` : ''}#${o}#${a}#${showSessionOHL}`;
  });

  const writeOhlc = (c?: { open: number; high: number; low: number; close: number; volume?: number }) => {
    const sym = useTerminalStore.getState().symbol;
    if (!ohlc.current) return;
    ohlc.current.textContent = c
      ? `O ${fmtPrice(c.open, sym)}  H ${fmtPrice(c.high, sym)}  L ${fmtPrice(c.low, sym)}  C ${fmtPrice(c.close, sym)}${c.volume ? `  V ${fmtQty(c.volume)}` : ''}`
      : '';
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

  // History load / symbol / timeframe switch.
  useEffect(() => {
    const a = api.current;
    if (!a || !candles.length) return;

    // Use standard or Heikin-Ashi transformed candles
    const displayCandles = chartStyle === 'HEIKIN_ASHI' ? heikinAshi(candles) : candles;
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
  }, [candles, symbol, chartStyle]);

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

        {/* Chart Style Switcher (Heikin-Ashi vs Candles) */}
        <button
          className={btn(chartStyle === 'HEIKIN_ASHI')}
          onClick={() => {
            audioHaptics.tick();
            setChartStyle(chartStyle === 'CANDLE' ? 'HEIKIN_ASHI' : 'CANDLE');
          }}
          title="Toggle Heikin-Ashi Smoothed Trend Candles"
        >
          {chartStyle === 'HEIKIN_ASHI' ? 'Heikin-Ashi' : 'Candles'}
        </button>

        <span className="mx-1 h-4 w-px bg-grid" />

        {/* Indicators Cluster */}
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
          Snapshot / Share
        </button>
      </div>

      {/* Main Chart Canvas & Overlays Container */}
      <div className="relative min-h-0 flex-1">
        <div ref={ohlc} className="num pointer-events-none absolute left-14 top-1 z-30 text-[11px] text-muted" />

        {/* TradingView-Style Left Vertical Drawing Toolbar */}
        <DrawingToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onClearAll={() => setClearDrawingTrigger(Date.now())}
          drawingsCount={drawingsCount}
        />

        {/* Candle-Close Countdown Floating Timer */}
        <CandleCountdown timeframe={timeframe} />

        {/* Lightweight Charts mounting container */}
        <div ref={box} className="absolute inset-0 z-10" />

        {/* Multi-Timeframe Ghost Charts Canvas Layer */}
        <GhostOverlay chartApi={chartApi} seriesApi={seriesApi} />

        {/* TradingView-Style SVG Drawing Tools Canvas Layer */}
        <DrawingOverlay
          symbol={symbol}
          activeTool={activeTool}
          seriesApi={seriesApi}
          chartApi={chartApi}
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

      {/* Skins Customization Modal */}
      <ChartSkinsModal isOpen={showSkinsModal} onClose={() => setShowSkinsModal(false)} />

      {/* Share Chart Snapshot Modal */}
      <ShareChartModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />
    </div>
  );
}
