import { useJournalStore } from '../store/useJournalStore';
import type { JournalEntry } from '../types/psychology';

/**
 * Helper to render an SVG element into a 2D canvas context.
 */
function renderSvgToCanvas(
  ctx: CanvasRenderingContext2D,
  svgEl: SVGSVGElement,
  width: number,
  height: number
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;
      cloned.setAttribute('width', `${width}`);
      cloned.setAttribute('height', `${height}`);
      if (!cloned.getAttribute('viewBox')) {
        cloned.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
      const xml = new XMLSerializer().serializeToString(cloned);
      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, width, height);
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

        // Draw base chart (series, scales, grid, indicators)
        ctx.drawImage(baseCanvas, 0, 0);

        // Overlay SVG drawings if present
        const parentEl = container?.parentElement || container;
        if (parentEl && parentEl.querySelectorAll) {
          const svgs = Array.from(parentEl.querySelectorAll('svg')) as SVGSVGElement[];
          for (let i = 0; i < svgs.length; i++) {
            const svg = svgs[i];
            if (svg.querySelector('path, line, rect, circle, polygon, text')) {
              await renderSvgToCanvas(ctx, svg, width, height);
            }
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

  // Draw background fill
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, width, height);

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

  // Clean TradingView-style export (zero text watermark overlay)
  return offscreen.toDataURL('image/png', 0.95);
}

export const captureMultiCanvasSnapshot = captureChartScreenshot;

/**
 * Automatically capture a trade journal entry when an order executes or position closes.
 */
export async function logTradeToJournal(params: {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
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

  const entry = useJournalStore.getState().addEntry({
    tradeId: params.tradeId,
    timestamp: Date.now(),
    symbol: params.symbol,
    side: params.side,
    entryPrice: params.entryPrice,
    exitPrice: params.exitPrice,
    pnl: params.pnl,
    chartDataUrl,
    emotionTag: params.emotionTag ?? 'PLANNED',
    notes: params.notes ?? `Auto-logged execution for ${params.symbol} at ${params.entryPrice}`,
  });

  return entry;
}
