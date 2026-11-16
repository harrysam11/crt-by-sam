/**
 * TradingView-Style Institutional Create Alert Dialog.
 * Supports:
 * - Price condition: Crossing, Crossing Up, Crossing Down, Greater Than, Less Than
 * - Indicator condition: RSI Overbought/Oversold, Moving Average Cross
 * - Drawing condition: Trendline / Horizontal Line cross
 * - Notifications: Browser Push Notification, Audio Chime, Telegram Alert
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { getInstrument } from '../../services/instruments';
import { fmtPrice, labelOf } from '../../utils/formatters';
import { audioHaptics, requestNotify } from '../../utils/notify';
import { loadTelegramConfig, sendTelegramMessage } from '../../services/telegramService';
import type { AlertConditionType } from '../../types/terminal';

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrice?: number;
}

export default function CreateAlertModal({ isOpen, onClose, initialPrice }: CreateAlertModalProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const addAdvancedAlert = useTerminalStore((s) => s.addAdvancedAlert);

  const defaultPrice = initialPrice ?? currentPrice;

  const [conditionType, setConditionType] = useState<AlertConditionType>('PRICE');
  const [operator, setOperator] = useState<'CROSSING' | 'CROSSING_UP' | 'CROSSING_DOWN' | 'GREATER_THAN' | 'LESS_THAN'>('CROSSING');
  const [targetPrice, setTargetPrice] = useState(defaultPrice ? String(defaultPrice) : '');
  const [indicatorId, setIndicatorId] = useState('rsi');
  const [indicatorVal, setIndicatorVal] = useState('70');
  const [alertNote, setAlertNote] = useState('');
  const [notifySound, setNotifySound] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [tgFeedback, setTgFeedback] = useState<string | null>(null);

  const tgConfig = loadTelegramConfig();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    audioHaptics.tick();

    if (notifyPush) {
      requestNotify();
    }

    const priceNum = parseFloat(targetPrice) || currentPrice;
    const dir = priceNum >= currentPrice ? 'above' : 'below';

    if (conditionType === 'PRICE') {
      addAdvancedAlert({
        symbol,
        price: priceNum,
        dir,
        type: 'PRICE',
        condition: {
          operator,
          targetValue: priceNum,
        },
        note: alertNote.trim() || `${labelOf(symbol)} reached ${fmtPrice(priceNum, symbol)}`,
      });
    } else if (conditionType === 'INDICATOR_CROSS') {
      const indValNum = parseFloat(indicatorVal) || 70;
      addAdvancedAlert({
        symbol,
        price: priceNum,
        dir,
        type: 'INDICATOR_CROSS',
        condition: {
          indicatorId,
          operator,
          targetValue: indValNum,
        },
        note: alertNote.trim() || `${labelOf(symbol)} ${indicatorId.toUpperCase()} ${operator} ${indValNum}`,
      });
    }

    if (notifyTelegram && tgConfig.enabled) {
      sendTelegramMessage(
        `<b>Alert Created</b>: <b>${labelOf(symbol)}</b> target <b>${fmtPrice(priceNum, symbol)}</b> (${conditionType === 'PRICE' ? operator : indicatorId.toUpperCase()}).\nNote: ${alertNote.trim() || 'Active price alert'}`
      ).catch(() => {});
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md font-mono select-none text-xs p-4">
      <div className="clay-modal flex flex-col w-full max-w-md overflow-hidden p-5 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <h3 className="font-semibold text-white text-sm">
              Create Alert on {labelOf(symbol)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="clay-btn px-2 py-0.5 text-muted hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-4">
          {/* Condition Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold text-muted mb-1 block">
              Condition Target
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setConditionType('PRICE')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  conditionType === 'PRICE' ? 'clay-pill-active' : 'clay-pill text-muted hover:text-white'
                }`}
              >
                Price Level
              </button>
              <button
                type="button"
                onClick={() => setConditionType('INDICATOR_CROSS')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  conditionType === 'INDICATOR_CROSS' ? 'clay-pill-active' : 'clay-pill text-muted hover:text-white'
                }`}
              >
                Technical Indicator
              </button>
            </div>
          </div>

          {/* Indicator Options (when condition is indicator) */}
          {conditionType === 'INDICATOR_CROSS' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted mb-1 block">
                  Indicator
                </label>
                <select
                  value={indicatorId}
                  onChange={(e) => setIndicatorId(e.target.value)}
                  className="clay-inset w-full px-2.5 py-1.5 text-white bg-[#0e0e13] focus:outline-none"
                >
                  <option value="rsi">RSI (14)</option>
                  <option value="macd">MACD Histogram</option>
                  <option value="ema">EMA (20)</option>
                  <option value="sma">SMA (50)</option>
                  <option value="vwap">VWAP</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted mb-1 block">
                  Threshold Value
                </label>
                <input
                  type="number"
                  value={indicatorVal}
                  onChange={(e) => setIndicatorVal(e.target.value)}
                  className="clay-inset w-full px-2.5 py-1.5 text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Trigger Operator */}
          <div>
            <label className="text-[10px] uppercase font-bold text-muted mb-1 block">
              Trigger Trigger Action
            </label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as any)}
              className="clay-inset w-full px-2.5 py-1.5 text-white bg-[#0e0e13] focus:outline-none"
            >
              <option value="CROSSING">Crossing</option>
              <option value="CROSSING_UP">Crossing Up</option>
              <option value="CROSSING_DOWN">Crossing Down</option>
              <option value="GREATER_THAN">Greater Than</option>
              <option value="LESS_THAN">Less Than</option>
            </select>
          </div>

          {/* Target Price */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold text-muted">
                Target Price
              </label>
              <span className="text-[10px] text-muted">
                Current: {fmtPrice(currentPrice, symbol)}
              </span>
            </div>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={String(currentPrice)}
              required
              className="clay-inset w-full px-2.5 py-1.5 text-white focus:outline-none font-mono"
            />
          </div>

          {/* Notification Actions */}
          <div>
            <label className="text-[10px] uppercase font-bold text-muted mb-1 block">
              Alert Actions
            </label>
            <div className="flex flex-wrap items-center gap-4 py-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={notifySound}
                  onChange={(e) => setNotifySound(e.target.checked)}
                  className="rounded bg-black border-grid text-white focus:ring-0"
                />
                <span>Play Sound Chime</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={notifyPush}
                  onChange={(e) => setNotifyPush(e.target.checked)}
                  className="rounded bg-black border-grid text-white focus:ring-0"
                />
                <span>Browser Notification</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={notifyTelegram}
                  onChange={(e) => setNotifyTelegram(e.target.checked)}
                  className="rounded bg-black border-grid text-white focus:ring-0"
                />
                <span>Telegram Bot Alert</span>
              </label>
            </div>

            {/* Telegram Configuration Status & Instant Test */}
            {notifyTelegram && (
              <div className="mt-2 rounded border border-grid/60 bg-bg/50 p-2 text-[10px]">
                {tgConfig.enabled && tgConfig.botToken && tgConfig.chatId ? (
                  <div className="flex items-center justify-between">
                    <span className="text-up font-semibold">
                      [TG Active: Chat ID {tgConfig.chatId}]
                    </span>
                    <button
                      type="button"
                      disabled={isTestingTg}
                      onClick={async () => {
                        audioHaptics.tick();
                        setIsTestingTg(true);
                        setTgFeedback(null);
                        const res = await sendTelegramMessage(
                          `Test Ping from Create Alert Dialog for <b>${labelOf(symbol)}</b> at <b>${fmtPrice(currentPrice, symbol)}</b>`
                        );
                        setIsTestingTg(false);
                        setTgFeedback(res.ok ? 'Delivered successfully to Telegram!' : `Failed: ${res.error}`);
                      }}
                      className="clay-pill px-2.5 py-0.5 text-white hover:text-white"
                    >
                      {isTestingTg ? 'Sending...' : 'Test TG Ping'}
                    </button>
                  </div>
                ) : (
                  <div className="text-amber-400">
                    Telegram bot not configured yet. Configure token and chat ID in <b>Settings &gt; Telegram</b>.
                  </div>
                )}
                {tgFeedback && (
                  <div className="mt-1 text-slate-300 font-mono text-[9px]">
                    {tgFeedback}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alert Note */}
          <div>
            <label className="text-[10px] uppercase font-bold text-muted mb-1 block">
              Message Note (Optional)
            </label>
            <input
              type="text"
              value={alertNote}
              onChange={(e) => setAlertNote(e.target.value)}
              placeholder="e.g. Breakout retest confirmation"
              className="clay-inset w-full px-2.5 py-1.5 text-white focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-grid/60 pt-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="clay-btn px-3 py-1.5 text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="clay-pill-active px-4 py-1.5 font-bold"
            >
              Create Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
