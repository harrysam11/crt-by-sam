import React from 'react';
import type { ToolType } from './types';
import { useDrawingStore } from '../../store/useDrawingStore';
import { audioHaptics } from '../../utils/notify';

interface ToolMeta {
  type: ToolType;
  label: string;
  icon: React.ReactNode;
}

const TOOL_METAS: Record<ToolType, ToolMeta> = {
  CURSOR_CROSSHAIR: {
    type: 'CURSOR_CROSSHAIR',
    label: 'Crosshair',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  CURSOR_ARROW: {
    type: 'CURSOR_ARROW',
    label: 'Arrow Pointer',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
  },
  CURSOR_DOT: {
    type: 'CURSOR_DOT',
    label: 'Dot Cursor',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  CURSOR_ERASER: {
    type: 'CURSOR_ERASER',
    label: 'Eraser',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
  TRENDLINE: {
    type: 'TRENDLINE',
    label: 'Trend Line',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5M5 19a2 2 0 100-4 2 2 0 000 4zM19 5a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    ),
  },
  RAY: {
    type: 'RAY',
    label: 'Ray',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5m0 0v6m0-6h-6" />
      </svg>
    ),
  },
  HORIZONTAL_LINE: {
    type: 'HORIZONTAL_LINE',
    label: 'Horizontal Line',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
      </svg>
    ),
  },
  HORIZONTAL_RAY: {
    type: 'HORIZONTAL_RAY',
    label: 'Horizontal Ray',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 12h10m-10 0a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    ),
  },
  VERTICAL_LINE: {
    type: 'VERTICAL_LINE',
    label: 'Vertical Line',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16" />
      </svg>
    ),
  },
  PARALLEL_CHANNEL: {
    type: 'PARALLEL_CHANNEL',
    label: 'Parallel Channel',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 18L18 4M6 20L20 6" />
      </svg>
    ),
  },
  ARROW: {
    type: 'ARROW',
    label: 'Arrow',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5m0 0v8m0-8h-8" />
      </svg>
    ),
  },
  FIBONACCI: {
    type: 'FIBONACCI',
    label: 'Fib Retracement',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  FIB_EXTENSION: {
    type: 'FIB_EXTENSION',
    label: 'Fib Extension',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l5 16 5-10 6 10" />
      </svg>
    ),
  },
  RECTANGLE: {
    type: 'RECTANGLE',
    label: 'Rectangle',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="4" y="5" width="16" height="14" rx="2" strokeWidth={2} />
      </svg>
    ),
  },
  CIRCLE: {
    type: 'CIRCLE',
    label: 'Circle',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="8" strokeWidth={2} />
      </svg>
    ),
  },
  BRUSH: {
    type: 'BRUSH',
    label: 'Brush',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  TEXT: {
    type: 'TEXT',
    label: 'Text',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 6v14" />
      </svg>
    ),
  },
  CALLOUT: {
    type: 'CALLOUT',
    label: 'Callout',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  PRICE_LABEL: {
    type: 'PRICE_LABEL',
    label: 'Price Label',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  POSITION_LONG: {
    type: 'POSITION_LONG',
    label: 'Long Position',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#22c55e">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
  },
  POSITION_SHORT: {
    type: 'POSITION_SHORT',
    label: 'Short Position',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#ef4444">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
  },
  POSITION_TOOL: {
    type: 'POSITION_TOOL',
    label: 'Position Tool',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  MEASURE_RULER: {
    type: 'MEASURE_RULER',
    label: 'Measure Ruler',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
};

export default function FavoritesBar() {
  const favorites = useDrawingStore((s) => s.favorites);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const isFavoritesBarVisible = useDrawingStore((s) => s.isFavoritesBarVisible);
  const toggleFavoritesBar = useDrawingStore((s) => s.toggleFavoritesBar);
  const pos = useDrawingStore((s) => s.floatingToolbarPos);
  const setPos = useDrawingStore((s) => s.setFloatingToolbarPos);
  const stayInDrawingMode = useDrawingStore((s) => s.stayInDrawingMode);
  const toggleStayInDrawingMode = useDrawingStore((s) => s.toggleStayInDrawingMode);

  // Boundary safety clamp so toolbar is never positioned under or behind the top navbar (min Y = 64)
  const safeX = Math.max(16, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - 320, pos?.x ?? 80));
  const safeY = Math.max(64, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 70, pos?.y ?? 120));

  const isDraggingRef = React.useRef(false);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = safeX;
    const startPosY = safeY;

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEv.clientX - startMouseX;
      const dy = moveEv.clientY - startMouseY;
      const newX = Math.max(16, Math.min(window.innerWidth - 320, startPosX + dx));
      const newY = Math.max(64, Math.min(window.innerHeight - 70, startPosY + dy));
      setPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResetPos = () => {
    audioHaptics.tick();
    setPos({ x: 80, y: 120 });
  };

  if (!isFavoritesBarVisible || favorites.length === 0) return null;

  return (
    <div
      style={{ left: `${safeX}px`, top: `${safeY}px` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('button')) return;
        startDrag(e);
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={handleResetPos}
      className="clay-popover fixed z-40 flex items-center gap-1 px-2 py-1 select-none font-mono text-xs shadow-2xl backdrop-blur-md border border-white/[0.08] cursor-move"
      title="In-Chart Drawing Toolbar (Drag to reposition, Double-click to reset)"
    >
      {/* Movable Drag Grip Handle */}
      <div
        onPointerDown={startDrag}
        className="flex items-center gap-0.5 px-1 py-1.5 cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-200 transition"
        title="Drag toolbar to reposition (Double-click to reset)"
      >
        <svg className="h-3.5 w-2.5" viewBox="0 0 6 12" fill="currentColor">
          <circle cx="1.5" cy="2" r="1" />
          <circle cx="4.5" cy="2" r="1" />
          <circle cx="1.5" cy="6" r="1" />
          <circle cx="4.5" cy="6" r="1" />
          <circle cx="1.5" cy="10" r="1" />
          <circle cx="4.5" cy="10" r="1" />
        </svg>
      </div>

      <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

      {/* Favorite Tool Icons */}
      {favorites.map((tool) => {
        const meta = TOOL_METAS[tool];
        if (!meta) return null;
        const isActive = activeTool === tool;

        return (
          <button
            key={tool}
            onClick={() => {
              audioHaptics.tick();
              setActiveTool(tool);
            }}
            className={`p-1.5 rounded-[4px] transition relative group ${
              isActive
                ? 'clay-btn-active text-white'
                : 'clay-btn text-zinc-400 hover:text-white'
            }`}
            title={`${meta.label}`}
          >
            {meta.icon}
          </button>
        );
      })}

      <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

      {/* Stay in Drawing Mode Pin Toggle */}
      <button
        onClick={() => {
          audioHaptics.tick();
          toggleStayInDrawingMode();
        }}
        className={`p-1.5 rounded-[4px] transition text-[10px] ${
          stayInDrawingMode
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title={
          stayInDrawingMode
            ? 'Stay in Drawing Mode: ON (Will not auto-return to crosshair)'
            : 'Stay in Drawing Mode: OFF (Auto-returns to crosshair after draw)'
        }
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>

      {/* Close button */}
      <button
        onClick={() => {
          audioHaptics.tick();
          toggleFavoritesBar();
        }}
        className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition text-[10px]"
        title="Hide Favorites Bar"
      >
        x
      </button>
    </div>
  );
}
