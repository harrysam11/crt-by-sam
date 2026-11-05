/**
 * TradingView-Style Expandable Vector Drawing Toolbar.
 * Provides flyout tool drawers, Magnet Snapping mode, and quick utility toggles.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import type { ToolType, MagnetConfig } from './types';
import { audioHaptics } from '../../utils/notify';

interface DrawingToolbarProps {
  activeTool: ToolType;
  onSelectTool: (t: ToolType) => void;
  onClearAll: () => void;
  drawingsCount: number;
  magnetConfig: MagnetConfig;
  onToggleMagnet: () => void;
  isLockedAll: boolean;
  onToggleLockAll: () => void;
  isHiddenAll: boolean;
  onToggleHideAll: () => void;
}

export default function DrawingToolbar({
  activeTool,
  onSelectTool,
  onClearAll,
  drawingsCount,
  magnetConfig,
  onToggleMagnet,
  isLockedAll,
  onToggleLockAll,
  isHiddenAll,
  onToggleHideAll,
}: DrawingToolbarProps) {
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);

  const select = (t: ToolType) => {
    audioHaptics.tick();
    onSelectTool(t);
    setOpenDrawer(null);
  };

  const isCurrentInGroup = (tools: ToolType[]) => tools.includes(activeTool);

  const btnCls = (isActive: boolean) =>
    `p-2 rounded-lg flex items-center justify-center transition relative group ${
      isActive
        ? 'bg-accent text-black font-bold shadow-md ring-1 ring-accent'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
    }`;

  return (
    <div className="relative z-30 flex w-11 shrink-0 flex-col items-center gap-1 border-r border-grid bg-panel/95 py-2 backdrop-blur-md select-none font-mono text-xs">
      {/* Drawer 1: Cursors */}
      <div className="relative">
        <button
          onClick={() => setOpenDrawer(openDrawer === 'CURSOR' ? null : 'CURSOR')}
          className={btnCls(isCurrentInGroup(['CURSOR_CROSSHAIR', 'CURSOR_ARROW', 'CURSOR_DOT', 'CURSOR_ERASER']))}
          title="Cursors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {openDrawer === 'CURSOR' && (
          <div className="absolute left-11 top-0 z-40 flex flex-col gap-1 rounded-lg border border-grid bg-panel p-1.5 shadow-2xl min-w-[130px]">
            <button
              onClick={() => select('CURSOR_CROSSHAIR')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'CURSOR_CROSSHAIR' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Crosshair
            </button>
            <button
              onClick={() => select('CURSOR_ARROW')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'CURSOR_ARROW' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Arrow
            </button>
            <button
              onClick={() => select('CURSOR_DOT')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'CURSOR_DOT' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Dot
            </button>
            <button
              onClick={() => select('CURSOR_ERASER')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'CURSOR_ERASER' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Eraser
            </button>
          </div>
        )}
      </div>

      {/* Drawer 2: Trendlines & Channels */}
      <div className="relative">
        <button
          onClick={() => setOpenDrawer(openDrawer === 'LINES' ? null : 'LINES')}
          className={btnCls(isCurrentInGroup(['TRENDLINE', 'RAY', 'HORIZONTAL_LINE', 'HORIZONTAL_RAY', 'VERTICAL_LINE', 'PARALLEL_CHANNEL']))}
          title="Lines & Channels"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5M5 19a2 2 0 100-4 2 2 0 000 4zM19 5a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>

        {openDrawer === 'LINES' && (
          <div className="absolute left-11 top-0 z-40 flex flex-col gap-1 rounded-lg border border-grid bg-panel p-1.5 shadow-2xl min-w-[170px]">
            <button
              onClick={() => select('TRENDLINE')}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left ${activeTool === 'TRENDLINE' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span>Trend Line</span>
              <kbd className="text-[10px] text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-grid">Alt+T</kbd>
            </button>
            <button
              onClick={() => select('RAY')}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left ${activeTool === 'RAY' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span>Ray</span>
            </button>
            <button
              onClick={() => select('HORIZONTAL_LINE')}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left ${activeTool === 'HORIZONTAL_LINE' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span>Horizontal Line</span>
              <kbd className="text-[10px] text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-grid">Alt+H</kbd>
            </button>
            <button
              onClick={() => select('HORIZONTAL_RAY')}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left ${activeTool === 'HORIZONTAL_RAY' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span>Horizontal Ray</span>
            </button>
            <button
              onClick={() => select('VERTICAL_LINE')}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left ${activeTool === 'VERTICAL_LINE' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span>Vertical Line</span>
              <kbd className="text-[10px] text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-grid">Alt+V</kbd>
            </button>
            <button
              onClick={() => select('PARALLEL_CHANNEL')}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left ${activeTool === 'PARALLEL_CHANNEL' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span>Parallel Channel</span>
            </button>
          </div>
        )}
      </div>

      {/* Drawer 3: Fibonacci */}
      <div className="relative">
        <button
          onClick={() => setOpenDrawer(openDrawer === 'FIB' ? null : 'FIB')}
          className={btnCls(isCurrentInGroup(['FIBONACCI', 'FIB_EXTENSION']))}
          title="Fibonacci Retracements"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>

        {openDrawer === 'FIB' && (
          <div className="absolute left-11 top-0 z-40 flex flex-col gap-1 rounded-lg border border-grid bg-panel p-1.5 shadow-2xl min-w-[160px]">
            <button
              onClick={() => select('FIBONACCI')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'FIBONACCI' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Fib Retracement
            </button>
            <button
              onClick={() => select('FIB_EXTENSION')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'FIB_EXTENSION' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Trend-Based Fib Extension
            </button>
          </div>
        )}
      </div>

      {/* Drawer 4: Geometric Shapes */}
      <div className="relative">
        <button
          onClick={() => setOpenDrawer(openDrawer === 'SHAPES' ? null : 'SHAPES')}
          className={btnCls(isCurrentInGroup(['RECTANGLE', 'CIRCLE', 'BRUSH']))}
          title="Geometric Shapes"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          </svg>
        </button>

        {openDrawer === 'SHAPES' && (
          <div className="absolute left-11 top-0 z-40 flex flex-col gap-1 rounded-lg border border-grid bg-panel p-1.5 shadow-2xl min-w-[140px]">
            <button
              onClick={() => select('RECTANGLE')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'RECTANGLE' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Rectangle Box
            </button>
            <button
              onClick={() => select('CIRCLE')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'CIRCLE' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Circle / Ellipse
            </button>
            <button
              onClick={() => select('BRUSH')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'BRUSH' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Brush / Pen
            </button>
          </div>
        )}
      </div>

      {/* Drawer 5: Annotations */}
      <div className="relative">
        <button
          onClick={() => setOpenDrawer(openDrawer === 'TEXT' ? null : 'TEXT')}
          className={btnCls(isCurrentInGroup(['TEXT', 'CALLOUT', 'PRICE_LABEL']))}
          title="Text & Annotations"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 6v14" />
          </svg>
        </button>

        {openDrawer === 'TEXT' && (
          <div className="absolute left-11 top-0 z-40 flex flex-col gap-1 rounded-lg border border-grid bg-panel p-1.5 shadow-2xl min-w-[140px]">
            <button
              onClick={() => select('TEXT')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'TEXT' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Text Note
            </button>
            <button
              onClick={() => select('CALLOUT')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'CALLOUT' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Callout Balloon
            </button>
            <button
              onClick={() => select('PRICE_LABEL')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'PRICE_LABEL' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Price Tag Label
            </button>
          </div>
        )}
      </div>

      {/* Drawer 6: Position & Forecasting */}
      <div className="relative">
        <button
          onClick={() => setOpenDrawer(openDrawer === 'POSITION' ? null : 'POSITION')}
          className={btnCls(isCurrentInGroup(['POSITION_LONG', 'POSITION_SHORT', 'POSITION_TOOL', 'MEASURE_RULER']))}
          title="Long & Short Position Forecasting Tools"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </button>

        {openDrawer === 'POSITION' && (
          <div className="absolute left-11 top-0 z-40 flex flex-col gap-1 rounded-lg border border-grid bg-panel p-1.5 shadow-2xl min-w-[170px]">
            <button
              onClick={() => select('POSITION_LONG')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'POSITION_LONG' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Long Position (R:R Box)
            </button>
            <button
              onClick={() => select('POSITION_SHORT')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'POSITION_SHORT' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Short Position (R:R Box)
            </button>
            <button
              onClick={() => select('MEASURE_RULER')}
              className={`flex items-center gap-2 px-2 py-1 rounded text-left ${activeTool === 'MEASURE_RULER' ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Measure Ruler
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-grid my-0.5" />

      {/* Undo Drawing Action */}
      <button
        onClick={() => {
          audioHaptics.tick();
          (window as any).__undoDrawing?.();
        }}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
        title="Undo (Ctrl+Z)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
        </svg>
      </button>

      {/* Redo Drawing Action */}
      <button
        onClick={() => {
          audioHaptics.tick();
          (window as any).__redoDrawing?.();
        }}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
        title="Redo (Ctrl+Y)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
        </svg>
      </button>

      <div className="h-px bg-grid my-0.5" />

      {/* Magnet Snapping Toggle */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onToggleMagnet();
        }}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          magnetConfig.enabled
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
        title={magnetConfig.enabled ? 'Magnet Mode Active (Snaps to Candle OHLC)' : 'Enable Magnet Mode (Snaps to Candle OHLC)'}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      </button>

      {/* Lock All Drawings */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onToggleLockAll();
        }}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          isLockedAll
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
        title={isLockedAll ? 'Drawings Locked' : 'Lock All Drawings'}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </button>

      {/* Hide / Show All Drawings */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onToggleHideAll();
        }}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          isHiddenAll
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
        title={isHiddenAll ? 'Drawings Hidden' : 'Hide All Drawings'}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>

      {/* Delete / Clear All Drawings */}
      <button
        onClick={() => {
          if (drawingsCount > 0) {
            audioHaptics.tick();
            onClearAll();
          }
        }}
        disabled={drawingsCount === 0}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800/80 disabled:opacity-30 disabled:pointer-events-none transition"
        title="Remove All Drawings"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
