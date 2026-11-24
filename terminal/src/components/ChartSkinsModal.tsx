import React, { useState, useRef } from 'react';
import { usePsychologyStore } from '../store/usePsychologyStore';
import { WALLPAPER_PRESETS, type WallpaperPreset } from './ChartSkinsLayer';
import { audioHaptics } from '../utils/notify';
import { validateWallpaperFile, sanitizeMediaUrl } from '../utils/security';
import { saveCustomWallpaper, clearCustomWallpaper } from '../services/wallpaperStorage';
import type { WallpaperFitMode } from '../types/psychology';

interface ChartSkinsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChartSkinsModal({ isOpen, onClose }: ChartSkinsModalProps) {
  const themeConfig = usePsychologyStore((s) => s.themeConfig);
  const setThemeConfig = usePsychologyStore((s) => s.setThemeConfig);

  const [filterCategory, setFilterCategory] = useState<'ALL' | 'VIDEO' | 'GIF' | 'IMAGE'>('ALL');
  const [customUrl, setCustomUrl] = useState('');
  const [customType, setCustomType] = useState<'IMAGE' | 'GIF' | 'VIDEO'>('VIDEO');
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Drag-to-relocate state for interactive preview canvas
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  if (!isOpen) return null;

  const filteredPresets = WALLPAPER_PRESETS.filter(
    (p) => filterCategory === 'ALL' || p.category === filterCategory
  );

  const currentScale = themeConfig.scale ?? 1.0;
  const currentOffsetX = themeConfig.offsetX ?? 0;
  const currentOffsetY = themeConfig.offsetY ?? 0;
  const currentFitMode = themeConfig.fitMode ?? 'cover';
  const currentRotation = themeConfig.rotation ?? 0;
  const currentFlipH = themeConfig.flipH ?? false;
  const currentFlipV = themeConfig.flipV ?? false;
  const currentSpeed = themeConfig.playbackSpeed ?? 1.0;

  // Handle local file upload (converts local file to a memory Blob URL, supporting up to 100MB)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateWallpaperFile(file);
    if (!validation.ok) {
      setUploadNotice(validation.error || 'Invalid file.');
      setTimeout(() => setUploadNotice(null), 4000);
      return;
    }

    audioHaptics.tick();
    const objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    const determinedType: 'VIDEO' | 'GIF' | 'IMAGE' = isVideo ? 'VIDEO' : isGif ? 'GIF' : 'IMAGE';

    // Persist blob to IndexedDB so it never disappears on page refresh
    saveCustomWallpaper(file, file.name, determinedType).catch((err) => {
      console.warn('Could not persist wallpaper in IndexedDB:', err);
    });

    setThemeConfig({
      wallpaperType: determinedType,
      mediaUrl: objectUrl,
      fitMode: 'cover',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      playbackSpeed: 1.0,
    });
    setUploadNotice(`Loaded local ${determinedType} (${(file.size / (1024 * 1024)).toFixed(1)}MB): ${file.name}`);
    setTimeout(() => setUploadNotice(null), 3500);
  };

  const handleApplyPreset = (preset: WallpaperPreset) => {
    audioHaptics.tick();
    setThemeConfig({
      wallpaperType: preset.type,
      mediaUrl: preset.url,
      overlayOpacity: themeConfig.overlayOpacity > 0.65 ? 0.45 : themeConfig.overlayOpacity,
      fitMode: 'cover',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      playbackSpeed: 1.0,
    });
  };

  const handleApplyCustomUrl = () => {
    if (!customUrl.trim()) return;
    const safeUrl = sanitizeMediaUrl(customUrl.trim());
    if (!safeUrl) {
      setUploadNotice('Invalid URL. Only secure http/https URLs with safe characters are accepted.');
      setTimeout(() => setUploadNotice(null), 4000);
      return;
    }

    audioHaptics.tick();
    let detectedType = customType;
    const lower = safeUrl.toLowerCase();
    if (lower.endsWith('.gif')) detectedType = 'GIF';
    else if (lower.endsWith('.mp4') || lower.endsWith('.webm')) detectedType = 'VIDEO';

    setThemeConfig({
      wallpaperType: detectedType,
      mediaUrl: safeUrl,
      fitMode: 'cover',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      playbackSpeed: 1.0,
    });
    setCustomUrl('');
  };

  const SOLID_COLOR_PRESETS = [
    { name: 'Charcoal Dark', hex: '#141413' },
    { name: 'Pitch Black', hex: '#000000' },
    { name: 'Deep Void', hex: '#080808' },
    { name: 'Institutional Slate', hex: '#181817' },
    { name: 'TradingView Dark', hex: '#131722' },
    { name: 'Midnight Navy', hex: '#0b0e14' },
    { name: 'Cyber Graphite', hex: '#1e1e24' },
    { name: 'Emerald Shadow', hex: '#0a1914' },
    { name: 'Pure White', hex: '#ffffff' },
    { name: 'Soft Light Gray', hex: '#f4f4f6' },
  ];

  const handleApplySolidColor = (color: string) => {
    audioHaptics.tick();
    clearCustomWallpaper().catch(() => {});
    setThemeConfig({
      wallpaperType: 'SOLID',
      solidColor: color,
      mediaUrl: null,
      fitMode: 'cover',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      playbackSpeed: 1.0,
    });
  };

  const handleResetSolid = () => {
    handleApplySolidColor('#141413');
  };

  const handleResetTransform = () => {
    audioHaptics.tick();
    setThemeConfig({
      fitMode: 'cover',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      playbackSpeed: 1.0,
    });
  };

  const handleRotate90 = () => {
    audioHaptics.tick();
    const nextRotation = (currentRotation + 90) % 360;
    setThemeConfig({ rotation: nextRotation });
  };

  const handleToggleFlipH = () => {
    audioHaptics.tick();
    setThemeConfig({ flipH: !currentFlipH });
  };

  const handleToggleFlipV = () => {
    audioHaptics.tick();
    setThemeConfig({ flipV: !currentFlipV });
  };

  const applyAnchorPreset = (x: number, y: number) => {
    audioHaptics.tick();
    setThemeConfig({ offsetX: x, offsetY: y });
  };

  // Drag handling for visual relocation canvas
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initX: currentOffsetX,
      initY: currentOffsetY,
    };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.startX;
    const dy = clientY - dragStartRef.current.startY;
    const newX = Math.round(Math.max(-100, Math.min(100, dragStartRef.current.initX + dx * 0.4)));
    const newY = Math.round(Math.max(-100, Math.min(100, dragStartRef.current.initY + dy * 0.4)));
    setThemeConfig({ offsetX: newX, offsetY: newY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const isMediaActive = themeConfig.wallpaperType !== 'SOLID' && !!themeConfig.mediaUrl;
  const safeMediaUrl = sanitizeMediaUrl(themeConfig.mediaUrl);

  const previewTransform = [
    `translate(${currentOffsetX}%, ${currentOffsetY}%)`,
    `scale(${currentScale * (currentFlipH ? -1 : 1)}, ${currentScale * (currentFlipV ? -1 : 1)})`,
    currentRotation ? `rotate(${currentRotation}deg)` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-3xl max-h-[92vh] rounded-xl border border-white/[0.08] bg-panel p-4 sm:p-6 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              ChartSkins Background Engine (100MB Video, GIF & Image)
            </h3>
          </div>
          <button onClick={onClose} className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white" aria-label="Close">
            [ESC / Close]
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
          {/* Category Tabs & Solid Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid pb-2">
            <div className="flex items-center gap-1.5">
              {(['ALL', 'VIDEO', 'GIF', 'IMAGE'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    audioHaptics.tick();
                    setFilterCategory(cat);
                  }}
                  className={`rounded px-2.5 py-1 text-xs transition ${
                    filterCategory === cat
                      ? 'bg-accent/20 border border-accent text-accent font-semibold'
                      : 'border border-grid text-muted hover:text-white'
                  }`}
                >
                  {cat === 'ALL' ? 'All Formats' : cat}
                </button>
              ))}
            </div>

            <button
              onClick={handleResetSolid}
              className={`rounded border px-2.5 py-1 text-xs transition ${
                themeConfig.wallpaperType === 'SOLID'
                  ? 'border-white bg-white/10 text-white font-bold'
                  : 'border-grid text-muted hover:text-white'
              }`}
            >
              [Reset Solid Charcoal]
            </button>
          </div>

          {/* Custom Solid Background Color Section */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <span className="text-xs font-bold text-white block">Custom Solid Canvas Background</span>
                <span className="text-[10px] text-slate-400 block">Choose an institutional dark tone or pick any custom solid color</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white uppercase">{themeConfig.solidColor || '#141413'}</span>
                <input
                  type="color"
                  value={themeConfig.solidColor || '#141413'}
                  onChange={(e) => handleApplySolidColor(e.target.value)}
                  className="h-7 w-8 rounded cursor-pointer border border-white/20 bg-transparent p-0"
                  title="Pick Any Solid Background Color"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SOLID_COLOR_PRESETS.map((preset) => {
                const isActive =
                  themeConfig.wallpaperType === 'SOLID' &&
                  (themeConfig.solidColor || '#141413').toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplySolidColor(preset.hex)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition text-xs ${
                      isActive
                        ? 'border-white bg-white/15 font-bold text-white'
                        : 'border-white/10 bg-black/50 text-slate-300 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span className="truncate text-[10px]">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transform, Crop & Relocation Engine (Active when media is loaded) */}
          {isMediaActive && (
            <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-3.5 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Resize, Crop, Scale & Relocate Engine
                  </span>
                </div>
                <button
                  onClick={handleResetTransform}
                  className="rounded border border-grid px-2 py-0.5 text-[10px] text-muted hover:text-white transition"
                  title="Reset Scale, Position and Rotation to Default"
                >
                  Reset Transforms
                </button>
              </div>

              {/* Interactive Drag-to-Relocate Canvas Preview */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>Interactive Canvas Preview (Drag to Relocate / Pan)</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    X: {currentOffsetX > 0 ? `+${currentOffsetX}` : currentOffsetX}% │ Y: {currentOffsetY > 0 ? `+${currentOffsetY}` : currentOffsetY}% │ Zoom: {Math.round(currentScale * 100)}%
                  </span>
                </div>
                <div
                  onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                  onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={(e) => e.touches[0] && handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchMove={(e) => e.touches[0] && handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={handleDragEnd}
                  className={`relative w-full h-36 sm:h-44 rounded-lg overflow-hidden border border-white/20 bg-black/90 select-none ${
                    isDragging ? 'cursor-grabbing ring-1 ring-cyan-400' : 'cursor-grab'
                  }`}
                  title="Click & drag or swipe to relocate background"
                >
                  {/* Media in preview */}
                  {safeMediaUrl && (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      {themeConfig.wallpaperType === 'VIDEO' ? (
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          src={safeMediaUrl}
                          style={{
                            objectFit: currentFitMode,
                            transform: previewTransform,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          }}
                          className="h-full w-full pointer-events-none"
                        />
                      ) : (
                        <img
                          src={safeMediaUrl}
                          alt="Preview"
                          style={{
                            objectFit: currentFitMode,
                            transform: previewTransform,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          }}
                          className="h-full w-full pointer-events-none"
                        />
                      )}
                    </div>
                  )}

                  {/* Dark overlay matching user settings */}
                  <div
                    className="absolute inset-0 bg-[#0b0e14] pointer-events-none"
                    style={{ opacity: themeConfig.overlayOpacity * 0.7 }}
                  />

                  {/* Crosshair guide overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                    <div className="w-full h-px bg-cyan-400" />
                    <div className="h-full w-px bg-cyan-400 absolute" />
                  </div>

                  {/* Drag prompt pill */}
                  <div className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[9px] text-slate-300 pointer-events-none border border-white/10">
                    {isDragging ? 'Dragging...' : 'Click & Drag to Relocate'}
                  </div>

                  {/* Quick Center Pill */}
                  {(currentOffsetX !== 0 || currentOffsetY !== 0) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        applyAnchorPreset(0, 0);
                      }}
                      className="absolute top-2 right-2 bg-cyan-500/90 text-black font-bold px-2 py-0.5 rounded text-[10px] hover:bg-cyan-400 transition"
                    >
                      Center
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Fit & Crop Mode Selector */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Fit & Crop Mode
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'cover', label: 'Fill & Crop (cover)', desc: 'Fills viewport, crops overflow' },
                      { id: 'contain', label: 'Fit Whole (contain)', desc: 'Fits entire aspect ratio' },
                      { id: 'fill', label: 'Stretch (fill)', desc: 'Stretches 100% width/height' },
                      { id: 'none', label: 'Original (none)', desc: '1:1 native resolution' },
                    ] as { id: WallpaperFitMode; label: string; desc: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        audioHaptics.tick();
                        setThemeConfig({ fitMode: m.id });
                      }}
                      className={`rounded-lg p-2 text-left border transition ${
                        currentFitMode === m.id
                          ? 'border-cyan-400 bg-cyan-400/20 text-white font-bold ring-1 ring-cyan-400'
                          : 'border-grid bg-slate-900/60 text-muted hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <div className="text-xs">{m.label}</div>
                      <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Resize / Zoom Scale Slider & Presets */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-300 font-semibold">Resize / Zoom Scale</span>
                  <div className="flex items-center gap-1">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          audioHaptics.tick();
                          setThemeConfig({ scale: s });
                        }}
                        className={`px-1.5 py-0.5 text-[9px] rounded border transition ${
                          Math.abs(currentScale - s) < 0.01
                            ? 'border-cyan-400 bg-cyan-400 text-black font-bold'
                            : 'border-grid text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {Math.round(s * 100)}%
                      </button>
                    ))}
                    <span className="font-mono text-cyan-300 font-bold ml-1">
                      {Math.round(currentScale * 100)}%
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="3.0"
                  step="0.05"
                  value={currentScale}
                  onChange={(e) => setThemeConfig({ scale: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* 3. Relocation / Pan Sliders & Position Anchor Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Sliders */}
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-muted mb-0.5">
                      <span>Horizontal Pan (X Offset)</span>
                      <span className="font-mono text-cyan-300 font-bold">{currentOffsetX}%</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={currentOffsetX}
                      onChange={(e) => setThemeConfig({ offsetX: parseInt(e.target.value, 10) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted mb-0.5">
                      <span>Vertical Pan (Y Offset)</span>
                      <span className="font-mono text-cyan-300 font-bold">{currentOffsetY}%</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={currentOffsetY}
                      onChange={(e) => setThemeConfig({ offsetY: parseInt(e.target.value, 10) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                {/* Quick Anchor Matrix & Transforms */}
                <div className="flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                      Quick Relocate Presets:
                    </span>
                    <div className="grid grid-cols-3 gap-1 max-w-[200px]">
                      {[
                        { label: 'TL', x: -30, y: -30 },
                        { label: 'Top', x: 0, y: -30 },
                        { label: 'TR', x: 30, y: -30 },
                        { label: 'Left', x: -30, y: 0 },
                        { label: 'Center', x: 0, y: 0 },
                        { label: 'Right', x: 30, y: 0 },
                        { label: 'BL', x: -30, y: 30 },
                        { label: 'Bottom', x: 0, y: 30 },
                        { label: 'BR', x: 30, y: 30 },
                      ].map((a) => (
                        <button
                          key={a.label}
                          onClick={() => applyAnchorPreset(a.x, a.y)}
                          className={`py-1 text-[10px] rounded border transition ${
                            currentOffsetX === a.x && currentOffsetY === a.y
                              ? 'border-cyan-400 bg-cyan-400/30 text-white font-bold'
                              : 'border-grid bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orientation Toggles */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleRotate90}
                      className={`px-2 py-1 rounded border text-[10px] transition ${
                        currentRotation > 0
                          ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 font-bold'
                          : 'border-grid text-slate-300 hover:text-white'
                      }`}
                    >
                      Rotate ({currentRotation}°)
                    </button>
                    <button
                      onClick={handleToggleFlipH}
                      className={`px-2 py-1 rounded border text-[10px] transition ${
                        currentFlipH
                          ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 font-bold'
                          : 'border-grid text-slate-300 hover:text-white'
                      }`}
                    >
                      Flip H
                    </button>
                    <button
                      onClick={handleToggleFlipV}
                      className={`px-2 py-1 rounded border text-[10px] transition ${
                        currentFlipV
                          ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 font-bold'
                          : 'border-grid text-slate-300 hover:text-white'
                      }`}
                    >
                      Flip V
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Video Playback Speed (shown if video is active) */}
              {themeConfig.wallpaperType === 'VIDEO' && (
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">Video Playback Speed</span>
                    <span className="font-mono text-cyan-300 font-bold">{currentSpeed}x</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => {
                          audioHaptics.tick();
                          setThemeConfig({ playbackSpeed: spd });
                        }}
                        className={`px-2 py-1 text-xs rounded border transition ${
                          currentSpeed === spd
                            ? 'border-cyan-400 bg-cyan-400 text-black font-bold'
                            : 'border-grid text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

{/* Curated Presets Grid */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-2">
              Curated Lo-Fi & High-FPS Wallpapers ({filteredPresets.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredPresets.map((p) => {
                const isSelected = themeConfig.mediaUrl === p.url;
                return (
                  <button
                    key={p.name}
                    onClick={() => handleApplyPreset(p)}
                    className={`rounded-xl border p-2.5 text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-accent bg-accent/20 text-white ring-1 ring-accent'
                        : 'border-grid bg-slate-900/50 text-muted hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                            p.type === 'VIDEO'
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                              : p.type === 'GIF'
                              ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                              : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          }`}
                        >
                          {p.type}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] text-accent font-bold">[ACTIVE]</span>
                        )}
                      </div>
                      <div className="font-bold text-xs text-white leading-tight mb-0.5">{p.name}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{p.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Local File Upload Picker (Supports Up to 100MB) */}
          <div className="rounded-xl border border-grid bg-slate-950/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Upload From Local Computer
              </span>
              <span className="text-[10px] text-accent font-semibold">
                Supports MP4, WebM, GIF, PNG, JPG, WebP (Up to 100MB)
              </span>
            </div>
            <label className="flex flex-col items-center justify-center border border-dashed border-grid rounded-lg p-3 hover:border-accent hover:bg-slate-900/60 transition cursor-pointer">
              <span className="text-xs text-accent font-semibold mb-0.5">Click or Drag & Drop File</span>
              <span className="text-[10px] text-muted">Instant local playback (up to 100MB video/image)</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {uploadNotice && (
              <p className="text-[11px] text-cyan-300 font-semibold text-center">{uploadNotice}</p>
            )}
          </div>

          {/* Custom Web URL Input */}
          <div className="rounded-xl border border-grid bg-slate-950/40 p-3 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white block">
              Load From Web URL
            </span>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value as 'IMAGE' | 'GIF' | 'VIDEO')}
                className="rounded border border-grid bg-bg px-2 py-1 text-xs text-white focus:outline-none shrink-0"
              >
                <option value="VIDEO">MP4 / WebM Video</option>
                <option value="GIF">Animated GIF</option>
                <option value="IMAGE">Static Wallpaper (JPG/PNG)</option>
              </select>
              <input
                type="url"
                placeholder="https://.../wallpaper.gif or .mp4"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 min-w-[180px] rounded border border-grid bg-bg px-2.5 py-1 text-xs text-white placeholder:text-muted/50 focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleApplyCustomUrl}
                disabled={!customUrl.trim()}
                className="rounded bg-accent px-3 py-1 text-xs font-bold text-black hover:brightness-110 disabled:opacity-40 shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

                    {/* Opacity & Aesthetic Blur Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-grid bg-slate-950/40 p-3">
            {/* Dark Blend Opacity */}
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Dark Blend Opacity</span>
                <span className="font-mono text-white font-bold">
                  {Math.round(themeConfig.overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={themeConfig.overlayOpacity}
                onChange={(e) => setThemeConfig({ overlayOpacity: parseFloat(e.target.value) })}
                className="w-full accent-accent"
              />
              <span className="text-[10px] text-muted block mt-0.5">
                Controls chart contrast over background
              </span>
            </div>

            {/* Aesthetic Blur Slider */}
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Aesthetic Wallpaper Blur</span>
                <span className="font-mono text-white font-bold">
                  {themeConfig.blurAmount ?? 0}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={themeConfig.blurAmount ?? 0}
                onChange={(e) => setThemeConfig({ blurAmount: parseInt(e.target.value, 10) })}
                className="w-full accent-accent"
              />
              <span className="text-[10px] text-muted block mt-0.5">
                Softens media details to maximize candle focus
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-3 border-t border-grid pt-2.5 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-muted">
            Format Active: {themeConfig.wallpaperType} │ Fit: {currentFitMode} │ Scale: {Math.round(currentScale * 100)}%
          </span>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="rounded bg-accent px-4 py-1.5 text-xs font-bold text-black hover:brightness-110"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
