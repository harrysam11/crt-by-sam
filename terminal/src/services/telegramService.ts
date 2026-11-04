/**
 * Telegram Bot Webhook & Real-time Notification Engine.
 * Allows traders to receive order fills, stop-loss hits, and liquidation alerts directly in Telegram.
 * ZERO EMOJI POLICY strictly enforced.
 */

import {
  escapeHtml,
  validateTelegramBotToken,
  validateTelegramChatId,
  checkTelegramRateLimit,
} from '../utils/security';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyOnFills: boolean;
  notifyOnAlerts: boolean;
  notifyOnKillSwitch: boolean;
  notifyOnLiquidation: boolean;
}

const STORAGE_KEY = 'crt_telegram_config';

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '',
  chatId: '',
  enabled: false,
  notifyOnFills: true,
  notifyOnAlerts: true,
  notifyOnKillSwitch: true,
  notifyOnLiquidation: true,
};

export function loadTelegramConfig(): TelegramConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_TELEGRAM_CONFIG, ...JSON.parse(raw) } : DEFAULT_TELEGRAM_CONFIG;
  } catch {
    return DEFAULT_TELEGRAM_CONFIG;
  }
}

export function saveTelegramConfig(config: TelegramConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const config = loadTelegramConfig();
  if (!config.enabled || !config.botToken.trim() || !config.chatId.trim()) {
    return { ok: false, error: 'Telegram integration is disabled or credentials unconfigured.' };
  }

  const token = config.botToken.trim();
  const chatId = config.chatId.trim();

  if (!validateTelegramBotToken(token)) {
    return { ok: false, error: 'Invalid Telegram Bot Token format. Expected format: 123456789:ABC...' };
  }

  if (!validateTelegramChatId(chatId)) {
    return { ok: false, error: 'Invalid Telegram Chat ID format. Expected numeric ID (e.g. 12345678 or -10012345678).' };
  }

  if (!checkTelegramRateLimit()) {
    return { ok: false, error: 'Client rate limit reached: maximum 10 Telegram dispatches per minute.' };
  }

  const endpoint = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined,
      body: JSON.stringify({
        chat_id: chatId,
        text: `[CRT TERMINAL ALERT]\n${text}`,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || 'Telegram API error' };
    }

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken.trim();
  const chat = chatId.trim();

  if (!token || !chat) {
    return { ok: false, error: 'Enter both Bot Token and Chat ID.' };
  }

  if (!validateTelegramBotToken(token)) {
    return { ok: false, error: 'Invalid Bot Token format. Token must match: <digits>:<alphanumeric>.' };
  }

  if (!validateTelegramChatId(chat)) {
    return { ok: false, error: 'Invalid Chat ID format. Must be a positive or negative numeric integer.' };
  }

  const endpoint = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined,
      body: JSON.stringify({
        chat_id: chat,
        text: '<b>[CRT TERMINAL TEST]</b>\nTelegram Bot webhook connected successfully.\nTimestamp: ' + new Date().toISOString(),
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || 'Telegram API rejected token or chat ID.' };
    }

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed.' };
  }
}

/** Pre-formatted dispatchers with strict HTML escaping */
export function dispatchOrderFillTelegram(symbol: string, side: string, qty: number, price: number): void {
  const cfg = loadTelegramConfig();
  if (!cfg.enabled || !cfg.notifyOnFills) return;
  const safeSym = escapeHtml(symbol);
  const safeSide = escapeHtml(side);
  const safeQty = Number(qty) || 0;
  const safePrice = Number(price) || 0;
  const safeTime = escapeHtml(new Date().toLocaleTimeString());
  const msg = `<b>ORDER FILLED</b>\nSymbol: <code>${safeSym}</code>\nSide: <b>${safeSide}</b>\nQuantity: <code>${safeQty}</code>\nFill Price: <code>${safePrice}</code>\nTime: ${safeTime}`;
  void sendTelegramMessage(msg);
}

export function dispatchPriceAlertTelegram(symbol: string, targetPrice: number, currentPrice: number): void {
  const cfg = loadTelegramConfig();
  if (!cfg.enabled || !cfg.notifyOnAlerts) return;
  const safeSym = escapeHtml(symbol);
  const safeTarget = Number(targetPrice) || 0;
  const safeMarket = Number(currentPrice) || 0;
  const safeTime = escapeHtml(new Date().toLocaleTimeString());
  const msg = `<b>PRICE TARGET REACHED</b>\nSymbol: <code>${safeSym}</code>\nTarget: <code>${safeTarget}</code>\nMarket: <code>${safeMarket}</code>\nTime: ${safeTime}`;
  void sendTelegramMessage(msg);
}

export function dispatchKillSwitchTelegram(reason: string, lockedUntil: number): void {
  const cfg = loadTelegramConfig();
  if (!cfg.enabled || !cfg.notifyOnKillSwitch) return;
  const safeReason = escapeHtml(reason);
  const unlockDate = escapeHtml(new Date(lockedUntil).toLocaleTimeString());
  const msg = `<b>KILL-SWITCH LOCKOUT TRIGGERED</b>\nReason: <code>${safeReason}</code>\nLocked Until: <b>${unlockDate}</b>\nEmergency Lockout Active.`;
  void sendTelegramMessage(msg);
}
