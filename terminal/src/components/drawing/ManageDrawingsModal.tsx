/**
 * TradingView-Style Object Tree & Manage Drawings Modal.
 * Allows traders to inspect drawn data points, select/choose drawings,
 * toggle visibility and locks, delete in bulk, and export/import drawn JSON.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import type { DrawingItem } from './types';
import { audioHaptics } from '../../utils/notify';
import { useDrawingStore } from '../../store/useDrawingStore';
import { drawingEvents } from './framework/DrawingEvents';

interface ManageDrawingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
}

export default function ManageDrawingsModal({
  isOpen,
  onClose,
  symbol,
}: ManageDrawingsModalProps) {
  const selectedDrawingIds = useDrawingStore((s) => s.selectedDrawingIds);
  const setSelectedDrawingIds = useDrawingStore((s) => s.setSelectedDrawingIds);
  const toggleSelectDrawingId = useDrawingStore((s) => s.toggleSelectDrawingId);

  const [search, setSearch] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedJson, setExportedJson] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Read drawings from localStorage for this symbol
  const [drawings, setDrawings] = useState<DrawingItem[]>(() => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Keep drawings synced if opened
  const refreshDrawings = () => {
    try {
      const stored = localStorage.getItem(`crt_drawings_${symbol}`);
      setDrawings(stored ? JSON.parse(stored) : []);
    } catch {
      setDrawings([]);
    }
  };

  const persistDrawings = (next: DrawingItem[]) => {
    setDrawings(next);
    try {
      localStorage.setItem(`crt_drawings_${symbol}`, JSON.stringify(next));
    } catch {}
    useDrawingStore.getState().setActiveSymbolDrawings(next);
    drawingEvents.emitReloadDrawings(next);
    window.dispatchEvent(new CustomEvent('crt_drawings_updated', { detail: { symbol, drawings: next } }));
  };

  const filteredDrawings = useMemo(() => {
    if (!search.trim()) return drawings;
    const q = search.toLowerCase();
    return drawings.filter(
      (d) =>
        d.type.toLowerCase().includes(q) ||
        (d.text && d.text.toLowerCase().includes(q)) ||
        d.id.toLowerCase().includes(q)
    );
  }, [drawings, search]);

  if (!isOpen) return null;

  const handleToggleSelectAll = () => {
    audioHaptics.tick();
    if (selectedDrawingIds.length === filteredDrawings.length) {
      setSelectedDrawingIds([]);
    } else {
      setSelectedDrawingIds(filteredDrawings.map((d) => d.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedDrawingIds.length === 0) return;
    audioHaptics.tick();
    const next = drawings.filter((d) => !selectedDrawingIds.includes(d.id));
    persistDrawings(next);
    setSelectedDrawingIds([]);
  };

  const handleToggleLockItem = (id: string) => {
    audioHaptics.tick();
    const next = drawings.map((d) => (d.id === id ? { ...d, locked: !d.locked } : d));
    persistDrawings(next);
  };

  const handleToggleHideItem = (id: string) => {
    audioHaptics.tick();
    const next = drawings.map((d) => (d.id === id ? { ...d, hidden: !d.hidden } : d));
    persistDrawings(next);
  };

  const handleDeleteSingle = (id: string) => {
    audioHaptics.tick();
    const next = drawings.filter((d) => d.id !== id);
    persistDrawings(next);
    setSelectedDrawingIds(selectedDrawingIds.filter((selId) => selId !== id));
  };

  const handleOpenExport = () => {
    audioHaptics.tick();
    setExportedJson(JSON.stringify(drawings, null, 2));
    setShowExportModal(true);
  };

  const handleApplyImport = () => {
    try {
      setImportError(null);
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('Import data must be a JSON array of drawings.');
      }
      audioHaptics.tick();
      persistDrawings(parsed);
      setImportJsonText('');
      setShowExportModal(false);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono select-none">
      <div className="clay-modal flex h-[580px] w-full max-w-2xl flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid/50 px-5 py-3.5 bg-panel/90">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <h2 className="text-sm font-bold text-white tracking-wide">Object Tree & Drawings Inspector</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-[#1e2029] text-[#38bdf8] border border-[#2e3245]">
              {symbol} ({drawings.length})
            </span>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="clay-btn h-7 w-7 text-muted hover:text-white"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="flex items-center justify-between gap-3 border-b border-grid/50 p-3 bg-panel/50 text-xs">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter drawings by tool type or note..."
              className="w-full rounded bg-[#0b0c10] border border-grid px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38bdf8]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1.5 rounded clay-btn text-xs text-slate-300 hover:text-white transition"
            >
              {selectedDrawingIds.length === filteredDrawings.length && filteredDrawings.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </button>
            {selectedDrawingIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-2.5 py-1.5 rounded bg-rose-950/40 border border-rose-800/60 text-xs text-rose-400 hover:text-rose-200 transition"
              >
                Delete Selected ({selectedDrawingIds.length})
              </button>
            )}
            <button
              onClick={handleOpenExport}
              className="px-2.5 py-1.5 rounded clay-pill text-xs hover:text-white transition"
              title="Export or Import drawn data JSON"
            >
              Data JSON
            </button>
          </div>
        </div>

        {/* Drawings List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          {filteredDrawings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted">
              <p>No drawings found on {symbol}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Select any tool from the drawing toolbar to start charting
              </p>
            </div>
          ) : (
            filteredDrawings.map((d) => {
              const isSelected = selectedDrawingIds.includes(d.id);
              return (
                <div
                  key={d.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                    isSelected
                      ? 'bg-[#182030] border-[#38bdf8]/60 shadow-sm'
                      : 'bg-[#0f1015] border-grid/50 hover:bg-[#14151e]'
                  }`}
                >
                  {/* Left: Select Checkbox & Info */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        audioHaptics.tick();
                        toggleSelectDrawingId(d.id, true);
                      }}
                      className="rounded border-grid text-[#38bdf8] focus:ring-0 cursor-pointer"
                    />

                    {/* Color dot */}
                    <span
                      className="w-3 h-3 rounded-full border border-black/40 shrink-0"
                      style={{ backgroundColor: d.color || '#38bdf8' }}
                    />

                    {/* Tool details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {d.type.replace(/_/g, ' ')}
                        </span>
                        {d.text && (
                          <span className="text-[10px] text-slate-400 italic">
                            "{d.text}"
                          </span>
                        )}
                        {d.locked && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                            Locked
                          </span>
                        )}
                        {d.hidden && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 space-x-2 font-mono">
                        <span>P1: {d.p1.price?.toFixed(2) ?? 'N/A'}</span>
                        {d.p2?.price !== undefined && <span>P2: {d.p2.price.toFixed(2)}</span>}
                        {d.p3?.price !== undefined && <span>P3: {d.p3.price.toFixed(2)}</span>}
                        {d.p1.time && (
                          <span>
                            Time: {new Date(Number(d.p1.time) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleLockItem(d.id)}
                      className={`p-1.5 rounded transition ${
                        d.locked ? 'text-amber-400 bg-amber-950/30' : 'text-slate-400 hover:text-white'
                      }`}
                      title={d.locked ? 'Unlock drawing' : 'Lock drawing'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleToggleHideItem(d.id)}
                      className={`p-1.5 rounded transition ${
                        d.hidden ? 'text-slate-500' : 'text-slate-400 hover:text-white'
                      }`}
                      title={d.hidden ? 'Show drawing' : 'Hide drawing'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDeleteSingle(d.id)}
                      className="p-1.5 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950/30 transition"
                      title="Delete drawing"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid/50 px-5 py-3 bg-panel/90 text-xs">
          <div className="text-muted">
            Total {drawings.length} drawings on chart
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="clay-pill-active px-5 py-1.5 font-bold"
          >
            Done
          </button>
        </div>
      </div>

      {/* Export / Import Modal Overlay */}
      {showExportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="clay-modal flex h-[480px] w-full max-w-lg flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-grid/50 px-5 py-3 bg-panel">
              <h3 className="text-sm font-bold text-white">Drawn Data JSON Export / Import</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="clay-btn h-6 w-6 text-muted hover:text-white"
              >
                x
              </button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Exported JSON (Copy to backup):
                </label>
                <textarea
                  readOnly
                  value={exportedJson}
                  className="w-full h-32 rounded bg-[#07070a] border border-grid p-2 font-mono text-[11px] text-slate-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Import Drawn JSON:
                </label>
                <textarea
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Paste drawing JSON array here..."
                  className="w-full h-24 rounded bg-[#07070a] border border-grid p-2 font-mono text-[11px] text-white focus:outline-none focus:border-[#38bdf8]"
                />
                {importError && (
                  <p className="text-rose-400 text-[10px] mt-1">{importError}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-grid/50 px-5 py-3 bg-panel text-xs">
              <button
                onClick={() => setShowExportModal(false)}
                className="clay-btn px-4 py-1.5 text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyImport}
                disabled={!importJsonText.trim()}
                className="clay-pill-active px-4 py-1.5 font-bold disabled:opacity-40"
              >
                Apply Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
