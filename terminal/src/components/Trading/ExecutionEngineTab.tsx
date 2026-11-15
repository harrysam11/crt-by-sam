/**
 * cTrader-Style If-Else Rule & Contingent Algorithmic Execution Interface.
 * Allows traders to define rule-based conditional orders:
 * - IF [Price Cross / Position PnL / Drawdown] THEN [Action] ELSE [Contingency]
 * - Pre-configured institutional presets
 * - Live execution audit logs
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import {
  useExecutionEngineStore,
  INSTITUTIONAL_TEMPLATES,
  type TriggerConditionType,
  type RuleActionType,
} from '../../store/useExecutionEngineStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { fmtPrice, labelOf } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';

export default function ExecutionEngineTab() {
  const currentSymbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const positions = useTerminalStore((s) => s.positions);

  const rules = useExecutionEngineStore((s) => s.rules);
  const logs = useExecutionEngineStore((s) => s.logs);
  const addRule = useExecutionEngineStore((s) => s.addRule);
  const toggleRule = useExecutionEngineStore((s) => s.toggleRule);
  const removeRule = useExecutionEngineStore((s) => s.removeRule);
  const clearLogs = useExecutionEngineStore((s) => s.clearLogs);
  const applyTemplate = useExecutionEngineStore((s) => s.applyTemplate);

  const [isCreating, setIsCreating] = useState(false);
  const [ruleName, setRuleName] = useState('My Contingent Rule');
  const [ruleSymbol, setRuleSymbol] = useState(currentSymbol);
  const [condType, setCondType] = useState<TriggerConditionType>('PRICE_CROSS_ABOVE');
  const [condThreshold, setCondThreshold] = useState<number>(currentPrice || 90000);
  const [thenActionType, setThenActionType] = useState<RuleActionType>('SNAP_BREAK_EVEN');
  const [thenSide, setThenSide] = useState<'BUY' | 'SELL'>('BUY');
  const [thenQty, setThenQty] = useState<number>(0.1);
  const [thenFraction, setThenFraction] = useState<number>(0.5);
  const [hasElse, setHasElse] = useState(false);
  const [elseActionType, setElseActionType] = useState<'CANCEL_ORDER' | 'CLOSE_POSITION' | 'ALERT_ONLY'>('ALERT_ONLY');
  const [oneShot, setOneShot] = useState(true);

  const handleSaveRule = () => {
    audioHaptics.tick();
    addRule({
      name: ruleName.trim() || 'Custom Rule',
      symbol: ruleSymbol,
      enabled: true,
      condition: {
        type: condType,
        threshold: condThreshold,
      },
      thenAction: {
        type: thenActionType,
        side: thenSide,
        qty: thenQty,
        fraction: thenFraction,
      },
      elseAction: hasElse ? { type: elseActionType } : undefined,
      oneShot,
    });
    setIsCreating(false);
  };

  return (
    <div className="flex h-full flex-col font-mono text-xs text-slate-200 select-none overflow-y-auto p-3">
      {/* Top Header & Template Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid/60 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-xs tracking-wide">
            cTrader Contingent Execution Engine
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#38bdf8]/15 text-[#38bdf8] font-bold text-[10.5px] border border-[#38bdf8]/30">
            {rules.filter((r) => r.enabled).length} Active
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsCreating((v) => !v);
            }}
            className="px-3 py-1 rounded-lg bg-[#38bdf8] text-black font-bold text-xs hover:bg-[#7dd3fc] transition"
          >
            {isCreating ? 'Close Builder' : '+ New If-Else Rule'}
          </button>
        </div>
      </div>

      {/* Quick Institutional Template Pills */}
      <div className="mb-3.5 bg-[#101016] p-2.5 rounded-xl border border-white/5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Instant cTrader Algo Templates
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {INSTITUTIONAL_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => applyTemplate(tmpl.id, currentSymbol, currentPrice)}
              className="flex flex-col items-start p-2 rounded-lg bg-[#151520] hover:bg-[#1a1a28] border border-white/5 hover:border-[#38bdf8]/40 transition text-left group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-bold text-white group-hover:text-[#38bdf8] transition text-[11px]">
                  {tmpl.name}
                </span>
                <span className="text-[9px] text-slate-400 uppercase">{tmpl.category}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {tmpl.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Rule Builder Form */}
      {isCreating && (
        <div className="mb-4 bg-[#14141e] p-4 rounded-xl border border-[#38bdf8]/40 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <span className="font-bold text-white text-xs">
              If-Then-Else Algorithmic Rule Builder
            </span>
            <span className="text-[10px] text-slate-400">cTrader Standard Logic</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Rule Name</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full rounded bg-[#1c1c2b] px-2.5 py-1.5 text-xs text-white border border-[#2e2e42] focus:border-[#38bdf8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Asset Target</label>
              <select
                value={ruleSymbol}
                onChange={(e) => setRuleSymbol(e.target.value)}
                className="w-full rounded bg-[#1c1c2b] px-2.5 py-1.5 text-xs text-white border border-[#2e2e42] focus:border-[#38bdf8] focus:outline-none"
              >
                <option value={currentSymbol}>{labelOf(currentSymbol)} (Current)</option>
                <option value="ALL">ALL Open Positions (Portfolio Wide)</option>
                {Object.keys(positions).map((sym) => (
                  <option key={sym} value={sym}>{labelOf(sym)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Execution Mode</label>
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={oneShot}
                    onChange={(e) => setOneShot(e.target.checked)}
                    className="rounded bg-[#1c1c2b] border-[#2e2e42] text-[#38bdf8]"
                  />
                  <span>One-Shot (Deactivate on Fill)</span>
                </label>
              </div>
            </div>
          </div>

          {/* IF Condition Statement */}
          <div className="p-3 bg-[#0d0d14] rounded-lg border border-[#262638] mb-3">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-2">
              IF [Trigger Condition]
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={condType}
                onChange={(e) => setCondType(e.target.value as TriggerConditionType)}
                className="rounded bg-[#1c1c2b] px-2.5 py-1.5 text-xs text-white border border-[#2e2e42] focus:border-[#38bdf8] focus:outline-none"
              >
                <option value="PRICE_CROSS_ABOVE">Price Crosses Above (&gt;=)</option>
                <option value="PRICE_CROSS_BELOW">Price Crosses Below (&lt;=)</option>
                <option value="POSITION_PROFIT_USD">Position Profit Reaches (+$)</option>
                <option value="POSITION_DRAWDOWN_USD">Position Drawdown Reaches (-$)</option>
                <option value="POSITION_RR_REACHED">Risk/Reward Target Reached (R:R)</option>
              </select>

              <span className="text-slate-400 text-xs">Threshold Value:</span>
              <input
                type="number"
                step="any"
                value={condThreshold}
                onChange={(e) => setCondThreshold(parseFloat(e.target.value) || 0)}
                className="w-28 rounded bg-[#1c1c2b] px-2.5 py-1.5 text-xs text-white border border-[#2e2e42] focus:border-[#38bdf8] focus:outline-none"
              />
            </div>
          </div>

          {/* THEN Action Statement */}
          <div className="p-3 bg-[#0d0d14] rounded-lg border border-[#262638] mb-3">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
              THEN [Execute Action]
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={thenActionType}
                onChange={(e) => setThenActionType(e.target.value as RuleActionType)}
                className="rounded bg-[#1c1c2b] px-2.5 py-1.5 text-xs text-white border border-[#2e2e42] focus:border-[#38bdf8] focus:outline-none"
              >
                <option value="SNAP_BREAK_EVEN">Snap Stop Loss to Entry (Break-Even)</option>
                <option value="SCALE_OUT">Scale-Out Position (Partial Close)</option>
                <option value="CLOSE_POSITION">Emergency Close Position (Market)</option>
                <option value="MARKET_ORDER">Enter Market Order</option>
                <option value="ALERT_ONLY">Sound Alert Only</option>
              </select>

              {thenActionType === 'SCALE_OUT' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">Fraction:</span>
                  {[0.25, 0.5, 0.75].map((f) => (
                    <button
                      key={f}
                      onClick={() => setThenFraction(f)}
                      className={`px-2 py-1 rounded text-[10px] ${
                        thenFraction === f
                          ? 'bg-emerald-500 text-black font-bold'
                          : 'bg-white/5 text-slate-300'
                      }`}
                    >
                      {f * 100}%
                    </button>
                  ))}
                </div>
              )}

              {thenActionType === 'MARKET_ORDER' && (
                <div className="flex items-center gap-2">
                  <select
                    value={thenSide}
                    onChange={(e) => setThenSide(e.target.value as 'BUY' | 'SELL')}
                    className="rounded bg-[#1c1c2b] px-2 py-1 text-xs text-white border border-[#2e2e42]"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                  <span className="text-slate-400 text-xs">Qty:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={thenQty}
                    onChange={(e) => setThenQty(parseFloat(e.target.value) || 0.01)}
                    className="w-20 rounded bg-[#1c1c2b] px-2 py-1 text-xs text-white border border-[#2e2e42]"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRule}
              className="px-4 py-1.5 rounded-lg bg-[#38bdf8] text-black font-bold text-xs hover:bg-[#7dd3fc] transition shadow-md"
            >
              Arm Rule
            </button>
          </div>
        </div>
      )}

      {/* Active Rules List */}
      <div className="flex-1 min-h-[140px] mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Configured Contingent Rules ({rules.length})
        </div>

        {rules.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#101016] border border-white/5 text-center text-slate-500">
            No contingent execution rules currently armed. Use an institutional template above or click "+ New If-Else Rule".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-3 rounded-xl border transition ${
                  rule.enabled
                    ? 'bg-[#12121c] border-[#38bdf8]/30 shadow-md'
                    : 'bg-[#0e0e14] border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        rule.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className="font-bold text-white text-xs">{rule.name}</span>
                    <span className="px-1.5 py-0.2 rounded bg-white/5 text-slate-400 text-[10px]">
                      {labelOf(rule.symbol)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        rule.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {rule.enabled ? 'Armed' : 'Paused'}
                    </button>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 text-xs transition"
                      title="Delete Rule"
                    >
                      x
                    </button>
                  </div>
                </div>

                <div className="text-[11px] space-y-1 bg-black/40 p-2 rounded-lg border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">IF:</span>
                    <span className="text-slate-300">
                      {rule.condition.type === 'PRICE_CROSS_ABOVE' && `Price >= ${fmtPrice(rule.condition.threshold, rule.symbol)}`}
                      {rule.condition.type === 'PRICE_CROSS_BELOW' && `Price <= ${fmtPrice(rule.condition.threshold, rule.symbol)}`}
                      {rule.condition.type === 'POSITION_PROFIT_USD' && `Position PnL >= +$${rule.condition.threshold}`}
                      {rule.condition.type === 'POSITION_DRAWDOWN_USD' && `Drawdown <= -$${Math.abs(rule.condition.threshold)}`}
                      {rule.condition.type === 'POSITION_RR_REACHED' && `Risk/Reward >= ${rule.condition.threshold} R:R`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-400">THEN:</span>
                    <span className="text-slate-200">
                      {rule.thenAction.type === 'SNAP_BREAK_EVEN' && 'Snap Stop Loss to Entry Price (Break-Even)'}
                      {rule.thenAction.type === 'SCALE_OUT' && `Scale Out ${( (rule.thenAction.fraction || 0.5) * 100).toFixed(0)}% of Position`}
                      {rule.thenAction.type === 'CLOSE_POSITION' && 'Emergency Flatten Position at Market'}
                      {rule.thenAction.type === 'MARKET_ORDER' && `Market ${rule.thenAction.side} ${rule.thenAction.qty} contracts`}
                      {rule.thenAction.type === 'ALERT_ONLY' && 'Sound Audio/Visual Alert'}
                    </span>
                  </div>
                </div>

                {rule.lastTriggeredAt && (
                  <div className="mt-1.5 text-[9.5px] text-slate-500 flex items-center justify-between">
                    <span>Last fired: {new Date(rule.lastTriggeredAt).toLocaleTimeString()}</span>
                    <span className="text-emerald-400 font-semibold">{rule.status}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution Audit Logs */}
      <div className="border-t border-grid/60 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Live Execution Audit Logs ({logs.length})
          </span>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-[10px] text-slate-500 hover:text-white transition"
            >
              Clear Logs
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <p className="text-[11px] text-slate-500 py-1">No execution events recorded in this session.</p>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between px-2.5 py-1 rounded bg-[#101016] border border-white/5 text-[10.5px]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="font-bold text-[#38bdf8]">{log.ruleName}</span>
                  <span className="text-slate-300">{log.actionSummary}</span>
                </div>
                <span className="text-emerald-400 font-bold">FILLED</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
