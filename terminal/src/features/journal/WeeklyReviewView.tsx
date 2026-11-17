import { useState, useEffect, useMemo } from 'react';
import { useJournalStore } from '../../store/useJournalStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPnl, fmtPrice, fmtTime, labelOf, pnlClass } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { JournalEntry } from '../../types/psychology';

interface WeeklyReflection {
  weekKey: string; // e.g. "2026-W47"
  disciplineScore: number; // 1-10
  whatWentWell: string;
  mistakesMade: string;
  keyLessons: string;
  goalsNextWeek: string;
  updatedAt: number;
}

const STORAGE_KEY = 'crt_weekly_reviews_v1';

function getIsoWeek(date: Date): { year: number; week: number; key: string; label: string; start: Date; end: Date } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();
  const key = `${year}-W${String(weekNo).padStart(2, '0')}`;

  // Start of week (Monday)
  const monday = new Date(date);
  const curDay = monday.getDay();
  const diffToMon = curDay === 0 ? -6 : 1 - curDay;
  monday.setDate(monday.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);

  // End of week (Sunday)
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const label = `${mStr} - ${sStr} (Week ${weekNo})`;

  return { year, week: weekNo, key, label, start: monday, end: sunday };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekStats {
  totalTrades: number;
  totalPnl: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  rrRatio: number;
  totalCommission: number;
  maxDrawdown: number;
  bestTrade: JournalEntry | null;
  worstTrade: JournalEntry | null;
  dayPnl: Record<string, { pnl: number; count: number; wins: number }>;
  emotionCounts: Record<JournalEntry['emotionTag'], { count: number; pnl: number }>;
}

export default function WeeklyReviewView() {
  const entries = useJournalStore((s) => s.entries);
  const terminalTrades = useTerminalStore((s) => s.trades);

  // Build list of all weeks available from trades & entries + current week
  const availableWeeks = useMemo(() => {
    const map = new Map<string, { key: string; label: string; start: Date; end: Date }>();
    const nowInfo = getIsoWeek(new Date());
    map.set(nowInfo.key, { key: nowInfo.key, label: nowInfo.label, start: nowInfo.start, end: nowInfo.end });

    // Look back 4 weeks minimum
    for (let i = 1; i <= 6; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - i * 7);
      const info = getIsoWeek(pastDate);
      if (!map.has(info.key)) {
        map.set(info.key, { key: info.key, label: info.label, start: info.start, end: info.end });
      }
    }

    [...entries, ...terminalTrades].forEach((item) => {
      const t = 'timestamp' in item ? item.timestamp : Date.now();
      const info = getIsoWeek(new Date(t));
      if (!map.has(info.key)) {
        map.set(info.key, { key: info.key, label: info.label, start: info.start, end: info.end });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [entries, terminalTrades]);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(() => {
    return availableWeeks[0]?.key || getIsoWeek(new Date()).key;
  });

  const selectedWeek = useMemo(() => {
    return availableWeeks.find((w) => w.key === selectedWeekKey) || availableWeeks[0];
  }, [availableWeeks, selectedWeekKey]);

  // Load / Save Reflection
  const [reflections, setReflections] = useState<Record<string, WeeklyReflection>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const currentReflection = reflections[selectedWeekKey] || {
    weekKey: selectedWeekKey,
    disciplineScore: 8,
    whatWentWell: '',
    mistakesMade: '',
    keyLessons: '',
    goalsNextWeek: '',
    updatedAt: Date.now(),
  };

  const handleUpdateReflection = (patch: Partial<WeeklyReflection>) => {
    const updated: WeeklyReflection = {
      ...currentReflection,
      ...patch,
      weekKey: selectedWeekKey,
      updatedAt: Date.now(),
    };
    const nextMap = { ...reflections, [selectedWeekKey]: updated };
    setReflections(nextMap);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
    } catch {}
  };

  // Filter entries & trades for this selected week
  const weekEntries = useMemo(() => {
    if (!selectedWeek) return [];
    const startMs = selectedWeek.start.getTime();
    const endMs = selectedWeek.end.getTime();
    return entries.filter((e) => e.timestamp >= startMs && e.timestamp <= endMs);
  }, [entries, selectedWeek]);

  // Aggregate stats
  const stats: WeekStats = useMemo(() => {
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let grossWin = 0;
    let grossLoss = 0;
    let totalCommission = 0;
    let maxDrawdown = 0;
    let peakEquity = 0;
    let curEquity = 0;
    let bestTrade: JournalEntry | null = null;
    let worstTrade: JournalEntry | null = null;

    const dayPnl: Record<string, { pnl: number; count: number; wins: number }> = {
      Mon: { pnl: 0, count: 0, wins: 0 },
      Tue: { pnl: 0, count: 0, wins: 0 },
      Wed: { pnl: 0, count: 0, wins: 0 },
      Thu: { pnl: 0, count: 0, wins: 0 },
      Fri: { pnl: 0, count: 0, wins: 0 },
      Sat: { pnl: 0, count: 0, wins: 0 },
      Sun: { pnl: 0, count: 0, wins: 0 },
    };

    const emotionCounts: Record<JournalEntry['emotionTag'], { count: number; pnl: number }> = {
      PLANNED: { count: 0, pnl: 0 },
      FOMO: { count: 0, pnl: 0 },
      REVENGE: { count: 0, pnl: 0 },
      IMPULSE: { count: 0, pnl: 0 },
    };

    // Sort ascending for equity curve calculation
    const sorted = [...weekEntries].sort((a, b) => a.timestamp - b.timestamp);

    sorted.forEach((e) => {
      const p = e.pnl ?? 0;
      const comm = e.commission ?? 0;
      totalPnl += p;
      totalCommission += comm;

      curEquity += p;
      if (curEquity > peakEquity) peakEquity = curEquity;
      const dd = peakEquity - curEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (p > 0) {
        wins++;
        grossWin += p;
      } else if (p < 0) {
        losses++;
        grossLoss += Math.abs(p);
      }

      if (!bestTrade || p > (bestTrade.pnl ?? 0)) bestTrade = e;
      if (!worstTrade || p < (worstTrade.pnl ?? 0)) worstTrade = e;

      // Day of week
      const dayIdx = new Date(e.timestamp).getDay();
      const dayKey = DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
      if (dayPnl[dayKey]) {
        dayPnl[dayKey].pnl += p;
        dayPnl[dayKey].count += 1;
        if (p > 0) dayPnl[dayKey].wins += 1;
      }

      // Emotion
      if (emotionCounts[e.emotionTag]) {
        emotionCounts[e.emotionTag].count += 1;
        emotionCounts[e.emotionTag].pnl += p;
      }
    });

    const totalTrades = weekEntries.length;
    const closedTrades = wins + losses;
    const winRate = closedTrades > 0 ? (wins / closedTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99.9 : 0;
    const avgWin = wins > 0 ? grossWin / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    return {
      totalTrades,
      totalPnl,
      wins,
      losses,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      rrRatio,
      totalCommission,
      maxDrawdown,
      bestTrade,
      worstTrade,
      dayPnl,
      emotionCounts,
    };
  }, [weekEntries]);

  // Max daily PnL amplitude for bar chart scaling
  const maxAbsDayPnl = useMemo(() => {
    let max = 1;
    Object.values(stats.dayPnl).forEach((d) => {
      const a = Math.abs(d.pnl);
      if (a > max) max = a;
    });
    return max;
  }, [stats.dayPnl]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-6">
      {/* Week Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-grid bg-bg/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 border border-accent/40 text-accent font-bold">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-heading">Institutional Weekly Debrief</h3>
            <p className="text-xs text-muted">Weekly performance aggregation, setup breakdown, and behavioral self-audit</p>
          </div>
        </div>

        {/* Week Picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted font-medium">Select Week:</label>
          <select
            value={selectedWeekKey}
            onChange={(e) => {
              audioHaptics.tick();
              setSelectedWeekKey(e.target.value);
            }}
            className="rounded-lg border border-grid bg-bg px-3 py-1.5 text-xs font-semibold text-white focus:border-accent focus:outline-none"
          >
            {availableWeeks.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Core KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Net PnL */}
        <div className="rounded-xl border border-grid bg-bg/40 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Net Realized PnL</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-bold font-mono ${pnlClass(stats.totalPnl)}`}>
              {fmtPnl(stats.totalPnl)}
            </span>
          </div>
          <span className="text-[10px] text-muted mt-1">{stats.totalTrades} trades logged</span>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl border border-grid bg-bg/40 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Win Rate</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {stats.winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted">({stats.wins}W / {stats.losses}L)</span>
          </div>
          <div className="w-full bg-grid/60 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${stats.winRate}%` }} />
          </div>
        </div>

        {/* Profit Factor */}
        <div className="rounded-xl border border-grid bg-bg/40 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Profit Factor</span>
          <div className="mt-1">
            <span className={`text-xl font-bold font-mono ${stats.profitFactor >= 1.5 ? 'text-emerald-400' : stats.profitFactor >= 1.0 ? 'text-slate-200' : 'text-rose-400'}`}>
              {stats.profitFactor > 50 ? 'MAX' : stats.profitFactor.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-muted mt-1">Gross Win / Gross Loss</span>
        </div>

        {/* Risk / Reward Realized */}
        <div className="rounded-xl border border-grid bg-bg/40 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Realized R:R</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-white">
              1 : {stats.rrRatio > 0 ? stats.rrRatio.toFixed(2) : '-'}
            </span>
          </div>
          <span className="text-[10px] text-muted mt-1">Avg Win vs Avg Loss</span>
        </div>

        {/* Max Drawdown */}
        <div className="rounded-xl border border-grid bg-bg/40 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Week Max Drawdown</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-rose-400">
              -${stats.maxDrawdown.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-muted mt-1">Peak-to-trough drop</span>
        </div>

        {/* Discipline Rating */}
        <div className="rounded-xl border border-grid bg-bg/40 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Discipline Score</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-amber-400">
              {currentReflection.disciplineScore}
            </span>
            <span className="text-xs text-muted">/ 10</span>
          </div>
          <span className="text-[10px] text-muted mt-1">Self-audit rating</span>
        </div>
      </div>

      {/* Two Column Layout: Day-of-Week Chart & Psychological States */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily PnL Distribution */}
        <div className="rounded-xl border border-grid bg-bg/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Day-of-Week PnL Distribution</h4>
            <span className="text-[11px] text-muted">Monday through Sunday</span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-4 pb-2 items-end h-40">
            {DAYS.map((day) => {
              const d = stats.dayPnl[day];
              const p = d ? d.pnl : 0;
              const isPos = p > 0;
              const isNeg = p < 0;
              const heightPct = maxAbsDayPnl > 0 ? Math.min(100, (Math.abs(p) / maxAbsDayPnl) * 100) : 0;

              return (
                <div key={day} className="flex flex-col items-center justify-end h-full group relative">
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-8 hidden group-hover:flex flex-col items-center z-10 bg-black/90 px-2 py-1 rounded border border-grid text-[10px] font-mono whitespace-nowrap">
                    <span>{day}: {fmtPnl(p)}</span>
                    <span className="text-muted">{d?.count || 0} trades ({d?.wins || 0}W)</span>
                  </div>

                  {/* Bar */}
                  <div className="w-full flex flex-col items-center h-28 justify-center">
                    {p === 0 ? (
                      <div className="h-0.5 w-6 bg-grid/80 rounded" />
                    ) : (
                      <div
                        style={{ height: `${Math.max(8, heightPct)}%` }}
                        className={`w-7 rounded-t transition-all ${
                          isPos ? 'bg-emerald-500/80 hover:bg-emerald-400' : 'bg-rose-500/80 hover:bg-rose-400'
                        }`}
                      />
                    )}
                  </div>

                  <span className="mt-2 text-[10px] font-bold text-muted">{day}</span>
                  <span className={`text-[9px] font-mono ${pnlClass(p)}`}>
                    {p !== 0 ? (p > 0 ? `+${Math.round(p)}` : `${Math.round(p)}`) : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Setup & Emotional State Breakdown */}
        <div className="rounded-xl border border-grid bg-bg/40 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Psychological Execution States</h4>
              <span className="text-[11px] text-muted">Discipline vs Impulsive Entries</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { tag: 'PLANNED', label: 'Planned Setup', desc: 'Strict plan followed', color: 'text-emerald-400', border: 'border-emerald-500/30 bg-emerald-500/10' },
                { tag: 'FOMO', label: 'FOMO Chase', desc: 'Chasing green bars', color: 'text-amber-400', border: 'border-amber-500/30 bg-amber-500/10' },
                { tag: 'REVENGE', label: 'Revenge Trade', desc: 'Trying to recover loss', color: 'text-rose-400', border: 'border-rose-500/30 bg-rose-500/10' },
                { tag: 'IMPULSE', label: 'Impulse Entry', desc: 'Boredom or impulse', color: 'text-purple-400', border: 'border-purple-500/30 bg-purple-500/10' },
              ].map((item) => {
                const info = stats.emotionCounts[item.tag as JournalEntry['emotionTag']] || { count: 0, pnl: 0 };
                const pct = stats.totalTrades > 0 ? ((info.count / stats.totalTrades) * 100).toFixed(0) : '0';

                return (
                  <div key={item.tag} className={`rounded-lg border p-3 ${item.border}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${item.color}`}>{item.label}</span>
                      <span className="text-[11px] font-mono text-white font-bold">{info.count} ({pct}%)</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted text-[10px]">{item.desc}</span>
                      <span className={`font-mono font-semibold ${pnlClass(info.pnl)}`}>{fmtPnl(info.pnl)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extremes: Best and Worst Trade of the Week */}
          <div className="mt-4 pt-3 border-t border-grid/60 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted text-[10px] uppercase font-bold block">Best Execution</span>
              {stats.bestTrade ? (
                <div className="font-mono text-emerald-400 font-semibold mt-0.5">
                  {labelOf(stats.bestTrade.symbol)} +${(stats.bestTrade.pnl ?? 0).toFixed(2)}
                </div>
              ) : (
                <span className="text-muted text-[11px]">-</span>
              )}
            </div>
            <div>
              <span className="text-muted text-[10px] uppercase font-bold block">Worst Execution</span>
              {stats.worstTrade ? (
                <div className="font-mono text-rose-400 font-semibold mt-0.5">
                  {labelOf(stats.worstTrade.symbol)} -${Math.abs(stats.worstTrade.pnl ?? 0).toFixed(2)}
                </div>
              ) : (
                <span className="text-muted text-[11px]">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Self-Reflection & Next Week Action Plan */}
      <div className="rounded-xl border border-grid bg-bg/40 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-grid/60">
          <div>
            <h4 className="text-sm font-bold text-white font-heading">Weekly Qualitative Self-Audit & Action Plan</h4>
            <p className="text-xs text-muted">Honest review of process adherence, rule breaches, and tactical adaptations</p>
          </div>

          {/* Discipline Rating Selector (1 to 10) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted font-medium mr-1">Discipline Score:</span>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <button
                key={score}
                onClick={() => {
                  audioHaptics.tick();
                  handleUpdateReflection({ disciplineScore: score });
                }}
                className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                  currentReflection.disciplineScore === score
                    ? 'bg-accent text-white shadow-md'
                    : 'bg-grid/60 text-muted hover:text-white hover:bg-grid'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Reflection Quadrants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* What went well */}
          <div>
            <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1.5">
              1. What went well this week? (Good habits & setups)
            </label>
            <textarea
              rows={3}
              value={currentReflection.whatWentWell}
              onChange={(e) => handleUpdateReflection({ whatWentWell: e.target.value })}
              placeholder="e.g. Respected daily loss limit on Wednesday, patiently waited for London session sweep confluence, executed 2:1 RR targets without premature exits."
              className="w-full rounded-lg border border-grid bg-bg px-3 py-2 text-xs text-white placeholder-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          {/* Mistakes & Rule Violations */}
          <div>
            <label className="text-xs font-semibold text-rose-400 uppercase tracking-wider block mb-1.5">
              2. Mistakes made & rules violated
            </label>
            <textarea
              rows={3}
              value={currentReflection.mistakesMade}
              onChange={(e) => handleUpdateReflection({ mistakesMade: e.target.value })}
              placeholder="e.g. Took 1 FOMO short right before US CPI news release, resized too heavy on SOL after a loss."
              className="w-full rounded-lg border border-grid bg-bg px-3 py-2 text-xs text-white placeholder-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          {/* Key Lessons */}
          <div>
            <label className="text-xs font-semibold text-sky-400 uppercase tracking-wider block mb-1.5">
              3. Key lessons & psychological takeaways
            </label>
            <textarea
              rows={3}
              value={currentReflection.keyLessons}
              onChange={(e) => handleUpdateReflection({ keyLessons: e.target.value })}
              placeholder="e.g. High-impact news candles are random noise for my strategy; flat before 8:30 AM EST is mandatory. When feeling eager, step back for 15 minutes."
              className="w-full rounded-lg border border-grid bg-bg px-3 py-2 text-xs text-white placeholder-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          {/* Goals for Next Week */}
          <div>
            <label className="text-xs font-semibold text-purple-400 uppercase tracking-wider block mb-1.5">
              4. Strict goals & focal points for next week
            </label>
            <textarea
              rows={3}
              value={currentReflection.goalsNextWeek}
              onChange={(e) => handleUpdateReflection({ goalsNextWeek: e.target.value })}
              placeholder="e.g. Max 3 trades per session. 100% adherence to planned setups only. Keep position risk strictly at 1.0% with hard stops."
              className="w-full rounded-lg border border-grid bg-bg px-3 py-2 text-xs text-white placeholder-muted/50 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 text-[11px] text-muted">
          <span>Auto-saved to institutional journal storage</span>
          <button
            onClick={() => {
              audioHaptics.tick();
              window.print();
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-grid/60 hover:bg-grid text-white transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / Export Debrief</span>
          </button>
        </div>
      </div>
    </div>
  );
}
