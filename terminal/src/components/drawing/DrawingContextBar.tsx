/**
 * Authentic TradingView-Style Floating Contextual Action Bar for Selected Drawing.
 * Provides per-tool style controls: border color with opacity slider, fill color with opacity slider,
 * line width selector (1px-4px with visual lines), line style (solid/dashed/dotted),
 * settings gear, lock/unlock padlock, trash delete, visual order (z-index), and templates.
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
  onOpenSettings?: () => void;
}

const PALETTE_COLORS = [
  '#ffffff', '#94a3b8', '#64748b', '#334155', '#1e293b', '#0f172a',
  '#38bdf8', '#0284c7', '#0369a1', '#22c55e', '#16a34a', '#15803d',
  '#f59e0b', '#d97706', '#b45309', '#ef4444', '#dc2626', '#b91c1c',
  '#a855f7', '#9333ea', '#7e22ce', '#ec4899', '#db2777', '#be185d',
];

export default function DrawingContextBar({
  selectedDrawing,
  onUpdateDrawing,
  onDeleteDrawing,
  onClose,
  onBringToFront,
  onSendToBack,
  onOpenSettings,
}: DrawingContextBarProps) {
  const templates = useDrawingStore((s) => s.templates);
  const saveTemplate = useDrawingStore((s) => s.saveTemplate);
  const pos = useDrawingStore((s) => s.drawingContextBarPos);
  const setPos = useDrawingStore((s) => s.setDrawingContextBarPos);

  // Active popovers
  const [activeMenu, setActiveMenu] = useState<'BORDER_COLOR' | 'FILL_COLOR' | 'LINE_WIDTH' | 'LINE_STYLE' | 'MORE' | null>(null);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Boundary safety clamp so context bar can be moved freely across viewport
  const safeX = Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - 220, pos?.x ?? 280));
  const safeY = Math.max(42, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 45, pos?.y ?? 75));

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = safeX;
    const startPosY = safeY;

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEv.clientX - startMouseX;
      const dy = moveEv.clientY - startMouseY;
      const newX = Math.max(8, Math.min(window.innerWidth - 220, startPosX + dx));
      const newY = Math.max(42, Math.min(window.innerHeight - 45, startPosY + dy));
      setPos({ x: newX, y: newY });
    };

    const stopDrag = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  };

  const handleResetPos = () => {
    audioHaptics.tick();
    setPos({ x: 280, y: 75 });
  };

  // Close menus on outside click or Escape
  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  if (!selectedDrawing) return null;

  const supportsFill = [
    'RECTANGLE',
    'CIRCLE',
    'PARALLEL_CHANNEL',
    'MEASURE_RULER',
    'POSITION_LONG',
    'POSITION_SHORT',
    'POSITION_TOOL',
    'FIBONACCI',
    'FIB_EXTENSION',
  ].includes(selectedDrawing.type);

  const currentBorderColor = selectedDrawing.color || '#38bdf8';
  const currentLineOpacity = selectedDrawing.lineOpacity !== undefined ? selectedDrawing.lineOpacity : 1;
  const currentFillColor = selectedDrawing.fillColor || currentBorderColor;
  const currentFillOpacity = selectedDrawing.fillOpacity !== undefined ? selectedDrawing.fillOpacity : 0.15;
  const currentLineWidth = selectedDrawing.lineWidth || 2;
  const currentLineStyle = selectedDrawing.lineStyle || 'solid';

  return (
    <div
      ref={menuContainerRef}
      data-drawing-context-bar="true"
      onDoubleClick={handleResetPos}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="drawing-context-bar fixed z-50 flex max-w-[calc(100vw-16px)] items-center gap-1 overflow-x-auto overscroll-x-contain px-1.5 py-1 font-mono text-xs select-none shadow-2xl bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] rounded-lg pointer-events-auto"
      style={{ left: `${safeX}px`, top: `${safeY}px`, touchAction: 'pan-x' }}
      title="Drawing Context Toolbar (Drag grip to move, Double-click to reset)"
    >
      {/* 1. Movable Drag Grip Handle */}
      <div
        onPointerDown={startDrag}
        className="flex items-center gap-0.5 px-1 py-1 cursor-grab active:cursor-grabbing text-[#787b86] hover:text-[#d1d4dc] transition"
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

      <div className="h-4 w-px bg-[#2a2e39] mx-0.5" />

      {/* 2. Border / Line Color & Opacity Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'BORDER_COLOR' ? null : 'BORDER_COLOR')}
          className={`flex items-center gap-1 p-1 rounded hover:bg-[#2a2e39] transition ${
            activeMenu === 'BORDER_COLOR' ? 'bg-[#2a2e39] ring-1 ring-[#38bdf8]' : ''
          }`}
          title="Line / Border Color & Opacity"
        >
          <span
            className="h-4 w-4 rounded border border-black/40 shadow-xs"
            style={{
              backgroundColor: currentBorderColor,
              opacity: currentLineOpacity,
            }}
          />
          <svg className="h-2.5 w-2.5 text-[#787b86]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Border Color Popover */}
        {activeMenu === 'BORDER_COLOR' && (
          <div className="absolute left-0 bottom-full mb-1.5 z-50 w-56 rounded-lg border border-[#2a2e39] bg-[#1e222d] p-3 shadow-2xl backdrop-blur-xl">
            <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider mb-2">
              Border / Line Color
            </div>
            {/* Palette Grid */}
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {PALETTE_COLORS.map((col) => (
                <button
                  key={col}
                  onClick={() => {
                    audioHaptics.tick();
                    onUpdateDrawing(selectedDrawing.id, { color: col });
                  }}
                  className={`h-5 w-5 rounded border transition ${
                    currentBorderColor.toLowerCase() === col.toLowerCase()
                      ? 'border-white scale-110 shadow-sm ring-1 ring-white/50'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: col }}
                  title={col}
                />
              ))}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center justify-between bg-[#131722] p-1.5 rounded border border-[#2a2e39] mb-3">
              <span className="text-[10px] text-[#787b86]">Custom Hex:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[#d1d4dc]">{currentBorderColor.toUpperCase()}</span>
                <input
                  type="color"
                  value={currentBorderColor}
                  onChange={(e) => onUpdateDrawing(selectedDrawing.id, { color: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
            </div>

            {/* Line Opacity Slider */}
            <div className="space-y-1 border-t border-[#2a2e39] pt-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#787b86]">Opacity</span>
                <span className="text-[#d1d4dc] font-mono">{Math.round(currentLineOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={currentLineOpacity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateDrawing(selectedDrawing.id, { lineOpacity: val });
                }}
                className="w-full accent-[#38bdf8] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Fill Color & Opacity Button (if drawing has fill) */}
      {supportsFill && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'FILL_COLOR' ? null : 'FILL_COLOR')}
            className={`flex items-center gap-1 p-1 rounded hover:bg-[#2a2e39] transition ${
              activeMenu === 'FILL_COLOR' ? 'bg-[#2a2e39] ring-1 ring-[#38bdf8]' : ''
            }`}
            title="Background Fill Color & Opacity"
          >
            <div className="relative h-4 w-4 rounded border border-black/40 overflow-hidden bg-white/10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: currentFillColor,
                  opacity: currentFillOpacity,
                }}
              />
            </div>
            <svg className="h-2.5 w-2.5 text-[#787b86]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Fill Color Popover */}
          {activeMenu === 'FILL_COLOR' && (
            <div className="absolute left-0 bottom-full mb-1.5 z-50 w-56 rounded-lg border border-[#2a2e39] bg-[#1e222d] p-3 shadow-2xl backdrop-blur-xl">
              <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider mb-2">
                Background Fill Color
              </div>
              {/* Palette Grid */}
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {PALETTE_COLORS.map((col) => (
                  <button
                    key={col}
                    onClick={() => {
                      audioHaptics.tick();
                      onUpdateDrawing(selectedDrawing.id, { fillColor: col });
                    }}
                    className={`h-5 w-5 rounded border transition ${
                      currentFillColor.toLowerCase() === col.toLowerCase()
                        ? 'border-white scale-110 shadow-sm ring-1 ring-white/50'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: col }}
                    title={col}
                  />
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center justify-between bg-[#131722] p-1.5 rounded border border-[#2a2e39] mb-3">
                <span className="text-[10px] text-[#787b86]">Custom Hex:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[#d1d4dc]">{currentFillColor.toUpperCase()}</span>
                  <input
                    type="color"
                    value={currentFillColor}
                    onChange={(e) => onUpdateDrawing(selectedDrawing.id, { fillColor: e.target.value })}
                    className="h-5 w-6 cursor-pointer bg-transparent border-0 p-0"
                  />
                </div>
              </div>

              {/* Fill Opacity Slider */}
              <div className="space-y-1 border-t border-[#2a2e39] pt-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#787b86]">Fill Opacity</span>
                  <span className="text-[#d1d4dc] font-mono">{Math.round(currentFillOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentFillOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateDrawing(selectedDrawing.id, { fillOpacity: val, fillColor: currentFillColor });
                  }}
                  className="w-full accent-[#38bdf8] cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Line Width Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'LINE_WIDTH' ? null : 'LINE_WIDTH')}
          className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#2a2e39] transition ${
            activeMenu === 'LINE_WIDTH' ? 'bg-[#2a2e39] ring-1 ring-[#38bdf8]' : ''
          }`}
          title="Line Width"
        >
          <div className="w-5 flex items-center justify-center">
            <span
              className="w-full bg-[#d1d4dc] rounded-full"
              style={{ height: `${currentLineWidth}px` }}
            />
          </div>
          <svg className="h-2.5 w-2.5 text-[#787b86]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Width Menu */}
        {activeMenu === 'LINE_WIDTH' && (
          <div className="absolute left-0 bottom-full mb-1.5 z-50 w-28 rounded-lg border border-[#2a2e39] bg-[#1e222d] py-1 shadow-2xl backdrop-blur-xl">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => {
                  audioHaptics.tick();
                  onUpdateDrawing(selectedDrawing.id, { lineWidth: w });
                  setActiveMenu(null);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition ${
                  currentLineWidth === w ? 'text-[#38bdf8] font-bold bg-[#2a2e39]/50' : 'text-[#d1d4dc]'
                }`}
              >
                <div className="w-10 flex items-center">
                  <span
                    className="w-full bg-current rounded-full"
                    style={{ height: `${w}px` }}
                  />
                </div>
                <span className="text-[10px] font-mono">{w}px</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 5. Line Style Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'LINE_STYLE' ? null : 'LINE_STYLE')}
          className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#2a2e39] transition ${
            activeMenu === 'LINE_STYLE' ? 'bg-[#2a2e39] ring-1 ring-[#38bdf8]' : ''
          }`}
          title="Line Style"
        >
          <div className="w-5 flex items-center justify-center">
            {currentLineStyle === 'solid' && (
              <span className="w-full h-[2px] bg-[#d1d4dc] rounded-full" />
            )}
            {currentLineStyle === 'dashed' && (
              <svg className="w-full h-1 text-[#d1d4dc]" viewBox="0 0 20 2" fill="none">
                <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
              </svg>
            )}
            {currentLineStyle === 'dotted' && (
              <svg className="w-full h-1 text-[#d1d4dc]" viewBox="0 0 20 2" fill="none">
                <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" />
              </svg>
            )}
          </div>
          <svg className="h-2.5 w-2.5 text-[#787b86]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Style Menu */}
        {activeMenu === 'LINE_STYLE' && (
          <div className="absolute left-0 bottom-full mb-1.5 z-50 w-32 rounded-lg border border-[#2a2e39] bg-[#1e222d] py-1 shadow-2xl backdrop-blur-xl">
            {(
              [
                { id: 'solid', label: 'Solid' },
                { id: 'dashed', label: 'Dashed' },
                { id: 'dotted', label: 'Dotted' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  audioHaptics.tick();
                  onUpdateDrawing(selectedDrawing.id, { lineStyle: st.id });
                  setActiveMenu(null);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition ${
                  currentLineStyle === st.id ? 'text-[#38bdf8] font-bold bg-[#2a2e39]/50' : 'text-[#d1d4dc]'
                }`}
              >
                <div className="w-12 flex items-center">
                  {st.id === 'solid' && (
                    <span className="w-full h-[2px] bg-current rounded-full" />
                  )}
                  {st.id === 'dashed' && (
                    <svg className="w-full h-1" viewBox="0 0 24 2" fill="none">
                      <line x1="0" y1="1" x2="24" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="6 3" />
                    </svg>
                  )}
                  {st.id === 'dotted' && (
                    <svg className="w-full h-1" viewBox="0 0 24 2" fill="none">
                      <line x1="0" y1="1" x2="24" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" />
                    </svg>
                  )}
                </div>
                <span className="text-[10px] capitalize">{st.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. Text Editor for TEXT annotations */}
      {selectedDrawing.type === 'TEXT' && (
        <div className="flex items-center gap-1 px-1">
          <input
            type="text"
            value={selectedDrawing.text || ''}
            onChange={(e) => onUpdateDrawing(selectedDrawing.id, { text: e.target.value })}
            placeholder="Edit text..."
            className="bg-[#131722] border border-[#2a2e39] px-2 py-0.5 rounded text-[11px] text-[#d1d4dc] w-28 focus:outline-none focus:border-[#38bdf8]"
          />
        </div>
      )}

      <div className="h-4 w-px bg-[#2a2e39] mx-0.5" />

      {/* 7. Settings Gear Icon */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={() => {
            audioHaptics.tick();
            onOpenSettings();
          }}
          className="p-1 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39] transition"
          title="Settings (Double-click drawing or click here)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

      {/* 8. Lock Padlock Icon */}
      <button
        type="button"
        onClick={() => {
          audioHaptics.tick();
          onUpdateDrawing(selectedDrawing.id, { locked: !selectedDrawing.locked });
        }}
        className={`p-1 rounded transition ${
          selectedDrawing.locked
            ? 'text-amber-400 bg-amber-400/15 hover:bg-amber-400/25'
            : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
        }`}
        title={selectedDrawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
      >
        {selectedDrawing.locked ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* 9. Delete Trash Icon */}
      <button
        type="button"
        onClick={() => {
          audioHaptics.tick();
          onDeleteDrawing(selectedDrawing.id);
        }}
        className="p-1 rounded text-[#787b86] hover:text-red-400 hover:bg-red-500/10 transition"
        title="Delete Drawing (Del / Backspace)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      {/* 10. More Options (...) Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'MORE' ? null : 'MORE')}
          className={`p-1 rounded hover:bg-[#2a2e39] transition ${
            activeMenu === 'MORE' ? 'bg-[#2a2e39] text-[#d1d4dc]' : 'text-[#787b86] hover:text-[#d1d4dc]'
          }`}
          title="More options (Visual order, templates)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>

        {activeMenu === 'MORE' && (
          <div className="absolute right-0 bottom-full mb-1.5 z-50 w-48 rounded-lg border border-[#2a2e39] bg-[#1e222d] p-1.5 shadow-2xl backdrop-blur-xl">
            {/* Visual Order */}
            <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider px-2 py-1 border-b border-[#2a2e39] mb-1">
              Visual Order
            </div>
            <button
              onClick={() => {
                audioHaptics.tick();
                onBringToFront?.(selectedDrawing.id);
                setActiveMenu(null);
              }}
              className="flex w-full items-center justify-between px-2.5 py-1 text-left text-xs text-[#d1d4dc] hover:bg-[#2a2e39] rounded transition"
            >
              <span>Bring to Front</span>
              <span className="text-[9px] text-[#787b86]">Top</span>
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                onSendToBack?.(selectedDrawing.id);
                setActiveMenu(null);
              }}
              className="flex w-full items-center justify-between px-2.5 py-1 text-left text-xs text-[#d1d4dc] hover:bg-[#2a2e39] rounded transition"
            >
              <span>Send to Back</span>
              <span className="text-[9px] text-[#787b86]">Bottom</span>
            </button>

            {/* Templates Section */}
            <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider px-2 py-1 border-t border-[#2a2e39] mt-1.5 mb-1">
              Template
            </div>
            <div className="flex items-center gap-1 px-1 mb-1">
              <input
                type="text"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder="Name..."
                className="bg-[#131722] border border-[#2a2e39] px-1.5 py-0.5 rounded text-[10px] text-[#d1d4dc] w-full focus:outline-none focus:border-[#38bdf8]"
              />
              <button
                onClick={() => {
                  if (templateNameInput.trim()) {
                    saveTemplate(templateNameInput.trim(), {
                      color: selectedDrawing.color,
                      lineOpacity: selectedDrawing.lineOpacity,
                      lineWidth: selectedDrawing.lineWidth,
                      lineStyle: selectedDrawing.lineStyle,
                      fillColor: selectedDrawing.fillColor,
                      fillOpacity: selectedDrawing.fillOpacity,
                    });
                    setTemplateNameInput('');
                    setActiveMenu(null);
                  }
                }}
                className="px-2 py-0.5 rounded bg-[#38bdf8] text-black font-bold text-[10px] hover:bg-[#38bdf8]/90 transition"
              >
                Save
              </button>
            </div>

            {Object.keys(templates).length > 0 && (
              <div className="flex flex-col gap-0.5 border-t border-[#2a2e39] pt-1 mt-1">
                <span className="text-[9px] text-[#787b86] px-2">Apply Template:</span>
                {Object.entries(templates).map(([name, tmpl]) => (
                  <button
                    key={name}
                    onClick={() => {
                      onUpdateDrawing(selectedDrawing.id, tmpl);
                      setActiveMenu(null);
                    }}
                    className="text-left text-[11px] text-[#d1d4dc] hover:text-white hover:bg-[#2a2e39] px-2 py-1 rounded transition"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-[#2a2e39] mx-0.5" />

      {/* 11. Close Deselect Button */}
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39] transition text-[11px] leading-none"
        title="Deselect"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
