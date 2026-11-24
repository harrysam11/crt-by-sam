import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomThemeConfig, KillSwitchState, RiskRuleConfig, ZenModeConfig } from '../types/psychology';
import { dispatchKillSwitchTelegram } from '../services/telegramService';

interface PsychologyState {
  riskRules: RiskRuleConfig;
  killSwitch: KillSwitchState;
  zenMode: ZenModeConfig;
  themeConfig: CustomThemeConfig;

  // Actions
  updateRiskRules: (rules: Partial<RiskRuleConfig>) => void;
  triggerLockout: (reason: string, durationMs?: number) => void;
  unlockWithCode: (code: string) => boolean;
  clearExpiredLock: () => void;
  checkRiskTriggers: (sessionRealizedLoss: number, totalTradesToday: number, consecutiveLosses: number) => boolean;

  toggleZenMode: () => void;
  updateZenConfig: (config: Partial<ZenModeConfig>) => void;

  setThemeConfig: (config: Partial<CustomThemeConfig>) => void;
  resetAllPsychology: () => void;
}

const DEFAULT_RISK_RULES: RiskRuleConfig = {
  maxDailyLoss: 500,
  maxDailyTrades: 6,
  maxConsecutiveLosses: 3,
  coolDownDurationMs: 30 * 60 * 1000, // 30 minutes
  propFirmShieldEnabled: true,
  propFirmDailyLossPct: 4.5,
  propFirmMaxDrawdownPct: 9.0,
};

const DEFAULT_KILL_SWITCH: KillSwitchState = {
  isLocked: false,
  lockReason: null,
  lockedUntil: null,
  accountabilityPartnerCode: 'DISCIPLINE_FIRST',
};

const DEFAULT_ZEN_MODE: ZenModeConfig = {
  active: false,
  hidePnlTicker: true,
  softPastelCandles: true,
  breathingGuideActive: true,
};

const DEFAULT_THEME: CustomThemeConfig = {
  wallpaperType: 'SOLID',
  mediaUrl: null,
  overlayOpacity: 0.82,
  accentColor: '#4c8dff',
  fitMode: 'cover',
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  playbackSpeed: 1.0,
};

export const usePsychologyStore = create<PsychologyState>()(
  persist(
    (set, get) => ({
      riskRules: DEFAULT_RISK_RULES,
      killSwitch: DEFAULT_KILL_SWITCH,
      zenMode: DEFAULT_ZEN_MODE,
      themeConfig: DEFAULT_THEME,

      updateRiskRules: (patch) =>
        set((s) => ({ riskRules: { ...s.riskRules, ...patch } })),

      triggerLockout: (reason, durationMs) => {
        const ms = durationMs ?? get().riskRules.coolDownDurationMs;
        const lockedUntil = Date.now() + ms;
        set({
          killSwitch: {
            ...get().killSwitch,
            isLocked: true,
            lockReason: reason,
            lockedUntil,
          },
        });
        dispatchKillSwitchTelegram(reason, lockedUntil);
      },

      unlockWithCode: (code) => {
        const { killSwitch } = get();
        const expected = killSwitch.accountabilityPartnerCode?.trim().toUpperCase();
        if (expected && code.trim().toUpperCase() === expected) {
          set({
            killSwitch: {
              ...killSwitch,
              isLocked: false,
              lockReason: null,
              lockedUntil: null,
            },
          });
          return true;
        }
        return false;
      },

      clearExpiredLock: () => {
        const { killSwitch } = get();
        if (killSwitch.isLocked && killSwitch.lockedUntil && Date.now() >= killSwitch.lockedUntil) {
          set({
            killSwitch: {
              ...killSwitch,
              isLocked: false,
              lockReason: null,
              lockedUntil: null,
            },
          });
        }
      },

      checkRiskTriggers: (sessionRealizedLoss, totalTradesToday, consecutiveLosses) => {
        const { riskRules, killSwitch } = get();
        if (killSwitch.isLocked) return true;

        if (sessionRealizedLoss >= riskRules.maxDailyLoss) {
          get().triggerLockout(
            `Daily loss limit hit: -$${sessionRealizedLoss.toFixed(2)} (Max: -$${riskRules.maxDailyLoss})`
          );
          return true;
        }

        if (totalTradesToday >= riskRules.maxDailyTrades) {
          get().triggerLockout(
            `Session trade velocity cap reached: ${totalTradesToday} trades (Max: ${riskRules.maxDailyTrades})`
          );
          return true;
        }

        if (consecutiveLosses >= riskRules.maxConsecutiveLosses) {
          get().triggerLockout(
            `Consecutive loss streak triggered: ${consecutiveLosses} red trades in a row`
          );
          return true;
        }

        return false;
      },

      toggleZenMode: () =>
        set((s) => ({ zenMode: { ...s.zenMode, active: !s.zenMode.active } })),

      updateZenConfig: (patch) =>
        set((s) => ({ zenMode: { ...s.zenMode, ...patch } })),

      setThemeConfig: (patch) =>
        set((s) => ({ themeConfig: { ...s.themeConfig, ...patch } })),

      resetAllPsychology: () =>
        set({
          riskRules: DEFAULT_RISK_RULES,
          killSwitch: DEFAULT_KILL_SWITCH,
          zenMode: DEFAULT_ZEN_MODE,
          themeConfig: DEFAULT_THEME,
        }),
    }),
    {
      name: 'psychology-store',
      version: 1,
    }
  )
);
