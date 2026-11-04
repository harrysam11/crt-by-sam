import React, { useEffect, useState } from 'react';
import { usePsychologyStore } from '../../store/usePsychologyStore';

export default function ZenController() {
  const zenMode = usePsychologyStore((s) => s.zenMode);
  const toggleZenMode = usePsychologyStore((s) => s.toggleZenMode);
  const updateZenConfig = usePsychologyStore((s) => s.updateZenConfig);

  // Global hotkey Alt+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        toggleZenMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleZenMode]);

  return null;
}

/**
 * Breathing Guide Component for Top-Right Header/Toolbar
 * Box Breathing: 4s Inhale, 4s Hold, 4s Exhale, 4s Rest
 */
export function BreathingHalo() {
  const zenMode = usePsychologyStore((s) => s.zenMode);
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Rest'>('Inhale');
  const [counter, setCounter] = useState(4);

  useEffect(() => {
    if (!zenMode.active || !zenMode.breathingGuideActive) return;

    const interval = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          setPhase((curr) => {
            if (curr === 'Inhale') return 'Hold';
            if (curr === 'Hold') return 'Exhale';
            if (curr === 'Exhale') return 'Rest';
            return 'Inhale';
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [zenMode.active, zenMode.breathingGuideActive]);

  if (!zenMode.active || !zenMode.breathingGuideActive) return null;

  const pulseScale =
    phase === 'Inhale'
      ? 'scale-125 bg-teal-400/40 text-teal-300'
      : phase === 'Hold'
      ? 'scale-125 bg-blue-400/40 text-blue-300'
      : phase === 'Exhale'
      ? 'scale-90 bg-emerald-400/20 text-emerald-300'
      : 'scale-90 bg-slate-500/20 text-slate-400';

  return (
    <div className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-[#0f1922] px-3 py-1 text-xs shadow-inner">
      <div
        className={`h-3.5 w-3.5 rounded-full transition-all duration-1000 ease-in-out ${pulseScale}`}
      />
      <span className="font-medium text-teal-200">
        {phase} ({counter}s)
      </span>
      <span className="text-[10px] text-teal-400/60 uppercase tracking-wider">Zen Mode</span>
    </div>
  );
}
