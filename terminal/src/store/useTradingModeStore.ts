/**
 * Trading Mode Store — Paper vs Live gateway selection.
 * Paper: all orders are simulated by the internal paper engine.
 * Live: orders would route to a connected broker API (future integration hook).
 * ZERO EMOJI POLICY strictly enforced.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradingMode = 'PAPER' | 'LIVE';

export interface BrokerProfile {
  id: string;
  name: string;
  exchange: string; // 'delta' | 'binance' | 'zerodha' | 'custom'
  apiKeyMasked: string; // only last 4 chars shown
  connected: boolean;
}

interface TradingModeState {
  mode: TradingMode;
  brokerProfiles: BrokerProfile[];
  activeBrokerId: string | null;
  confirmationRequired: boolean; // ask before switching to LIVE

  setMode: (mode: TradingMode) => void;
  toggleMode: () => void;
  addBrokerProfile: (profile: Omit<BrokerProfile, 'id'>) => string;
  removeBrokerProfile: (id: string) => void;
  setActiveBroker: (id: string | null) => void;
  setConfirmationRequired: (v: boolean) => void;
}

export const useTradingModeStore = create<TradingModeState>()(
  persist(
    (set, get) => ({
      mode: 'PAPER',
      brokerProfiles: [],
      activeBrokerId: null,
      confirmationRequired: true,

      setMode: (mode) => set({ mode }),

      toggleMode: () => {
        const next = get().mode === 'PAPER' ? 'LIVE' : 'PAPER';
        set({ mode: next });
      },

      addBrokerProfile: (profile) => {
        const id = `broker-${Date.now()}`;
        set((s) => ({
          brokerProfiles: [...s.brokerProfiles, { ...profile, id }],
        }));
        return id;
      },

      removeBrokerProfile: (id) =>
        set((s) => ({
          brokerProfiles: s.brokerProfiles.filter((p) => p.id !== id),
          activeBrokerId: s.activeBrokerId === id ? null : s.activeBrokerId,
        })),

      setActiveBroker: (activeBrokerId) => set({ activeBrokerId }),

      setConfirmationRequired: (confirmationRequired) => set({ confirmationRequired }),
    }),
    {
      name: 'crt-trading-mode-v1',
      partialize: (s) => ({
        mode: s.mode,
        brokerProfiles: s.brokerProfiles,
        activeBrokerId: s.activeBrokerId,
        confirmationRequired: s.confirmationRequired,
      }),
    }
  )
);
