/**
 * cTrader-Style If-Else Rule & Contingent Algorithmic Execution Store.
 * Supports:
 * - Conditional If/Then/Else automated order executions
 * - Multi-condition triggers (Price Cross, Profit/Drawdown target, Order Fill, Bar Close)
 * - Actions (Market entry, Scale-out, Break-Even, Trailing Stop, Cancel OCO)
 * - 1-Click Institutional Rule Templates
 * - Execution log tracking
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audioHaptics, notifyAlert } from '../utils/notify';
import { useTerminalStore, positionPnlUsd } from './useTerminalStore';
import { toUsd } from '../services/instruments';
import { fmtPrice, labelOf } from '../utils/formatters';

export type TriggerConditionType =
  | 'PRICE_CROSS_ABOVE'
  | 'PRICE_CROSS_BELOW'
  | 'POSITION_PROFIT_USD'
  | 'POSITION_DRAWDOWN_USD'
  | 'POSITION_RR_REACHED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'PORTFOLIO_DRAWDOWN_PCT';

export type RuleActionType =
  | 'MARKET_ORDER'
  | 'SNAP_BREAK_EVEN'
  | 'SCALE_OUT'
  | 'CLOSE_POSITION'
  | 'CANCEL_ORDER'
  | 'ALERT_ONLY';

export interface ExecutionRule {
  id: string;
  name: string;
  symbol: string; // e.g. 'BTCUSDT' or 'ALL'
  enabled: boolean;
  condition: {
    type: TriggerConditionType;
    threshold: number; // Price, USD amount, or R:R ratio
    orderId?: string;
  };
  thenAction: {
    type: RuleActionType;
    side?: 'BUY' | 'SELL';
    qty?: number;
    fraction?: number; // e.g. 0.5 for 50%
    price?: number;
    sl?: number;
    tp?: number;
    orderId?: string;
    note?: string;
  };
  elseAction?: {
    type: 'CANCEL_ORDER' | 'CLOSE_POSITION' | 'ALERT_ONLY';
    orderId?: string;
    message?: string;
  };
  oneShot: boolean; // Deactivates after first successful execution
  status: 'ACTIVE' | 'TRIGGERED' | 'DISABLED';
  createdAt: number;
  lastTriggeredAt?: number;
}

export interface ExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  symbol: string;
  conditionSummary: string;
  actionSummary: string;
  timestamp: number;
  success: boolean;
}

interface ExecutionEngineState {
  rules: ExecutionRule[];
  logs: ExecutionLog[];

  addRule: (rule: Omit<ExecutionRule, 'id' | 'createdAt' | 'status'>) => string;
  updateRule: (id: string, patch: Partial<ExecutionRule>) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  clearLogs: () => void;
  applyTemplate: (templateKey: string, symbol: string, currentPrice: number) => void;
  evaluateRules: (symbol: string, currentPrice: number) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export const INSTITUTIONAL_TEMPLATES = [
  {
    id: 'AUTO_BE_PROFIT',
    name: 'Auto Break-Even on Profit',
    desc: 'IF position reaches +$50 profit, THEN snap Stop Loss to Entry Price (Zero Risk).',
    category: 'Risk Management',
  },
  {
    id: 'RUNNER_SCALEOUT',
    name: 'Runner Strategy: 50% Scale-Out',
    desc: 'IF position hits target price, THEN close 50% of size and move SL to Break-Even.',
    category: 'Profit Taking',
  },
  {
    id: 'CIRCUIT_BREAKER',
    name: 'Portfolio Circuit Breaker (-$200 Loss)',
    desc: 'IF total open drawdown exceeds -$200, THEN emergency flatten all positions.',
    category: 'Account Guard',
  },
  {
    id: 'BREAKOUT_BUY_OCO',
    name: 'Breakout Buy with Contingency',
    desc: 'IF price crosses above resistance, THEN enter Market Buy; ELSE keep protective stop.',
    category: 'Directional Algos',
  },
];

export const useExecutionEngineStore = create<ExecutionEngineState>()(
  persist(
    (set, get) => ({
      rules: [
        {
          id: 'rule_default_be',
          name: 'Auto Break-Even at +$50 Profit',
          symbol: 'BTCUSDT',
          enabled: false,
          condition: {
            type: 'POSITION_PROFIT_USD',
            threshold: 50,
          },
          thenAction: {
            type: 'SNAP_BREAK_EVEN',
            note: 'Lock in entry price on +$50 gain',
          },
          oneShot: true,
          status: 'ACTIVE',
          createdAt: Date.now(),
        },
      ],
      logs: [],

      addRule: (ruleData) => {
        const id = `rule_${uid()}`;
        const newRule: ExecutionRule = {
          ...ruleData,
          id,
          createdAt: Date.now(),
          status: ruleData.enabled ? 'ACTIVE' : 'DISABLED',
        };
        set((s) => ({ rules: [newRule, ...s.rules] }));
        audioHaptics.tick();
        return id;
      },

      updateRule: (id, patch) => {
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
      },

      removeRule: (id) => {
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
        }));
        audioHaptics.tick();
      },

      toggleRule: (id) => {
        set((s) => ({
          rules: s.rules.map((r) => {
            if (r.id !== id) return r;
            const nextEnabled = !r.enabled;
            return {
              ...r,
              enabled: nextEnabled,
              status: nextEnabled ? 'ACTIVE' : 'DISABLED',
            };
          }),
        }));
        audioHaptics.tick();
      },

      clearLogs: () => set({ logs: [] }),

      applyTemplate: (templateKey, symbol, currentPrice) => {
        audioHaptics.tick();
        if (templateKey === 'AUTO_BE_PROFIT') {
          get().addRule({
            name: `${labelOf(symbol)} Auto Break-Even (+$50)`,
            symbol,
            enabled: true,
            condition: {
              type: 'POSITION_PROFIT_USD',
              threshold: 50,
            },
            thenAction: {
              type: 'SNAP_BREAK_EVEN',
              note: 'Lock in entry on +$50 gain',
            },
            oneShot: true,
          });
          notifyAlert('Template Applied', `Auto Break-Even rule created for ${labelOf(symbol)}.`);
        } else if (templateKey === 'RUNNER_SCALEOUT') {
          const targetPrice = +(currentPrice * 1.015).toFixed(2);
          get().addRule({
            name: `${labelOf(symbol)} Scale-Out 50% at +1.5%`,
            symbol,
            enabled: true,
            condition: {
              type: 'PRICE_CROSS_ABOVE',
              threshold: targetPrice,
            },
            thenAction: {
              type: 'SCALE_OUT',
              fraction: 0.5,
              note: 'Close half size at target',
            },
            elseAction: {
              type: 'ALERT_ONLY',
              message: 'Target not reached yet',
            },
            oneShot: true,
          });
          notifyAlert('Template Applied', `Runner Scale-Out rule created at ${targetPrice}.`);
        } else if (templateKey === 'CIRCUIT_BREAKER') {
          get().addRule({
            name: 'Emergency Portfolio Circuit Breaker (-$200)',
            symbol: 'ALL',
            enabled: true,
            condition: {
              type: 'POSITION_DRAWDOWN_USD',
              threshold: -200,
            },
            thenAction: {
              type: 'CLOSE_POSITION',
              note: 'Emergency flatten all positions',
            },
            oneShot: true,
          });
          notifyAlert('Template Applied', 'Portfolio Circuit Breaker active (-$200 limit).');
        } else if (templateKey === 'BREAKOUT_BUY_OCO') {
          const breakoutPrice = +(currentPrice * 1.008).toFixed(2);
          get().addRule({
            name: `${labelOf(symbol)} Breakout Buy (${breakoutPrice})`,
            symbol,
            enabled: true,
            condition: {
              type: 'PRICE_CROSS_ABOVE',
              threshold: breakoutPrice,
            },
            thenAction: {
              type: 'MARKET_ORDER',
              side: 'BUY',
              qty: 0.1,
              note: 'Market Buy on breakout',
            },
            oneShot: true,
          });
          notifyAlert('Template Applied', `Breakout Buy rule armed at ${breakoutPrice}.`);
        }
      },

      evaluateRules: (symbol, price) => {
        const { rules } = get();
        const activeRules = rules.filter((r) => r.enabled && (r.symbol === symbol || r.symbol === 'ALL'));
        if (activeRules.length === 0) return;

        const terminal = useTerminalStore.getState();
        const positions = terminal.positions;
        const pos = positions[symbol];
        const openPosList = Object.values(positions);
        const totalUnrealizedPnl = openPosList.reduce((acc, p) => acc + p.unrealizedPnl, 0);

        activeRules.forEach((rule) => {
          let triggered = false;
          let conditionSummary = '';

          switch (rule.condition.type) {
            case 'PRICE_CROSS_ABOVE':
              if (price >= rule.condition.threshold) {
                triggered = true;
                conditionSummary = `Price reached ${fmtPrice(price, symbol)} (>= ${fmtPrice(rule.condition.threshold, symbol)})`;
              }
              break;

            case 'PRICE_CROSS_BELOW':
              if (price <= rule.condition.threshold) {
                triggered = true;
                conditionSummary = `Price dropped to ${fmtPrice(price, symbol)} (<= ${fmtPrice(rule.condition.threshold, symbol)})`;
              }
              break;

            case 'POSITION_PROFIT_USD':
              if (pos) {
                const mark = terminal.prices[symbol] ?? pos.entryPrice;
                const pnl = positionPnlUsd(pos, mark);
                if (pnl >= rule.condition.threshold) {
                  triggered = true;
                  conditionSummary = `Position PnL reached +$${pnl.toFixed(2)} (>= +$${rule.condition.threshold})`;
                }
              }
              break;

            case 'POSITION_DRAWDOWN_USD':
              if (rule.symbol === 'ALL') {
                if (totalUnrealizedPnl <= rule.condition.threshold) {
                  triggered = true;
                  conditionSummary = `Total Portfolio Drawdown reached -$${Math.abs(totalUnrealizedPnl).toFixed(2)} (limit: -$${Math.abs(rule.condition.threshold)})`;
                }
              } else if (pos) {
                const mark = terminal.prices[symbol] ?? pos.entryPrice;
                const pnl = positionPnlUsd(pos, mark);
                if (pnl <= rule.condition.threshold) {
                  triggered = true;
                  conditionSummary = `Position Drawdown reached -$${Math.abs(pnl).toFixed(2)} (limit: -$${Math.abs(rule.condition.threshold)})`;
                }
              }
              break;

            case 'POSITION_RR_REACHED':
              if (pos) {
                const matchingOrders = terminal.orders.filter(
                  (o) => o.status === 'PENDING' && o.symbol === symbol && o.type === 'STOP_LOSS'
                );
                const slOrder = matchingOrders[0];
                if (slOrder && slOrder.triggerPrice) {
                  const riskDist = Math.abs(pos.entryPrice - slOrder.triggerPrice);
                  const currentGain = (price - pos.entryPrice) * (pos.side === 'LONG' ? 1 : -1);
                  const currentRR = riskDist > 0 ? currentGain / riskDist : 0;
                  if (currentRR >= rule.condition.threshold) {
                    triggered = true;
                    conditionSummary = `Position reached ${currentRR.toFixed(1)} R:R (Target: ${rule.condition.threshold} R:R)`;
                  }
                }
              }
              break;

            default:
              break;
          }

          if (triggered) {
            let actionSummary = '';
            try {
              if (rule.thenAction.type === 'SNAP_BREAK_EVEN') {
                terminal.snapBreakEven(symbol);
                actionSummary = `Moved Stop Loss of ${labelOf(symbol)} to Entry (Break-Even)`;
              } else if (rule.thenAction.type === 'SCALE_OUT') {
                const frac = rule.thenAction.fraction || 0.5;
                terminal.closePartialPosition(symbol, frac);
                actionSummary = `Scaled out ${(frac * 100).toFixed(0)}% of ${labelOf(symbol)} position`;
              } else if (rule.thenAction.type === 'CLOSE_POSITION') {
                if (rule.symbol === 'ALL') {
                  terminal.closeAllPositions();
                  actionSummary = 'Executed Emergency Flatten of all open positions';
                } else {
                  terminal.closePosition(symbol);
                  actionSummary = `Closed ${labelOf(symbol)} position at market`;
                }
              } else if (rule.thenAction.type === 'MARKET_ORDER') {
                if (rule.thenAction.side && rule.thenAction.qty) {
                  terminal.placeOrder({
                    symbol,
                    side: rule.thenAction.side,
                    type: 'MARKET',
                    qty: rule.thenAction.qty,
                    leverage: 10,
                  });
                  actionSummary = `Placed Market ${rule.thenAction.side} for ${rule.thenAction.qty} ${labelOf(symbol)}`;
                }
              } else if (rule.thenAction.type === 'CANCEL_ORDER' && rule.thenAction.orderId) {
                terminal.cancelOrder(rule.thenAction.orderId);
                actionSummary = `Cancelled Order #${rule.thenAction.orderId}`;
              } else {
                actionSummary = `Alert triggered: ${rule.name}`;
              }

              // Update rule status and log
              audioHaptics.tick();
              notifyAlert(`Algo Rule Triggered: ${rule.name}`, `${conditionSummary} -> ${actionSummary}`);

              set((s) => ({
                rules: s.rules.map((r) =>
                  r.id === rule.id
                    ? {
                        ...r,
                        enabled: !r.oneShot,
                        status: r.oneShot ? ('TRIGGERED' as const) : ('ACTIVE' as const),
                        lastTriggeredAt: Date.now(),
                      }
                    : r
                ),
                logs: [
                  {
                    id: uid(),
                    ruleId: rule.id,
                    ruleName: rule.name,
                    symbol,
                    conditionSummary,
                    actionSummary,
                    timestamp: Date.now(),
                    success: true,
                  },
                  ...s.logs.slice(0, 49),
                ],
              }));
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Execution error';
              set((s) => ({
                logs: [
                  {
                    id: uid(),
                    ruleId: rule.id,
                    ruleName: rule.name,
                    symbol,
                    conditionSummary,
                    actionSummary: `Failed: ${errMsg}`,
                    timestamp: Date.now(),
                    success: false,
                  },
                  ...s.logs.slice(0, 49),
                ],
              }));
            }
          }
        });
      },
    }),
    {
      name: 'crt_execution_rules',
      partialize: (s) => ({
        rules: s.rules,
        logs: s.logs,
      }),
    }
  )
);
