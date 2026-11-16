/**
 * TradeXGuardian - Capital Protection and Trading Discipline System.
 *
 * Prevention-only system: no signals, no execution.
 * Monitors manually-initiated trades, enforces user-defined rules,
 * and blocks/warns/confirms before risk violations reach the broker.
 *
 * Rule categories:
 *  - Risk Rules: % risk per trade, RR requirement, SL/TP enforcement, lot size cap
 *  - Trade Blocker: max trades/day, max daily loss, consecutive losses, cooldown
 *  - Time Blocker: permitted trading windows per weekday
 *  - Prop Firm Rules: consistency, drawdown, profit target, news restrictions
 *  - Behavioural Intelligence: revenge trading, overtrading, lot escalation, martingale
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---- Rule Action Types -------------------------------------------------------
export type RuleAction = 'ALLOW' | 'WARN' | 'CONFIRM' | 'BLOCK';

// ---- Time Window -------------------------------------------------------------
export interface TradeTimeWindow {
  id: string;
  label: string;
  startHour: number;   // 0-23 in user's configured timezone
  startMin: number;
  endHour: number;
  endMin: number;
  weekdays: number[];  // 0=Sun, 1=Mon ... 6=Sat
  enabled: boolean;
}

// ---- Prop Firm Config -------------------------------------------------------
export interface PropFirmConfig {
  enabled: boolean;
  firmName: string;
  accountSize: number;
  dailyDrawdownPct: number;        // e.g. 5 = 5%
  maxDrawdownPct: number;          // e.g. 10 = 10%
  profitTargetPct: number;         // e.g. 10 = 10%
  minTradingDays: number;
  maxDailyTrades: number;
  consistencyPct: number;          // best day must be < X% of total profit
  noWeekendHolding: boolean;
  noNewsTrading: boolean;          // 15 min window around major news
  martingaleDetect: boolean;       // detect lot doubling sequences
  gridDetect: boolean;             // detect repeated same-price entries
  maxLotSize: number;
  maxOpenRiskUsd: number;
  restrictedInstruments: string[]; // e.g. ['USDTRY', 'BTCUSD']
  // Actions for each rule
  dailyDrawdownAction: RuleAction;
  maxDrawdownAction: RuleAction;
  consistencyAction: RuleAction;
  martingaleAction: RuleAction;
  lotSizeAction: RuleAction;
  openRiskAction: RuleAction;
  weekendAction: RuleAction;
  newsAction: RuleAction;
}

// ---- Behavioural Config -----------------------------------------------------
export interface BehaviourConfig {
  enabled: boolean;
  revengeTrading: boolean;         // block trades within cooldown after loss
  revengeCooldownMs: number;       // e.g. 30 * 60 * 1000
  revengeAction: RuleAction;
  overtradingAction: RuleAction;
  slWideningWarn: boolean;         // warn if SL moved further than entry distance
  slWideningAction: RuleAction;
  tpReductionWarn: boolean;        // warn if TP reduced (reducing planned RR)
  tpReductionAction: RuleAction;
  lotEscalationFactor: number;     // warn if lot > N x previous lot (e.g. 2)
  lotEscalationAction: RuleAction;
  correlationRiskPct: number;      // warn if correlated exposure > X% of equity
  correlationAction: RuleAction;
}

// ---- Risk Rule Config --------------------------------------------------------
export interface GuardianRiskConfig {
  enabled: boolean;
  riskPerTradePct: number;         // e.g. 1 = 1% of account equity
  minRR: number;                   // e.g. 1.5 = minimum 1:1.5
  requireSl: boolean;              // block orders with no SL
  requireTp: boolean;
  maxLotSize: number;
  maxOpenPositions: number;
  autoSuggestSlTp: boolean;        // fill SL/TP fields based on % risk + RR
  // Actions
  rrAction: RuleAction;
  riskPctAction: RuleAction;
  noSlAction: RuleAction;
  noTpAction: RuleAction;
  lotSizeAction: RuleAction;
  openPosAction: RuleAction;
}

// ---- Trade Blocker Config ---------------------------------------------------
export interface TradeBlockerConfig {
  enabled: boolean;
  maxTradesPerDay: number;
  maxDailyLossPct: number;         // % of starting balance
  maxConsecutiveLosses: number;
  cooldownAfterLossMs: number;
  maxOpenPositions: number;
  resetHour: number;               // UTC hour at which daily counters reset (e.g. 0)
  // Actions
  maxTradesAction: RuleAction;
  maxLossAction: RuleAction;
  consecutiveLossAction: RuleAction;
}

// ---- Violation Log Entry ---------------------------------------------------
export interface ViolationLogEntry {
  id: string;
  ts: number;
  rule: string;
  action: RuleAction;
  detail: string;
  overridden: boolean;
}

// ---- Guardian Check Request/Response ----------------------------------------
export interface GuardianCheckRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  accountEquity: number;
  currentBalance: number;
  openPositionsCount: number;
  tradesTodayCount: number;
  dailyRealizedLoss: number;      // positive = loss amount in USD
  consecutiveLosses: number;
  lastTradeTimestamp?: number;
  previousLotSize?: number;
}

export interface GuardianCheckResult {
  allowed: boolean;
  blocked: boolean;
  warnings: string[];
  confirmations: string[];         // items needing user confirmation
  violations: string[];            // hard blocks
  suggestedSl?: number;
  suggestedTp?: number;
  riskUsd?: number;
  rewardUsd?: number;
  actualRR?: number;
}

// ---- Full Guardian State ---------------------------------------------------
interface GuardianState {
  enabled: boolean;
  riskConfig: GuardianRiskConfig;
  blockerConfig: TradeBlockerConfig;
  timeWindows: TradeTimeWindow[];
  propFirm: PropFirmConfig;
  behaviour: BehaviourConfig;
  violationLog: ViolationLogEntry[];
  disciplineScore: number;         // 0-100 calculated from rule adherence
  emergencyLocked: boolean;
  emergencyLockReason: string | null;
  timezoneOffset: number;          // user's UTC offset in minutes

  // Actions
  setEnabled: (v: boolean) => void;
  updateRiskConfig: (patch: Partial<GuardianRiskConfig>) => void;
  updateBlockerConfig: (patch: Partial<TradeBlockerConfig>) => void;
  addTimeWindow: (w: Omit<TradeTimeWindow, 'id'>) => void;
  removeTimeWindow: (id: string) => void;
  updateTimeWindow: (id: string, patch: Partial<TradeTimeWindow>) => void;
  updatePropFirm: (patch: Partial<PropFirmConfig>) => void;
  updateBehaviour: (patch: Partial<BehaviourConfig>) => void;
  checkTrade: (req: GuardianCheckRequest) => GuardianCheckResult;
  logViolation: (rule: string, action: RuleAction, detail: string, overridden?: boolean) => void;
  emergencyLock: (reason?: string) => void;
  emergencyUnlock: () => void;
  recalculateDisciplineScore: () => void;
  clearViolationLog: () => void;
  resetAll: () => void;
}

// ---- Defaults ---------------------------------------------------------------
const DEFAULT_RISK: GuardianRiskConfig = {
  enabled: true,
  riskPerTradePct: 1,
  minRR: 1.5,
  requireSl: true,
  requireTp: false,
  maxLotSize: 10,
  maxOpenPositions: 5,
  autoSuggestSlTp: true,
  rrAction: 'WARN',
  riskPctAction: 'CONFIRM',
  noSlAction: 'CONFIRM',
  noTpAction: 'WARN',
  lotSizeAction: 'WARN',
  openPosAction: 'WARN',
};

const DEFAULT_BLOCKER: TradeBlockerConfig = {
  enabled: true,
  maxTradesPerDay: 6,
  maxDailyLossPct: 2,
  maxConsecutiveLosses: 3,
  cooldownAfterLossMs: 30 * 60 * 1000,
  maxOpenPositions: 5,
  resetHour: 0,
  maxTradesAction: 'BLOCK',
  maxLossAction: 'BLOCK',
  consecutiveLossAction: 'BLOCK',
};

const DEFAULT_PROP: PropFirmConfig = {
  enabled: false,
  firmName: 'My Prop Firm',
  accountSize: 100000,
  dailyDrawdownPct: 5,
  maxDrawdownPct: 10,
  profitTargetPct: 10,
  minTradingDays: 10,
  maxDailyTrades: 10,
  consistencyPct: 40,
  noWeekendHolding: true,
  noNewsTrading: false,
  martingaleDetect: true,
  gridDetect: false,
  maxLotSize: 5,
  maxOpenRiskUsd: 2000,
  restrictedInstruments: [],
  dailyDrawdownAction: 'BLOCK',
  maxDrawdownAction: 'BLOCK',
  consistencyAction: 'WARN',
  martingaleAction: 'WARN',
  lotSizeAction: 'BLOCK',
  openRiskAction: 'WARN',
  weekendAction: 'WARN',
  newsAction: 'WARN',
};

const DEFAULT_BEHAVIOUR: BehaviourConfig = {
  enabled: true,
  revengeTrading: true,
  revengeCooldownMs: 15 * 60 * 1000,
  revengeAction: 'CONFIRM',
  overtradingAction: 'WARN',
  slWideningWarn: true,
  slWideningAction: 'WARN',
  tpReductionWarn: true,
  tpReductionAction: 'WARN',
  lotEscalationFactor: 2,
  lotEscalationAction: 'WARN',
  correlationRiskPct: 5,
  correlationAction: 'WARN',
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---- Instrument pip/tick value helpers -------------------------------------
function getPipValue(symbol: string, qty: number, price: number): number {
  // Returns USD value per 1 pip of movement for given qty
  if (symbol.includes('JPY')) return qty * 0.01 * (1 / price) * 100000;
  if (symbol.startsWith('XAU')) return qty * 0.1;         // XAUUSD: $0.1 per 0.01
  if (symbol.startsWith('XAG')) return qty * 0.05;
  if (symbol.includes('BTC')) return qty;                  // crypto: direct
  if (symbol.includes('ETH')) return qty;
  if (symbol.includes('USDT')) return qty;                 // crypto vs USDT
  return qty * 0.0001 * 100000;                            // standard forex 0.1 pip
}

// ---- Core check function (pure, no store side-effects) ----------------------
function runGuardianChecks(req: GuardianCheckRequest, state: GuardianState): GuardianCheckResult {
  const result: GuardianCheckResult = {
    allowed: true,
    blocked: false,
    warnings: [],
    confirmations: [],
    violations: [],
  };

  if (!state.enabled) return result;
  if (state.emergencyLocked) {
    result.blocked = true;
    result.allowed = false;
    result.violations.push(`Emergency lock active: ${state.emergencyLockReason || 'manual lock'}`);
    return result;
  }

  const { riskConfig, blockerConfig, propFirm, behaviour } = state;
  const { symbol, qty, entryPrice, stopLoss, takeProfit, accountEquity, currentBalance } = req;

  const pushByAction = (action: RuleAction, msg: string) => {
    if (action === 'BLOCK') { result.violations.push(msg); result.blocked = true; result.allowed = false; }
    else if (action === 'CONFIRM') result.confirmations.push(msg);
    else if (action === 'WARN') result.warnings.push(msg);
    // ALLOW = silent
  };

  // ---- Time Blocker --------------------------------------------------------
  if (blockerConfig.enabled) {
    const now = new Date();
    const utcMs = now.getTime() + (state.timezoneOffset * 60000);
    const local = new Date(utcMs);
    const localHour = local.getUTCHours();
    const localMin = local.getUTCMinutes();
    const localDay = local.getUTCDay();
    const localMinOfDay = localHour * 60 + localMin;

    if (state.timeWindows.length > 0) {
      const anyWindowAllows = state.timeWindows
        .filter(w => w.enabled && w.weekdays.includes(localDay))
        .some(w => {
          const start = w.startHour * 60 + w.startMin;
          const end = w.endHour * 60 + w.endMin;
          if (start <= end) return localMinOfDay >= start && localMinOfDay < end;
          return localMinOfDay >= start || localMinOfDay < end; // crosses midnight
        });
      if (!anyWindowAllows && state.timeWindows.some(w => w.enabled)) {
        result.blocked = true;
        result.allowed = false;
        result.violations.push(`Trading is outside your permitted time windows. No active window for ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][localDay]} ${String(localHour).padStart(2,'0')}:${String(localMin).padStart(2,'0')}`);
      }
    }
  }

  // ---- Trade Blocker -------------------------------------------------------
  if (blockerConfig.enabled) {
    if (req.tradesTodayCount >= blockerConfig.maxTradesPerDay) {
      pushByAction(blockerConfig.maxTradesAction, `Max trades/day reached: ${req.tradesTodayCount}/${blockerConfig.maxTradesPerDay}`);
    }
    const maxLossUsd = currentBalance * blockerConfig.maxDailyLossPct / 100;
    if (req.dailyRealizedLoss >= maxLossUsd) {
      pushByAction(blockerConfig.maxLossAction, `Daily loss limit hit: -$${req.dailyRealizedLoss.toFixed(2)} (max: -$${maxLossUsd.toFixed(2)} = ${blockerConfig.maxDailyLossPct}% of balance)`);
    }
    if (req.consecutiveLosses >= blockerConfig.maxConsecutiveLosses) {
      pushByAction(blockerConfig.consecutiveLossAction, `${req.consecutiveLosses} consecutive losses — cooldown required`);
    }
    if (req.openPositionsCount >= blockerConfig.maxOpenPositions) {
      pushByAction('WARN', `Open positions at max: ${req.openPositionsCount}/${blockerConfig.maxOpenPositions}`);
    }
    // Revenge trading cooldown
    if (behaviour.enabled && behaviour.revengeTrading && req.lastTradeTimestamp && req.consecutiveLosses > 0) {
      const msSinceLast = Date.now() - req.lastTradeTimestamp;
      if (msSinceLast < behaviour.revengeCooldownMs) {
        const remMin = Math.ceil((behaviour.revengeCooldownMs - msSinceLast) / 60000);
        pushByAction(behaviour.revengeAction, `Revenge trading guard: ${remMin} min cooldown remaining after last loss`);
      }
    }
  }

  // ---- Risk Rules ----------------------------------------------------------
  if (riskConfig.enabled) {
    const slDist = stopLoss !== undefined && entryPrice > 0 ? Math.abs(entryPrice - stopLoss) : undefined;
    const tpDist = takeProfit !== undefined && entryPrice > 0 ? Math.abs(takeProfit - entryPrice) : undefined;
    const pipVal = getPipValue(symbol, qty, entryPrice);

    // Risk USD
    const riskUsd = slDist !== undefined ? slDist * qty : undefined;
    const rewardUsd = tpDist !== undefined ? tpDist * qty : undefined;
    const actualRR = riskUsd && rewardUsd ? rewardUsd / riskUsd : undefined;
    result.riskUsd = riskUsd;
    result.rewardUsd = rewardUsd;
    result.actualRR = actualRR;

    // SL required?
    if (riskConfig.requireSl && stopLoss === undefined) {
      pushByAction(riskConfig.noSlAction, 'No stop loss set — a stop loss is required by your risk rules');
    }
    if (riskConfig.requireTp && takeProfit === undefined) {
      pushByAction(riskConfig.noTpAction, 'No take profit set — TP is required by your risk rules');
    }

    // Risk % check
    if (riskUsd !== undefined && accountEquity > 0) {
      const riskPct = (riskUsd / accountEquity) * 100;
      if (riskPct > riskConfig.riskPerTradePct * 1.5) {
        pushByAction(riskConfig.riskPctAction, `Risk per trade: ${riskPct.toFixed(2)}% — your limit is ${riskConfig.riskPerTradePct}% (current risk: $${riskUsd.toFixed(2)})`);
      }
    }

    // RR check
    if (actualRR !== undefined && actualRR < riskConfig.minRR) {
      pushByAction(riskConfig.rrAction, `RR is ${actualRR.toFixed(2)} — minimum required is 1:${riskConfig.minRR}. Reward: $${rewardUsd?.toFixed(2)}, Risk: $${riskUsd?.toFixed(2)}`);
    }

    // Lot size check
    if (qty > riskConfig.maxLotSize) {
      pushByAction(riskConfig.lotSizeAction, `Lot size ${qty} exceeds your max: ${riskConfig.maxLotSize}`);
    }

    // Auto-suggest SL/TP
    if (riskConfig.autoSuggestSlTp && stopLoss === undefined && accountEquity > 0 && entryPrice > 0) {
      const riskUsdTarget = (accountEquity * riskConfig.riskPerTradePct) / 100;
      const slDelta = qty > 0 ? riskUsdTarget / qty : 0;
      const side = req.side;
      result.suggestedSl = side === 'BUY' ? entryPrice - slDelta : entryPrice + slDelta;
      result.suggestedTp = side === 'BUY'
        ? entryPrice + slDelta * riskConfig.minRR
        : entryPrice - slDelta * riskConfig.minRR;
    }

    // Lot escalation (behavioural)
    if (behaviour.enabled && req.previousLotSize && req.previousLotSize > 0) {
      if (qty >= req.previousLotSize * behaviour.lotEscalationFactor) {
        pushByAction(behaviour.lotEscalationAction, `Lot size ${qty} is ${(qty / req.previousLotSize).toFixed(1)}x your previous lot — potential martingale / emotional sizing`);
      }
    }
  }

  // ---- Prop Firm Rules -----------------------------------------------------
  if (propFirm.enabled) {
    const startBalance = propFirm.accountSize;

    // Daily drawdown
    const dailyDdPct = startBalance > 0 ? (req.dailyRealizedLoss / startBalance) * 100 : 0;
    if (dailyDdPct >= propFirm.dailyDrawdownPct * 0.8) {
      const pct = propFirm.dailyDrawdownPct;
      pushByAction(propFirm.dailyDrawdownAction, `Prop firm daily drawdown: used ${dailyDdPct.toFixed(2)}% of ${pct}% limit ($${req.dailyRealizedLoss.toFixed(2)} / $${(startBalance * pct / 100).toFixed(2)})`);
    }

    // Max lot
    if (qty > propFirm.maxLotSize) {
      pushByAction(propFirm.lotSizeAction, `Prop firm max lot: ${qty} > ${propFirm.maxLotSize}`);
    }

    // Open risk
    const openRiskUsd = result.riskUsd ?? 0;
    if (openRiskUsd > propFirm.maxOpenRiskUsd) {
      pushByAction(propFirm.openRiskAction, `Open risk $${openRiskUsd.toFixed(2)} exceeds prop firm max: $${propFirm.maxOpenRiskUsd}`);
    }

    // Restricted instruments
    if (propFirm.restrictedInstruments.some(r => symbol.includes(r) || r.includes(symbol))) {
      result.blocked = true;
      result.allowed = false;
      result.violations.push(`${symbol} is in your prop firm restricted instruments list`);
    }

    // Weekend holding warning (Fri 20:00 UTC to Sun 21:00 UTC approx)
    if (propFirm.noWeekendHolding) {
      const utcDay = new Date().getUTCDay();
      const utcHour = new Date().getUTCHours();
      if ((utcDay === 5 && utcHour >= 20) || utcDay === 6 || (utcDay === 0 && utcHour < 21)) {
        pushByAction(propFirm.weekendAction, 'Opening new positions near weekend close — prop firm no weekend holding rule may apply');
      }
    }

    // Max daily trades
    if (req.tradesTodayCount >= propFirm.maxDailyTrades) {
      pushByAction('BLOCK', `Prop firm max daily trades reached: ${req.tradesTodayCount}/${propFirm.maxDailyTrades}`);
    }
  }

  return result;
}

// ---- Store ------------------------------------------------------------------
export const useGuardianStore = create<GuardianState>()(
  persist(
    (set, get) => ({
      enabled: true,
      riskConfig: DEFAULT_RISK,
      blockerConfig: DEFAULT_BLOCKER,
      timeWindows: [],
      propFirm: DEFAULT_PROP,
      behaviour: DEFAULT_BEHAVIOUR,
      violationLog: [],
      disciplineScore: 100,
      emergencyLocked: false,
      emergencyLockReason: null,
      timezoneOffset: new Date().getTimezoneOffset() * -1, // local offset in minutes

      setEnabled: (enabled) => set({ enabled }),

      updateRiskConfig: (patch) =>
        set((s) => ({ riskConfig: { ...s.riskConfig, ...patch } })),

      updateBlockerConfig: (patch) =>
        set((s) => ({ blockerConfig: { ...s.blockerConfig, ...patch } })),

      addTimeWindow: (w) => {
        const id = `tw-${uid()}`;
        set((s) => ({ timeWindows: [...s.timeWindows, { ...w, id }] }));
      },

      removeTimeWindow: (id) =>
        set((s) => ({ timeWindows: s.timeWindows.filter((w) => w.id !== id) })),

      updateTimeWindow: (id, patch) =>
        set((s) => ({
          timeWindows: s.timeWindows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),

      updatePropFirm: (patch) =>
        set((s) => ({ propFirm: { ...s.propFirm, ...patch } })),

      updateBehaviour: (patch) =>
        set((s) => ({ behaviour: { ...s.behaviour, ...patch } })),

      checkTrade: (req) => {
        const result = runGuardianChecks(req, get());
        // Log if any violation occurred
        if (result.violations.length > 0 || result.confirmations.length > 0) {
          result.violations.forEach((v) => get().logViolation('BLOCK', 'BLOCK', v));
          result.confirmations.forEach((c) => get().logViolation('CONFIRM', 'CONFIRM', c));
        }
        result.warnings.forEach((w) => get().logViolation('WARN', 'WARN', w));
        get().recalculateDisciplineScore();
        return result;
      },

      logViolation: (rule, action, detail, overridden = false) => {
        const entry: ViolationLogEntry = {
          id: uid(),
          ts: Date.now(),
          rule,
          action,
          detail,
          overridden,
        };
        set((s) => ({
          violationLog: [entry, ...s.violationLog].slice(0, 500), // keep last 500
        }));
      },

      emergencyLock: (reason = 'Manual emergency lock activated') => {
        set({ emergencyLocked: true, emergencyLockReason: reason });
      },

      emergencyUnlock: () => {
        set({ emergencyLocked: false, emergencyLockReason: null });
      },

      recalculateDisciplineScore: () => {
        const { violationLog } = get();
        const recent = violationLog.filter((v) => v.ts > Date.now() - 7 * 24 * 3600 * 1000);
        if (recent.length === 0) { set({ disciplineScore: 100 }); return; }
        const blocks = recent.filter((v) => v.action === 'BLOCK').length;
        const confirms = recent.filter((v) => v.action === 'CONFIRM' && !v.overridden).length;
        const overrides = recent.filter((v) => v.overridden).length;
        const penaltyScore = Math.min(100, blocks * 5 + overrides * 3 + confirms * 1);
        set({ disciplineScore: Math.max(0, 100 - penaltyScore) });
      },

      clearViolationLog: () => set({ violationLog: [] }),

      resetAll: () =>
        set({
          enabled: true,
          riskConfig: DEFAULT_RISK,
          blockerConfig: DEFAULT_BLOCKER,
          timeWindows: [],
          propFirm: DEFAULT_PROP,
          behaviour: DEFAULT_BEHAVIOUR,
          violationLog: [],
          disciplineScore: 100,
          emergencyLocked: false,
          emergencyLockReason: null,
        }),
    }),
    {
      name: 'crt-guardian-v1',
      partialize: (s) => ({
        enabled: s.enabled,
        riskConfig: s.riskConfig,
        blockerConfig: s.blockerConfig,
        timeWindows: s.timeWindows,
        propFirm: s.propFirm,
        behaviour: s.behaviour,
        violationLog: s.violationLog.slice(0, 100), // persist only recent 100
        disciplineScore: s.disciplineScore,
        emergencyLocked: s.emergencyLocked,
        emergencyLockReason: s.emergencyLockReason,
        timezoneOffset: s.timezoneOffset,
      }),
    }
  )
);
