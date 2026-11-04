import { useEffect, useState } from 'react';
import type { Timeframe } from '../../types/terminal';

interface CandleCountdownProps {
  timeframe: Timeframe;
}

const SECONDS_MAP: Record<Timeframe, number> = {
  '1s': 1,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

export default function CandleCountdown({ timeframe }: CandleCountdownProps) {
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const interval = SECONDS_MAP[timeframe] || 60;
      const nextCandleSec = Math.ceil(nowSec / interval) * interval;
      setRemainingSec(Math.max(0, nextCandleSec - nowSec));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe]);

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div
      className="pointer-events-none absolute right-3 top-2 z-20 flex items-center gap-1.5 rounded border border-grid/80 bg-panel/85 px-2 py-0.5 font-mono text-[11px] text-muted shadow-sm backdrop-blur-sm"
      title={`Time remaining until current ${timeframe} candle closes`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
      <span className="text-slate-400">{timeframe}:</span>
      <span className="font-semibold text-white">{formatted}</span>
    </div>
  );
}
