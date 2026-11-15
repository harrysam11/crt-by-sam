/**
 * TradingView-Style Candle-Close Countdown Floating Timer.
 * Shows time remaining until the active bar closes for standard or custom intervals.
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useState } from 'react';
import type { Timeframe } from '../../types/terminal';
import { formatCountdownTimer, parseTimeframeToSeconds } from '../../utils/timeframe';

interface CandleCountdownProps {
  timeframe: Timeframe;
  lastCandleTime?: number;
}

export default function CandleCountdown({ timeframe, lastCandleTime }: CandleCountdownProps) {
  const [formattedText, setFormattedText] = useState<string>('00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const intervalSec = parseTimeframeToSeconds(timeframe);

      let diffSec = 0;
      if (lastCandleTime && lastCandleTime > 0) {
        const nextCloseSec = lastCandleTime + intervalSec;
        diffSec = Math.max(0, nextCloseSec - nowSec);
      } else {
        const nextCandleSec = Math.ceil(nowSec / intervalSec) * intervalSec;
        diffSec = Math.max(0, nextCandleSec - nowSec);
      }

      setFormattedText(formatCountdownTimer(diffSec));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe, lastCandleTime]);

  return (
    <div
      className="pointer-events-none absolute right-20 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-[#28283a] bg-[#0c0c14]/95 px-2.5 py-1 font-mono text-xs text-slate-300 shadow-xl shadow-black/60 backdrop-blur-md"
      title={`Time remaining until current ${timeframe} candle closes`}
    >
      <span className="h-2 w-2 rounded-full bg-[#38bdf8] animate-pulse" />
      <span className="text-slate-400 font-medium">{timeframe}:</span>
      <span className="font-bold text-[#38bdf8] tracking-wider">{formattedText}</span>
    </div>
  );
}
