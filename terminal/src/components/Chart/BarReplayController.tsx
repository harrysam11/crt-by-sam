/**
 * TradingView-Style Bar Replay Historical Time Machine Controller.
 * Slices historical market data and replays candles at variable speeds with step-by-step controls.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { useEffect, useRef } from 'react';
import { audioHaptics } from '../../utils/notify';

interface BarReplayControllerProps {
  isActive: boolean;
  onExit: () => void;
  totalCandles: number;
  currentReplayIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onSelectCutPoint: () => void;
  isSelectingCutPoint: boolean;
  speedMs: number;
  onSpeedChange: (speed: number) => void;
  currentTimeString?: string;
}

export default function BarReplayController({
  isActive,
  onExit,
  totalCandles,
  currentReplayIndex,
  isPlaying,
  onTogglePlay,
  onStepForward,
  onSelectCutPoint,
  isSelectingCutPoint,
  speedMs,
  onSpeedChange,
  currentTimeString,
}: BarReplayControllerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listeners (Space = Play/Pause, Shift+Right = Step Forward, Esc = Exit)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.shiftKey && e.code === 'ArrowRight') {
        e.preventDefault();
        onStepForward();
      } else if (e.code === 'Escape') {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onTogglePlay, onStepForward, onExit]);

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-accent/40 bg-panel/95 px-3 py-1.5 shadow-2xl backdrop-blur-md font-mono text-xs select-none ring-1 ring-accent/20"
    >
      {/* Replay Mode Badge */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-grid">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="font-bold text-accent tracking-wider text-[11px]">REPLAY</span>
      </div>

      {/* Jump to Bar (Cut Tool) */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onSelectCutPoint();
        }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition ${
          isSelectingCutPoint
            ? 'bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/40'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
        title="Jump to Bar (Click any candle on chart to start replay from that point)"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
        <span>{isSelectingCutPoint ? 'Click Candle...' : 'Jump To'}</span>
      </button>

      {/* Play / Pause Button */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onTogglePlay();
        }}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-black font-bold hover:opacity-90 transition text-[11px]"
        title="Play / Pause Replay (Space)"
      >
        {isPlaying ? (
          <>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <span>Pause</span>
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Play</span>
          </>
        )}
      </button>

      {/* Step Forward 1 Bar */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onStepForward();
        }}
        className="flex items-center gap-1 px-2 py-1 rounded border border-grid text-slate-300 hover:bg-slate-800 hover:text-white transition text-[11px]"
        title="Step Forward 1 Candle (Shift + Right Arrow)"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
        <span>Step</span>
      </button>

      {/* Playback Speed Selector */}
      <div className="flex items-center gap-1 pl-1 pr-2 border-r border-grid">
        {[
          { label: '0.2s', val: 200 },
          { label: '0.5s', val: 500 },
          { label: '1s', val: 1000 },
          { label: '2s', val: 2000 },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => {
              audioHaptics.tick();
              onSpeedChange(s.val);
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] transition ${
              speedMs === s.val
                ? 'bg-accent/20 text-accent font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Progress & Time Info */}
      <div className="text-[10px] text-slate-400 px-1 min-w-[110px]">
        <div>Bar {currentReplayIndex + 1} / {totalCandles}</div>
        {currentTimeString && (
          <div className="text-slate-500 truncate max-w-[120px]">{currentTimeString}</div>
        )}
      </div>

      {/* Exit Replay Button */}
      <button
        onClick={() => {
          audioHaptics.tick();
          onExit();
        }}
        className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="Exit Replay Mode (Esc)"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
