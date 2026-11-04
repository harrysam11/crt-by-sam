import React from 'react';
import { usePsychologyStore } from '../store/usePsychologyStore';
import { sanitizeMediaUrl } from '../utils/security';

export interface WallpaperPreset {
  name: string;
  type: 'IMAGE' | 'GIF' | 'VIDEO';
  url: string;
  category: 'VIDEO' | 'GIF' | 'IMAGE';
  description: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  // 1. MP4 Video Loops
  {
    name: 'Cyber Grid (MP4)',
    type: 'VIDEO',
    category: 'VIDEO',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-code-31911-large.mp4',
    description: 'High-framerate cybernetic data screens',
  },
  {
    name: 'Neon Matrix Stream (MP4)',
    type: 'VIDEO',
    category: 'VIDEO',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-matrix-style-code-screen-animation-39749-large.mp4',
    description: 'Continuous green matrix digital rainfall',
  },
  {
    name: 'Hyperspace Tunnel (MP4)',
    type: 'VIDEO',
    category: 'VIDEO',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4',
    description: 'Ambient cosmic particle drift',
  },

  // 2. Animated GIFs
  {
    name: 'Pixel Cyberpunk City (GIF)',
    type: 'GIF',
    category: 'GIF',
    url: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
    description: 'Lo-fi aesthetic night cityscape animation',
  },
  {
    name: 'Retro 80s Synthwave Grid (GIF)',
    type: 'GIF',
    category: 'GIF',
    url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif',
    description: 'Endless wireframe synthwave horizon',
  },
  {
    name: 'Lo-Fi Rain on Window (GIF)',
    type: 'GIF',
    category: 'GIF',
    url: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',
    description: 'Calm ambient focus rain loop',
  },

  // 3. High-Res Static Wallpapers
  {
    name: 'Deep Nebula Galaxy (Image)',
    type: 'IMAGE',
    category: 'IMAGE',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2000&auto=format&fit=crop',
    description: 'Stellar dust & deep cosmos photography',
  },
  {
    name: 'Minimal Dark Mesh (Image)',
    type: 'IMAGE',
    category: 'IMAGE',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2000&auto=format&fit=crop',
    description: 'Clean dark obsidian topography',
  },
  {
    name: 'Tokyo Neon Skyline (Image)',
    type: 'IMAGE',
    category: 'IMAGE',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=2000&auto=format&fit=crop',
    description: 'Nocturnal financial metropolis',
  },
];

export default function ChartSkinsLayer() {
  const themeConfig = usePsychologyStore((s) => s.themeConfig);
  const { wallpaperType, mediaUrl, overlayOpacity, blurAmount = 0 } = themeConfig;

  const safeMediaUrl = sanitizeMediaUrl(mediaUrl);

  if (wallpaperType === 'SOLID' || !safeMediaUrl) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      {/* Background Media Layer */}
      <div
        className="h-full w-full"
        style={{
          filter: blurAmount > 0 ? `blur(${blurAmount}px)` : undefined,
          transform: blurAmount > 0 ? 'scale(1.05)' : undefined,
        }}
      >
        {wallpaperType === 'VIDEO' ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            src={safeMediaUrl}
          />
        ) : wallpaperType === 'GIF' ? (
          <img
            src={safeMediaUrl}
            alt="Chart Wallpaper GIF"
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div
            className="h-full w-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${encodeURI(safeMediaUrl)}")` }}
          />
        )}
      </div>

      {/* Dark blend overlay to guarantee candlestick & indicator legibility */}
      <div
        className="absolute inset-0 bg-[#0b0e14]"
        style={{ opacity: overlayOpacity }}
      />
    </div>
  );
}
