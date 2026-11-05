/**
 * TradingView-Style Multi-Chart Layout & Synchronization Store.
 * Manages grid layouts (1x1, 1x2, 2x1, 2x2), active pane selection,
 * synchronized symbols/timeframes/crosshair/range, saved layout templates,
 * and dark/light theme state.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Timeframe } from '../types/terminal';

export type ChartGridLayout = '1x1' | '1x2' | '2x1' | '2x2';
export type ThemeMode = 'DARK' | 'LIGHT';

export interface PaneConfig {
  paneId: string;
  symbol: string;
  timeframe: Timeframe;
}

export interface SavedLayoutItem {
  id: string;
  name: string;
  createdAt: number;
  layout: ChartGridLayout;
  syncSymbol: boolean;
  syncTimeframe: boolean;
  syncCrosshair: boolean;
  syncRange: boolean;
  panes: Record<string, { symbol: string; timeframe: Timeframe }>;
}

const DEFAULT_PANES: Record<string, PaneConfig> = {
  'pane-1': { paneId: 'pane-1', symbol: 'BTCUSDT', timeframe: '15m' },
  'pane-2': { paneId: 'pane-2', symbol: 'ETHUSDT', timeframe: '1h' },
  'pane-3': { paneId: 'pane-3', symbol: 'SOLUSDT', timeframe: '4h' },
  'pane-4': { paneId: 'pane-4', symbol: 'BNBUSDT', timeframe: '1d' },
};

const DEFAULT_TEMPLATES: SavedLayoutItem[] = [
  {
    id: 'tmpl-single',
    name: 'Single Full Chart',
    createdAt: Date.now(),
    layout: '1x1',
    syncSymbol: false,
    syncTimeframe: false,
    syncCrosshair: true,
    syncRange: false,
    panes: {
      'pane-1': { symbol: 'BTCUSDT', timeframe: '15m' },
    },
  },
  {
    id: 'tmpl-dual-tf',
    name: 'Dual Timeframe (15m + 1h)',
    createdAt: Date.now(),
    layout: '1x2',
    syncSymbol: true,
    syncTimeframe: false,
    syncCrosshair: true,
    syncRange: false,
    panes: {
      'pane-1': { symbol: 'BTCUSDT', timeframe: '15m' },
      'pane-2': { symbol: 'BTCUSDT', timeframe: '1h' },
    },
  },
  {
    id: 'tmpl-quad-tf',
    name: 'Quad Top-Down (5m, 15m, 1h, 1D)',
    createdAt: Date.now(),
    layout: '2x2',
    syncSymbol: true,
    syncTimeframe: false,
    syncCrosshair: true,
    syncRange: false,
    panes: {
      'pane-1': { symbol: 'BTCUSDT', timeframe: '5m' },
      'pane-2': { symbol: 'BTCUSDT', timeframe: '15m' },
      'pane-3': { symbol: 'BTCUSDT', timeframe: '1h' },
      'pane-4': { symbol: 'BTCUSDT', timeframe: '1d' },
    },
  },
  {
    id: 'tmpl-crypto-majors',
    name: 'Quad Crypto Majors (BTC, ETH, SOL, BNB)',
    createdAt: Date.now(),
    layout: '2x2',
    syncSymbol: false,
    syncTimeframe: true,
    syncCrosshair: true,
    syncRange: false,
    panes: {
      'pane-1': { symbol: 'BTCUSDT', timeframe: '15m' },
      'pane-2': { symbol: 'ETHUSDT', timeframe: '15m' },
      'pane-3': { symbol: 'SOLUSDT', timeframe: '15m' },
      'pane-4': { symbol: 'BNBUSDT', timeframe: '15m' },
    },
  },
];

interface LayoutState {
  layout: ChartGridLayout;
  activePaneId: string;
  panes: Record<string, PaneConfig>;
  syncSymbol: boolean;
  syncTimeframe: boolean;
  syncCrosshair: boolean;
  syncRange: boolean;
  isChartMaximized: boolean;
  themeMode: ThemeMode;
  savedLayouts: SavedLayoutItem[];
  activeLayoutId: string | null;

  setLayout: (layout: ChartGridLayout) => void;
  setActivePaneId: (paneId: string) => void;
  setPaneConfig: (paneId: string, patch: Partial<PaneConfig>) => void;
  setPaneSymbol: (paneId: string, symbol: string) => void;
  setPaneTimeframe: (paneId: string, timeframe: Timeframe) => void;
  toggleSync: (key: 'syncSymbol' | 'syncTimeframe' | 'syncCrosshair' | 'syncRange') => void;
  toggleChartMaximized: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  saveCurrentLayout: (name: string) => string;
  loadLayout: (id: string) => void;
  deleteLayout: (id: string) => void;
  renameLayout: (id: string, newName: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      layout: '1x1',
      activePaneId: 'pane-1',
      panes: DEFAULT_PANES,
      syncSymbol: false,
      syncTimeframe: false,
      syncCrosshair: true,
      syncRange: false,
      isChartMaximized: false,
      themeMode: (localStorage.getItem('crt_theme_mode') as ThemeMode) || 'DARK',
      savedLayouts: DEFAULT_TEMPLATES,
      activeLayoutId: null,

      setLayout: (layout) => set({ layout }),

      setActivePaneId: (activePaneId) => set({ activePaneId }),

      setPaneConfig: (paneId, patch) =>
        set((state) => {
          const current = state.panes[paneId] || { paneId, symbol: 'BTCUSDT', timeframe: '15m' };
          const updated = { ...current, ...patch };

          let nextPanes = {
            ...state.panes,
            [paneId]: updated,
          };

          // If syncSymbol is on and symbol changed, propagate to all other panes
          if (state.syncSymbol && patch.symbol) {
            const sym = patch.symbol;
            nextPanes = Object.fromEntries(
              Object.entries(nextPanes).map(([k, v]) => [k, { ...v, symbol: sym }])
            );
          }

          // If syncTimeframe is on and timeframe changed, propagate to all other panes
          if (state.syncTimeframe && patch.timeframe) {
            const tf = patch.timeframe;
            nextPanes = Object.fromEntries(
              Object.entries(nextPanes).map(([k, v]) => [k, { ...v, timeframe: tf }])
            );
          }

          return { panes: nextPanes };
        }),

      setPaneSymbol: (paneId, symbol) => {
        get().setPaneConfig(paneId, { symbol });
      },

      setPaneTimeframe: (paneId, timeframe) => {
        get().setPaneConfig(paneId, { timeframe });
      },

      toggleSync: (key) =>
        set((state) => {
          const nextVal = !state[key];
          let nextPanes = state.panes;

          // If enabling syncSymbol, align all panes to the active pane's symbol
          if (key === 'syncSymbol' && nextVal) {
            const activeSym = state.panes[state.activePaneId]?.symbol || 'BTCUSDT';
            nextPanes = Object.fromEntries(
              Object.entries(nextPanes).map(([k, v]) => [k, { ...v, symbol: activeSym }])
            );
          }

          // If enabling syncTimeframe, align all panes to the active pane's timeframe
          if (key === 'syncTimeframe' && nextVal) {
            const activeTf = state.panes[state.activePaneId]?.timeframe || '15m';
            nextPanes = Object.fromEntries(
              Object.entries(nextPanes).map(([k, v]) => [k, { ...v, timeframe: activeTf }])
            );
          }

          return { [key]: nextVal, panes: nextPanes };
        }),

      toggleChartMaximized: () =>
        set((state) => ({ isChartMaximized: !state.isChartMaximized })),

      setThemeMode: (mode) => {
        try {
          localStorage.setItem('crt_theme_mode', mode);
          if (mode === 'LIGHT') {
            document.documentElement.classList.add('theme-light');
          } else {
            document.documentElement.classList.remove('theme-light');
          }
          window.dispatchEvent(new CustomEvent('crt-theme-change', { detail: { mode } }));
        } catch {}
        set({ themeMode: mode });
      },

      toggleThemeMode: () => {
        const next = get().themeMode === 'DARK' ? 'LIGHT' : 'DARK';
        get().setThemeMode(next);
      },

      saveCurrentLayout: (name) => {
        const id = `layout-${Date.now()}`;
        const s = get();
        const item: SavedLayoutItem = {
          id,
          name: name.trim() || `Layout ${new Date().toLocaleDateString()}`,
          createdAt: Date.now(),
          layout: s.layout,
          syncSymbol: s.syncSymbol,
          syncTimeframe: s.syncTimeframe,
          syncCrosshair: s.syncCrosshair,
          syncRange: s.syncRange,
          panes: Object.fromEntries(
            Object.entries(s.panes).map(([k, v]) => [k, { symbol: v.symbol, timeframe: v.timeframe }])
          ),
        };

        set((state) => ({
          savedLayouts: [item, ...state.savedLayouts],
          activeLayoutId: id,
        }));

        return id;
      },

      loadLayout: (id) => {
        const found = get().savedLayouts.find((l) => l.id === id);
        if (!found) return;

        set((state) => {
          const nextPanes: Record<string, PaneConfig> = { ...state.panes };
          Object.entries(found.panes).forEach(([k, v]) => {
            nextPanes[k] = {
              paneId: k,
              symbol: v.symbol,
              timeframe: v.timeframe,
            };
          });

          return {
            layout: found.layout,
            syncSymbol: found.syncSymbol,
            syncTimeframe: found.syncTimeframe,
            syncCrosshair: found.syncCrosshair,
            syncRange: found.syncRange,
            panes: nextPanes,
            activeLayoutId: id,
          };
        });
      },

      deleteLayout: (id) => {
        set((state) => ({
          savedLayouts: state.savedLayouts.filter((l) => l.id !== id),
          activeLayoutId: state.activeLayoutId === id ? null : state.activeLayoutId,
        }));
      },

      renameLayout: (id, newName) => {
        set((state) => ({
          savedLayouts: state.savedLayouts.map((l) =>
            l.id === id ? { ...l, name: newName.trim() || l.name } : l
          ),
        }));
      },
    }),
    {
      name: 'crt-multi-chart-layout-v1',
      partialize: (s) => ({
        layout: s.layout,
        activePaneId: s.activePaneId,
        panes: s.panes,
        syncSymbol: s.syncSymbol,
        syncTimeframe: s.syncTimeframe,
        syncCrosshair: s.syncCrosshair,
        syncRange: s.syncRange,
        themeMode: s.themeMode,
        savedLayouts: s.savedLayouts,
        activeLayoutId: s.activeLayoutId,
      }),
    }
  )
);
