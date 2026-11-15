/**
 * Floating Contextual Action Bar for Selected Drawing.
 * Provides per-tool style panel: colors, line width, line style, fill opacity,
 * z-order controls (bring forward / send back), templates, and delete.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { DrawingItem } from './types';
import { audioHaptics } from '../../utils/notify';
import { useDrawingStore } from '../../store/useDrawingStore';

interface DrawingContextBarProps {
  selectedDrawing: DrawingItem | null;
  anchorPoint?: { x: number; y: number };
  onUpdateDrawing: (id: string, patch: Partial<DrawingItem>) => void;
  onDeleteDrawing: (id: string) => void;
  onClose: () => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
}

const PRESET_COLORS = [
  '#38bdf8', // Cyan / Sky
  '#f0b90b', // Gold / Amber
  '#22c55e', // Green / Up
  '#ef4444', // Red / Down
  '#c084fc', // Purple
  '#ffffff', // White
  '#94a3b8', // Slate
];

export default function DrawingContextBar({
  selectedDrawing,
  anchorPoint,
  onUpdateDrawing,
  onDeleteDrawing,
  onClose,
  onBringToFront,
  onSendToBack,
}: DrawingContextBarProps) {
  const templates = useDrawingStore((s) => s.templates);
  const saveTemplate = useDrawingStore((s) => s.saveTemplate);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);
  const templatesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTemplatesMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (templatesMenuRef.current && !templatesMenuRef.current.contains(e.target as Node)) {
        setShowTemplatesMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTemplatesMenu(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTemplatesMenu]);

  if (!selectedDrawing) return null;

  const currentX = anchorPoint ? anchorPoint.x : selectedDrawing.p1.x;
  const currentY = anchorPoint ? anchorPoint.y : selectedDrawing.p1.y;
  const posX = Math.max(80, Math.min(window.innerWidth - 450, currentX));
  const posY = Math.max(50, currentY - 50);

  const supportsFill = [
    'RECTANGLE',
    'CIRCLE',
    'PARALLEL_CHANNEL',
    'MEASURE_RULER',
    'POSITION_LONG',
    'POSITION_SHORT',
    'POSITION_TOOL',
  ].includes(selectedDrawing.type);

  return (
    <div
      style={{ left: posX, top: posY }}
      className="clay-popover absolute z-40 flex items-center gap-2 px-3 py-1.5 font-mono text-xs select-none shadow-2xl backdrop-blur-md"
    >
      {/* Color Swatches */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-grid/50">
        {PRESET_COLORS.map((col) => (
          <button
            key={col}
            onClick={() => {
              audioHaptics.tick();
              onUpdateDrawing(selectedDrawing.id, { color: col });
            }}
            className={`h-4 w-4 rounded-full border transition ${
              selectedDrawing.color === col
                ? 'border-white scale-110 shadow-sm'
                : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: col }}
            title={col}
          />
        ))}
      </div>

      {/* Line Width */}
      <div className="flex items-center gap-1 pr-2 border-r border-grid/50">
        {[1, 2, 3, 4].map((w) => (
          <button
            key={w}
            onClick={() => {
              audioHaptics.tick();
              onUpdateDrawing(selectedDrawing.id, { lineWidth: w });
            }}
            className={`px-1.5 py-0.5 text-[10px] rounded transition ${
              selectedDrawing.lineWidth === w
                ? 'clay-btn-active font-bold text-white'
                : 'clay-btn text-muted hover:text-white'
            }`}
          >
            {w}px
          </button>
        ))}
      </div>

      {/* Line Style (Solid, Dashed, Dotted) */}
      <div className="flex items-center gap-1 pr-2 border-r border-grid/50">
        {(['solid', 'dashed', 'dotted'] as const).map((style) => (
          <button
            key={style}
            onClick={() => {
              audioHaptics.tick();
              onUpdateDrawing(selectedDrawing.id, { lineStyle: style });
            }}
            className={`px-1.5 py-0.5 text-[10px] rounded capitalize transition ${
              (selectedDrawing.lineStyle || 'solid') === style
                ? 'clay-btn-active font-bold text-white'
                : 'clay-btn text-muted hover:text-white'
            }`}
            title={`Line style: ${style}`}
          >
            {style[0].toUpperCase()}
          </button>
        ))}
      </div>

      {/* Fill Opacity Slider for shapes */}
      {supportsFill && (
        <div className="flex items-center gap-1 pr-2 border-r border-grid/50">
          <span className="text-[10px] text-muted">Fill</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={selectedDrawing.fillOpacity ?? 0.15}
            onChange={(e) => {
              onUpdateDrawing(selectedDrawing.id, { fillOpacity: parseFloat(e.target.value) });
            }}
            className="w-14 accent-accent cursor-pointer"
            title="Fill Opacity"
          />
        </div>
      )}

      {/* Text Editor for TEXT annotations */}
      {selectedDrawing.type === 'TEXT' && (
        <div className="flex items-center gap-1 pr-2 border-r border-grid/50">
          <input
            type="text"
            value={selectedDrawing.text || ''}
            onChange={(e) => onUpdateDrawing(selectedDrawing.id, { text: e.target.value })}
            placeholder="Edit text..."
            className="bg-slate-900 border border-grid px-2 py-0.5 rounded text-[11px] text-white w-28 focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {/* Z-Order Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-grid/50">
        <button
          onClick={() => {
            audioHaptics.tick();
            onBringToFront?.(selectedDrawing.id);
          }}
          className="clay-btn px-1.5 py-0.5 text-[10px] text-muted hover:text-white"
          title="Bring to Front"
        >
          Top
        </button>
        <button
          onClick={() => {
            audioHaptics.tick();
            onSendToBack?.(selectedDrawing.id);
          }}
          className="clay-btn px-1.5 py-0.5 text-[10px] text-muted hover:text-white"
          title="Send to Back"
        >
          Bottom
        </button>
      </div>

      {/* Templates Menu */}
      <div ref={templatesMenuRef} className="relative pr-2 border-r border-grid/50">
        <button
          onClick={() => setShowTemplatesMenu(!showTemplatesMenu)}
          className="clay-btn px-1.5 py-0.5 text-[10px] text-muted hover:text-white"
          title="Drawing Style Templates"
        >
          Templates
        </button>

        {showTemplatesMenu && (
          <div className="clay-popover absolute left-0 bottom-full mb-1 z-50 flex flex-col gap-1 p-2 min-w-[160px] shadow-2xl">
            <div className="text-[10px] text-slate-400 font-bold border-b border-grid/50 pb-1">
              Save Template
            </div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder="Template name"
                className="bg-slate-900 border border-grid px-1.5 py-0.5 rounded text-[10px] text-white w-full focus:outline-none"
              />
              <button
                onClick={() => {
                  if (templateNameInput.trim()) {
                    saveTemplate(templateNameInput.trim(), {
                      color: selectedDrawing.color,
                      lineWidth: selectedDrawing.lineWidth,
                      lineStyle: selectedDrawing.lineStyle,
                      fillColor: selectedDrawing.fillColor,
                      fillOpacity: selectedDrawing.fillOpacity,
                    });
                    setTemplateNameInput('');
                    setShowTemplatesMenu(false);
                  }
                }}
                className="clay-btn px-1.5 py-0.5 text-[10px] text-accent"
              >
                Save
              </button>
            </div>

            {Object.keys(templates).length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 border-t border-grid/50 pt-1">
                <span className="text-[9px] text-slate-500">Apply:</span>
                {Object.entries(templates).map(([name, tmpl]) => (
                  <button
                    key={name}
                    onClick={() => {
                      onUpdateDrawing(selectedDrawing.id, tmpl);
                      setShowTemplatesMenu(false);
                    }}
                    className="text-left text-[10px] text-slate-300 hover:text-white hover:bg-slate-800 px-1.5 py-0.5 rounded"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lock Toggle */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onUpdateDrawing(selectedDrawing.id, { locked: !selectedDrawing.locked });
        }}
        className={`px-2 py-0.5 text-[10px] rounded transition ${
          selectedDrawing.locked
            ? 'clay-btn-active font-bold text-amber-300'
            : 'clay-btn text-muted hover:text-white'
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
        className="clay-btn px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 transition"
        title="Delete Drawing (Del / Backspace)"
      >
        Delete
      </button>

      {/* Close Floating Bar */}
      <button
        onClick={onClose}
        className="clay-btn h-5 w-5 text-muted hover:text-white text-[10px] rounded"
        title="Deselect"
      >
        x
      </button>
    </div>
  );
}
