/**
 * TradeXGuardian Configuration Modal.
 * Full settings UI for all guardian rules:
 * - Risk Rules, Trade Blocker, Time Windows, Prop Firm, Behavioural Intelligence
 * - Discipline Score, Violation Log, Emergency Lock
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import {
  useGuardianStore,
  type RuleAction,
  type TradeTimeWindow,
} from '../../store/useGuardianStore';
import { audioHaptics } from '../../utils/notify';

interface GuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'OVERVIEW' | 'RISK' | 'BLOCKER' | 'TIME' | 'PROPFIRM' | 'BEHAVIOUR' | 'LOG';

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'OVERVIEW', label: 'Overview' },
  { id: 'RISK', label: 'Risk Rules' },
  { id: 'BLOCKER', label: 'Trade Blocker' },
  { id: 'TIME', label: 'Time Windows' },
  { id: 'PROPFIRM', label: 'Prop Firm' },
  { id: 'BEHAVIOUR', label: 'Behaviour' },
  { id: 'LOG', label: 'Log' },
];

const ACTION_OPTIONS: { value: RuleAction; label: string; cls: string }[] = [
  { value: 'ALLOW', label: 'Allow', cls: 'text-zinc-400' },
  { value: 'WARN', label: 'Warn', cls: 'text-yellow-400' },
  { value: 'CONFIRM', label: 'Confirm', cls: 'text-amber-400' },
  { value: 'BLOCK', label: 'Block', cls: 'text-red-400' },
];

function ActionSelect({
  value,
  onChange,
}: {
  value: RuleAction;
  onChange: (v: RuleAction) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as RuleAction)}
      className="clay-inset px-2 py-1 text-[11px] text-white rounded focus:outline-none"
    >
      {ACTION_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  sub,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-grid/30">
      <div>
        <span className="text-xs text-white">{label}</span>
        {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => { audioHaptics.tick(); onChange(!value); }}
        className={`relative w-9 h-5 rounded-full border transition ${
          value ? 'bg-emerald-500/80 border-emerald-500' : 'bg-zinc-700 border-zinc-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            value ? 'left-4' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  sub,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-grid/30">
      <div>
        <span className="text-xs text-white">{label}</span>
        {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n); }}
          min={min}
          max={max}
          step={step}
          className="clay-inset w-20 px-2 py-1 text-[11px] text-white text-right rounded focus:outline-none"
        />
        {suffix && <span className="text-[10px] text-muted w-6">{suffix}</span>}
      </div>
    </div>
  );
}

export default function GuardianModal({ isOpen, onClose }: GuardianModalProps) {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [newWindow, setNewWindow] = useState<Partial<TradeTimeWindow>>({
    label: '', startHour: 9, startMin: 0, endHour: 17, endMin: 0,
    weekdays: [1, 2, 3, 4, 5], enabled: true,
  });

  const store = useGuardianStore();

  if (!isOpen) return null;

  const scoreColor = store.disciplineScore >= 80 ? 'text-emerald-400' :
    store.disciplineScore >= 50 ? 'text-amber-400' : 'text-red-400';

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleAddWindow = () => {
    if (!newWindow.label?.trim()) return;
    audioHaptics.tick();
    store.addTimeWindow({
      label: newWindow.label!.trim(),
      startHour: newWindow.startHour ?? 9,
      startMin: newWindow.startMin ?? 0,
      endHour: newWindow.endHour ?? 17,
      endMin: newWindow.endMin ?? 0,
      weekdays: newWindow.weekdays ?? [1, 2, 3, 4, 5],
      enabled: true,
    });
    setNewWindow({ label: '', startHour: 9, startMin: 0, endHour: 17, endMin: 0, weekdays: [1, 2, 3, 4, 5], enabled: true });
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl mx-4 clay-panel rounded-xl border border-grid/80 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid/60 bg-[#09090d]/90">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${store.emergencyLocked ? 'bg-red-400 animate-pulse' : store.enabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            <span className="text-sm font-bold text-white font-mono">TradeXGuardian</span>
            <span className="text-[10px] text-muted ml-1">Capital Protection System</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Emergency Lock */}
            <button
              onClick={() => {
                audioHaptics.tick();
                if (store.emergencyLocked) store.emergencyUnlock();
                else store.emergencyLock();
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded border transition ${
                store.emergencyLocked
                  ? 'border-red-500/60 bg-red-500/20 text-red-400 animate-pulse'
                  : 'border-zinc-600/40 clay-btn text-muted hover:text-red-400 hover:border-red-500/40'
              }`}
              title="Emergency Lock — immediately block all new trade execution"
            >
              {store.emergencyLocked ? '[LOCKED — UNLOCK]' : '[EMERGENCY LOCK]'}
            </button>
            {/* Master toggle */}
            <button
              onClick={() => { audioHaptics.tick(); store.setEnabled(!store.enabled); }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded border transition ${
                store.enabled
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-zinc-600/40 bg-zinc-800/40 text-zinc-500'
              }`}
            >
              {store.enabled ? 'ACTIVE' : 'DISABLED'}
            </button>
            <button onClick={onClose} className="clay-btn p-1.5 text-muted hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-3 pt-2 pb-0 bg-[#09090d]/60 border-b border-grid/40 overflow-x-auto">
          {TAB_LABELS.map((t) => (
            <button
              key={t.id}
              onClick={() => { audioHaptics.tick(); setTab(t.id); }}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-t-md border-b-2 transition whitespace-nowrap ${
                tab === t.id
                  ? 'border-white/80 text-white bg-white/5'
                  : 'border-transparent text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm">

          {/* OVERVIEW */}
          {tab === 'OVERVIEW' && (
            <div className="space-y-4">
              {/* Discipline Score */}
              <div className="clay-panel rounded-xl p-4 border border-grid/60 text-center">
                <div className={`text-4xl font-black font-mono ${scoreColor}`}>{store.disciplineScore}</div>
                <div className="text-xs text-muted mt-1">Discipline Score (7-day)</div>
                <div className="mt-2 h-2 rounded-full bg-zinc-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${store.disciplineScore >= 80 ? 'bg-emerald-400' : store.disciplineScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${store.disciplineScore}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted mt-2">
                  Score drops with each rule violation or override. Maintains well by following your own rules.
                </p>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Risk Rules', active: store.riskConfig.enabled },
                  { label: 'Trade Blocker', active: store.blockerConfig.enabled },
                  { label: 'Time Windows', active: store.timeWindows.length > 0 },
                  { label: 'Prop Firm', active: store.propFirm.enabled },
                  { label: 'Behavioural', active: store.behaviour.enabled },
                  { label: 'Emergency Lock', active: store.emergencyLocked },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between clay-panel rounded-lg p-2.5 border border-grid/40">
                    <span className="text-xs text-muted">{item.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-600/20 text-zinc-500'}`}>
                      {item.active ? 'ON' : 'OFF'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Quick stats from log */}
              <div className="clay-panel rounded-xl p-3 border border-grid/50 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted">Recent 7 Days</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Blocks', val: store.violationLog.filter(v => v.action === 'BLOCK' && v.ts > Date.now() - 7*86400000).length, cls: 'text-red-400' },
                    { label: 'Confirms', val: store.violationLog.filter(v => v.action === 'CONFIRM' && v.ts > Date.now() - 7*86400000).length, cls: 'text-amber-400' },
                    { label: 'Warnings', val: store.violationLog.filter(v => v.action === 'WARN' && v.ts > Date.now() - 7*86400000).length, cls: 'text-yellow-400' },
                  ].map((s) => (
                    <div key={s.label} className="clay-panel rounded-lg p-2 border border-grid/30">
                      <div className={`text-lg font-bold font-mono ${s.cls}`}>{s.val}</div>
                      <div className="text-[10px] text-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { audioHaptics.tick(); if (window.confirm('Reset all guardian settings to defaults?')) store.resetAll(); }}
                className="w-full clay-btn py-2 text-xs text-red-400 hover:text-red-300 border border-red-500/20"
              >
                Reset All Guardian Settings to Defaults
              </button>
            </div>
          )}

          {/* RISK RULES */}
          {tab === 'RISK' && (
            <div className="space-y-1">
              <ToggleRow label="Risk Rules Active" value={store.riskConfig.enabled} onChange={(v) => store.updateRiskConfig({ enabled: v })} />
              <NumberField label="Risk per trade" value={store.riskConfig.riskPerTradePct} onChange={(v) => store.updateRiskConfig({ riskPerTradePct: v })} min={0.1} max={10} step={0.1} suffix="%" sub="Max % of equity to risk per trade" />
              <NumberField label="Min Risk/Reward" value={store.riskConfig.minRR} onChange={(v) => store.updateRiskConfig({ minRR: v })} min={0.5} max={10} step={0.1} suffix="R" sub="Minimum acceptable RR ratio (1:X)" />
              <NumberField label="Max lot size" value={store.riskConfig.maxLotSize} onChange={(v) => store.updateRiskConfig({ maxLotSize: v })} min={0.01} max={1000} step={0.01} suffix="lots" />
              <NumberField label="Max open positions" value={store.riskConfig.maxOpenPositions} onChange={(v) => store.updateRiskConfig({ maxOpenPositions: v })} min={1} max={50} />
              <ToggleRow label="Require Stop Loss" value={store.riskConfig.requireSl} onChange={(v) => store.updateRiskConfig({ requireSl: v })} sub="Block/warn trades with no SL" />
              <ToggleRow label="Require Take Profit" value={store.riskConfig.requireTp} onChange={(v) => store.updateRiskConfig({ requireTp: v })} />
              <ToggleRow label="Auto-suggest SL/TP" value={store.riskConfig.autoSuggestSlTp} onChange={(v) => store.updateRiskConfig({ autoSuggestSlTp: v })} sub="Fill SL/TP fields based on % risk + RR when not set" />
              <div className="pt-2 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted">Rule Actions</span>
                {[
                  { label: 'RR too low', key: 'rrAction' as const },
                  { label: 'Risk % exceeded', key: 'riskPctAction' as const },
                  { label: 'No stop loss', key: 'noSlAction' as const },
                  { label: 'No take profit', key: 'noTpAction' as const },
                  { label: 'Lot size too large', key: 'lotSizeAction' as const },
                  { label: 'Too many open positions', key: 'openPosAction' as const },
                ].map((r) => (
                  <div key={r.key} className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-300">{r.label}</span>
                    <ActionSelect value={store.riskConfig[r.key]} onChange={(v) => store.updateRiskConfig({ [r.key]: v })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRADE BLOCKER */}
          {tab === 'BLOCKER' && (
            <div className="space-y-1">
              <ToggleRow label="Trade Blocker Active" value={store.blockerConfig.enabled} onChange={(v) => store.updateBlockerConfig({ enabled: v })} />
              <NumberField label="Max trades per day" value={store.blockerConfig.maxTradesPerDay} onChange={(v) => store.updateBlockerConfig({ maxTradesPerDay: v })} min={1} max={100} sub="Block further execution after this many trades" />
              <NumberField label="Max daily loss" value={store.blockerConfig.maxDailyLossPct} onChange={(v) => store.updateBlockerConfig({ maxDailyLossPct: v })} min={0.1} max={50} step={0.1} suffix="%" sub="Block when daily realized loss exceeds this % of balance" />
              <NumberField label="Max consecutive losses" value={store.blockerConfig.maxConsecutiveLosses} onChange={(v) => store.updateBlockerConfig({ maxConsecutiveLosses: v })} min={1} max={20} sub="Block after N losses in a row" />
              <NumberField label="Cooldown after losses" value={Math.round(store.blockerConfig.cooldownAfterLossMs / 60000)} onChange={(v) => store.updateBlockerConfig({ cooldownAfterLossMs: v * 60000 })} min={1} max={480} suffix="min" sub="Wait this long before allowing new trades after consecutive losses" />
              <NumberField label="Max open positions" value={store.blockerConfig.maxOpenPositions} onChange={(v) => store.updateBlockerConfig({ maxOpenPositions: v })} min={1} max={50} />
              <NumberField label="Daily reset hour (UTC)" value={store.blockerConfig.resetHour} onChange={(v) => store.updateBlockerConfig({ resetHour: Math.round(v) })} min={0} max={23} suffix="h" />
              <div className="pt-2 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted">Rule Actions</span>
                {[
                  { label: 'Max trades reached', key: 'maxTradesAction' as const },
                  { label: 'Max daily loss hit', key: 'maxLossAction' as const },
                  { label: 'Consecutive losses', key: 'consecutiveLossAction' as const },
                ].map((r) => (
                  <div key={r.key} className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-300">{r.label}</span>
                    <ActionSelect value={store.blockerConfig[r.key]} onChange={(v) => store.updateBlockerConfig({ [r.key]: v })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIME WINDOWS */}
          {tab === 'TIME' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">Define permitted trading windows. Outside these windows, new trades will be blocked. If no windows are defined, time blocking is disabled.</p>

              {/* Add new window */}
              <div className="clay-panel rounded-xl border border-grid/50 p-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted">Add Window</span>
                <input
                  type="text"
                  placeholder="Label (e.g. London Session)"
                  value={newWindow.label || ''}
                  onChange={(e) => setNewWindow((w) => ({ ...w, label: e.target.value }))}
                  className="clay-inset w-full px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted">Start</label>
                    <div className="flex gap-1 mt-0.5">
                      <input type="number" min={0} max={23} value={newWindow.startHour ?? 9}
                        onChange={(e) => setNewWindow(w => ({ ...w, startHour: +e.target.value }))}
                        className="clay-inset w-14 px-2 py-1 text-xs text-white text-center focus:outline-none" placeholder="HH" />
                      <span className="text-muted self-center">:</span>
                      <input type="number" min={0} max={59} value={newWindow.startMin ?? 0}
                        onChange={(e) => setNewWindow(w => ({ ...w, startMin: +e.target.value }))}
                        className="clay-inset w-14 px-2 py-1 text-xs text-white text-center focus:outline-none" placeholder="MM" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted">End</label>
                    <div className="flex gap-1 mt-0.5">
                      <input type="number" min={0} max={23} value={newWindow.endHour ?? 17}
                        onChange={(e) => setNewWindow(w => ({ ...w, endHour: +e.target.value }))}
                        className="clay-inset w-14 px-2 py-1 text-xs text-white text-center focus:outline-none" placeholder="HH" />
                      <span className="text-muted self-center">:</span>
                      <input type="number" min={0} max={59} value={newWindow.endMin ?? 0}
                        onChange={(e) => setNewWindow(w => ({ ...w, endMin: +e.target.value }))}
                        className="clay-inset w-14 px-2 py-1 text-xs text-white text-center focus:outline-none" placeholder="MM" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted">Days</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                      <button
                        key={d}
                        onClick={() => setNewWindow(w => ({
                          ...w,
                          weekdays: (w.weekdays || []).includes(i)
                            ? (w.weekdays || []).filter(x => x !== i)
                            : [...(w.weekdays || []), i]
                        }))}
                        className={`px-2 py-0.5 text-[10px] rounded border transition ${
                          (newWindow.weekdays || []).includes(i)
                            ? 'border-white/40 bg-white/10 text-white'
                            : 'border-zinc-600/40 text-muted'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAddWindow}
                  disabled={!newWindow.label?.trim()}
                  className="w-full clay-pill-active py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  Add Time Window
                </button>
              </div>

              {/* Existing windows */}
              {store.timeWindows.length === 0 && (
                <p className="text-xs text-muted text-center py-4">No time windows configured — time blocking is disabled.</p>
              )}
              {store.timeWindows.map((w) => (
                <div key={w.id} className="clay-panel rounded-lg border border-grid/40 p-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${w.enabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                      <span className="text-xs text-white font-semibold">{w.label}</span>
                    </div>
                    <span className="text-[10px] text-muted">
                      {String(w.startHour).padStart(2,'0')}:{String(w.startMin).padStart(2,'0')} – {String(w.endHour).padStart(2,'0')}:{String(w.endMin).padStart(2,'0')} | {w.weekdays.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => store.updateTimeWindow(w.id, { enabled: !w.enabled })}
                      className={`clay-btn px-2 py-0.5 text-[10px] ${w.enabled ? 'text-emerald-400' : 'text-muted'}`}>
                      {w.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => store.removeTimeWindow(w.id)}
                      className="clay-btn px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300">
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PROP FIRM */}
          {tab === 'PROPFIRM' && (
            <div className="space-y-1">
              <ToggleRow label="Prop Firm Rules Active" value={store.propFirm.enabled} onChange={(v) => store.updatePropFirm({ enabled: v })} />
              <div className="py-2 border-b border-grid/30">
                <label className="text-xs text-white">Firm Name</label>
                <input type="text" value={store.propFirm.firmName}
                  onChange={(e) => store.updatePropFirm({ firmName: e.target.value })}
                  className="clay-inset w-full px-2 py-1 text-xs text-white mt-1 focus:outline-none" />
              </div>
              <NumberField label="Account size" value={store.propFirm.accountSize} onChange={(v) => store.updatePropFirm({ accountSize: v })} min={1000} max={1000000} step={1000} suffix="$" />
              <NumberField label="Daily drawdown limit" value={store.propFirm.dailyDrawdownPct} onChange={(v) => store.updatePropFirm({ dailyDrawdownPct: v })} min={1} max={20} step={0.5} suffix="%" />
              <NumberField label="Max overall drawdown" value={store.propFirm.maxDrawdownPct} onChange={(v) => store.updatePropFirm({ maxDrawdownPct: v })} min={1} max={30} step={0.5} suffix="%" />
              <NumberField label="Profit target" value={store.propFirm.profitTargetPct} onChange={(v) => store.updatePropFirm({ profitTargetPct: v })} min={1} max={50} step={0.5} suffix="%" />
              <NumberField label="Min trading days" value={store.propFirm.minTradingDays} onChange={(v) => store.updatePropFirm({ minTradingDays: Math.round(v) })} min={1} max={60} suffix="days" />
              <NumberField label="Max daily trades" value={store.propFirm.maxDailyTrades} onChange={(v) => store.updatePropFirm({ maxDailyTrades: Math.round(v) })} min={1} max={100} />
              <NumberField label="Consistency threshold" value={store.propFirm.consistencyPct} onChange={(v) => store.updatePropFirm({ consistencyPct: v })} min={10} max={80} step={5} suffix="%" sub="Warn if best day is > X% of total profit" />
              <NumberField label="Max lot size" value={store.propFirm.maxLotSize} onChange={(v) => store.updatePropFirm({ maxLotSize: v })} min={0.01} max={100} step={0.01} suffix="lots" />
              <NumberField label="Max open risk" value={store.propFirm.maxOpenRiskUsd} onChange={(v) => store.updatePropFirm({ maxOpenRiskUsd: v })} min={0} max={50000} step={100} suffix="$" />
              <ToggleRow label="No weekend holding" value={store.propFirm.noWeekendHolding} onChange={(v) => store.updatePropFirm({ noWeekendHolding: v })} />
              <ToggleRow label="No news trading" value={store.propFirm.noNewsTrading} onChange={(v) => store.updatePropFirm({ noNewsTrading: v })} />
              <ToggleRow label="Martingale detector" value={store.propFirm.martingaleDetect} onChange={(v) => store.updatePropFirm({ martingaleDetect: v })} sub="Warn on lot doubling sequences" />
              <ToggleRow label="Grid trading detector" value={store.propFirm.gridDetect} onChange={(v) => store.updatePropFirm({ gridDetect: v })} sub="Detect repeated same-price-level entries" />
              <div className="pt-2 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted">Restricted Instruments</span>
                <input
                  type="text"
                  placeholder="e.g. USDTRY, BTCUSD (comma separated)"
                  defaultValue={store.propFirm.restrictedInstruments.join(', ')}
                  onBlur={(e) => store.updatePropFirm({ restrictedInstruments: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="clay-inset w-full px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* BEHAVIOUR */}
          {tab === 'BEHAVIOUR' && (
            <div className="space-y-1">
              <ToggleRow label="Behavioural Intelligence Active" value={store.behaviour.enabled} onChange={(v) => store.updateBehaviour({ enabled: v })} />
              <ToggleRow label="Revenge trading guard" value={store.behaviour.revengeTrading} onChange={(v) => store.updateBehaviour({ revengeTrading: v })} sub="Cooldown period after consecutive losses" />
              <NumberField label="Revenge cooldown" value={Math.round(store.behaviour.revengeCooldownMs / 60000)} onChange={(v) => store.updateBehaviour({ revengeCooldownMs: v * 60000 })} min={1} max={240} suffix="min" />
              <ToggleRow label="SL widening warning" value={store.behaviour.slWideningWarn} onChange={(v) => store.updateBehaviour({ slWideningWarn: v })} sub="Warn if SL moved further away from entry after open" />
              <ToggleRow label="TP reduction warning" value={store.behaviour.tpReductionWarn} onChange={(v) => store.updateBehaviour({ tpReductionWarn: v })} sub="Warn if TP is reduced (deteriorating RR)" />
              <NumberField label="Lot escalation factor" value={store.behaviour.lotEscalationFactor} onChange={(v) => store.updateBehaviour({ lotEscalationFactor: v })} min={1.5} max={10} step={0.5} suffix="x" sub="Warn if lot size > Nx previous lot (martingale pattern)" />
              <NumberField label="Correlation risk limit" value={store.behaviour.correlationRiskPct} onChange={(v) => store.updateBehaviour({ correlationRiskPct: v })} min={1} max={50} step={1} suffix="%" sub="Warn if correlated pair exposure > X% of equity" />
              <div className="pt-2 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted">Rule Actions</span>
                {[
                  { label: 'Revenge trading detected', key: 'revengeAction' as const },
                  { label: 'Overtrading detected', key: 'overtradingAction' as const },
                  { label: 'SL widening', key: 'slWideningAction' as const },
                  { label: 'TP reduction', key: 'tpReductionAction' as const },
                  { label: 'Lot escalation', key: 'lotEscalationAction' as const },
                  { label: 'Correlation risk', key: 'correlationAction' as const },
                ].map((r) => (
                  <div key={r.key} className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-300">{r.label}</span>
                    <ActionSelect value={store.behaviour[r.key]} onChange={(v) => store.updateBehaviour({ [r.key]: v })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LOG */}
          {tab === 'LOG' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{store.violationLog.length} entries</span>
                <button
                  onClick={() => { audioHaptics.tick(); store.clearViolationLog(); }}
                  className="clay-btn px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300"
                >
                  Clear Log
                </button>
              </div>
              {store.violationLog.length === 0 && (
                <p className="text-center text-xs text-muted py-6">No violations recorded — good discipline!</p>
              )}
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {store.violationLog.map((v) => (
                  <div key={v.id} className={`text-[11px] font-mono px-3 py-2 rounded-lg border ${
                    v.action === 'BLOCK' ? 'border-red-500/20 bg-red-500/5 text-red-300' :
                    v.action === 'CONFIRM' ? 'border-amber-500/20 bg-amber-500/5 text-amber-300' :
                    'border-yellow-500/20 bg-yellow-500/5 text-yellow-300'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">[{v.action}]</span>
                      <span className="text-muted text-[9px]">{new Date(v.ts).toLocaleTimeString()}</span>
                      {v.overridden && <span className="text-zinc-500 text-[9px]">OVERRIDDEN</span>}
                    </div>
                    <div className="mt-0.5 text-[10px] text-current opacity-80">{v.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
