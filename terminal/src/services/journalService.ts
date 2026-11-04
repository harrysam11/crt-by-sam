import { useJournalStore } from '../store/useJournalStore';
import type { JournalEntry } from '../types/psychology';

/**
 * Composite all visible HTML5 canvas layers inside the chart container
 * into a single base64 PNG data URL snapshot.
 */
export async function captureChartScreenshot(chartContainer: HTMLElement | null): Promise<string> {
  if (!chartContainer) return '';

  const canvases = chartContainer.querySelectorAll<HTMLCanvasElement>('canvas');
  if (!canvases.length) return '';

  const width = chartContainer.clientWidth || 800;
  const height = chartContainer.clientHeight || 450;

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return '';

  // Draw background fill
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, width, height);

  // Draw each chart canvas layer in DOM order
  canvases.forEach((c) => {
    try {
      ctx.drawImage(c, 0, 0, width, height);
    } catch {
      // Ignore cross-origin canvas security errors if any
    }
  });

  // Stamp timestamp watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '11px sans-serif';
  ctx.fillText(`CRT Terminal Snapshot • ${new Date().toLocaleString()}`, 12, height - 12);

  return offscreen.toDataURL('image/png', 0.85);
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
