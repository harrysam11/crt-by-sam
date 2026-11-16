/**
 * TradingView-Style In-Depth Drawing Settings Modal.
 * Opens on double-clicking any drawing or clicking the Settings gear on the floating context bar.
 * Allows comprehensive editing of:
 * - Style: Line color, width, style, opacity, fill color & opacity, extend left/right
 * - Text: Custom text label on drawing, text color, font size, alignment, show price badge
 * - Notes: Rich notes on drawing (displayed on hover over the drawing on the chart)
 * - Coordinates: Exact prices and timestamps for P1, P2, P3
 * - Visibility & Locking: Lock, Hide, Delete
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { DrawingItem } from './types';
import { audioHaptics } from '../../utils/notify';
import { fmtPrice } from '../../utils/formatters';

interface DrawingSettingsModalProps {
  isOpen: boolean;
  drawing: DrawingItem | null;
  symbol: string;
  onClose: () => void;
  onSave: (id: string, patch: Partial<DrawingItem>) => void;
  onDelete: (id: string) => void;
}

const PRESET_COLORS = [
  '#38bdf8', // Cyan
  '#22c55e', // Green
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#ffffff', // White
  '#71717a', // Slate
  '#f97316', // Orange
];

export default function DrawingSettingsModal({
  isOpen,
  drawing,
  symbol,
  onClose,
  onSave,
  onDelete,
}: DrawingSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'STYLE' | 'TEXT' | 'COORDINATES' | 'VISIBILITY'>('STYLE');

  // Form states initialized from drawing
  const [color, setColor] = useState('#38bdf8');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [fillColor, setFillColor] = useState('#38bdf8');
  const [fillOpacity, setFillOpacity] = useState(0.15);
  const [hasFill, setHasFill] = useState(false);
  const [extendLeft, setExtendLeft] = useState(false);
  const [extendRight, setExtendRight] = useState(false);

  // Text & Notes states
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(12);
  const [textPosition, setTextPosition] = useState<'top' | 'middle' | 'bottom'>('top');
  const [showPrice, setShowPrice] = useState(false);
  const [notes, setNotes] = useState('');

  // Coordinates
  const [p1Price, setP1Price] = useState<number>(0);
  const [p2Price, setP2Price] = useState<number>(0);
  const [p3Price, setP3Price] = useState<number>(0);

  // Locks & Visibility
  const [locked, setLocked] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Movable Dialog Window position state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Initialize position to comfortable center-right view on first open so chart stays visible
  useEffect(() => {
    if (isOpen && pos === null) {
      const initX = typeof window !== 'undefined' ? Math.max(20, Math.min(window.innerWidth - 500, Math.round((window.innerWidth - 480) / 2))) : 280;
      const initY = typeof window !== 'undefined' ? Math.max(50, Math.min(window.innerHeight - 560, 90)) : 90;
      setPos({ x: initX, y: initY });
    }
  }, [isOpen]);

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = pos?.x ?? 280;
    const startPosY = pos?.y ?? 90;

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEv.clientX - startMouseX;
      const dy = moveEv.clientY - startMouseY;
      const newX = Math.max(8, Math.min(window.innerWidth - 300, startPosX + dx));
      const newY = Math.max(40, Math.min(window.innerHeight - 150, startPosY + dy));
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

  useEffect(() => {
    if (!drawing) return;
    setColor(drawing.color || '#38bdf8');
    setLineWidth(drawing.lineWidth || 2);
    setLineStyle(drawing.lineStyle || 'solid');
    setFillColor(drawing.fillColor || drawing.color || '#38bdf8');
    setFillOpacity(drawing.fillOpacity !== undefined ? drawing.fillOpacity : 0.15);
    setHasFill(!!drawing.fillColor || drawing.fillOpacity !== undefined);
    setExtendLeft(!!drawing.extendLeft);
    setExtendRight(!!drawing.extendRight);

    setText(drawing.text || '');
    setTextColor(drawing.textColor || '#ffffff');
    setFontSize(drawing.fontSize || 12);
    setTextPosition(drawing.textPosition || 'top');
    setShowPrice(!!drawing.showPrice);
    setNotes(drawing.notes || '');

    setP1Price(drawing.p1.price);
    setP2Price(drawing.p2 ? drawing.p2.price : 0);
    setP3Price(drawing.p3 ? drawing.p3.price : 0);

    setLocked(!!drawing.locked);
    setHidden(!!drawing.hidden);
  }, [drawing]);

  if (!isOpen || !drawing) return null;

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
  ].includes(drawing.type);

  const supportsExtend = ['TRENDLINE', 'RAY'].includes(drawing.type);

  const handleApply = () => {
    audioHaptics.tick();
    const patch: Partial<DrawingItem> = {
      color,
      lineWidth,
      lineStyle,
      fillColor: hasFill ? fillColor : undefined,
      fillOpacity: hasFill ? fillOpacity : undefined,
      extendLeft,
      extendRight,
      text: text.trim() ? text.trim() : undefined,
      textColor,
      fontSize,
      textPosition,
      showPrice,
      notes: notes.trim() ? notes.trim() : undefined,
      locked,
      hidden,
      p1: { ...drawing.p1, price: p1Price },
      p2: drawing.p2 ? { ...drawing.p2, price: p2Price } : undefined,
      p3: drawing.p3 ? { ...drawing.p3, price: p3Price } : undefined,
    };
    onSave(drawing.id, patch);
    onClose();
  };

  const handleDelete = () => {
    audioHaptics.tick();
    onDelete(drawing.id);
    onClose();
  };

  return (
    <div
      data-drawing-settings-modal="true"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        left: `${pos?.x ?? 280}px`,
        top: `${pos?.y ?? 90}px`,
      }}
      className="fixed z-50 w-[490px] max-w-[94vw] rounded-xl border border-grid bg-[#0c0d14]/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-mono select-none pointer-events-auto ring-1 ring-white/10"
    >
      {/* Header (Draggable Handle) */}
      <div
        onPointerDown={startDrag}
        className="flex items-center justify-between border-b border-grid px-4 py-2.5 bg-panel/80 cursor-move select-none"
        title="Click and drag to move settings anywhere on screen"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <svg className="h-3.5 w-3.5 text-slate-400 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-bold tracking-wide text-white uppercase">
            {drawing.type.replace('_', ' ')} Settings
          </h3>
          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-grid">
            {symbol}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close (Esc)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-grid bg-[#10111a] px-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('STYLE')}
            className={`px-3 py-2.5 border-b-2 transition ${
              activeTab === 'STYLE'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Style
          </button>
          <button
            onClick={() => setActiveTab('TEXT')}
            className={`px-3 py-2.5 border-b-2 transition ${
              activeTab === 'TEXT'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Text & Notes
          </button>
          <button
            onClick={() => setActiveTab('COORDINATES')}
            className={`px-3 py-2.5 border-b-2 transition ${
              activeTab === 'COORDINATES'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Coordinates
          </button>
          <button
            onClick={() => setActiveTab('VISIBILITY')}
            className={`px-3 py-2.5 border-b-2 transition ${
              activeTab === 'VISIBILITY'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Visibility
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
          {/* TAB 1: STYLE */}
          {activeTab === 'STYLE' && (
            <div className="space-y-4">
              {/* Color & Line Width */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Line Style & Color</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-lg border border-grid">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-5 w-5 rounded-full border transition ${
                          color === c ? 'border-white scale-110 shadow-md' : 'border-black/50 hover:scale-105'
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-5 w-5 rounded-full cursor-pointer bg-transparent border-0 p-0"
                      title="Custom Color"
                    />
                  </div>

                  {/* Width */}
                  <select
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-slate-900 border border-grid focus:outline-none"
                  >
                    <option value={1}>1 px</option>
                    <option value={2}>2 px</option>
                    <option value={3}>3 px</option>
                    <option value={4}>4 px</option>
                  </select>

                  {/* Style */}
                  <select
                    value={lineStyle}
                    onChange={(e) => setLineStyle(e.target.value as any)}
                    className="clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-slate-900 border border-grid focus:outline-none"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
              </div>

              {/* Background Fill (if supported) */}
              {supportsFill && (
                <div className="space-y-2 border-t border-grid/60 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasFill}
                        onChange={(e) => setHasFill(e.target.checked)}
                        className="rounded border-grid text-accent focus:ring-0"
                      />
                      <span>Background Fill</span>
                    </label>
                  </div>

                  {hasFill && (
                    <div className="flex items-center gap-3 pl-5">
                      <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-lg border border-grid">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setFillColor(c)}
                            style={{ backgroundColor: c }}
                            className={`h-5 w-5 rounded-full border transition ${
                              fillColor === c ? 'border-white scale-110 shadow-md' : 'border-black/50 hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-slate-400 text-[10px]">Opacity:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={fillOpacity}
                          onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
                          className="flex-1 accent-accent"
                        />
                        <span className="text-slate-200 text-[10px] w-8 font-mono">{Math.round(fillOpacity * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Extend Left / Right (for trendlines / rays) */}
              {supportsExtend && (
                <div className="space-y-2 border-t border-grid/60 pt-3">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Line Extension</label>
                  <div className="flex items-center gap-6 pl-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={extendLeft}
                        onChange={(e) => setExtendLeft(e.target.checked)}
                        className="rounded border-grid text-accent focus:ring-0"
                      />
                      <span>Extend Left</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={extendRight}
                        onChange={(e) => setExtendRight(e.target.checked)}
                        className="rounded border-grid text-accent focus:ring-0"
                      />
                      <span>Extend Right</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEXT & NOTES */}
          {activeTab === 'TEXT' && (
            <div className="space-y-4">
              {/* Custom Text Label */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Drawing Label Text</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Support / Order Block / Key Liquidity"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full clay-inset px-3 py-2 text-xs text-white rounded bg-slate-900 border border-grid focus:outline-none focus:border-accent"
                />
              </div>

              {/* Text Styling Options */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Text Color</label>
                  <div className="flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded border border-grid">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-5 w-5 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] font-mono text-slate-300">{textColor}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Font Size</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-slate-900 border border-grid focus:outline-none"
                  >
                    <option value={10}>10 px</option>
                    <option value={12}>12 px</option>
                    <option value={14}>14 px</option>
                    <option value={16}>16 px</option>
                    <option value={20}>20 px</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Alignment</label>
                  <select
                    value={textPosition}
                    onChange={(e) => setTextPosition(e.target.value as any)}
                    className="w-full clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-slate-900 border border-grid focus:outline-none"
                  >
                    <option value="top">Top</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
              </div>

              {/* Show Price Tag checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Show exact price level badge on chart</span>
                </label>
              </div>

              {/* Custom Drawing Notes (Shown on hover) */}
              <div className="space-y-1.5 border-t border-grid/60 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-accent font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Hover Notes (Displayed on mouse hover)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Hovering this drawing shows these notes</span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Enter strategic trade notes, execution triggers, or context...&#10;e.g. Wait for 15m candle close below 90,800 before entering short. Target 89,200."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full clay-inset px-3 py-2 text-xs text-slate-200 rounded bg-slate-900/90 border border-grid focus:outline-none focus:border-accent resize-none leading-relaxed"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['[KEY LEVEL]', '[LIQUIDITY POOL]', '[ORDER BLOCK]', '[STOP HUNT]', '[RISK NOTE]'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNotes((prev) => (prev ? `${prev} ${tag}` : tag))}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 hover:text-white hover:bg-slate-700 transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COORDINATES */}
          {activeTab === 'COORDINATES' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-400">
                Fine-tune exact numeric prices and anchor point timestamps for this {drawing.type.replace('_', ' ')}.
              </p>

              {/* Point 1 */}
              <div className="p-2.5 rounded bg-slate-900 border border-grid space-y-2">
                <span className="text-[11px] font-bold text-slate-300">Point 1</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Price</label>
                    <input
                      type="number"
                      step="any"
                      value={p1Price}
                      onChange={(e) => setP1Price(parseFloat(e.target.value) || 0)}
                      className="w-full clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-[#090a0f] border border-grid focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Time</label>
                    <input
                      type="text"
                      disabled
                      value={drawing.p1.time ? new Date(drawing.p1.time * 1000).toLocaleString() : 'N/A'}
                      className="w-full px-2.5 py-1.5 text-xs text-slate-400 rounded bg-slate-800 border border-grid cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Point 2 */}
              {drawing.p2 && (
                <div className="p-2.5 rounded bg-slate-900 border border-grid space-y-2">
                  <span className="text-[11px] font-bold text-slate-300">Point 2</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Price</label>
                      <input
                        type="number"
                        step="any"
                        value={p2Price}
                        onChange={(e) => setP2Price(parseFloat(e.target.value) || 0)}
                        className="w-full clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-[#090a0f] border border-grid focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Time</label>
                      <input
                        type="text"
                        disabled
                        value={drawing.p2.time ? new Date(drawing.p2.time * 1000).toLocaleString() : 'N/A'}
                        className="w-full px-2.5 py-1.5 text-xs text-slate-400 rounded bg-slate-800 border border-grid cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Point 3 */}
              {drawing.p3 && (
                <div className="p-2.5 rounded bg-slate-900 border border-grid space-y-2">
                  <span className="text-[11px] font-bold text-slate-300">Point 3</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Price</label>
                      <input
                        type="number"
                        step="any"
                        value={p3Price}
                        onChange={(e) => setP3Price(parseFloat(e.target.value) || 0)}
                        className="w-full clay-inset px-2.5 py-1.5 text-xs text-white rounded bg-[#090a0f] border border-grid focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Time</label>
                      <input
                        type="text"
                        disabled
                        value={drawing.p3.time ? new Date(drawing.p3.time * 1000).toLocaleString() : 'N/A'}
                        className="w-full px-2.5 py-1.5 text-xs text-slate-400 rounded bg-slate-800 border border-grid cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VISIBILITY & ACTIONS */}
          {activeTab === 'VISIBILITY' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded bg-slate-900 border border-grid hover:border-slate-600 transition">
                  <input
                    type="checkbox"
                    checked={locked}
                    onChange={(e) => setLocked(e.target.checked)}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <div>
                    <div className="font-bold text-white text-xs">Lock Drawing</div>
                    <div className="text-[10px] text-slate-400">Prevent accidental repositioning or handle dragging</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2 rounded bg-slate-900 border border-grid hover:border-slate-600 transition">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(e) => setHidden(e.target.checked)}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <div>
                    <div className="font-bold text-white text-xs">Hide Drawing</div>
                    <div className="text-[10px] text-slate-400">Temporarily hide from the chart canvas</div>
                  </div>
                </label>
              </div>

              {/* Danger Zone */}
              <div className="border-t border-grid pt-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full py-2 px-3 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white transition font-semibold text-xs flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete This Drawing</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid px-4 py-3 bg-panel/80">
          <button
            type="button"
            onClick={handleDelete}
            className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline"
          >
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition border border-grid"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 rounded text-xs font-bold text-white bg-accent hover:brightness-110 shadow-lg transition"
            >
              Apply & Save
            </button>
        </div>
      </div>
    </div>
  );
}
