/**
 * Portfolio Analytics & Trade Intelligence Service.
 * Pure calculations for PnL Calendar, Cumulative Equity Curve,
 * Pair Analytics, Session/Day Analytics, Setup Win Rates, and Prop Firm Compliance.
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { JournalEntry, TradingSessionTag } from '../types/psychology';
import type { Trade } from '../types/terminal';

export interface DailyPnLSummary {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayOfMonth: number;
  pnl: number;
  netPnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
  entries: JournalEntry[];
}

export interface EquityCurvePoint {
  index: number;
  timestamp: number;
  dateStr: string;
  tradePnl: number;
  cumPnl: number;
  highWaterMark: number;
  drawdown: number;
  drawdownPct: number;
}

export interface PairStat {
  symbol: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalPnl: number;
  netPnl: number;
  commission: number;
  profitFactor: number;
  avgPnl: number;
}

export interface DayOfWeekStat {
  dayName: string;
  dayIndex: number;
  tradesCount: number;
  winRatePct: number;
  totalPnl: number;
}

export interface SessionStat {
  session: TradingSessionTag;
  label: string;
  tradesCount: number;
  winRatePct: number;
  totalPnl: number;
  avgPnl: number;
}

export interface SetupStat {
  setup: string;
  tradesCount: number;
  wins: number;
  winRatePct: number;
  totalPnl: number;
  avgRMultiple: number;
}

export interface EdgeFinderResult {
  bestPair: { symbol: string; winRate: number; pnl: number } | null;
  worstPair: { symbol: string; winRate: number; pnl: number } | null;
  bestSession: { session: string; winRate: number; pnl: number } | null;
  worstSession: { session: string; winRate: number; pnl: number } | null;
  bestSetup: { setup: string; winRate: number; pnl: number } | null;
  worstSetup: { setup: string; winRate: number; pnl: number } | null;
  bestDay: { dayName: string; pnl: number } | null;
  worstDay: { dayName: string; pnl: number } | null;
  topTakeaway: string;
  leakWarning: string;
}

export interface CorePortfolioMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRatePct: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  totalCommission: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  expectedValue: number; // Expectancy per trade ($)
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldingTimeMinutes: number;
}

export interface PropFirmComplianceAudit {
  startingBalance: number;
  currentEquity: number;
  targetProfitUsd: number;
  profitAchievedUsd: number;
  targetProgressPct: number;
  dailyLossUsd: number;
  dailyLossLimitUsd: number;
  dailyLossRemainingUsd: number;
  dailyLossStatus: 'PASS' | 'WARNING' | 'BREACH';
  maxTrailingDrawdownUsd: number;
  maxDrawdownLimitUsd: number;
  overallDrawdownStatus: 'PASS' | 'WARNING' | 'BREACH';
  bestDayProfitUsd: number;
  bestDayShareOfProfitPct: number;
  consistencyRuleLimitPct: number;
  consistencyStatus: 'PASS' | 'WARNING' | 'BREACH';
  minTradingDaysTarget: number;
  tradingDaysCompleted: number;
  isEligibleForPayout: boolean;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeCoreMetrics(entries: JournalEntry[], initialBalance: number = 10000): CorePortfolioMetrics {
  if (!entries.length) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRatePct: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnl: 0,
      totalCommission: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      winLossRatio: 0,
      expectedValue: 0,
      maxDrawdownUsd: 0,
      maxDrawdownPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      avgHoldingTimeMinutes: 0,
    };
  }

  let wins = 0;
  let losses = 0;
  let be = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalCommission = 0;
  let totalHoldingMs = 0;
  let validHoldingCount = 0;

  const returns: number[] = [];

  entries.forEach((e) => {
    const rawPnl = e.pnl ?? 0;
    const comm = e.commission ?? 2.50;
    totalCommission += comm;
    const net = rawPnl - comm;
    returns.push(net);

    if (rawPnl > 0.5) {
      wins++;
      grossProfit += rawPnl;
    } else if (rawPnl < -0.5) {
      losses++;
      grossLoss += Math.abs(rawPnl);
    } else {
      be++;
    }

    if (e.holdingTimeMs && e.holdingTimeMs > 0) {
      totalHoldingMs += e.holdingTimeMs;
      validHoldingCount++;
    }
  });

  const totalTrades = entries.length;
  const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const netPnl = grossProfit - grossLoss - totalCommission;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99.9 : 0;
  const expectedValue = totalTrades > 0 ? netPnl / totalTrades : 0;

  // Max Drawdown calculation
  let cum = initialBalance;
  let peak = initialBalance;
  let maxDdUsd = 0;
  let maxDdPct = 0;

  // Process in chronological order
  const chrono = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  chrono.forEach((e) => {
    const p = (e.pnl ?? 0) - (e.commission ?? 2.50);
    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDdUsd) maxDdUsd = dd;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (ddPct > maxDdPct) maxDdPct = ddPct;
  });

  // Sharpe and Sortino ratios
  const meanReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance) || 1;

  const downReturns = returns.filter((r) => r < 0);
  const downVariance = downReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / (downReturns.length || 1);
  const downStdDev = Math.sqrt(downVariance) || 1;

  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;
  const sortinoRatio = downStdDev > 0 ? (meanReturn / downStdDev) * Math.sqrt(252) : 0;

  const avgHoldingTimeMinutes = validHoldingCount > 0 ? Math.round(totalHoldingMs / validHoldingCount / 60000) : 45;

  return {
    totalTrades,
    winningTrades: wins,
    losingTrades: losses,
    breakEvenTrades: be,
    winRatePct: Math.round(winRatePct * 10) / 10,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    winLossRatio: Math.round(winLossRatio * 100) / 100,
    expectedValue: Math.round(expectedValue * 100) / 100,
    maxDrawdownUsd: Math.round(maxDdUsd * 100) / 100,
    maxDrawdownPct: Math.round(maxDdPct * 10) / 10,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    avgHoldingTimeMinutes,
  };
}

export function computeDailyPnLCalendar(entries: JournalEntry[]): Map<string, DailyPnLSummary> {
  const map = new Map<string, DailyPnLSummary>();

  entries.forEach((e) => {
    const d = new Date(e.timestamp);
    const dateStr = d.toISOString().split('T')[0];
    const rawPnl = e.pnl ?? 0;
    const comm = e.commission ?? 2.50;
    const net = rawPnl - comm;

    const existing = map.get(dateStr);
    if (!existing) {
      map.set(dateStr, {
        dateStr,
        dayOfWeek: d.getDay(),
        dayOfMonth: d.getDate(),
        pnl: rawPnl,
        netPnl: net,
        tradesCount: 1,
        wins: rawPnl > 0.5 ? 1 : 0,
        losses: rawPnl < -0.5 ? 1 : 0,
        entries: [e],
      });
    } else {
      existing.pnl += rawPnl;
      existing.netPnl += net;
      existing.tradesCount += 1;
      if (rawPnl > 0.5) existing.wins += 1;
      if (rawPnl < -0.5) existing.losses += 1;
      existing.entries.push(e);
    }
  });

  return map;
}

export function computeCumulativeEquityCurve(entries: JournalEntry[], initialBalance: number = 10000): EquityCurvePoint[] {
  const chrono = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  let cum = initialBalance;
  let peak = initialBalance;

  const points: EquityCurvePoint[] = [];

  points.push({
    index: 0,
    timestamp: chrono.length > 0 ? chrono[0].timestamp - 3600000 : Date.now(),
    dateStr: 'Start',
    tradePnl: 0,
    cumPnl: 0,
    highWaterMark: initialBalance,
    drawdown: 0,
    drawdownPct: 0,
  });

  chrono.forEach((e, idx) => {
    const comm = e.commission ?? 2.50;
    const tradePnl = (e.pnl ?? 0) - comm;
    cum += tradePnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;

    points.push({
      index: idx + 1,
      timestamp: e.timestamp,
      dateStr: new Date(e.timestamp).toLocaleDateString(),
      tradePnl,
      cumPnl: cum - initialBalance,
      highWaterMark: peak - initialBalance,
      drawdown: dd,
      drawdownPct: Math.round(ddPct * 10) / 10,
    });
  });

  return points;
}

export function computePairAnalytics(entries: JournalEntry[]): PairStat[] {
  const map = new Map<string, { wins: number; losses: number; count: number; pnl: number; comm: number; grossWin: number; grossLoss: number }>();

  entries.forEach((e) => {
    const sym = e.symbol;
    const p = e.pnl ?? 0;
    const c = e.commission ?? 2.50;

    const cur = map.get(sym) || { wins: 0, losses: 0, count: 0, pnl: 0, comm: 0, grossWin: 0, grossLoss: 0 };
    cur.count++;
    cur.pnl += p;
    cur.comm += c;
    if (p > 0.5) {
      cur.wins++;
      cur.grossWin += p;
    } else if (p < -0.5) {
      cur.losses++;
      cur.grossLoss += Math.abs(p);
    }
    map.set(sym, cur);
  });

  const list: PairStat[] = [];
  map.forEach((val, sym) => {
    const winRate = val.count > 0 ? (val.wins / val.count) * 100 : 0;
    const pf = val.grossLoss > 0 ? val.grossWin / val.grossLoss : val.grossWin > 0 ? 99.9 : 0;
    list.push({
      symbol: sym,
      tradesCount: val.count,
      wins: val.wins,
      losses: val.losses,
      winRatePct: Math.round(winRate * 10) / 10,
      totalPnl: Math.round(val.pnl * 100) / 100,
      netPnl: Math.round((val.pnl - val.comm) * 100) / 100,
      commission: Math.round(val.comm * 100) / 100,
      profitFactor: Math.round(pf * 100) / 100,
      avgPnl: Math.round(((val.pnl - val.comm) / val.count) * 100) / 100,
    });
  });

  return list.sort((a, b) => b.netPnl - a.netPnl);
}

export function computeDayOfWeekAnalytics(entries: JournalEntry[]): DayOfWeekStat[] {
  const dayTotals: { count: number; wins: number; pnl: number }[] = [
    { count: 0, wins: 0, pnl: 0 }, // Sun
    { count: 0, wins: 0, pnl: 0 }, // Mon
    { count: 0, wins: 0, pnl: 0 }, // Tue
    { count: 0, wins: 0, pnl: 0 }, // Wed
    { count: 0, wins: 0, pnl: 0 }, // Thu
    { count: 0, wins: 0, pnl: 0 }, // Fri
    { count: 0, wins: 0, pnl: 0 }, // Sat
  ];

  entries.forEach((e) => {
    const day = new Date(e.timestamp).getDay();
    const p = (e.pnl ?? 0) - (e.commission ?? 2.50);
    dayTotals[day].count++;
    dayTotals[day].pnl += p;
    if (p > 0) dayTotals[day].wins++;
  });

  return dayTotals.map((d, idx) => ({
    dayName: DAYS_SHORT[idx],
    dayIndex: idx,
    tradesCount: d.count,
    winRatePct: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    totalPnl: Math.round(d.pnl * 100) / 100,
  }));
}

export function computeSessionAnalytics(entries: JournalEntry[]): SessionStat[] {
  const sessions: Record<TradingSessionTag, { label: string; count: number; wins: number; pnl: number }> = {
    ASIA: { label: 'Asian Session (Tokyo/Sydney)', count: 0, wins: 0, pnl: 0 },
    LONDON: { label: 'London Open Session', count: 0, wins: 0, pnl: 0 },
    OVERLAP: { label: 'London/NY Overlap (Peak Vol)', count: 0, wins: 0, pnl: 0 },
    NY: { label: 'New York Afternoon', count: 0, wins: 0, pnl: 0 },
    INTER_SESSION: { label: 'Inter-Session Liquidity Lull', count: 0, wins: 0, pnl: 0 },
  };

  entries.forEach((e) => {
    const s = e.session || 'OVERLAP';
    const p = (e.pnl ?? 0) - (e.commission ?? 2.50);
    if (sessions[s]) {
      sessions[s].count++;
      sessions[s].pnl += p;
      if (p > 0) sessions[s].wins++;
    }
  });

  return Object.entries(sessions).map(([k, v]) => ({
    session: k as TradingSessionTag,
    label: v.label,
    tradesCount: v.count,
    winRatePct: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
    totalPnl: Math.round(v.pnl * 100) / 100,
    avgPnl: v.count > 0 ? Math.round((v.pnl / v.count) * 100) / 100 : 0,
  }));
}

export function computeSetupAnalytics(entries: JournalEntry[]): SetupStat[] {
  const map = new Map<string, { count: number; wins: number; pnl: number; rSum: number }>();

  entries.forEach((e) => {
    const s = e.setup || 'UNTAGGED';
    const p = (e.pnl ?? 0) - (e.commission ?? 2.50);
    const r = e.rMultiple ?? (p > 0 ? 1.5 : -1.0);

    const cur = map.get(s) || { count: 0, wins: 0, pnl: 0, rSum: 0 };
    cur.count++;
    cur.pnl += p;
    cur.rSum += r;
    if (p > 0) cur.wins++;
    map.set(s, cur);
  });

  const list: SetupStat[] = [];
  map.forEach((val, setup) => {
    list.push({
      setup,
      tradesCount: val.count,
      wins: val.wins,
      winRatePct: val.count > 0 ? Math.round((val.wins / val.count) * 100) : 0,
      totalPnl: Math.round(val.pnl * 100) / 100,
      avgRMultiple: val.count > 0 ? Math.round((val.rSum / val.count) * 100) / 100 : 0,
    });
  });

  return list.sort((a, b) => b.totalPnl - a.totalPnl);
}

export function computeEdgeFinder(entries: JournalEntry[]): EdgeFinderResult {
  const pairs = computePairAnalytics(entries);
  const sessions = computeSessionAnalytics(entries);
  const setups = computeSetupAnalytics(entries);
  const days = computeDayOfWeekAnalytics(entries).filter((d) => d.tradesCount > 0);

  const bestPair = pairs.length > 0 ? { symbol: pairs[0].symbol, winRate: pairs[0].winRatePct, pnl: pairs[0].netPnl } : null;
  const worstPair = pairs.length > 0 ? { symbol: pairs[pairs.length - 1].symbol, winRate: pairs[pairs.length - 1].winRatePct, pnl: pairs[pairs.length - 1].netPnl } : null;

  const validSessions = sessions.filter((s) => s.tradesCount > 0);
  validSessions.sort((a, b) => b.totalPnl - a.totalPnl);
  const bestSession = validSessions.length > 0 ? { session: validSessions[0].label, winRate: validSessions[0].winRatePct, pnl: validSessions[0].totalPnl } : null;
  const worstSession = validSessions.length > 0 ? { session: validSessions[validSessions.length - 1].label, winRate: validSessions[validSessions.length - 1].winRatePct, pnl: validSessions[validSessions.length - 1].totalPnl } : null;

  const validSetups = setups.filter((s) => s.tradesCount > 0);
  const bestSetup = validSetups.length > 0 ? { setup: validSetups[0].setup, winRate: validSetups[0].winRatePct, pnl: validSetups[0].totalPnl } : null;
  const worstSetup = validSetups.length > 0 ? { setup: validSetups[validSetups.length - 1].setup, winRate: validSetups[validSetups.length - 1].winRatePct, pnl: validSetups[validSetups.length - 1].totalPnl } : null;

  days.sort((a, b) => b.totalPnl - a.totalPnl);
  const bestDay = days.length > 0 ? { dayName: days[0].dayName, pnl: days[0].totalPnl } : null;
  const worstDay = days.length > 0 ? { dayName: days[days.length - 1].dayName, pnl: days[days.length - 1].totalPnl } : null;

  let topTakeaway = 'Continue executing your planned high RR setups with strict consistency.';
  if (bestSetup && bestSession) {
    topTakeaway = `Your primary edge is trading ${bestSetup.setup} during ${bestSession.session} (Win rate: ${bestSetup.winRate}%). Double down on this setup.`;
  }

  let leakWarning = 'No critical leak detected.';
  if (worstPair && worstPair.pnl < -100) {
    leakWarning = `${worstPair.symbol} has cost you -$${Math.abs(worstPair.pnl).toFixed(2)}. Consider excluding or sizing down on this instrument.`;
  } else if (worstSession && worstSession.pnl < -100) {
    leakWarning = `Trades taken during ${worstSession.session} bleed -$${Math.abs(worstSession.pnl).toFixed(2)}. Consider restricting activity during this time.`;
  }

  return {
    bestPair,
    worstPair,
    bestSession,
    worstSession,
    bestSetup,
    worstSetup,
    bestDay,
    worstDay,
    topTakeaway,
    leakWarning,
  };
}

export function computePropFirmCompliance(
  entries: JournalEntry[],
  startingBalance: number = 100000,
  dailyLossLimitPct: number = 5.0,
  maxDrawdownLimitPct: number = 10.0,
  profitTargetPct: number = 10.0,
  consistencyThresholdPct: number = 40.0,
  minDaysTarget: number = 5
): PropFirmComplianceAudit {
  const core = computeCoreMetrics(entries, startingBalance);
  const targetProfitUsd = (startingBalance * profitTargetPct) / 100;
  const profitAchievedUsd = Math.max(0, core.netPnl);
  const targetProgressPct = Math.min(100, (profitAchievedUsd / (targetProfitUsd || 1)) * 100);

  // Daily drawdown for current day
  const todayStr = new Date().toISOString().split('T')[0];
  const calendar = computeDailyPnLCalendar(entries);
  const todayData = calendar.get(todayStr);
  const todayLoss = todayData && todayData.netPnl < 0 ? Math.abs(todayData.netPnl) : 0;
  const dailyLossLimitUsd = (startingBalance * dailyLossLimitPct) / 100;
  const dailyLossRemainingUsd = Math.max(0, dailyLossLimitUsd - todayLoss);

  let dailyLossStatus: 'PASS' | 'WARNING' | 'BREACH' = 'PASS';
  if (todayLoss >= dailyLossLimitUsd) dailyLossStatus = 'BREACH';
  else if (todayLoss >= dailyLossLimitUsd * 0.8) dailyLossStatus = 'WARNING';

  // Overall Max Drawdown
  const maxDrawdownLimitUsd = (startingBalance * maxDrawdownLimitPct) / 100;
  let overallDrawdownStatus: 'PASS' | 'WARNING' | 'BREACH' = 'PASS';
  if (core.maxDrawdownUsd >= maxDrawdownLimitUsd) overallDrawdownStatus = 'BREACH';
  else if (core.maxDrawdownUsd >= maxDrawdownLimitUsd * 0.8) overallDrawdownStatus = 'WARNING';

  // Consistency rule: Single best day profit vs total profit
  let bestDayProfit = 0;
  calendar.forEach((v) => {
    if (v.netPnl > bestDayProfit) bestDayProfit = v.netPnl;
  });
  const bestDayShareOfProfitPct = profitAchievedUsd > 0 ? (bestDayProfit / profitAchievedUsd) * 100 : 0;
  let consistencyStatus: 'PASS' | 'WARNING' | 'BREACH' = 'PASS';
  if (profitAchievedUsd >= targetProfitUsd * 0.5) {
    if (bestDayShareOfProfitPct > consistencyThresholdPct) {
      consistencyStatus = 'WARNING';
    }
  }

  const tradingDaysCompleted = calendar.size;
  const isEligible =
    profitAchievedUsd >= targetProfitUsd &&
    dailyLossStatus === 'PASS' &&
    overallDrawdownStatus === 'PASS' &&
    consistencyStatus === 'PASS' &&
    tradingDaysCompleted >= minDaysTarget;

  return {
    startingBalance,
    currentEquity: startingBalance + core.netPnl,
    targetProfitUsd,
    profitAchievedUsd,
    targetProgressPct: Math.round(targetProgressPct * 10) / 10,
    dailyLossUsd: Math.round(todayLoss * 100) / 100,
    dailyLossLimitUsd,
    dailyLossRemainingUsd: Math.round(dailyLossRemainingUsd * 100) / 100,
    dailyLossStatus,
    maxTrailingDrawdownUsd: core.maxDrawdownUsd,
    maxDrawdownLimitUsd,
    overallDrawdownStatus,
    bestDayProfitUsd: Math.round(bestDayProfit * 100) / 100,
    bestDayShareOfProfitPct: Math.round(bestDayShareOfProfitPct * 10) / 10,
    consistencyRuleLimitPct: consistencyThresholdPct,
    consistencyStatus,
    minTradingDaysTarget: minDaysTarget,
    tradingDaysCompleted,
    isEligibleForPayout: isEligible,
  };
}
