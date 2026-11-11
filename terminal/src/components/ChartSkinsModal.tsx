import React, { useState } from 'react';
import { usePsychologyStore } from '../store/usePsychologyStore';
import { WALLPAPER_PRESETS, type WallpaperPreset } from './ChartSkinsLayer';
import { audioHaptics } from '../utils/notify';
import { validateWallpaperFile, sanitizeMediaUrl } from '../utils/security';

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

  if (!isOpen) return null;

  const filteredPresets = WALLPAPER_PRESETS.filter(
    (p) => filterCategory === 'ALL' || p.category === filterCategory
  );

  // Handle local file upload (converts local file to a memory Blob URL)
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

    setThemeConfig({
      wallpaperType: determinedType,
      mediaUrl: objectUrl,
    });
    setUploadNotice(`Loaded local ${determinedType}: ${file.name}`);
    setTimeout(() => setUploadNotice(null), 3000);
  };

  const handleApplyPreset = (preset: WallpaperPreset) => {
    audioHaptics.tick();
    setThemeConfig({
      wallpaperType: preset.type,
      mediaUrl: preset.url,
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
    });
    setCustomUrl('');
  };

  const handleResetSolid = () => {
    audioHaptics.tick();
    setThemeConfig({ wallpaperType: 'SOLID', mediaUrl: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-[10px] border border-white/[0.08] bg-panel p-6 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              ChartSkins Background Engine (Image, GIF & Video)
            </h3>
          </div>
          <button onClick={onClose} className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white" aria-label="Close">
            [ESC / Close]
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pt-4 pr-1">
          {/* Category Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-grid pb-2">
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
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 font-bold'
                  : 'border-grid text-muted hover:text-white'
              }`}
            >
              [Default Solid Dark]
            </button>
          </div>

          {/* Curated Presets Grid */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-2">
              Curated Lo-Fi & High-FPS Wallpapers ({filteredPresets.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredPresets.map((p) => {
                const isSelected = themeConfig.mediaUrl === p.url;
                return (
                  <button
                    key={p.name}
                    onClick={() => handleApplyPreset(p)}
                    className={`rounded-xl border p-3 text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-accent bg-accent/20 text-white ring-1 ring-accent'
                        : 'border-grid bg-slate-900/50 text-muted hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
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
                      <div className="font-bold text-xs text-white leading-tight mb-1">{p.name}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{p.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Local File Upload Picker (Instant Blob URL) */}
          <div className="rounded-xl border border-grid bg-slate-950/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Upload From Local Computer
              </span>
              <span className="text-[10px] text-muted">Supports MP4, WebM, GIF, PNG, JPG, WebP</span>
            </div>
            <label className="flex flex-col items-center justify-center border border-dashed border-grid rounded-lg p-3 hover:border-accent hover:bg-slate-900/60 transition cursor-pointer">
              <span className="text-xs text-accent font-semibold mb-0.5">Click or Drag & Drop File</span>
              <span className="text-[10px] text-muted">Instant zero-upload local playback</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {uploadNotice && (
              <p className="text-[11px] text-up font-semibold text-center">{uploadNotice}</p>
            )}
          </div>

          {/* Custom Web URL Input */}
          <div className="rounded-xl border border-grid bg-slate-950/40 p-3.5 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white block">
              Load From Web URL
            </span>
            <div className="flex gap-2">
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value as 'IMAGE' | 'GIF' | 'VIDEO')}
                className="rounded border border-grid bg-bg px-2 py-1 text-xs text-white focus:outline-none"
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
                className="flex-1 rounded border border-grid bg-bg px-2.5 py-1 text-xs text-white placeholder:text-muted/50 focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleApplyCustomUrl}
                disabled={!customUrl.trim()}
                className="rounded bg-accent px-3 py-1 text-xs font-bold text-black hover:brightness-110 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Opacity & Aesthetic Blur Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-grid bg-slate-950/40 p-3.5">
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
        <div className="mt-4 border-t border-grid pt-3 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-muted">
            Format Active: {themeConfig.wallpaperType}
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
