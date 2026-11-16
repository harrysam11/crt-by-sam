/**
 * AI Behavioral Insights & Psychology Coach Engine.
 * Analyzes journaled trade history, emotional tags, timing velocity,
 * streak psychology, and tilt patterns.
 * Supports local Ollama (Llama 3 / DeepSeek / Mistral) & Cloud API.
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { JournalEntry } from '../types/psychology';
import { computeCoreMetrics, computePairAnalytics, computeSessionAnalytics, computeSetupAnalytics } from './portfolioAnalytics';

export interface BehavioralAuditResult {
  psychologyScore: number; // 0-100
  tiltLevel: 'CALM' | 'ELEVATED' | 'DANGEROUS' | 'TILTED';
  streakRisk: string;
  fomoCount: number;
  fomoPnl: number;
  revengeCount: number;
  revengePnl: number;
  plannedCount: number;
  plannedPnl: number;
  disciplineRatePct: number;
  strengths: string[];
  vulnerabilities: string[];
  coachingDirectives: string[];
  aiPrompt: string;
}

export function performBehavioralAudit(entries: JournalEntry[]): BehavioralAuditResult {
  if (!entries.length) {
    return {
      psychologyScore: 100,
      tiltLevel: 'CALM',
      streakRisk: 'No trades recorded yet. Mindset clean.',
      fomoCount: 0,
      fomoPnl: 0,
      revengeCount: 0,
      revengePnl: 0,
      plannedCount: 0,
      plannedPnl: 0,
      disciplineRatePct: 100,
      strengths: ['Account in baseline calm state with zero impulsive trades logged.'],
      vulnerabilities: [],
      coachingDirectives: ['Execute your pre-market checklist before taking your first entry.'],
      aiPrompt: '',
    };
  }

  let fomoCount = 0;
  let fomoPnl = 0;
  let revengeCount = 0;
  let revengePnl = 0;
  let plannedCount = 0;
  let plannedPnl = 0;
  let impulseCount = 0;
  let impulsePnl = 0;

  entries.forEach((e) => {
    const net = (e.pnl ?? 0) - (e.commission ?? 2.50);
    if (e.emotionTag === 'FOMO') {
      fomoCount++;
      fomoPnl += net;
    } else if (e.emotionTag === 'REVENGE') {
      revengeCount++;
      revengePnl += net;
    } else if (e.emotionTag === 'IMPULSE') {
      impulseCount++;
      impulsePnl += net;
    } else {
      plannedCount++;
      plannedPnl += net;
    }
  });

  const total = entries.length;
  const emotionalTrades = fomoCount + revengeCount + impulseCount;
  const disciplineRatePct = total > 0 ? Math.round((plannedCount / total) * 100) : 100;

  // Streak detection (recent consecutive losses)
  const chrono = [...entries].sort((a, b) => b.timestamp - a.timestamp); // latest first
  let recentLossStreak = 0;
  for (const t of chrono) {
    if ((t.pnl ?? 0) < 0) recentLossStreak++;
    else break;
  }

  // Psychology score algorithm
  let score = 100;
  score -= (fomoCount / total) * 35;
  score -= (revengeCount / total) * 45;
  score -= (impulseCount / total) * 20;
  if (recentLossStreak >= 3) score -= 15;
  if (recentLossStreak >= 5) score -= 25;
  const finalScore = Math.max(10, Math.min(100, Math.round(score)));

  let tiltLevel: BehavioralAuditResult['tiltLevel'] = 'CALM';
  if (finalScore < 40 || revengeCount >= 2 || recentLossStreak >= 4) {
    tiltLevel = 'TILTED';
  } else if (finalScore < 65 || emotionalTrades >= 3 || recentLossStreak >= 2) {
    tiltLevel = 'ELEVATED';
  } else if (finalScore < 80) {
    tiltLevel = 'CALM';
  }

  let streakRisk = 'Normal execution pace.';
  if (recentLossStreak >= 3) {
    streakRisk = `Warning: ${recentLossStreak} consecutive red trades. Heightened probability of dopamine-seeking revenge trade. Cooldown mandatory.`;
  }

  const strengths: string[] = [];
  const vulnerabilities: string[] = [];
  const coachingDirectives: string[] = [];

  if (disciplineRatePct >= 80) {
    strengths.push(`High procedural discipline: ${disciplineRatePct}% of trades adhered strictly to your pre-defined strategy.`);
  }
  if (plannedPnl > 0) {
    strengths.push(`Positive edge expectancy: Planned setups generated +$${plannedPnl.toFixed(2)}.`);
  }
  if (revengeCount === 0) {
    strengths.push('Zero revenge trades logged. Emotional composure after losses is intact.');
  }

  if (revengeCount > 0) {
    vulnerabilities.push(`Revenge trading detected (${revengeCount} instances, cost -$${Math.abs(revengePnl).toFixed(2)}). You are trying to win back capital immediately.`);
    coachingDirectives.push('Implement a hard 30-minute keyboard detachment lock after any red trade.');
  }
  if (fomoCount > 0) {
    vulnerabilities.push(`FOMO chasing cost you -$${Math.abs(fomoPnl).toFixed(2)} across ${fomoCount} trades. Entering after major candles expand rather than on limit retracements.`);
    coachingDirectives.push('Never buy green candles or short red candles at session highs/lows. Wait for key Fibonacci or order block retests.');
  }
  if (recentLossStreak >= 2) {
    coachingDirectives.push('Reduce risk per trade by 50% until two consecutive winning executions restore cognitive baseline.');
  }

  if (!coachingDirectives.length) {
    coachingDirectives.push('Continue maintaining trade logs with screenshots after every single execution.');
    coachingDirectives.push('Review weekly setups on weekends to internalize highest expectancy patterns.');
  }

  // Pre-generate prompt for Local Ollama / AI models
  const core = computeCoreMetrics(entries);
  const pairStats = computePairAnalytics(entries);
  const sessionStats = computeSessionAnalytics(entries);
  const setupStats = computeSetupAnalytics(entries);

  const aiPrompt = `You are an elite quantitative trading performance psychologist and hedge fund risk officer.
Analyze this trader's journaled execution history and behavioral metrics:

[OVERVIEW]
- Total Executions: ${core.totalTrades}
- Win Rate: ${core.winRatePct}%
- Net PnL: $${core.netPnl.toFixed(2)} (Gross Profit: $${core.grossProfit}, Gross Loss: $${core.grossLoss})
- Profit Factor: ${core.profitFactor}
- Total Commission Paid: $${core.totalCommission}
- Expected Value per Trade: $${core.expectedValue}
- Max Drawdown: $${core.maxDrawdownUsd} (${core.maxDrawdownPct}%)
- Current Loss Streak: ${recentLossStreak}
- Discipline Rate: ${disciplineRatePct}% Planned vs ${emotionalTrades} Emotional trades
- FOMO Cost: -$${Math.abs(fomoPnl).toFixed(2)} (${fomoCount} trades)
- Revenge Cost: -$${Math.abs(revengePnl).toFixed(2)} (${revengeCount} trades)

[BY PAIR]
${pairStats.map((p) => `  * ${p.symbol}: ${p.tradesCount} trades | ${p.winRatePct}% Win | Net: $${p.netPnl}`).join('\n')}

[BY SESSION]
${sessionStats.map((s) => `  * ${s.label}: ${s.tradesCount} trades | ${s.winRatePct}% Win | Net: $${s.totalPnl}`).join('\n')}

[BY SETUP]
${setupStats.map((s) => `  * ${s.setup}: ${s.tradesCount} trades | ${s.winRatePct}% Win | Net: $${s.totalPnl}`).join('\n')}

Provide an ultra-concise, institutional-grade debrief containing:
1. Executive Cognitive Diagnosis (Where is this trader leaking capital psychologically?)
2. Edge Optimization (Which 1 pair and 1 setup should they strictly isolate?)
3. Specific Rules of Engagement (3 bullet points for next session to maximize discipline and eliminate emotional tilt).`;

  return {
    psychologyScore: finalScore,
    tiltLevel,
    streakRisk,
    fomoCount,
    fomoPnl: Math.round(fomoPnl * 100) / 100,
    revengeCount,
    revengePnl: Math.round(revengePnl * 100) / 100,
    plannedCount,
    plannedPnl: Math.round(plannedPnl * 100) / 100,
    disciplineRatePct,
    strengths,
    vulnerabilities,
    coachingDirectives,
    aiPrompt,
  };
}

export async function queryLocalOllama(
  prompt: string,
  model: string = 'llama3',
  endpoint: string = 'http://localhost:11434/api/generate'
): Promise<{ ok: boolean; response: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, response: data.response || '' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return {
      ok: false,
      response: `Local Ollama is not responding at ${endpoint} (${msg}). Ensure Ollama is running ('ollama serve') or copy the prompt into your preferred AI model.`,
    };
  }
}
