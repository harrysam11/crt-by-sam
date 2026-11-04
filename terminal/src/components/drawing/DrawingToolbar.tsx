import React from 'react';
import type { ToolType } from './types';
import { audioHaptics } from '../../utils/notify';

interface DrawingToolbarProps {
  activeTool: ToolType;
  onSelectTool: (t: ToolType) => void;
  onClearAll: () => void;
  drawingsCount: number;
}

export default function DrawingToolbar({
  activeTool,
  onSelectTool,
  onClearAll,
  drawingsCount,
}: DrawingToolbarProps) {
  const select = (t: ToolType) => {
    audioHaptics.tick();
    onSelectTool(t);
  };

  const btnCls = (t: ToolType) =>
    `p-2 rounded-lg flex items-center justify-center transition ${
      activeTool === t
        ? 'bg-accent text-black font-bold shadow-md ring-1 ring-accent'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`;

  return (
    <div className="absolute left-2 top-10 z-20 flex flex-col gap-1 rounded-xl border border-grid bg-panel/90 p-1 backdrop-blur-md shadow-2xl select-none">
      {/* Cursor Modes */}
      <button
        onClick={() => select('CURSOR_CROSSHAIR')}
        className={btnCls('CURSOR_CROSSHAIR')}
        title="Crosshair Cursor"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <button
        onClick={() => select('CURSOR_ARROW')}
        className={btnCls('CURSOR_ARROW')}
        title="Standard Arrow Cursor"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H8M17 7v9" />
        </svg>
      </button>

      <div className="h-px bg-grid my-0.5" />

      {/* Drawing Tools */}
      <button
        onClick={() => select('TRENDLINE')}
        className={btnCls('TRENDLINE')}
        title="Trendline (Click & Drag)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
          <circle cx="4" cy="20" r="2" fill="currentColor" />
          <circle cx="20" cy="4" r="2" fill="currentColor" />
        </svg>
      </button>

      <button
        onClick={() => select('HORIZONTAL_LINE')}
        className={btnCls('HORIZONTAL_LINE')}
        title="Horizontal Support / Resistance Level"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6" />
        </svg>
      </button>

      <button
        onClick={() => select('FIBONACCI')}
        className={btnCls('FIBONACCI')}
        title="Fibonacci Retracement (0.236, 0.382, 0.5, 0.618, 0.786)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6h18M3 10h18M3 14h18M3 18h18" />
        </svg>
      </button>

      <button
        onClick={() => select('RECTANGLE')}
        className={btnCls('RECTANGLE')}
        title="Order Block / Consolidation Rectangle"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={2} />
        </svg>
      </button>

      <button
        onClick={() => select('POSITION_TOOL')}
        className={btnCls('POSITION_TOOL')}
        title="Long / Short Risk-Reward Position Box"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      <div className="h-px bg-grid my-0.5" />

      {/* Eraser / Clear */}
      <button
        onClick={() => select('CURSOR_ERASER')}
        className={btnCls('CURSOR_ERASER')}
        title="Eraser (Click drawing to delete)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {drawingsCount > 0 && (
        <button
          onClick={() => {
            audioHaptics.tick();
            onClearAll();
          }}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition text-[10px] font-bold text-center"
          title={`Clear all ${drawingsCount} drawings`}
        >
          [{drawingsCount}]
        </button>
      )}
    </div>
  );
}
