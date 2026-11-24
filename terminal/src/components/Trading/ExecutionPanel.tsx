import { useEffect, useState } from 'react';
import { freeMargin, LEVERAGES, useTerminalStore } from '../../store/useTerminalStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { useDerivativesStore } from '../../store/useDerivativesStore';
import { useGuardianStore, type GuardianCheckResult } from '../../store/useGuardianStore';
import { getInstrument, toUsd } from '../../services/instruments';
import { fmtPrice, fmtQty, fmtUsd, labelOf } from '../../utils/formatters';
import { logTradeToJournal } from '../../services/journalService';
import { calculateDerivativesMargin } from '../../services/deltaExchange';
import { audioHaptics } from '../../utils/notify';
import GuardianConfirmModal from '../guardian/GuardianConfirmModal';
import type { OrderSide } from '../../types/terminal';

import { useDrawingStore } from '../../store/useDrawingStore';

// Global declaration for Risk HUD auto-fill
declare global {
  interface Window {
    __setExecutionValues?: (vals: { qty?: string; sl?: string; tp?: string }) => void;
    __chartContainer?: HTMLElement | null;
  }
}

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

interface ExecutionPanelProps {
  initialSide?: OrderSide;
  onClose?: () => void;
  showHeader?: boolean;
}

export default function ExecutionPanel({
  initialSide,
  onClose,
  showHeader = false,
}: ExecutionPanelProps = {}) {
  const storeLeftOrderSide = useDrawingStore((s) => s.leftOrderSide);
  const activeSide = initialSide || storeLeftOrderSide || 'BUY';
  const symbol = useTerminalStore((s) => s.symbol);
  const price = useTerminalStore((s) => s.currentPrice);
  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const trades = useTerminalStore((s) => s.trades);
  const positions = useTerminalStore((s) => s.positions);
  const positionTickets = useTerminalStore((s) => s.positionTickets || []);
  const equity = useTerminalStore((s) => s.balance + Object.values(s.positions).reduce((a, p) => a + p.unrealizedPnl, 0));
  const balance = useTerminalStore((s) => s.balance);
  const free = useTerminalStore((s) => freeMargin(s));

  // Psychology Kill-Switch & Rules
  const killSwitch = usePsychologyStore((s) => s.killSwitch);
  const checkRiskTriggers = usePsychologyStore((s) => s.checkRiskTriggers);

  // TradeXGuardian
  const guardianCheck = useGuardianStore((s) => s.checkTrade);
  const guardianEnabled = useGuardianStore((s) => s.enabled);
  const guardianEmergencyLocked = useGuardianStore((s) => s.emergencyLocked);

  // Derivatives Contract & Leverage
  const selectedContract = useDerivativesStore((s) => s.selectedContract);

  const [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [qty, setQty] = useState('0.01');
  const [limit, setLimit] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [lev, setLev] = useState(10);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Guardian modal state
  const [guardianModal, setGuardianModal] = useState<{
    isOpen: boolean;
    result: GuardianCheckResult;
    side: OrderSide;
  } | null>(null);

  // Expose setter for RiskHUD
  useEffect(() => {
    window.__setExecutionValues = (vals) => {
      if (vals.qty !== undefined) setQty(vals.qty);
      if (vals.sl !== undefined) setSl(vals.sl);
      if (vals.tp !== undefined) setTp(vals.tp);
    };
    return () => {
      delete window.__setExecutionValues;
    };
  }, []);

  const cur = getInstrument(symbol)?.currency ?? 'USD';
  const q = num(qty), slN = num(sl), tpN = num(tp);
  const entry = type === 'LIMIT' ? num(limit) : price || undefined;
  const fx = toUsd(symbol);
  const risk = entry && q && slN ? Math.abs(entry - slN) * q * fx : undefined;
  const reward = entry && q && tpN ? Math.abs(tpN - entry) * q * fx : undefined;
  const margin = entry && q ? (entry * q * fx) / lev : undefined;

  // Spread calculation (typical 0.02% of price)
  const spreadPts = entry ? +(entry * 0.0002).toFixed(symbol.includes('BTC') ? 2 : 4) : 0;
  const isSpreadWide = spreadPts > (entry ? entry * 0.0008 : 0);

  // Derivatives margin & liquidation price estimate
  const derivativesCalc = entry && q ? calculateDerivativesMargin({
    contract: selectedContract,
    price: entry,
    quantity: q,
    leverage: lev,
    side: 'BUY',
  }) : null;

  // Size position to exact risk percentage of equity
  const applyRiskPercentage = (pct: number) => {
    audioHaptics.tick();
    if (!entry || !slN) {
      setMsg({ ok: false, text: 'Specify a Stop Loss to calculate risk size.' });
      return;
    }
    const riskDollar = equity * (pct / 100);
    const distance = Math.abs(entry - slN) * fx;
    if (distance > 0) {
      const units = riskDollar / distance;
      setQty(String(Number(units.toPrecision(3))));
      setMsg({ ok: true, text: `Sized for ${pct}% risk ($${riskDollar.toFixed(2)})` });
    }
  };

  // Quick quantity multiplier
  const multiplyQty = (factor: number) => {
    audioHaptics.tick();
    const current = num(qty) || 0.01;
    const next = +(current * factor).toFixed(4);
    if (next > 0) setQty(String(next));
  };

  // Snap TP to 2R or 3R multiple
  const snapReward = (multiplier: number) => {
    audioHaptics.tick();
    if (!entry || !slN) {
      setMsg({ ok: false, text: 'Set Stop Loss first to calculate R:R target.' });
      return;
    }
    const distance = Math.abs(entry - slN);
    const isLong = entry >= slN;
    const targetPrice = isLong ? entry + distance * multiplier : entry - distance * multiplier;
    setTp(String(+targetPrice.toFixed(4)));
    setMsg({ ok: true, text: `TP snapped to ${multiplier}R (${targetPrice.toFixed(2)})` });
  };

  const executeOrder = async (side: OrderSide) => {
    const r = placeOrder({
      symbol,
      side,
      type,
      qty: q ?? 0,
      leverage: lev,
      price: num(limit),
      stopLoss: slN,
      takeProfit: tpN,
    });

    if (r.ok) {
      audioHaptics.fill();
      setMsg({ ok: true, text: r.warning ?? `${side === 'BUY' ? 'Buy' : 'Sell'} ${type.toLowerCase()} order placed.` });
      try {
        await logTradeToJournal({
          tradeId: `trade-${Date.now()}`,
          symbol,
          side,
          entryPrice: entry ?? price,
          chartContainer: window.__chartContainer,
          emotionTag: 'PLANNED',
          notes: `${side} order filled for ${qty} ${symbol} at ${entry ?? price}`,
        });
      } catch {
        // Continue even if snapshot fails
      }
    } else {
      audioHaptics.error();
      setMsg({ ok: false, text: r.error ?? 'Order rejected.' });
    }
  };

  const submit = async (side: OrderSide) => {
    audioHaptics.tick();

    // 0. Strict input bounds and sanity check
    if (q === null || q === undefined || q <= 0 || !Number.isFinite(q)) {
      audioHaptics.error();
      setMsg({ ok: false, text: 'Invalid order size. Quantity must be a positive finite number.' });
      return;
    }

    if (type === 'LIMIT' && (!entry || entry <= 0 || !Number.isFinite(entry))) {
      audioHaptics.error();
      setMsg({ ok: false, text: 'Invalid limit price. Price must be a positive number.' });
      return;
    }

    if (!Number.isFinite(lev) || lev < 1 || lev > 125) {
      audioHaptics.error();
      setMsg({ ok: false, text: 'Invalid leverage. Leverage must be between 1x and 125x.' });
      return;
    }

    // 1. Guard against Kill-Switch lockout
    if (killSwitch.isLocked) {
      audioHaptics.error();
      setMsg({ ok: false, text: 'Kill-Switch is locked. Order blocked.' });
      return;
    }

    // 2. TradeXGuardian emergency lock
    if (guardianEmergencyLocked) {
      audioHaptics.error();
      setMsg({ ok: false, text: '[GUARDIAN] Emergency lock active — all trading blocked.' });
      return;
    }

    // 3. Evaluate psychology session risk triggers
    const today = new Date().setHours(0, 0, 0, 0);
    const todayTrades = trades.filter((t) => t.time >= today);
    const realizedLossToday = Math.abs(
      todayTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0)
    );
    let streak = 0;
    for (let i = todayTrades.length - 1; i >= 0; i--) {
      if (todayTrades[i].pnl < 0) streak++;
      else break;
    }
    if (checkRiskTriggers(realizedLossToday, todayTrades.length, streak)) {
      audioHaptics.error();
      setMsg({ ok: false, text: 'Session risk limit reached. Lockout triggered!' });
      return;
    }

    // 4. TradeXGuardian full check
    if (guardianEnabled) {
      const lastTrade = todayTrades.length > 0 ? todayTrades[todayTrades.length - 1] : undefined;
      const prevLot = lastTrade ? lastTrade.qty : undefined;
      const guardianResult = guardianCheck({
        symbol,
        side,
        qty: q ?? 0,
        entryPrice: entry ?? price ?? 0,
        stopLoss: slN,
        takeProfit: tpN,
        leverage: lev,
        accountEquity: equity,
        currentBalance: balance,
        openPositionsCount: positionTickets.length > 0 ? positionTickets.length : Object.keys(positions).length,
        tradesTodayCount: todayTrades.length,
        dailyRealizedLoss: realizedLossToday,
        consecutiveLosses: streak,
        lastTradeTimestamp: lastTrade?.time,
        previousLotSize: prevLot,
      });

      // Apply suggested SL/TP if no SL set and guardian provided suggestions
      if (guardianResult.suggestedSl !== undefined && !slN) {
        setSl(String(+guardianResult.suggestedSl.toFixed(5)));
      }
      if (guardianResult.suggestedTp !== undefined && !tpN) {
        setTp(String(+guardianResult.suggestedTp.toFixed(5)));
      }

      // If blocked or confirmations needed → show guardian modal
      if (guardianResult.blocked || guardianResult.confirmations.length > 0 || guardianResult.warnings.length > 0) {
        audioHaptics.error();
        setGuardianModal({ isOpen: true, result: guardianResult, side });
        return;
      }
    }

    // 5. All checks passed → execute
    await executeOrder(side);
  };

  return (
    <div className="shrink-0 border-t md:border-t-0 bg-panel p-3 font-mono text-xs flex flex-col h-full overflow-y-auto">
      {/* Optional Top Header when opened as Left Order Pane or Standalone */}
      {(showHeader || onClose) && (
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-grid">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${activeSide === 'BUY' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`} />
            <span className="font-bold text-white text-[11px] uppercase tracking-wider">
              {symbol} Order Execution
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition"
              title="Close Order Pane"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Guardian Confirmation Modal */}
      {guardianModal?.isOpen && (
        <GuardianConfirmModal
          isOpen={guardianModal.isOpen}
          result={guardianModal.result}
          symbol={symbol}
          side={guardianModal.side}
          qty={q ?? 0}
          onProceed={async () => {
            setGuardianModal(null);
            await executeOrder(guardianModal.side);
          }}
          onCancel={() => {
            setGuardianModal(null);
            setMsg({ ok: false, text: 'Order cancelled by Guardian risk check.' });
          }}
        />
      )}

      {/* Guardian Emergency Lock banner */}
      {guardianEmergencyLocked && (
        <div className="mb-2 rounded border border-red-500/60 bg-red-500/20 p-2 text-center text-xs font-bold text-red-300 animate-pulse">
          [GUARDIAN EMERGENCY LOCK] All trading blocked.
        </div>
      )}

      {/* Kill-Switch lockout banner */}
      {killSwitch.isLocked && (
        <div className="mb-2 rounded border border-red-500/50 bg-red-500/20 p-2 text-center text-xs font-bold text-red-300">
          [LOCKED] Kill-Switch Active: {killSwitch.lockReason || 'Overtrading protection active'}
        </div>
      )}

      {/* Header controls & Spread Warning */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(['MARKET', 'LIMIT'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                audioHaptics.tick();
                setType(t);
              }}
              className={`rounded px-3 py-1 ${type === t ? 'bg-grid text-white font-semibold' : 'text-muted hover:text-white'}`}
            >
              {t === 'MARKET' ? 'Market' : 'Limit'}
            </button>
          ))}
        </div>

        {/* Live Spread Warning Pill */}
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] border ${
              isSpreadWide
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                : 'border-grid bg-bg text-muted'
            }`}
            title="Current estimated Bid-Ask spread"
          >
            Spread: {spreadPts} pts
          </span>

          <label className="flex items-center gap-1 text-muted text-xs">
            Lev
            <select
              value={lev}
              onChange={(e) => setLev(Number(e.target.value))}
              className="num rounded border border-grid bg-bg px-1 py-0.5 text-white"
            >
              {LEVERAGES.map((l) => <option key={l} value={l}>{l}x</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Input Fields Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Field label={`Quantity (${labelOf(symbol)})`} value={qty} onChange={setQty} />
          {/* Multipliers */}
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => multiplyQty(0.5)}
              className="rounded border border-grid px-1.5 py-0.5 text-[10px] text-muted hover:border-accent hover:text-white"
            >
              0.5x
            </button>
            <button
              onClick={() => multiplyQty(2.0)}
              className="rounded border border-grid px-1.5 py-0.5 text-[10px] text-muted hover:border-accent hover:text-white"
            >
              2x
            </button>
          </div>
        </div>

        <div>
          {type === 'LIMIT'
            ? <Field label={`Limit price (${cur})`} value={limit} onChange={setLimit} placeholder={fmtPrice(price, symbol)} />
            : <Field label={`Market price (${cur})`} value={fmtPrice(price, symbol)} onChange={() => undefined} disabled />}
        </div>

        <div>
          <Field label="Stop loss" value={sl} onChange={setSl} placeholder="optional" />
          {/* 1-Tap Risk % Pills */}
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-muted mr-0.5">Risk:</span>
            {[1, 2, 5].map((pct) => (
              <button
                key={pct}
                onClick={() => applyRiskPercentage(pct)}
                className="rounded border border-grid px-1.5 py-0.5 text-[10px] text-accent hover:border-accent hover:bg-accent/10"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <Field label="Take profit" value={tp} onChange={setTp} placeholder="optional" />
          {/* Target R:R Snaps */}
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-muted mr-0.5">Snap:</span>
            {[2, 3].map((rMult) => (
              <button
                key={rMult}
                onClick={() => snapReward(rMult)}
                className="rounded border border-grid px-1.5 py-0.5 text-[10px] text-up hover:border-up hover:bg-up/10"
              >
                {rMult}R
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="num mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted">
        <span>Margin {margin !== undefined ? fmtUsd(margin) : '—'}</span>
        <span className="text-right">Free {fmtUsd(free)}</span>
        <span className="text-down">Risk {risk !== undefined ? fmtUsd(risk) : '—'}</span>
        <span className="text-right text-up">
          Reward {reward !== undefined ? fmtUsd(reward) : '—'}{risk && reward ? ` · ${(reward / risk).toFixed(2)}R` : ''}
        </span>
      </div>

      {/* Liquidation estimate badge */}
      {derivativesCalc && (
        <div className="mt-1 flex justify-between text-[11px] text-muted font-mono">
          <span>Est. Liq Price:</span>
          <span className="text-amber-400 font-semibold">{fmtPrice(derivativesCalc.estimatedLiquidationPrice, symbol)}</span>
        </div>
      )}

      {/* Execution Buttons */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          onClick={() => submit('BUY')}
          disabled={killSwitch.isLocked || guardianEmergencyLocked}
          className={`rounded bg-up py-2 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
            activeSide === 'BUY' ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-black font-extrabold shadow-lg shadow-emerald-950/40' : 'opacity-85'
          }`}
        >
          Buy / Long
        </button>
        <button
          onClick={() => submit('SELL')}
          disabled={killSwitch.isLocked || guardianEmergencyLocked}
          className={`rounded bg-down py-2 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
            activeSide === 'SELL' ? 'ring-2 ring-rose-400 ring-offset-1 ring-offset-black font-extrabold shadow-lg shadow-rose-950/40' : 'opacity-85'
          }`}
        >
          Sell / Short
        </button>
      </div>

      <div role="status" className={`mt-2 min-h-[16px] text-xs ${msg?.ok ? 'text-up font-medium' : 'text-down'}`}>
        {msg?.text}
      </div>
    </div>
  );
}

function Field(p: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {p.label}
      <input
        inputMode="decimal"
        disabled={p.disabled}
        value={p.value}
        placeholder={p.placeholder}
        onChange={(e) => p.onChange(e.target.value)}
        className="num rounded border border-grid bg-bg px-2 py-1 text-xs text-white placeholder:text-muted/60 disabled:opacity-60 focus:border-accent focus:outline-none"
      />
    </label>
  );
}
