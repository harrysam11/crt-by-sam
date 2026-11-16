/**
 * safeJson.ts
 * Hardened JSON parsing and sanitization utilities to defend against
 * Prototype Pollution, Malformed JSON crashes, and Malicious payloads.
 */

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Deep sanitization of objects to strip prototype pollution keys
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }

  const clean: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (BLOCKED_KEYS.has(key)) {
      continue;
    }
    clean[key] = sanitizeObject(value);
  }

  return clean as T;
}

/**
 * Hardened JSON.parse with prototype pollution defense and safe fallbacks.
 */
export function safeJsonParse<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return sanitizeObject(parsed) as T;
  } catch {
    return fallback;
  }
}

/**
 * Hardened JSON.stringify with circular reference safety.
 */
export function safeJsonStringify(value: unknown, space?: number): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return undefined; // Drop circular reference safely
          }
          seen.add(val);
        }
        return val;
      },
      space
    );
  } catch {
    return '{}';
  }
}

/**
 * Safely parse and clamp numeric inputs within bounds.
 */
export function clampNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(max, Math.max(min, value));
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.min(max, Math.max(min, parsed));
    }
  }
  return defaultValue;
}

/**
 * Sanitize text strings to prevent XSS / markup injection in UI labels.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 1000);
}
