import { useEffect, useState } from 'react';
import type { Timeframe } from '../../types/terminal';

interface CandleCountdownProps {
  timeframe: Timeframe;
}

const SECONDS_MAP: Record<Timeframe, number> = {
  '1s': 1,
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
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
      className="pointer-events-none absolute right-3 top-2 z-20 flex items-center gap-1.5 rounded-[4px] border border-white/[0.08] bg-[#111114]/90 px-2 py-0.5 font-mono text-[11px] text-zinc-400 shadow-sm backdrop-blur-sm"
      title={`Time remaining until current ${timeframe} candle closes`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
      <span className="text-zinc-500">{timeframe}:</span>
      <span className="font-semibold text-white">{formatted}</span>
    </div>
  );
}
