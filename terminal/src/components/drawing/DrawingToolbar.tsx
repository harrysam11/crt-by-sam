/**
 * TradingView-Style Expandable Vector Drawing Toolbar.
 * Provides flyout tool drawers, star icons for Favorites, Magnet Snapping mode,
 * and quick utility toggles.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { ToolType, MagnetConfig } from './types';
import { audioHaptics } from '../../utils/notify';
import { useDrawingStore } from '../../store/useDrawingStore';
import { drawingEvents } from './framework/DrawingEvents';

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
  onOpenObjectTree?: () => void;
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
  onOpenObjectTree,
}: DrawingToolbarProps) {
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);
  const [drawerAnchor, setDrawerAnchor] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const favorites = useDrawingStore((s) => s.favorites);
  const toggleFavorite = useDrawingStore((s) => s.toggleFavorite);
  const isFavoritesBarVisible = useDrawingStore((s) => s.isFavoritesBarVisible);
  const toggleFavoritesBar = useDrawingStore((s) => s.toggleFavoritesBar);
  const setFloatingToolbarPos = useDrawingStore((s) => s.setFloatingToolbarPos);
  const setDrawingContextBarPos = useDrawingStore((s) => s.setDrawingContextBarPos);

  const toggleDrawer = (name: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openDrawer === name) {
      setOpenDrawer(null);
      setDrawerAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setOpenDrawer(name);
      setDrawerAnchor({ top: rect.top, left: rect.right + 4 });
    }
  };

  const handleResetFloatingBars = () => {
    audioHaptics.tick();
    setFloatingToolbarPos({ x: 80, y: 120 });
    setDrawingContextBarPos({ x: 280, y: 75 });
  };

  useEffect(() => {
    if (!openDrawer) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(target) &&
        !target.closest('.clay-popover')
      ) {
        setOpenDrawer(null);
        setDrawerAnchor(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDrawer(null);
        setDrawerAnchor(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDrawer]);

  const select = (t: ToolType) => {
    audioHaptics.tick();
    onSelectTool(t);
    setOpenDrawer(null);
    setDrawerAnchor(null);
  };

  const isCurrentInGroup = (tools: ToolType[]) => tools.includes(activeTool);

  const btnCls = (isActive: boolean) =>
    `p-2 rounded-[6px] flex items-center justify-center transition relative group ${
      isActive ? 'clay-btn-active' : 'clay-btn text-slate-300'
    }`;

  const renderToolRow = (type: ToolType, label: string, shortcut?: string) => {
    const isFav = favorites.includes(type);
    const isSelected = activeTool === type;

    return (
      <div
        key={type}
        className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-left transition ${
          isSelected ? 'bg-accent/20 text-accent font-bold' : 'text-slate-300 hover:bg-slate-800'
        }`}
      >
        <button
          onClick={() => select(type)}
          className="flex-1 text-left flex items-center justify-between gap-2"
        >
          <span>{label}</span>
          {shortcut && (
            <kbd className="text-[10px] text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-grid">
              {shortcut}
            </kbd>
          )}
        </button>

        {/* Favorite Star Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            audioHaptics.tick();
            toggleFavorite(type);
          }}
          className={`p-0.5 transition ${
            isFav ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-slate-400'
          }`}
          title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
        >
          <svg className="h-3.5 w-3.5" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="relative z-30 flex w-10 shrink-0 flex-col items-center gap-1 border-r border-grid bg-panel py-1.5 select-none font-mono text-xs overflow-y-auto overflow-x-hidden scrollbar-none max-h-full"
    >
      {/* Drawer 1: Cursors */}
      <div>
        <button
          onClick={(e) => toggleDrawer('CURSOR', e)}
          className={btnCls(isCurrentInGroup(['CURSOR_CROSSHAIR', 'CURSOR_ARROW', 'CURSOR_DOT', 'CURSOR_ERASER']))}
          title="Cursors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {openDrawer === 'CURSOR' && (
          <div
            style={{
              top: `${Math.max(50, Math.min(window.innerHeight - 200, drawerAnchor?.top ?? 60))}px`,
              left: `${drawerAnchor?.left ?? 50}px`,
            }}
            className="fixed z-50 flex flex-col gap-1.5 clay-popover p-2 shadow-2xl min-w-[160px] max-h-[85vh] overflow-y-auto"
          >
            {renderToolRow('CURSOR_CROSSHAIR', 'Crosshair')}
            {renderToolRow('CURSOR_ARROW', 'Arrow Cursor')}
            {renderToolRow('CURSOR_DOT', 'Dot Cursor')}
            {renderToolRow('CURSOR_ERASER', 'Eraser')}
          </div>
        )}
      </div>

      {/* Drawer 2: Lines & Channels */}
      <div>
        <button
          onClick={(e) => toggleDrawer('LINES', e)}
          className={btnCls(
            isCurrentInGroup([
              'TRENDLINE',
              'RAY',
              'HORIZONTAL_LINE',
              'HORIZONTAL_RAY',
              'VERTICAL_LINE',
              'PARALLEL_CHANNEL',
              'ARROW',
            ])
          )}
          title="Lines & Channels"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5M5 19a2 2 0 100-4 2 2 0 000 4zM19 5a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>

        {openDrawer === 'LINES' && (
          <div
            style={{
              top: `${Math.max(50, Math.min(window.innerHeight - 280, drawerAnchor?.top ?? 90))}px`,
              left: `${drawerAnchor?.left ?? 50}px`,
            }}
            className="fixed z-50 flex flex-col gap-1.5 clay-popover p-2 shadow-2xl min-w-[200px] max-h-[85vh] overflow-y-auto"
          >
            {renderToolRow('TRENDLINE', 'Trend Line', 'Alt+T')}
            {renderToolRow('RAY', 'Ray')}
            {renderToolRow('HORIZONTAL_LINE', 'Horizontal Line', 'Alt+H')}
            {renderToolRow('HORIZONTAL_RAY', 'Horizontal Ray')}
            {renderToolRow('VERTICAL_LINE', 'Vertical Line', 'Alt+V')}
            {renderToolRow('PARALLEL_CHANNEL', 'Parallel Channel')}
            {renderToolRow('ARROW', 'Arrow Vector')}
          </div>
        )}
      </div>

      {/* Drawer 3: Fibonacci */}
      <div>
        <button
          onClick={(e) => toggleDrawer('FIB', e)}
          className={btnCls(isCurrentInGroup(['FIBONACCI', 'FIB_EXTENSION']))}
          title="Fibonacci Tools"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>

        {openDrawer === 'FIB' && (
          <div
            style={{
              top: `${Math.max(50, Math.min(window.innerHeight - 150, drawerAnchor?.top ?? 130))}px`,
              left: `${drawerAnchor?.left ?? 50}px`,
            }}
            className="fixed z-50 flex flex-col gap-1.5 clay-popover p-2 shadow-2xl min-w-[200px] max-h-[85vh] overflow-y-auto"
          >
            {renderToolRow('FIBONACCI', 'Fib Retracement', 'Alt+F')}
            {renderToolRow('FIB_EXTENSION', 'Trend-Based Fib Extension')}
          </div>
        )}
      </div>

      {/* Drawer 4: Geometric Shapes */}
      <div>
        <button
          onClick={(e) => toggleDrawer('SHAPES', e)}
          className={btnCls(isCurrentInGroup(['RECTANGLE', 'CIRCLE', 'BRUSH']))}
          title="Geometric Shapes & Brush"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          </svg>
        </button>

        {openDrawer === 'SHAPES' && (
          <div
            style={{
              top: `${Math.max(50, Math.min(window.innerHeight - 180, drawerAnchor?.top ?? 170))}px`,
              left: `${drawerAnchor?.left ?? 50}px`,
            }}
            className="fixed z-50 flex flex-col gap-1.5 clay-popover p-2 shadow-2xl min-w-[170px] max-h-[85vh] overflow-y-auto"
          >
            {renderToolRow('RECTANGLE', 'Rectangle Box')}
            {renderToolRow('CIRCLE', 'Circle / Ellipse')}
            {renderToolRow('BRUSH', 'Brush / Pen')}
          </div>
        )}
      </div>

      {/* Drawer 5: Annotations */}
      <div>
        <button
          onClick={(e) => toggleDrawer('TEXT', e)}
          className={btnCls(isCurrentInGroup(['TEXT', 'CALLOUT', 'PRICE_LABEL']))}
          title="Text & Annotations"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 6v14" />
          </svg>
        </button>

        {openDrawer === 'TEXT' && (
          <div
            style={{
              top: `${Math.max(50, Math.min(window.innerHeight - 180, drawerAnchor?.top ?? 210))}px`,
              left: `${drawerAnchor?.left ?? 50}px`,
            }}
            className="fixed z-50 flex flex-col gap-1.5 clay-popover p-2 shadow-2xl min-w-[170px] max-h-[85vh] overflow-y-auto"
          >
            {renderToolRow('TEXT', 'Text Note')}
            {renderToolRow('CALLOUT', 'Callout Balloon')}
            {renderToolRow('PRICE_LABEL', 'Price Tag Label')}
          </div>
        )}
      </div>

      {/* Drawer 6: Position & Forecasting */}
      <div>
        <button
          onClick={(e) => toggleDrawer('POSITION', e)}
          className={btnCls(isCurrentInGroup(['POSITION_LONG', 'POSITION_SHORT', 'POSITION_TOOL', 'MEASURE_RULER', 'ANCHORED_VOLUME_PROFILE']))}
          title="Long & Short Position / Measurement / Volume Profile"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </button>

        {openDrawer === 'POSITION' && (
          <div
            style={{
              top: `${Math.max(50, Math.min(window.innerHeight - 180, drawerAnchor?.top ?? 250))}px`,
              left: `${drawerAnchor?.left ?? 50}px`,
            }}
            className="fixed z-50 flex flex-col gap-1.5 clay-popover p-2 shadow-2xl min-w-[210px] max-h-[85vh] overflow-y-auto"
          >
            {renderToolRow('POSITION_LONG', 'Long Position (R:R)')}
            {renderToolRow('POSITION_SHORT', 'Short Position (R:R)')}
            {renderToolRow('ANCHORED_VOLUME_PROFILE', 'Anchored Volume Profile (AVP)')}
            {renderToolRow('MEASURE_RULER', 'Measure Ruler')}
          </div>
        )}
      </div>

      <div className="h-px bg-grid my-0.5 w-6" />

      {/* Favorites Toolbar Toggle Button */}
      <button
        onClick={() => {
          audioHaptics.tick();
          toggleFavoritesBar();
        }}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          isFavoritesBarVisible && favorites.length > 0
            ? 'text-amber-400 bg-amber-500/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
        title={isFavoritesBarVisible ? 'Hide Favorites Toolbar' : 'Show Favorites Toolbar'}
      >
        <svg className="h-4 w-4" fill={isFavoritesBarVisible && favorites.length > 0 ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>

      {/* Reset Floating Toolbars Positions */}
      <button
        onClick={handleResetFloatingBars}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition"
        title="Reset Floating Toolbars Position (Favorites & Context Toolbar)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* Undo Action */}
      <button
        onClick={() => {
          audioHaptics.tick();
          drawingEvents.undo();
        }}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
        title="Undo (Ctrl+Z)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
        </svg>
      </button>

      {/* Redo Action */}
      <button
        onClick={() => {
          audioHaptics.tick();
          drawingEvents.redo();
        }}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
        title="Redo (Ctrl+Y)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
        </svg>
      </button>

      <div className="h-px bg-grid my-0.5 w-6" />

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

      {/* Object Tree / Inspect Drawn Data */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onOpenObjectTree?.();
        }}
        className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#38bdf8] hover:bg-slate-800/80 transition"
        title="Object Tree & Drawn Data Inspector"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
