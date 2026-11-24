import { useJournalStore } from '../store/useJournalStore';
import { usePsychologyStore } from '../store/usePsychologyStore';
import type { JournalEntry, TradingSessionTag } from '../types/psychology';

/**
 * Helper to render an SVG element into a 2D canvas context.
 */
function renderSvgToCanvas(
  ctx: CanvasRenderingContext2D,
  svgEl: SVGSVGElement,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;
      const origW = svgEl.clientWidth || w;
      const origH = svgEl.clientHeight || h;
      cloned.setAttribute('width', `${origW}`);
      cloned.setAttribute('height', `${origH}`);
      if (!cloned.getAttribute('viewBox')) {
        cloned.setAttribute('viewBox', `0 0 ${origW} ${origH}`);
      }
      const xml = new XMLSerializer().serializeToString(cloned);
      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, x, y, w, h);
        } catch {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    } catch {
      resolve();
    }
  });
}

/**
 * Helper to draw active ChartSkins MP4 video loop, GIF, or image wallpaper
 * onto the screenshot canvas with configured dark overlay tint before drawing series.
 */
function drawWallpaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  container: HTMLElement | null
) {
  try {
    const { themeConfig } = usePsychologyStore.getState();
    if (themeConfig && themeConfig.wallpaperType !== 'SOLID' && themeConfig.mediaUrl) {
      const skinsLayer = (container?.parentElement || document).querySelector(
        '#chart-skins-layer, [data-chart-skins-layer="true"]'
      );
      const mediaEl = skinsLayer?.querySelector('video, img') as HTMLVideoElement | HTMLImageElement | null;
      if (mediaEl) {
        ctx.save();
        ctx.drawImage(mediaEl, 0, 0, width, height);
        ctx.fillStyle = '#0b0e14';
        ctx.globalAlpha = themeConfig.overlayOpacity !== undefined ? Math.min(themeConfig.overlayOpacity, 0.6) : 0.5;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        return;
      }
    }
  } catch (err) {
    console.warn('Could not draw wallpaper background onto screenshot:', err);
  }
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, width, height);
}

/**
 * Composite all visible HTML5 canvas layers inside the chart container
 * into a single base64 PNG data URL snapshot.
 */
export async function captureChartScreenshot(
  chartContainer: HTMLElement | null,
  chartApi?: any
): Promise<string> {
  const api = chartApi || (typeof window !== 'undefined' ? (window as any).__chartApi : null);
  const container = chartContainer || (typeof window !== 'undefined' ? (window as any).__chartContainer : null);

  // Strategy 1: Use lightweight-charts native takeScreenshot() if available
  if (api && typeof api.takeScreenshot === 'function') {
    try {
      const baseCanvas = api.takeScreenshot() as HTMLCanvasElement;
      if (baseCanvas && baseCanvas.width > 0 && baseCanvas.height > 0) {
        const width = baseCanvas.width;
        const height = baseCanvas.height;

        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return baseCanvas.toDataURL('image/png', 0.95);

        // Draw active wallpaper (video, gif, image) or background color first
        drawWallpaperBackground(ctx, width, height, container);

        // Draw base chart (series, scales, grid, indicators)
        ctx.drawImage(baseCanvas, 0, 0);

        // Overlay ONLY user drawings SVG if present (never toolbar or button SVGs)
        if (container) {
          const drawingSvg = container.querySelector('svg[data-drawing-svg="true"]') as SVGSVGElement | null;
          if (drawingSvg && drawingSvg.querySelector('path, line, rect, circle, polygon, text')) {
            const containerRect = container.getBoundingClientRect();
            const svgRect = drawingSvg.getBoundingClientRect();
            const scaleX = width / (containerRect.width || width);
            const scaleY = height / (containerRect.height || height);
            const drawX = (svgRect.left - containerRect.left) * scaleX;
            const drawY = (svgRect.top - containerRect.top) * scaleY;
            const drawW = svgRect.width * scaleX;
            const drawH = svgRect.height * scaleY;
            await renderSvgToCanvas(ctx, drawingSvg, drawX, drawY, drawW, drawH);
          }
        }

        // Clean TradingView-style export (zero text watermark overlay)
        return offscreen.toDataURL('image/png', 0.95);
      }
    } catch (e) {
      console.warn('Native chart takeScreenshot failed, falling back to multi-canvas capture', e);
    }
  }

  // Strategy 2: Multi-canvas compositing with relative bounding-box positioning
  if (!container || !container.querySelectorAll) return '';
  const canvases = Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[];
  if (!canvases.length) return '';

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 450;

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return '';

  // Draw active wallpaper (video, gif, image) or background color first
  drawWallpaperBackground(ctx, width, height, container);

  const containerRect = container.getBoundingClientRect();

  // Draw each chart canvas layer using its relative bounding box to prevent stretching
  canvases.forEach((c: HTMLCanvasElement) => {
    try {
      const cRect = c.getBoundingClientRect();
      const x = cRect.left - containerRect.left;
      const y = cRect.top - containerRect.top;
      const w = cRect.width || width;
      const h = cRect.height || height;
      ctx.drawImage(c, x, y, w, h);
    } catch {
      // Ignore cross-origin canvas security errors if any
    }
  });

  // Overlay user drawing SVG if present
  const drawingSvg = container.querySelector('svg[data-drawing-svg="true"]') as SVGSVGElement | null;
  if (drawingSvg && drawingSvg.querySelector('path, line, rect, circle, polygon, text')) {
    const svgRect = drawingSvg.getBoundingClientRect();
    const drawX = svgRect.left - containerRect.left;
    const drawY = svgRect.top - containerRect.top;
    const drawW = svgRect.width;
    const drawH = svgRect.height;
    await renderSvgToCanvas(ctx, drawingSvg, drawX, drawY, drawW, drawH);
  }

  // Clean TradingView-style export (zero text watermark overlay)
  return offscreen.toDataURL('image/png', 0.95);
}

export const captureMultiCanvasSnapshot = captureChartScreenshot;

function getActiveSessionTag(now: Date = new Date()): TradingSessionTag {
  const utcHour = now.getUTCHours();
  if (utcHour >= 0 && utcHour < 7) return 'ASIA';
  if (utcHour >= 7 && utcHour < 12) return 'LONDON';
  if (utcHour >= 12 && utcHour < 16) return 'OVERLAP';
  if (utcHour >= 16 && utcHour < 21) return 'NY';
  return 'INTER_SESSION';
}

/**
 * Automatically capture a trade journal entry when an order executes or position closes.
 */
export async function logTradeToJournal(params: {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  qty?: number;
  pnl?: number;
  commission?: number;
  setup?: string;
  chartContainer?: HTMLElement | null;
  emotionTag?: JournalEntry['emotionTag'];
  notes?: string;
}): Promise<JournalEntry> {
  let chartDataUrl = '';
  if (params.chartContainer) {
    try {
      chartDataUrl = await captureChartScreenshot(params.chartContainer);
    } catch {
      chartDataUrl = '';
    }
  }

  const commission = params.commission ?? (params.qty && params.entryPrice ? +(params.qty * params.entryPrice * 0.0003).toFixed(2) : 2.50);
  const pnl = params.pnl;
  const netPnl = pnl !== undefined ? +(pnl - commission).toFixed(2) : undefined;
  const session = getActiveSessionTag();

  const entry = useJournalStore.getState().addEntry({
    tradeId: params.tradeId,
    timestamp: Date.now(),
    symbol: params.symbol,
    side: params.side,
    entryPrice: params.entryPrice,
    exitPrice: params.exitPrice,
    qty: params.qty,
    pnl: params.pnl,
    commission,
    netPnl,
    session,
    setup: params.setup ?? 'TREND_PULLBACK',
    checklist: {
      followedPlan: true,
      validRR: true,
      confluenceChecked: true,
      noNewsConflict: true,
      riskCalculated: true,
    },
    chartDataUrl,
    emotionTag: params.emotionTag ?? 'PLANNED',
    notes: params.notes ?? `Auto-logged execution for ${params.symbol} at ${params.entryPrice}`,
  });

  return entry;
}
