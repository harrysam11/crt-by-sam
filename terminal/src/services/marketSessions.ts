/**
 * Institutional Market Sessions & Killzones Engine.
 * Calculates active global trading sessions:
 * - Sydney: 21:00 - 06:00 UTC
 * - Tokyo (Asian): 00:00 - 09:00 UTC
 * - London (European): 07:00 - 16:00 UTC
 * - New York (US): 12:00 - 21:00 UTC
 *
 * ICT Institutional Killzones:
 * - Asian Killzone: 00:00 - 04:00 UTC
 * - London Open Killzone: 06:00 - 09:00 UTC (Peak Volatility)
 * - New York Open Killzone: 11:00 - 14:00 UTC (US Equities & Macro Release)
 * - London Close Killzone: 15:00 - 17:00 UTC (Fixings & Trend Reversals)
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface MarketSessionInfo {
  id: 'SYDNEY' | 'TOKYO' | 'LONDON' | 'NEW_YORK';
  name: string;
  region: string;
  startHourUtc: number;
  endHourUtc: number;
  isActive: boolean;
  progressPct: number;
  remainingMinutes: number;
  color: string;
}

export interface KillzoneInfo {
  id: string;
  name: string;
  session: string;
  startHourUtc: number;
  endHourUtc: number;
  isActive: boolean;
  desc: string;
}

export const MARKET_SESSIONS: Array<Omit<MarketSessionInfo, 'isActive' | 'progressPct' | 'remainingMinutes'>> = [
  {
    id: 'SYDNEY',
    name: 'Sydney Session',
    region: 'Australia / Pacific',
    startHourUtc: 21,
    endHourUtc: 6,
    color: '#38bdf8',
  },
  {
    id: 'TOKYO',
    name: 'Tokyo Session',
    region: 'Asia / Japan',
    startHourUtc: 0,
    endHourUtc: 9,
    color: '#f59e0b',
  },
  {
    id: 'LONDON',
    name: 'London Session',
    region: 'Europe / UK',
    startHourUtc: 7,
    endHourUtc: 16,
    color: '#089981',
  },
  {
    id: 'NEW_YORK',
    name: 'New York Session',
    region: 'US / Americas',
    startHourUtc: 12,
    endHourUtc: 21,
    color: '#a855f7',
  },
];

export const KILLZONES: Array<Omit<KillzoneInfo, 'isActive'>> = [
  {
    id: 'ASIA_KZ',
    name: 'Asian Killzone',
    session: 'Tokyo',
    startHourUtc: 0,
    endHourUtc: 4,
    desc: 'Asian range accumulation & initial liquidity pool creation',
  },
  {
    id: 'LONDON_OPEN_KZ',
    name: 'London Open Killzone',
    session: 'London',
    startHourUtc: 6,
    endHourUtc: 9,
    desc: 'Judas swing false move & primary trend initiation',
  },
  {
    id: 'NY_OPEN_KZ',
    name: 'New York Open Killzone',
    session: 'New York',
    startHourUtc: 11,
    endHourUtc: 14,
    desc: 'CPI / NFP / FOMC macro release & maximum volume overlap',
  },
  {
    id: 'LONDON_CLOSE_KZ',
    name: 'London Close Killzone',
    session: 'London',
    startHourUtc: 15,
    endHourUtc: 17,
    desc: 'Daily high/low fixing & intraday retracement liquidation',
  },
];

function isHourInRange(curUtcHours: number, start: number, end: number): boolean {
  if (start < end) {
    return curUtcHours >= start && curUtcHours < end;
  }
  // Crosses midnight (e.g. 21 to 6)
  return curUtcHours >= start || curUtcHours < end;
}

export function computeActiveSessions(now: Date = new Date()): {
  sessions: MarketSessionInfo[];
  activeKillzones: KillzoneInfo[];
  activeCount: number;
  isLondonNyOverlap: boolean;
  currentUtcTimeString: string;
} {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const curUtcMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  const sessions: MarketSessionInfo[] = MARKET_SESSIONS.map((s) => {
    const active = isHourInRange(utcHours, s.startHourUtc, s.endHourUtc);

    // Calculate duration in minutes
    let durMin = (s.endHourUtc - s.startHourUtc) * 60;
    if (durMin <= 0) durMin += 24 * 60;

    let elapsedMin = 0;
    let remMin = 0;

    if (active) {
      if (s.startHourUtc < s.endHourUtc) {
        elapsedMin = curUtcMin - s.startHourUtc * 60;
      } else {
        elapsedMin = (curUtcMin >= s.startHourUtc * 60)
          ? curUtcMin - s.startHourUtc * 60
          : curUtcMin + (24 - s.startHourUtc) * 60;
      }
      remMin = Math.max(0, durMin - elapsedMin);
    }

    const progressPct = active ? Math.min(100, Math.max(0, (elapsedMin / durMin) * 100)) : 0;

    return {
      ...s,
      isActive: active,
      progressPct: Math.round(progressPct),
      remainingMinutes: remMin,
    };
  });

  const activeKillzones: KillzoneInfo[] = KILLZONES.map((kz) => ({
    ...kz,
    isActive: isHourInRange(utcHours, kz.startHourUtc, kz.endHourUtc),
  })).filter((kz) => kz.isActive);

  const activeLondon = sessions.find((s) => s.id === 'LONDON')?.isActive;
  const activeNy = sessions.find((s) => s.id === 'NEW_YORK')?.isActive;
  const isLondonNyOverlap = !!(activeLondon && activeNy);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const currentUtcTimeString = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;

  return {
    sessions,
    activeKillzones,
    activeCount: sessions.filter((s) => s.isActive).length,
    isLondonNyOverlap,
    currentUtcTimeString,
  };
}
