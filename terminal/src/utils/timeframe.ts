/**
 * Timeframe and Custom Interval Utility Suite.
 * Provides parsing, validation, duration calculation, and persistence for standard and custom chart intervals.
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { Timeframe } from '../types/terminal';

const CUSTOM_TIMEFRAMES_STORAGE_KEY = 'crt_custom_timeframes';

export type IntervalUnit = 'm' | 'h' | 'd' | 'w';

export interface IntervalOption {
  value: number;
  unit: IntervalUnit;
  label: string;
}

export const UNIT_LABELS: Record<IntervalUnit, string> = {
  m: 'Minutes',
  h: 'Hours',
  d: 'Days',
  w: 'Weeks',
};

export const UNIT_SECONDS: Record<IntervalUnit, number> = {
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/**
 * Parses any timeframe string (e.g. '1s', '2m', '10m', '45m', '2h', '3d', '1w', '1M') to total duration in seconds.
 */
export function parseTimeframeToSeconds(tf: string): number {
  if (!tf) return 60;

  // Handle month separately (case-sensitive 'M')
  if (tf.endsWith('M')) {
    const val = parseInt(tf.slice(0, -1), 10);
    return isNaN(val) ? 2592000 : val * 2592000;
  }

  const match = tf.match(/^(\d+)([smhdw])$/i);
  if (!match) {
    return 60;
  }

  const count = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return count;
    case 'm':
      return count * 60;
    case 'h':
      return count * 3600;
    case 'd':
      return count * 86400;
    case 'w':
      return count * 604800;
    default:
      return 60;
  }
}

/**
 * Formats a remaining seconds countdown into a readable timer string (e.g., 04:59, 01:23:45, or 2d 04h).
 */
export function formatCountdownTimer(diffSec: number): string {
  if (diffSec <= 0) return '00:00';

  if (diffSec >= 86400) {
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    return `${days}d ${String(hours).padStart(2, '0')}h`;
  }

  if (diffSec >= 3600) {
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Validates a custom interval input.
 */
export function validateCustomInterval(val: number, unit: IntervalUnit): { ok: boolean; error?: string } {
  if (!Number.isInteger(val) || val <= 0) {
    return { ok: false, error: 'Value must be a positive integer.' };
  }

  if (unit === 'm' && val > 1440) {
    return { ok: false, error: 'Minutes cannot exceed 1440 (use hours or days).' };
  }

  if (unit === 'h' && val > 168) {
    return { ok: false, error: 'Hours cannot exceed 168 (use days or weeks).' };
  }

  if (unit === 'd' && val > 365) {
    return { ok: false, error: 'Days cannot exceed 365.' };
  }

  if (unit === 'w' && val > 52) {
    return { ok: false, error: 'Weeks cannot exceed 52.' };
  }

  return { ok: true };
}

/**
 * Loads persisted custom timeframes from localStorage.
 */
export function loadStoredCustomTimeframes(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TIMEFRAMES_STORAGE_KEY);
    if (!raw) return ['2m', '10m', '45m', '2h', '8h', '2d'];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && /^\d+[smhdwM]$/.test(item));
    }
  } catch {
    // Fallback on corrupt storage
  }
  return ['2m', '10m', '45m', '2h', '8h', '2d'];
}

/**
 * Persists a new custom timeframe to localStorage.
 */
export function saveStoredCustomTimeframe(tf: string): string[] {
  const existing = loadStoredCustomTimeframes();
  if (existing.includes(tf)) return existing;
  const next = [...existing, tf];
  try {
    localStorage.setItem(CUSTOM_TIMEFRAMES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage quota or disabled
  }
  return next;
}

/**
 * Removes a custom timeframe from localStorage.
 */
export function removeStoredCustomTimeframe(tf: string): string[] {
  const existing = loadStoredCustomTimeframes();
  const next = existing.filter((item) => item !== tf);
  try {
    localStorage.setItem(CUSTOM_TIMEFRAMES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage quota or disabled
  }
  return next;
}
