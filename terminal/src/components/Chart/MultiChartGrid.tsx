/**
 * TradingView-Style Multi-Chart Grid System.
 * Supports:
 * - 1x1: Single full chart
 * - 1x2: Dual vertical split (side-by-side)
 * - 2x1: Dual horizontal split (stacked)
 * - 2x2: Quad 4-chart layout
 * Synchronized symbol, timeframe, crosshair, and visible range options.
 * Saved layouts and templates management.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useRef, useEffect } from 'react';
import TradingChart from './TradingChart';
import { audioHaptics } from '../../utils/notify';
import { useLayoutStore, type ChartGridLayout } from '../../store/useLayoutStore';
import { useTerminalStore } from '../../store/useTerminalStore';

export default function MultiChartGrid() {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const activePaneId = useLayoutStore((s) => s.activePaneId);
  const setActivePaneId = useLayoutStore((s) => s.setActivePaneId);
  const panes = useLayoutStore((s) => s.panes);
  const syncSymbol = useLayoutStore((s) => s.syncSymbol);
  const syncTimeframe = useLayoutStore((s) => s.syncTimeframe);
  const syncCrosshair = useLayoutStore((s) => s.syncCrosshair);
  const syncRange = useLayoutStore((s) => s.syncRange);
  const toggleSync = useLayoutStore((s) => s.toggleSync);
  const savedLayouts = useLayoutStore((s) => s.savedLayouts);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const saveCurrentLayout = useLayoutStore((s) => s.saveCurrentLayout);
  const loadLayout = useLayoutStore((s) => s.loadLayout);
  const deleteLayout = useLayoutStore((s) => s.deleteLayout);
  const isChartMaximized = useLayoutStore((s) => s.isChartMaximized);
  const toggleChartMaximized = useLayoutStore((s) => s.toggleChartMaximized);

  const globalSymbol = useTerminalStore((s) => s.symbol);
  const globalTimeframe = useTerminalStore((s) => s.timeframe);

  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(target)) {
        setIsLayoutMenuOpen(false);
      }
      if (templateMenuRef.current && !templateMenuRef.current.contains(target)) {
        setIsTemplateMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveLayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLayoutName.trim()) return;
    audioHaptics.tick();
    saveCurrentLayout(newLayoutName.trim());
    setNewLayoutName('');
    setIsSavingLayout(false);
  };

  const currentTemplateName =
    savedLayouts.find((l) => l.id === activeLayoutId)?.name || 'Custom Layout';

  // Pane configurations with fallbacks
  const p1 = panes['pane-1'] || { paneId: 'pane-1', symbol: globalSymbol, timeframe: globalTimeframe };
  const p2 = panes['pane-2'] || { paneId: 'pane-2', symbol: globalSymbol, timeframe: '1h' };
  const p3 = panes['pane-3'] || { paneId: 'pane-3', symbol: globalSymbol, timeframe: '4h' };
  const p4 = panes['pane-4'] || { paneId: 'pane-4', symbol: globalSymbol, timeframe: '1d' };

  return (
    <div className={`relative flex h-full w-full flex-col overflow-hidden bg-bg ${isChartMaximized ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Floating Multi-Chart Layout & Sync Controller Toolbar */}
      <div className="absolute right-3 top-2 z-30 flex items-center gap-1.5 font-mono text-xs select-none">
        {/* Sync Toggles Cluster */}
        <div className="flex items-center gap-1 clay-card px-2 py-0.5 bg-[#09090d]/80 backdrop-blur-md">
          {/* Symbol Sync */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleSync('syncSymbol');
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold transition flex items-center gap-1 ${
              syncSymbol ? 'clay-pill-active' : 'clay-pill text-muted hover:text-white'
            }`}
            title="Sync Symbol across all charts"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Sym</span>
          </button>

          {/* Timeframe Sync */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleSync('syncTimeframe');
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold transition flex items-center gap-1 ${
              syncTimeframe ? 'clay-pill-active' : 'clay-pill text-muted hover:text-white'
            }`}
            title="Sync Interval / Timeframe across all charts"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Int</span>
          </button>

          {/* Crosshair Sync */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleSync('syncCrosshair');
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold transition flex items-center gap-1 ${
              syncCrosshair ? 'clay-pill-active' : 'clay-pill text-muted hover:text-white'
            }`}
            title="Sync Crosshair time cursor across all charts"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-6-6h12" />
            </svg>
            <span>Cross</span>
          </button>

          {/* Range Sync (Pan/Zoom) */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleSync('syncRange');
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold transition flex items-center gap-1 ${
              syncRange ? 'clay-pill-active' : 'clay-pill text-muted hover:text-white'
            }`}
            title="Sync Visible Range / Zoom across all charts"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Range</span>
          </button>
        </div>

        {/* Saved Layouts & Templates Dropdown */}
        <div className="relative" ref={templateMenuRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsTemplateMenuOpen((v) => !v);
              setIsLayoutMenuOpen(false);
            }}
            className="flex items-center gap-1.5 clay-pill px-2.5 py-1 text-white hover:text-white transition text-[11px]"
            title="Layout Templates"
          >
            <span className="truncate max-w-[110px] font-bold text-white">{currentTemplateName}</span>
            <svg className="h-3 w-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isTemplateMenuOpen && (
            <div className="clay-popover absolute right-0 top-8 z-50 flex flex-col gap-1 p-2 min-w-[240px] max-h-[380px] overflow-y-auto">
              <div className="flex items-center justify-between px-2 py-1 border-b border-grid text-[10px] uppercase font-bold text-muted">
                <span>Layout Templates</span>
                <button
                  onClick={() => setIsSavingLayout(true)}
                  className="clay-pill px-2 py-0.5 text-[9px] text-white hover:text-white"
                >
                  + Save New
                </button>
              </div>

              {isSavingLayout && (
                <form onSubmit={handleSaveLayoutSubmit} className="p-2 border-b border-grid flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    placeholder="Enter layout name..."
                    autoFocus
                    className="clay-inset px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none w-full"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsSavingLayout(false)}
                      className="clay-btn px-2 py-0.5 text-[10px] text-muted hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="clay-pill-active px-2.5 py-0.5 text-[10px]"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-col gap-0.5 mt-1">
                {savedLayouts.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition text-[11px] group ${
                      activeLayoutId === tmpl.id
                        ? 'clay-pill-active font-bold'
                        : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        loadLayout(tmpl.id);
                        setIsTemplateMenuOpen(false);
                      }}
                      className="flex-1 text-left truncate flex items-center gap-1.5"
                    >
                      <span className="font-semibold">{tmpl.name}</span>
                      <span className="text-[9px] text-muted font-normal">({tmpl.layout})</span>
                    </button>
                    {!tmpl.id.startsWith('tmpl-') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          audioHaptics.tick();
                          deleteLayout(tmpl.id);
                        }}
                        className="hidden group-hover:block text-muted hover:text-white px-1 text-[11px]"
                        title="Delete template"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Layout Grid Selector Button */}
        <div className="relative" ref={layoutMenuRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsLayoutMenuOpen((v) => !v);
              setIsTemplateMenuOpen(false);
            }}
            className="flex items-center gap-1.5 clay-pill px-2.5 py-1 text-white hover:text-white transition text-[11px]"
            title="Select Chart Grid Layout"
          >
            {/* Grid Layout SVG Icon */}
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {layout === '1x1' && (
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
              )}
              {layout === '1x2' && (
                <>
                  <rect x="3" y="3" width="8" height="18" rx="1.5" strokeWidth="2" />
                  <rect x="13" y="3" width="8" height="18" rx="1.5" strokeWidth="2" />
                </>
              )}
              {layout === '2x1' && (
                <>
                  <rect x="3" y="3" width="18" height="8" rx="1.5" strokeWidth="2" />
                  <rect x="3" y="13" width="18" height="8" rx="1.5" strokeWidth="2" />
                </>
              )}
              {layout === '2x2' && (
                <>
                  <rect x="3" y="3" width="8" height="8" rx="1" strokeWidth="2" />
                  <rect x="13" y="3" width="8" height="8" rx="1" strokeWidth="2" />
                  <rect x="3" y="13" width="8" height="8" rx="1" strokeWidth="2" />
                  <rect x="13" y="13" width="8" height="8" rx="1" strokeWidth="2" />
                </>
              )}
            </svg>
            <span className="font-bold text-white">{layout}</span>
          </button>

          {/* Layout Popover */}
          {isLayoutMenuOpen && (
            <div className="clay-popover absolute right-0 top-8 z-50 flex flex-col gap-1 p-2 min-w-[160px]">
              <span className="px-2 py-1 text-[10px] uppercase font-bold text-muted border-b border-grid">
                Chart Grid Layout
              </span>
              {[
                { id: '1x1', label: '1x1 Single', desc: 'Single Full Chart' },
                { id: '1x2', label: '1x2 Vertical', desc: 'Side-by-side Dual' },
                { id: '2x1', label: '2x1 Horizontal', desc: 'Top & Bottom Dual' },
                { id: '2x2', label: '2x2 Quad', desc: '4 Independent Panes' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setLayout(item.id as ChartGridLayout);
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 text-left transition text-[11px] rounded-lg ${
                    layout === item.id
                      ? 'clay-pill-active font-bold'
                      : 'hover:bg-white/10 text-muted hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {layout === item.id && <span className="text-[10px] font-bold">*</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart-Only Maximize Viewport Button */}
        <button
          onClick={() => {
            audioHaptics.tick();
            toggleChartMaximized();
          }}
          className={`clay-pill p-1.5 transition ${isChartMaximized ? 'clay-pill-active' : 'text-slate-300 hover:text-white'}`}
          title={isChartMaximized ? 'Exit Maximize Chart' : 'Maximize Chart View'}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isChartMaximized ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            )}
          </svg>
        </button>
      </div>

      {/* Grid Container with Active Pane Focus Rings */}
      <div className="flex-1 min-h-0 w-full h-full">
        {layout === '1x1' && (
          <div
            className={`h-full w-full relative ${activePaneId === 'pane-1' ? 'ring-1 ring-white/30' : ''}`}
            onClick={() => setActivePaneId('pane-1')}
          >
            <TradingChart
              paneId="pane-1"
              symbolOverride={p1.symbol}
              timeframeOverride={p1.timeframe}
            />
          </div>
        )}

        {layout === '1x2' && (
          <div className="grid h-full w-full grid-cols-2 divide-x divide-grid">
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-1' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-1')}
            >
              <TradingChart
                paneId="pane-1"
                symbolOverride={p1.symbol}
                timeframeOverride={p1.timeframe}
              />
            </div>
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-2' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-2')}
            >
              <TradingChart
                paneId="pane-2"
                symbolOverride={p2.symbol}
                timeframeOverride={p2.timeframe}
              />
            </div>
          </div>
        )}

        {layout === '2x1' && (
          <div className="grid h-full w-full grid-rows-2 divide-y divide-grid">
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-1' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-1')}
            >
              <TradingChart
                paneId="pane-1"
                symbolOverride={p1.symbol}
                timeframeOverride={p1.timeframe}
              />
            </div>
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-2' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-2')}
            >
              <TradingChart
                paneId="pane-2"
                symbolOverride={p2.symbol}
                timeframeOverride={p2.timeframe}
              />
            </div>
          </div>
        )}

        {layout === '2x2' && (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 divide-x divide-y divide-grid">
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-1' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-1')}
            >
              <TradingChart
                paneId="pane-1"
                symbolOverride={p1.symbol}
                timeframeOverride={p1.timeframe}
              />
            </div>
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-2' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-2')}
            >
              <TradingChart
                paneId="pane-2"
                symbolOverride={p2.symbol}
                timeframeOverride={p2.timeframe}
              />
            </div>
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-3' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-3')}
            >
              <TradingChart
                paneId="pane-3"
                symbolOverride={p3.symbol}
                timeframeOverride={p3.timeframe}
              />
            </div>
            <div
              className={`h-full min-h-0 relative ${activePaneId === 'pane-4' ? 'ring-1 ring-white/40 z-10' : ''}`}
              onClick={() => setActivePaneId('pane-4')}
            >
              <TradingChart
                paneId="pane-4"
                symbolOverride={p4.symbol}
                timeframeOverride={p4.timeframe}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
