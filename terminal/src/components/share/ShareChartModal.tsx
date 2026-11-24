import React, { useState, useEffect } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { captureMultiCanvasSnapshot } from '../../services/journalService';
import { fmtPrice, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

interface ShareChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartApi?: any;
  chartContainer?: HTMLElement | null;
}

export default function ShareChartModal({ isOpen, onClose, chartApi, chartContainer }: ShareChartModalProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const timeframe = useTerminalStore((s) => s.timeframe);

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const capture = async () => {
    setIsGenerating(true);
    const api = chartApi || (typeof window !== 'undefined' ? (window as any).__chartApi : null);
    const container = chartContainer || (typeof window !== 'undefined' ? (window as any).__chartContainer : null);
    try {
      const dataUrl = await captureMultiCanvasSnapshot(container, api);
      if (dataUrl) {
        setSnapshotUrl(dataUrl);
      }
    } catch (err) {
      console.warn('Snapshot capture error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSnapshotUrl(null);
      return;
    }

    capture();
  }, [isOpen, chartApi, chartContainer]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    audioHaptics.tick();
    const url = `${window.location.origin}${window.location.pathname}?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyToast('Share link copied to clipboard!');
    } catch {
      setCopyToast('Link copy failed');
    }
    setTimeout(() => setCopyToast(null), 2500);
  };

  const handleDownloadPng = () => {
    if (!snapshotUrl) return;
    audioHaptics.tick();
    const a = document.createElement('a');
    a.href = snapshotUrl;
    a.download = `${symbol}_${timeframe}_${Date.now()}.png`;
    a.click();
    setCopyToast('PNG image downloaded.');
    setTimeout(() => setCopyToast(null), 2500);
  };

  const handleCopyImage = async () => {
    if (!snapshotUrl) return;
    audioHaptics.tick();
    try {
      const res = await fetch(snapshotUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopyToast('Snapshot image copied to clipboard!');
    } catch {
      setCopyToast('Browser clipboard image copy blocked. Use Download PNG.');
    }
    setTimeout(() => setCopyToast(null), 2500);
  };

  const handleShareToX = async () => {
    audioHaptics.tick();
    if (snapshotUrl) {
      try {
        const res = await fetch(snapshotUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopyToast('Chart snapshot copied to clipboard! Paste into your X post (Ctrl+V).');
      } catch {}
    }

    const tweetText = `${labelOf(symbol)} (${timeframe}) at ${fmtPrice(currentPrice, symbol)}\nMarket analysis on @TerminalX`;
    const cleanSym = symbol.replace(/[^a-zA-Z0-9]/g, '');
    const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&hashtags=TerminalX,Orderflow,${cleanSym}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-[10px] border border-white/[0.08] bg-panel p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-white" />
            <h2 className="text-sm font-semibold text-white">
              Share Chart Snapshot & Link
            </h2>
            <span className="text-[10px] text-muted">
              {labelOf(symbol)} · {timeframe} · {fmtPrice(currentPrice, symbol)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white"
          >
            [ESC / Close]
          </button>
        </div>

        {/* Snapshot Preview Card with Watermark */}
        <div className="flex-1 overflow-y-auto min-h-0 py-4 flex flex-col items-center justify-center">
          <div className="relative w-full rounded-xl border border-grid bg-[#0b0e14] overflow-hidden shadow-2xl">
            {/* Watermark Banner */}
            <div className="flex items-center justify-between border-b border-grid bg-slate-900/80 px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-wider">TERMINALX</span>
                <span className="text-muted">|</span>
                <span className="text-white font-semibold">{labelOf(symbol)}</span>
                <span className="rounded bg-grid px-1.5 py-0.2 text-[10px] text-slate-300 font-mono">
                  {timeframe}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted font-mono text-[11px]">
                <span>{fmtPrice(currentPrice, symbol)}</span>
                <span>·</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Canvas Snapshot Image */}
            {isGenerating ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span>Rendering high-definition chart snapshot...</span>
              </div>
            ) : snapshotUrl ? (
              <img
                src={snapshotUrl}
                alt={`${symbol} Chart Snapshot`}
                className="w-full h-auto max-h-[380px] object-contain bg-black"
              />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted">
                <span>Chart container ready.</span>
                <button
                  onClick={capture}
                  className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-white transition"
                >
                  Capture Snapshot
                </button>
              </div>
            )}
          </div>

          {copyToast && (
            <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {copyToast}
            </div>
          )}
        </div>

        {/* Actions Toolbar */}
        <div className="border-t border-grid pt-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="rounded border border-grid px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-white transition"
          >
            Copy Chart URL Link
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareToX}
              className="rounded border border-white/20 bg-black hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5"
              title="Share chart directly to X.com (Twitter)"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Share to X</span>
            </button>
            <button
              onClick={handleCopyImage}
              disabled={!snapshotUrl}
              className="rounded border border-[#282826] bg-[#181817] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition disabled:opacity-40"
            >
              Copy Image
            </button>
            <button
              onClick={handleDownloadPng}
              disabled={!snapshotUrl}
              className="rounded bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-slate-200 transition disabled:opacity-40"
            >
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
