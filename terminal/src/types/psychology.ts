export interface RiskRuleConfig {
  maxDailyLoss: number;          // e.g., $500 max daily loss
  maxDailyTrades: number;        // e.g., 5 trades per session
  maxConsecutiveLosses: number;  // e.g., 3 consecutive losses
  coolDownDurationMs: number;    // e.g., 1800000 (30 mins lockout)
}

export interface KillSwitchState {
  isLocked: boolean;
  lockReason: string | null;
  lockedUntil: number | null;    // Unix timestamp in ms
  accountabilityPartnerCode?: string;
}

export interface ZenModeConfig {
  active: boolean;
  hidePnlTicker: boolean;
  softPastelCandles: boolean;
  breathingGuideActive: boolean;
}

export interface CustomThemeConfig {
  wallpaperType: 'SOLID' | 'IMAGE' | 'GIF' | 'VIDEO';
  mediaUrl: string | null;       // Canvas background MP4, WebM, GIF, PNG, or WebP URL
  overlayOpacity: number;        // 0.1 to 0.95 for readability
  blurAmount?: number;           // 0 to 12px blur for aesthetics
  accentColor: string;
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  chartDataUrl: string;          // Canvas snapshot Data URL
  emotionTag: 'PLANNED' | 'FOMO' | 'REVENGE' | 'IMPULSE';
  notes: string;
}
