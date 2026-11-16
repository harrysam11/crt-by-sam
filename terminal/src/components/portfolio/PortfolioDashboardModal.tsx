/**
 * Institutional Portfolio Tracker Dashboard, Analytics & Trade Journal Suite.
 * Features:
 * - Portfolio Tracker & KPI Cards
 * - Interactive Monthly / Weekly PnL Calendar
 * - Cumulative Equity Curve & High Water Mark
 * - Pair Analytics & Session / Day-of-Week Breakdown
 * - Setup & Checklist Compliance Audit
 * - Algorithmic Edge Finder & Risk Leak Detector
 * - Prop Firm Rule Guardian (Drawdown, Consistency, Target)
 * - Smart AI Behavioral Insights & Psychology Coach (Local Ollama support)
 * - Trade Journal Archive & Canvas Screenshots
 * - Forex Factory Macro News & J7 Tracker Feed
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { useJournalStore } from '../../store/useJournalStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useGuardianStore } from '../../store/useGuardianStore';
import { fmtPrice, fmtPnl, fmtUsd, labelOf, pnlClass } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { JournalEntry } from '../../types/psychology';
import {
  type DailyPnLSummary,
  computeCoreMetrics,
  computeDailyPnLCalendar,
  computeCumulativeEquityCurve,
  computePairAnalytics,
  computeDayOfWeekAnalytics,
  computeSessionAnalytics,
  computeSetupAnalytics,
  computeEdgeFinder,
  computePropFirmCompliance,
} from '../../services/portfolioAnalytics';
import {
  performBehavioralAudit,
  queryLocalOllama,
} from '../../services/aiBehavioralInsights';
import {
  MACRO_ECONOMIC_CALENDAR,
  LIVE_BREAKING_NEWS,
  type MacroEconomicEvent,
} from '../../services/liveMacroNews';

interface PortfolioDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType =
  | 'DASHBOARD'
  | 'ANALYTICS'
  | 'EDGE_FINDER'
  | 'PROP_FIRM'
  | 'BEHAVIOR_AI'
  | 'JOURNAL'
  | 'MACRO_NEWS';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_HEADER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PortfolioDashboardModal({
  isOpen,
  onClose,
}: PortfolioDashboardModalProps) {
  const entries = useJournalStore((s) => s.entries);
  const deleteEntry = useJournalStore((s) => s.deleteEntry);
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const balance = useTerminalStore((s) => s.balance);
  const guardianProp = useGuardianStore((s) => s.propFirm);

  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Journal View Selection
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [filterSetup, setFilterSetup] = useState<string>('ALL');

  // AI Ollama state
  const [ollamaModel, setOllamaModel] = useState<string>('llama3');
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>('http://localhost:11434/api/generate');
  const [isQueryingOllama, setIsQueryingOllama] = useState<boolean>(false);
  const [ollamaOutput, setOllamaOutput] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Macro News Filter
  const [newsFilterImpact, setNewsFilterImpact] = useState<'ALL' | 'HIGH'>('ALL');

  // Calculations
  const coreMetrics = useMemo(() => computeCoreMetrics(entries, balance || 10000), [entries, balance]);
  const pnlCalendarMap = useMemo(() => computeDailyPnLCalendar(entries), [entries]);
  const equityCurve = useMemo(() => computeCumulativeEquityCurve(entries, balance || 10000), [entries, balance]);
  const pairStats = useMemo(() => computePairAnalytics(entries), [entries]);
  const dayStats = useMemo(() => computeDayOfWeekAnalytics(entries), [entries]);
  const sessionStats = useMemo(() => computeSessionAnalytics(entries), [entries]);
  const setupStats = useMemo(() => computeSetupAnalytics(entries), [entries]);
  const edgeFinder = useMemo(() => computeEdgeFinder(entries), [entries]);

  const propCompliance = useMemo(() => {
    return computePropFirmCompliance(
      entries,
      guardianProp.accountSize || 100000,
      guardianProp.dailyDrawdownPct || 5.0,
      guardianProp.maxDrawdownPct || 10.0,
      guardianProp.profitTargetPct || 10.0,
      guardianProp.consistencyPct || 40.0,
      guardianProp.minTradingDays || 5
    );
  }, [entries, guardianProp]);

  const behavioralAudit = useMemo(() => performBehavioralAudit(entries), [entries]);

  if (!isOpen) return null;

  // Calendar matrix calculation
  const calendarDays = (() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (DailyPnLSummary | null)[] = [];

    // Prefix empty slots
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = pnlCalendarMap.get(dateStr) || {
        dateStr,
        dayOfWeek: (firstDay + d - 1) % 7,
        dayOfMonth: d,
        pnl: 0,
        netPnl: 0,
        tradesCount: 0,
        wins: 0,
        losses: 0,
        entries: [],
      };
      days.push(dayData);
    }
    return days;
  })();

  const selectedJournalEntry = entries.find((e) => e.id === selectedJournalId) || entries[0];

  const handlePrevMonth = () => {
    audioHaptics.tick();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    audioHaptics.tick();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleRunOllama = async () => {
    audioHaptics.tick();
    setIsQueryingOllama(true);
    setOllamaOutput(null);
    const res = await queryLocalOllama(behavioralAudit.aiPrompt, ollamaModel, ollamaEndpoint);
    setOllamaOutput(res.response);
    setIsQueryingOllama(false);
  };

  const handleCopyPrompt = () => {
    audioHaptics.tick();
    navigator.clipboard.writeText(behavioralAudit.aiPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  // SVG Equity curve path
  const curveSvg = (() => {
    if (equityCurve.length < 2) return '';
    const w = 700;
    const h = 180;
    const pnls = equityCurve.map((p) => p.cumPnl);
    const min = Math.min(0, ...pnls);
    const max = Math.max(100, ...pnls);
    const range = max - min || 1;

    const coords = equityCurve.map((p, idx) => {
      const x = (idx / (equityCurve.length - 1)) * w;
      const y = h - ((p.cumPnl - min) / range) * (h - 24) - 12;
      return { x, y };
    });

    const pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
    const zeroY = h - ((0 - min) / range) * (h - 24) - 12;

    return { pathD, zeroY, w, h, min, max };
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 font-mono select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="clay-modal flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-grid/80 shadow-2xl bg-[#0b0d14]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid/50 px-4 sm:px-6 py-3 bg-[#0d0f18]">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm sm:text-base">Portfolio Tracker & Trade Journal</span>
                <span className="clay-badge text-[10px] text-[#38bdf8]">PRO+ ANALYTICS</span>
              </div>
              <span className="text-[10px] text-muted">Institutional Performance & Cognitive Audit Suite</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] text-muted block">Net PnL</span>
                <span className={`font-bold ${pnlClass(coreMetrics.netPnl)}`}>{fmtPnl(coreMetrics.netPnl)}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block">Win Rate</span>
                <span className="font-bold text-white">{coreMetrics.winRatePct}%</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block">Profit Factor</span>
                <span className="font-bold text-white">{coreMetrics.profitFactor}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block">Total Comm</span>
                <span className="font-bold text-amber-400">-${coreMetrics.totalCommission}</span>
              </div>
            </div>

            <button
              onClick={() => { audioHaptics.tick(); onClose(); }}
              className="clay-btn p-1.5 text-muted hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1 border-b border-grid/50 px-4 pt-2 bg-[#090a10] overflow-x-auto scrollbar-none">
          {[
            { id: 'DASHBOARD' as TabType, label: 'PnL Calendar & KPIs' },
            { id: 'ANALYTICS' as TabType, label: 'Pair & Time Analytics' },
            { id: 'EDGE_FINDER' as TabType, label: 'Edge Finder & Setups' },
            { id: 'PROP_FIRM' as TabType, label: 'Prop Firm Rules Guardian' },
            { id: 'BEHAVIOR_AI' as TabType, label: 'AI Psychology Coach' },
            { id: 'JOURNAL' as TabType, label: `Trade Logs & Canvas (${entries.length})` },
            { id: 'MACRO_NEWS' as TabType, label: 'Macro Calendar & J7 Tracker' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                audioHaptics.tick();
                setActiveTab(t.id);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap border-b-2 ${
                activeTab === t.id
                  ? 'border-[#38bdf8] text-white bg-white/[0.04]'
                  : 'border-transparent text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: DASHBOARD & PNL CALENDAR */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-6">
              {/* Primary KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                {[
                  { label: 'Net Profit', val: fmtPnl(coreMetrics.netPnl), cls: pnlClass(coreMetrics.netPnl) },
                  { label: 'Win Rate', val: `${coreMetrics.winRatePct}%`, cls: coreMetrics.winRatePct >= 50 ? 'text-up' : 'text-down' },
                  { label: 'Profit Factor', val: `${coreMetrics.profitFactor}`, cls: coreMetrics.profitFactor >= 1.5 ? 'text-up' : 'text-amber-400' },
                  { label: 'Expected Value', val: `${fmtPnl(coreMetrics.expectedValue)}/tr`, cls: pnlClass(coreMetrics.expectedValue) },
                  { label: 'Max Drawdown', val: `${coreMetrics.maxDrawdownPct}%`, cls: 'text-down' },
                  { label: 'Total Comm', val: `-$${coreMetrics.totalCommission}`, cls: 'text-amber-400' },
                  { label: 'Sharpe Ratio', val: `${coreMetrics.sharpeRatio}`, cls: coreMetrics.sharpeRatio >= 1 ? 'text-up' : 'text-muted' },
                  { label: 'Total Trades', val: `${coreMetrics.totalTrades} (${coreMetrics.winningTrades}W/${coreMetrics.losingTrades}L)`, cls: 'text-white' },
                ].map((kpi, i) => (
                  <div key={i} className="clay-panel rounded-lg p-2.5 border border-grid/40">
                    <span className="text-[10px] text-muted block uppercase font-bold">{kpi.label}</span>
                    <span className={`text-sm font-bold font-mono mt-0.5 block ${kpi.cls}`}>{kpi.val}</span>
                  </div>
                ))}
              </div>

              {/* Cumulative Equity Curve Chart */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Cumulative Net Equity Curve</span>
                    <span className="text-[10px] text-muted ml-2">Net Realized Return ($) across {equityCurve.length - 1} trades</span>
                  </div>
                  <span className={`text-xs font-bold ${pnlClass(coreMetrics.netPnl)}`}>
                    Peak Watermark: +${Math.max(0, ...equityCurve.map((p) => p.cumPnl)).toFixed(2)}
                  </span>
                </div>

                {curveSvg ? (
                  <div className="w-full overflow-hidden">
                    <svg viewBox={`0 0 ${curveSvg.w} ${curveSvg.h}`} className="w-full h-36">
                      <line x1="0" y1={curveSvg.zeroY} x2={curveSvg.w} y2={curveSvg.zeroY} stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                      <path d={curveSvg.pathD} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-muted">
                    Take more trades to generate your cumulative equity curve.
                  </div>
                )}
              </div>

              {/* Monthly Interactive PnL Calendar */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      PnL Calendar — {MONTH_NAMES[currentMonth]} {currentYear}
                    </span>
                    {selectedDateFilter && (
                      <span className="text-[10px] bg-accent/20 text-[#38bdf8] px-2 py-0.5 rounded flex items-center gap-1">
                        Filtered: {selectedDateFilter}
                        <button onClick={() => setSelectedDateFilter(null)} className="hover:text-white font-bold">x</button>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button onClick={handlePrevMonth} className="clay-btn px-2 py-1 text-xs text-muted hover:text-white">
                      &lt; Prev
                    </button>
                    <button
                      onClick={() => {
                        setCurrentMonth(new Date().getMonth());
                        setCurrentYear(new Date().getFullYear());
                      }}
                      className="clay-btn px-2 py-1 text-xs text-muted hover:text-white"
                    >
                      Today
                    </button>
                    <button onClick={handleNextMonth} className="clay-btn px-2 py-1 text-xs text-muted hover:text-white">
                      Next &gt;
                    </button>
                  </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted uppercase">
                  {DAYS_HEADER.map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="h-16 rounded bg-white/[0.01] border border-transparent" />;
                    }

                    const hasTrades = day.tradesCount > 0;
                    const isPositive = day.netPnl > 0.5;
                    const isNegative = day.netPnl < -0.5;
                    const isSelected = selectedDateFilter === day.dateStr;

                    return (
                      <div
                        key={day.dateStr}
                        onClick={() => {
                          if (hasTrades) {
                            audioHaptics.tick();
                            setSelectedDateFilter(isSelected ? null : day.dateStr);
                          }
                        }}
                        className={`h-16 rounded-lg p-1.5 border transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-[#38bdf8] bg-white/10'
                            : isPositive
                            ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400'
                            : isNegative
                            ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400'
                            : 'bg-white/[0.02] border-grid/40 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-mono ${hasTrades ? 'text-white font-bold' : 'text-zinc-500'}`}>
                            {day.dayOfMonth}
                          </span>
                          {hasTrades && (
                            <span className="text-[9px] text-muted">
                              {day.tradesCount}tr
                            </span>
                          )}
                        </div>

                        {hasTrades ? (
                          <div>
                            <div className={`text-[11px] font-bold font-mono ${pnlClass(day.netPnl)}`}>
                              {fmtPnl(day.netPnl)}
                            </div>
                            <div className="text-[9px] text-muted">
                              {day.wins}W / {day.losses}L
                            </div>
                          </div>
                        ) : (
                          <div className="text-[9px] text-zinc-600">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAIR & TIME ANALYTICS */}
          {activeTab === 'ANALYTICS' && (
            <div className="space-y-6">
              {/* Pair Analytics Table */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Performance by Instrument / Pair</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-grid/60 text-[10px] text-muted uppercase">
                        <th className="py-2 px-3">Symbol</th>
                        <th className="py-2 px-3">Trades</th>
                        <th className="py-2 px-3">Win Rate</th>
                        <th className="py-2 px-3">Gross PnL</th>
                        <th className="py-2 px-3">Commission</th>
                        <th className="py-2 px-3">Net PnL</th>
                        <th className="py-2 px-3">Profit Factor</th>
                        <th className="py-2 px-3">Avg Trade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairStats.map((p) => (
                        <tr key={p.symbol} className="border-b border-grid/30 hover:bg-white/[0.02]">
                          <td className="py-2 px-3 font-bold text-white">{labelOf(p.symbol)}</td>
                          <td className="py-2 px-3 text-muted">{p.tradesCount} ({p.wins}W / {p.losses}L)</td>
                          <td className={`py-2 px-3 font-semibold ${p.winRatePct >= 50 ? 'text-up' : 'text-down'}`}>{p.winRatePct}%</td>
                          <td className="py-2 px-3">{fmtPnl(p.totalPnl)}</td>
                          <td className="py-2 px-3 text-amber-400">-${p.commission}</td>
                          <td className={`py-2 px-3 font-bold ${pnlClass(p.netPnl)}`}>{fmtPnl(p.netPnl)}</td>
                          <td className="py-2 px-3">{p.profitFactor}</td>
                          <td className={`py-2 px-3 ${pnlClass(p.avgPnl)}`}>{fmtPnl(p.avgPnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Day of Week & Session Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Day of Week */}
                <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Performance by Day of Week</span>
                  <div className="space-y-2">
                    {dayStats.filter((d) => d.tradesCount > 0).map((d) => (
                      <div key={d.dayName} className="flex items-center justify-between text-xs p-2 rounded bg-white/[0.02] border border-grid/30">
                        <span className="font-bold text-white w-12">{d.dayName}</span>
                        <span className="text-muted text-[10px]">{d.tradesCount} trades</span>
                        <span className={`text-[11px] font-semibold ${d.winRatePct >= 50 ? 'text-up' : 'text-down'}`}>{d.winRatePct}% Win</span>
                        <span className={`font-mono font-bold ${pnlClass(d.totalPnl)}`}>{fmtPnl(d.totalPnl)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session Breakdown */}
                <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Performance by Global Trading Session</span>
                  <div className="space-y-2">
                    {sessionStats.map((s) => (
                      <div key={s.session} className="flex items-center justify-between text-xs p-2 rounded bg-white/[0.02] border border-grid/30">
                        <div className="flex-1">
                          <span className="font-bold text-white block text-xs">{s.label}</span>
                          <span className="text-[10px] text-muted">{s.tradesCount} trades | Avg: {fmtPnl(s.avgPnl)}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold block ${pnlClass(s.totalPnl)}`}>{fmtPnl(s.totalPnl)}</span>
                          <span className={`text-[10px] ${s.winRatePct >= 50 ? 'text-up' : 'text-down'}`}>{s.winRatePct}% Win</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EDGE FINDER & SETUPS */}
          {activeTab === 'EDGE_FINDER' && (
            <div className="space-y-6">
              {/* Highlight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="clay-panel rounded-xl p-4 border border-emerald-500/30 bg-emerald-950/10 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Primary Statistical Edge</span>
                  <p className="text-sm text-slate-200">{edgeFinder.topTakeaway}</p>
                  {edgeFinder.bestPair && (
                    <div className="text-[11px] text-muted flex gap-3 pt-1 border-t border-emerald-500/20">
                      <span>Best Pair: <strong className="text-white">{edgeFinder.bestPair.symbol}</strong> ({edgeFinder.bestPair.winRate}%)</span>
                      <span>Net: <strong className="text-up">+{fmtPnl(edgeFinder.bestPair.pnl)}</strong></span>
                    </div>
                  )}
                </div>

                <div className="clay-panel rounded-xl p-4 border border-rose-500/30 bg-rose-950/10 space-y-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">Primary Risk Leak</span>
                  <p className="text-sm text-slate-200">{edgeFinder.leakWarning}</p>
                  {edgeFinder.worstPair && (
                    <div className="text-[11px] text-muted flex gap-3 pt-1 border-t border-rose-500/20">
                      <span>Worst Pair: <strong className="text-white">{edgeFinder.worstPair.symbol}</strong></span>
                      <span>Leak: <strong className="text-down">{fmtPnl(edgeFinder.worstPair.pnl)}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Setups Matrix */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Performance by Setup Strategy</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {setupStats.map((st) => (
                    <div key={st.setup} className="clay-panel rounded-lg p-3 border border-grid/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{st.setup}</span>
                        <span className={`text-xs font-bold ${pnlClass(st.totalPnl)}`}>{fmtPnl(st.totalPnl)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>{st.tradesCount} trades ({st.wins}W)</span>
                        <span className={st.winRatePct >= 50 ? 'text-up' : 'text-down'}>{st.winRatePct}% Win Rate</span>
                      </div>
                      <div className="text-[10px] text-muted pt-1 border-t border-grid/30">
                        Avg R-Multiple: <strong className="text-white">{st.avgRMultiple}R</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROP FIRM RULES GUARDIAN */}
          {activeTab === 'PROP_FIRM' && (
            <div className="space-y-6">
              {/* Account Status Card */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold block">Account Status</span>
                  <span className="text-xl font-bold text-white font-mono">{fmtUsd(propCompliance.currentEquity)}</span>
                  <span className="text-[10px] text-muted ml-2">Starting: {fmtUsd(propCompliance.startingBalance)}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${
                    propCompliance.isEligibleForPayout
                      ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                      : 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  }`}>
                    {propCompliance.isEligibleForPayout ? 'PASSED — ELIGIBLE FOR PAYOUT' : 'IN PROGRESS / EVALUATION'}
                  </div>
                </div>
              </div>

              {/* Progress & Drawdown Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Profit Target */}
                <div className="clay-panel rounded-xl p-4 border border-grid/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted font-bold uppercase text-[10px]">Profit Target Progress</span>
                    <span className="text-white font-bold">{propCompliance.targetProgressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${propCompliance.targetProgressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>Target: +${propCompliance.targetProfitUsd}</span>
                    <span className="text-up font-bold">+${propCompliance.profitAchievedUsd}</span>
                  </div>
                </div>

                {/* Daily Drawdown */}
                <div className="clay-panel rounded-xl p-4 border border-grid/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted font-bold uppercase text-[10px]">Daily Drawdown Buffer</span>
                    <span className={`font-bold ${propCompliance.dailyLossStatus === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {propCompliance.dailyLossStatus}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (propCompliance.dailyLossUsd / propCompliance.dailyLossLimitUsd) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>Used Today: -${propCompliance.dailyLossUsd}</span>
                    <span>Remaining: ${propCompliance.dailyLossRemainingUsd}</span>
                  </div>
                </div>

                {/* Consistency Rule */}
                <div className="clay-panel rounded-xl p-4 border border-grid/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted font-bold uppercase text-[10px]">Consistency Threshold</span>
                    <span className={`font-bold ${propCompliance.consistencyStatus === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {propCompliance.bestDayShareOfProfitPct}% / max {propCompliance.consistencyRuleLimitPct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${propCompliance.consistencyStatus === 'PASS' ? 'bg-cyan-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, (propCompliance.bestDayShareOfProfitPct / propCompliance.consistencyRuleLimitPct) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>Best Day: +${propCompliance.bestDayProfitUsd}</span>
                    <span>Status: {propCompliance.consistencyStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI PSYCHOLOGY COACH & BEHAVIORAL INSIGHTS */}
          {activeTab === 'BEHAVIOR_AI' && (
            <div className="space-y-6">
              {/* Psychology Score & Tilt State */}
              <div className="clay-panel rounded-xl p-5 border border-grid/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold block">Psychological Readiness Score</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-4xl font-extrabold font-mono ${
                      behavioralAudit.psychologyScore >= 80 ? 'text-emerald-400' :
                      behavioralAudit.psychologyScore >= 60 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {behavioralAudit.psychologyScore}/100
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      behavioralAudit.tiltLevel === 'CALM' ? 'bg-emerald-500/20 text-emerald-300' :
                      behavioralAudit.tiltLevel === 'ELEVATED' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-red-500/20 text-red-300 animate-pulse'
                    }`}>
                      TILT LEVEL: {behavioralAudit.tiltLevel}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1.5">{behavioralAudit.streakRisk}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopyPrompt}
                    className="clay-btn px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    {copiedPrompt ? 'Prompt Copied!' : 'Copy Coach Prompt'}
                  </button>
                  <button
                    onClick={handleRunOllama}
                    disabled={isQueryingOllama}
                    className="clay-pill-active px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    {isQueryingOllama ? 'Analyzing via Ollama...' : 'Run Local Ollama AI'}
                  </button>
                </div>
              </div>

              {/* Strengths & Leaks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="clay-panel rounded-xl p-4 border border-emerald-500/30 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Observed Behavioral Strengths</span>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {behavioralAudit.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="clay-panel rounded-xl p-4 border border-rose-500/30 space-y-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">Cognitive & Discipline Leaks</span>
                  {behavioralAudit.vulnerabilities.length === 0 ? (
                    <p className="text-xs text-muted">Zero critical leaks logged. Maintain your current execution discipline.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {behavioralAudit.vulnerabilities.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Coaching Directives */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Performance Directives for Next Session</span>
                <div className="space-y-1.5">
                  {behavioralAudit.coachingDirectives.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-200">
                      <span className="text-[#38bdf8] font-bold">[{i + 1}]</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ollama Result Output */}
              {ollamaOutput && (
                <div className="clay-panel rounded-xl p-4 border border-[#38bdf8]/40 bg-[#070910] space-y-2">
                  <span className="text-xs font-bold text-[#38bdf8] uppercase tracking-wider block">Ollama AI Coach Response</span>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{ollamaOutput}</pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: TRADE LOGS & CANVAS SCREENSHOTS */}
          {activeTab === 'JOURNAL' && (
            <div className="flex flex-col lg:flex-row gap-4 min-h-[550px]">
              {/* Entries List */}
              <div className="w-full lg:w-80 shrink-0 border border-grid/50 rounded-xl p-2 overflow-y-auto max-h-[550px] bg-[#090b12] space-y-1">
                {entries.length === 0 ? (
                  <p className="text-center text-xs text-muted py-8">No journal entries logged yet.</p>
                ) : (
                  entries.map((e) => {
                    const isSelected = (selectedJournalId || entries[0]?.id) === e.id;
                    return (
                      <div
                        key={e.id}
                        onClick={() => { audioHaptics.tick(); setSelectedJournalId(e.id); }}
                        className={`p-2.5 rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'border-[#38bdf8] bg-white/10'
                            : 'border-grid/30 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{labelOf(e.symbol)}</span>
                          <span className={`text-[10px] font-bold ${e.side === 'BUY' || e.side === 'LONG' ? 'text-up' : 'text-down'}`}>
                            {e.side}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1">
                          <span className="text-muted">{new Date(e.timestamp).toLocaleDateString()}</span>
                          <span className={`font-mono font-bold ${pnlClass(e.netPnl ?? e.pnl ?? 0)}`}>
                            {fmtPnl(e.netPnl ?? e.pnl ?? 0)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted truncate mt-0.5">{e.notes}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Entry Detail & Screenshot Viewer */}
              {selectedJournalEntry ? (
                <div className="flex-1 clay-panel rounded-xl p-4 border border-grid/50 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid/40 pb-3">
                    <div>
                      <span className="text-base font-bold text-white font-mono">{labelOf(selectedJournalEntry.symbol)}</span>
                      <span className="text-xs text-muted ml-2">{new Date(selectedJournalEntry.timestamp).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        if (window.confirm('Delete this trade journal entry?')) {
                          deleteEntry(selectedJournalEntry.id);
                        }
                      }}
                      className="clay-btn px-2.5 py-1 text-xs text-red-400 hover:text-red-300"
                    >
                      Delete Entry
                    </button>
                  </div>

                  {/* Chart Screenshot Canvas */}
                  {selectedJournalEntry.chartDataUrl ? (
                    <div className="rounded-lg overflow-hidden border border-grid/60 bg-black/60">
                      <img src={selectedJournalEntry.chartDataUrl} alt="Trade Canvas Snapshot" className="w-full object-contain max-h-[340px]" />
                    </div>
                  ) : (
                    <div className="h-44 rounded-lg border border-grid/40 flex items-center justify-center text-xs text-muted">
                      No chart canvas snapshot attached to this trade.
                    </div>
                  )}

                  {/* Notes & Setup */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-muted block uppercase font-bold mb-1">Trade Notes</label>
                      <textarea
                        value={selectedJournalEntry.notes}
                        onChange={(e) => updateEntry(selectedJournalEntry.id, { notes: e.target.value })}
                        rows={3}
                        className="w-full clay-inset p-2 rounded text-xs text-white focus:outline-none resize-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block uppercase font-bold mb-1">Emotion Tag</label>
                      <select
                        value={selectedJournalEntry.emotionTag}
                        onChange={(e) => updateEntry(selectedJournalEntry.id, { emotionTag: e.target.value as any })}
                        className="w-full clay-inset p-2 rounded text-xs text-white focus:outline-none mb-2"
                      >
                        <option value="PLANNED">Planned Setup</option>
                        <option value="FOMO">FOMO Chase</option>
                        <option value="REVENGE">Revenge Trade</option>
                        <option value="IMPULSE">Impulse Entry</option>
                      </select>

                      <label className="text-[10px] text-muted block uppercase font-bold mb-1">Setup Type</label>
                      <input
                        type="text"
                        value={selectedJournalEntry.setup || 'TREND_PULLBACK'}
                        onChange={(e) => updateEntry(selectedJournalEntry.id, { setup: e.target.value })}
                        className="w-full clay-inset p-2 rounded text-xs text-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted">
                  Select an entry to view details.
                </div>
              )}
            </div>
          )}

          {/* TAB 7: FOREX FACTORY MACRO NEWS & J7 TRACKER */}
          {activeTab === 'MACRO_NEWS' && (
            <div className="space-y-6">
              {/* Macro Economic Calendar */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Forex Factory High-Impact Economic Schedule</span>
                  <div className="flex gap-1">
                    {(['ALL', 'HIGH'] as const).map((impact) => (
                      <button
                        key={impact}
                        onClick={() => setNewsFilterImpact(impact)}
                        className={`px-2.5 py-1 text-[10px] rounded transition ${
                          newsFilterImpact === impact ? 'clay-pill-active' : 'clay-btn text-muted'
                        }`}
                      >
                        {impact === 'ALL' ? 'All Releases' : 'High Impact Only'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-grid/60 text-[10px] text-muted uppercase">
                        <th className="py-2 px-3">Time (UTC)</th>
                        <th className="py-2 px-3">Cur</th>
                        <th className="py-2 px-3">Impact</th>
                        <th className="py-2 px-3">Event</th>
                        <th className="py-2 px-3">Actual</th>
                        <th className="py-2 px-3">Forecast</th>
                        <th className="py-2 px-3">Previous</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MACRO_ECONOMIC_CALENDAR
                        .filter((ev) => (newsFilterImpact === 'HIGH' ? ev.impact === 'HIGH' : true))
                        .map((ev) => (
                          <tr key={ev.id} className="border-b border-grid/30 hover:bg-white/[0.02]">
                            <td className="py-2 px-3 text-muted">{ev.timeUtc}</td>
                            <td className="py-2 px-3 font-bold text-white">{ev.currency}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                ev.impact === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {ev.impact}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-white font-medium">{ev.event}</td>
                            <td className="py-2 px-3 text-emerald-400 font-mono font-bold">{ev.actual || '—'}</td>
                            <td className="py-2 px-3 text-muted font-mono">{ev.forecast || '—'}</td>
                            <td className="py-2 px-3 text-muted font-mono">{ev.previous || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* J7 Tracker Live Breaking News Wire */}
              <div className="clay-panel rounded-xl p-4 border border-grid/50 space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">J7 Macro & Order Flow Wire</span>
                <div className="space-y-2">
                  {LIVE_BREAKING_NEWS.map((news) => (
                    <div key={news.id} className="p-3 rounded-lg border border-grid/40 bg-white/[0.02] flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#38bdf8]">{news.source}</span>
                          <span className="text-[10px] text-muted">{news.handle}</span>
                          <span className="text-[9px] px-1 rounded bg-white/10 text-muted">{news.category}</span>
                        </div>
                        <p className="text-xs text-slate-200 mt-1 leading-relaxed">{news.headline}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        news.sentiment === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-300' :
                        news.sentiment === 'BEARISH' ? 'bg-rose-500/20 text-rose-300' :
                        'bg-zinc-700/20 text-zinc-400'
                      }`}>
                        {news.sentiment}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
