/**
 * TradingView-Style Object Tree & Layers Panel.
 * Slideout inspector panel for all chart elements:
 * - Main Price Series (visibility, settings)
 * - Active Indicators (visibility, settings, remove)
 * - Symbol Drawings (visibility, lock, settings, delete, select)
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { drawingEvents } from '../drawing/framework/DrawingEvents';
import { audioHaptics } from '../../utils/notify';
import { labelOf } from '../../utils/formatters';

interface ObjectTreePanelProps {
  onClose?: () => void;
}

export default function ObjectTreePanel({ onClose }: ObjectTreePanelProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);

  // Indicators
  const activeInstances = useIndicatorsStore((s) => s.activeInstances);
  const toggleVisibility = useIndicatorsStore((s) => s.toggleVisibility);
  const removeInstance = useIndicatorsStore((s) => s.removeInstance);
  const openSettings = useIndicatorsStore((s) => s.openSettings);
  const clearAllInstances = useIndicatorsStore((s) => s.clearAllInstances);

  // Drawings
  const drawings = useDrawingStore((s) => s.activeSymbolDrawings);
  const selectedDrawingIds = useDrawingStore((s) => s.selectedDrawingIds);
  const toggleSelectDrawingId = useDrawingStore((s) => s.toggleSelectDrawingId);
  const isHiddenAll = useDrawingStore((s) => s.isHiddenAll);
  const toggleHideAll = useDrawingStore((s) => s.toggleHideAll);
  const isLockedAll = useDrawingStore((s) => s.isLockedAll);
  const toggleLockAll = useDrawingStore((s) => s.toggleLockAll);

  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
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

  const filteredIndicators = useMemo(() => {
    if (!search.trim()) return activeInstances;
    const q = search.toLowerCase();
    return activeInstances.filter(
      (i) => i.name.toLowerCase().includes(q) || i.indicatorId.toLowerCase().includes(q)
    );
  }, [activeInstances, search]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-panel text-slate-200 select-none font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-grid bg-panel/90">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span className="font-bold tracking-wider text-slate-100 text-[11px] uppercase">
            Object Tree & Layers
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={() => {
                audioHaptics.tick();
                onClose();
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Hide Side Pane"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Global Toolbar / Quick Search & Bulk Actions */}
      <div className="flex flex-col gap-2 p-2.5 border-b border-grid/60 bg-panel/50">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search layers or drawings..."
            className="w-full bg-[#0a0d14] border border-grid px-2.5 py-1 pl-7 rounded text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
          />
          <svg
            className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-[10px]"
            >
              x
            </button>
          )}
        </div>

        {/* Global toggles */}
        <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-0.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                audioHaptics.tick();
                toggleHideAll();
              }}
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isHiddenAll
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 font-semibold'
                  : 'border-grid hover:border-slate-500 text-slate-300 hover:text-white'
              }`}
              title="Hide or show all drawing objects"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                />
              </svg>
              <span>{isHiddenAll ? 'Unhide All' : 'Hide All'}</span>
            </button>

            <button
              onClick={() => {
                audioHaptics.tick();
                toggleLockAll();
              }}
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isLockedAll
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 font-semibold'
                  : 'border-grid hover:border-slate-500 text-slate-300 hover:text-white'
              }`}
              title="Lock or unlock all drawing objects"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>{isLockedAll ? 'Unlock All' : 'Lock All'}</span>
            </button>
          </div>

          {drawings.length > 0 && (
            <button
              onClick={() => {
                audioHaptics.tick();
                drawingEvents.clear();
              }}
              className="px-2 py-0.5 rounded border border-rose-900/40 hover:border-rose-500 text-rose-400 hover:text-rose-300 transition"
              title="Remove all drawings from symbol"
            >
              Clear Drawings
            </button>
          )}
        </div>
      </div>

      {/* Main Layers List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-2">
        {/* Section 1: Main Series */}
        <div className="rounded border border-grid/60 bg-[#0c0f17] overflow-hidden">
          <div
            onClick={() => toggleSection('series')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#141824] cursor-pointer hover:bg-[#1a2030] transition text-[11px] font-semibold text-slate-200"
          >
            <div className="flex items-center gap-1.5">
              <svg
                className={`h-3 w-3 transition-transform text-slate-400 ${
                  collapsedSections['series'] ? '-rotate-90' : 'rotate-0'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>Main Price Series</span>
            </div>
            <span className="text-[10px] text-slate-400">1</span>
          </div>

          {!collapsedSections['series'] && (
            <div className="p-2 flex items-center justify-between hover:bg-white/[0.02] transition text-[11px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-100">{labelOf(symbol)}</span>
                <span className="text-slate-500">({timeframe})</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  Candles
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Active Indicators */}
        <div className="rounded border border-grid/60 bg-[#0c0f17] overflow-hidden">
          <div
            onClick={() => toggleSection('indicators')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#141824] cursor-pointer hover:bg-[#1a2030] transition text-[11px] font-semibold text-slate-200"
          >
            <div className="flex items-center gap-1.5">
              <svg
                className={`h-3 w-3 transition-transform text-slate-400 ${
                  collapsedSections['indicators'] ? '-rotate-90' : 'rotate-0'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>Active Indicators</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">{activeInstances.length}</span>
              {activeInstances.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.tick();
                    clearAllInstances();
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 px-1 py-0.2 rounded hover:bg-rose-950/40"
                  title="Remove all indicators"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {!collapsedSections['indicators'] && (
            <div className="flex flex-col divide-y divide-grid/40">
              {filteredIndicators.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-[11px]">
                  No active indicators. Add indicators via the top toolbar fx button.
                </div>
              ) : (
                filteredIndicators.map((inst) => {
                  const primaryStyle = Object.values(inst.styles)[0];
                  const plotColor = primaryStyle?.color || '#38bdf8';

                  return (
                    <div
                      key={inst.instanceId}
                      className="flex items-center justify-between px-2.5 py-1.5 hover:bg-white/[0.03] transition group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: plotColor }}
                        />
                        <span className="font-semibold text-slate-200 truncate text-[11px]">
                          {inst.name}
                        </span>
                        <span className="text-[9.5px] text-slate-500 truncate">
                          {inst.overlay ? 'Overlay' : `Pane ${inst.paneIndex}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                        {/* Eye toggle */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            toggleVisibility(inst.instanceId);
                          }}
                          className={`p-1 rounded hover:bg-white/10 transition ${
                            inst.visible ? 'text-slate-300 hover:text-white' : 'text-slate-600'
                          }`}
                          title={inst.visible ? 'Hide indicator' : 'Show indicator'}
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {inst.visible ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                              />
                            )}
                          </svg>
                        </button>

                        {/* Settings button */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            openSettings(inst);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
                          title="Indicator settings"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        {/* Remove button */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            removeInstance(inst.instanceId);
                          }}
                          className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                          title="Remove indicator"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 3: Drawings on Symbol */}
        <div className="rounded border border-grid/60 bg-[#0c0f17] overflow-hidden">
          <div
            onClick={() => toggleSection('drawings')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#141824] cursor-pointer hover:bg-[#1a2030] transition text-[11px] font-semibold text-slate-200"
          >
            <div className="flex items-center gap-1.5">
              <svg
                className={`h-3 w-3 transition-transform text-slate-400 ${
                  collapsedSections['drawings'] ? '-rotate-90' : 'rotate-0'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>Symbol Drawings</span>
            </div>
            <span className="text-[10px] text-slate-400">{drawings.length}</span>
          </div>

          {!collapsedSections['drawings'] && (
            <div className="flex flex-col divide-y divide-grid/40">
              {filteredDrawings.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-[11px]">
                  No drawings on {labelOf(symbol)}. Select a drawing tool on the left rail to draw.
                </div>
              ) : (
                filteredDrawings.map((d) => {
                  const isSelected = selectedDrawingIds.includes(d.id);

                  return (
                    <div
                      key={d.id}
                      onClick={() => {
                        audioHaptics.tick();
                        toggleSelectDrawingId(d.id);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer transition group ${
                        isSelected
                          ? 'bg-[#38bdf8]/15 border-l-2 border-[#38bdf8]'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: d.color || '#38bdf8' }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-semibold text-[11px] truncate ${
                              isSelected ? 'text-[#38bdf8]' : 'text-slate-200'
                            }`}
                          >
                            {d.text ? d.text : d.type.replace(/_/g, ' ')}
                          </span>
                          {d.notes && (
                            <span className="text-[9.5px] text-slate-400 truncate max-w-[140px]">
                              Note: {d.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Eye toggle */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            drawingEvents.emitUpdateDrawing(d.id, { hidden: !d.hidden });
                          }}
                          className={`p-1 rounded hover:bg-white/10 transition ${
                            !d.hidden ? 'text-slate-300 hover:text-white' : 'text-slate-600'
                          }`}
                          title={d.hidden ? 'Show drawing' : 'Hide drawing'}
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {!d.hidden ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                              />
                            )}
                          </svg>
                        </button>

                        {/* Lock toggle */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            drawingEvents.emitUpdateDrawing(d.id, { locked: !d.locked });
                          }}
                          className={`p-1 rounded hover:bg-white/10 transition ${
                            d.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title={d.locked ? 'Unlock drawing' : 'Lock drawing'}
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </button>

                        {/* Settings gear */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            drawingEvents.emitOpenDrawingSettings(d);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
                          title="Drawing Settings"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => {
                            audioHaptics.tick();
                            drawingEvents.emitDeleteDrawing(d.id);
                          }}
                          className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                          title="Delete drawing"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
