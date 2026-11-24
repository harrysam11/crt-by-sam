export interface RiskRuleConfig {
  maxDailyLoss: number;          // e.g., $500 max daily loss
  maxDailyTrades: number;        // e.g., 5 trades per session
  maxConsecutiveLosses: number;  // e.g., 3 consecutive losses
  coolDownDurationMs: number;    // e.g., 1800000 (30 mins lockout)
  propFirmShieldEnabled?: boolean;
  propFirmDailyLossPct?: number; // e.g. 4.5% safe buffer for 5% prop firm daily loss breach rule
  propFirmMaxDrawdownPct?: number; // e.g. 9.0% safe buffer for 10% maximum trailing drawdown breach rule
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

export type WallpaperFitMode = 'cover' | 'contain' | 'fill' | 'none';

export interface CustomThemeConfig {
  wallpaperType: 'SOLID' | 'IMAGE' | 'GIF' | 'VIDEO';
  mediaUrl: string | null;       // Canvas background MP4, WebM, GIF, PNG, or WebP URL
  overlayOpacity: number;        // 0.1 to 0.95 for readability
  blurAmount?: number;           // 0 to 12px blur for aesthetics
  accentColor: string;
  // Sizing, crop, scale & relocation controls
  fitMode?: WallpaperFitMode;    // 'cover' (fill/crop), 'contain' (fit whole), 'fill' (stretch), 'none' (original)
  scale?: number;                // 0.25 to 3.0 (zoom / resize factor)
  offsetX?: number;              // -100 to 100 (% horizontal pan / relocate)
  offsetY?: number;              // -100 to 100 (% vertical pan / relocate)
  rotation?: number;             // 0, 90, 180, 270 degrees
  flipH?: boolean;               // Horizontal mirror flip
  flipV?: boolean;               // Vertical mirror flip
  playbackSpeed?: number;        // 0.25 to 2.0x video playback rate
}

export interface JournalChecklist {
  followedPlan: boolean;
  validRR: boolean;
  confluenceChecked: boolean;
  noNewsConflict: boolean;
  riskCalculated: boolean;
}

export type TradingSessionTag = 'ASIA' | 'LONDON' | 'NY' | 'OVERLAP' | 'INTER_SESSION';

export interface JournalEntry {
  id: string;
  timestamp: number;
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  qty?: number;
  pnl?: number;
  commission?: number;
  netPnl?: number;
  rMultiple?: number;
  session?: TradingSessionTag;
  setup?: string;
  checklist?: JournalChecklist;
  holdingTimeMs?: number;
  chartDataUrl: string;          // Canvas snapshot Data URL
  emotionTag: 'PLANNED' | 'FOMO' | 'REVENGE' | 'IMPULSE';
  notes: string;
  tags?: string[];
  aiTakeaway?: string;
}
