/**
 * Floating Contextual Action Bar for Selected Drawing.
 * Appears adjacent to active drawing to configure line width, colors, style, and delete.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React from 'react';
import type { DrawingItem } from './types';
import { audioHaptics } from '../../utils/notify';

interface DrawingContextBarProps {
  selectedDrawing: DrawingItem | null;
  onUpdateDrawing: (id: string, patch: Partial<DrawingItem>) => void;
  onDeleteDrawing: (id: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#f0b90b', // Gold / Amber
  '#38bdf8', // Cyan / Sky
  '#22c55e', // Green / Up
  '#ef4444', // Red / Down
  '#c084fc', // Purple
  '#ffffff', // White
];

export default function DrawingContextBar({
  selectedDrawing,
  onUpdateDrawing,
  onDeleteDrawing,
  onClose,
}: DrawingContextBarProps) {
  if (!selectedDrawing) return null;

  const posX = Math.max(80, Math.min(window.innerWidth - 300, selectedDrawing.p1.x));
  const posY = Math.max(50, selectedDrawing.p1.y - 45);

  return (
    <div
      style={{ left: posX, top: posY }}
      className="absolute z-40 flex items-center gap-2 rounded-xl border border-grid bg-panel/95 px-3 py-1.5 shadow-2xl backdrop-blur-md font-mono text-xs select-none"
    >
      {/* Color Palette */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-grid">
        {PRESET_COLORS.map((col) => (
          <button
            key={col}
            onClick={() => {
              audioHaptics.tick();
              onUpdateDrawing(selectedDrawing.id, { color: col });
            }}
            className={`h-4 w-4 rounded-full border transition ${
              selectedDrawing.color === col ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: col }}
            title={col}
          />
        ))}
      </div>

      {/* Line Width */}
      <div className="flex items-center gap-1 pr-2 border-r border-grid">
        {[1, 2, 3, 4].map((w) => (
          <button
            key={w}
            onClick={() => {
              audioHaptics.tick();
              onUpdateDrawing(selectedDrawing.id, { lineWidth: w });
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] ${
              selectedDrawing.lineWidth === w ? 'bg-accent/20 text-accent font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {w}px
          </button>
        ))}
      </div>

      {/* Lock Toggle */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onUpdateDrawing(selectedDrawing.id, { locked: !selectedDrawing.locked });
        }}
        className={`px-1.5 py-0.5 rounded text-[10px] ${
          selectedDrawing.locked ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
        }`}
        title={selectedDrawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
      >
        {selectedDrawing.locked ? 'Locked' : 'Lock'}
      </button>

      {/* Delete Button */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onDeleteDrawing(selectedDrawing.id);
        }}
        className="px-1.5 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-500/20 transition"
        title="Delete Drawing (Del)"
      >
        Delete
      </button>

      {/* Close Floating Bar */}
      <button
        onClick={onClose}
        className="text-slate-500 hover:text-white text-xs pl-1"
        title="Deselect"
      >
        [x]
      </button>
    </div>
  );
}
