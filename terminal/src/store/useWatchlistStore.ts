/**
 * TradingView-Style Watchlist Store.
 * Supports:
 * - Color Flags per symbol (Red, Blue, Green, Orange, Purple)
 * - Filtering by color flag or category
 * - Multiple custom watchlists with add/rename/delete
 * - Persistent storage with Zustand
 * ZERO EMOJI POLICY strictly enforced.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WatchlistFlagColor = 'NONE' | 'RED' | 'BLUE' | 'GREEN' | 'ORANGE' | 'PURPLE';
export type WatchlistFlagFilter = WatchlistFlagColor | 'ALL';

export interface WatchlistGroup {
  id: string;
  name: string;
  symbols: string[];
}

export const FLAG_COLORS: Record<WatchlistFlagColor, { label: string; hex: string; bgClass: string; textClass: string }> = {
  NONE: { label: 'No Flag', hex: 'transparent', bgClass: 'bg-zinc-700/30', textClass: 'text-zinc-500' },
  RED: { label: 'Red Flag', hex: '#ef4444', bgClass: 'bg-red-500', textClass: 'text-red-400' },
  BLUE: { label: 'Blue Flag', hex: '#3b82f6', bgClass: 'bg-blue-500', textClass: 'text-blue-400' },
  GREEN: { label: 'Green Flag', hex: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-emerald-400' },
  ORANGE: { label: 'Orange Flag', hex: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-400' },
  PURPLE: { label: 'Purple Flag', hex: '#a855f7', bgClass: 'bg-purple-500', textClass: 'text-purple-400' },
};

const DEFAULT_WATCHLISTS: WatchlistGroup[] = [
  {
    id: 'list-main',
    name: 'Main Watchlist',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'RELIANCE.NS', '^NSEI', 'XAUUSD', 'EURUSD=X', 'AAPL', 'NVDA'],
  },
  {
    id: 'list-crypto',
    name: 'Crypto Majors',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT'],
  },
  {
    id: 'list-forex-commodities',
    name: 'Forex & Commodities',
    symbols: ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'XAUUSD', 'CL=F', 'SI=F'],
  },
  {
    id: 'list-india',
    name: 'Indian Equities & F&O',
    symbols: ['^NSEI', '^NSEBANK', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'TATAMOTORS.NS'],
  },
  {
    id: 'list-us-tech',
    name: 'US Tech Leaders',
    symbols: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META'],
  },
];

interface WatchlistState {
  lists: WatchlistGroup[];
  activeListId: string;
  flags: Record<string, WatchlistFlagColor>;
  flagFilter: WatchlistFlagFilter;

  setFlag: (symbol: string, color: WatchlistFlagColor) => void;
  cycleFlag: (symbol: string) => void;
  clearAllFlags: () => void;
  setActiveList: (listId: string) => void;
  createList: (name: string, initialSymbols?: string[]) => string;
  deleteList: (listId: string) => void;
  renameList: (listId: string, name: string) => void;
  addSymbolToList: (listId: string, symbol: string) => void;
  removeSymbolFromList: (listId: string, symbol: string) => void;
  setFlagFilter: (filter: WatchlistFlagFilter) => void;
}

const CYCLE_ORDER: WatchlistFlagColor[] = ['NONE', 'RED', 'BLUE', 'GREEN', 'ORANGE', 'PURPLE'];

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      lists: DEFAULT_WATCHLISTS,
      activeListId: 'list-main',
      flags: {
        BTCUSDT: 'RED',
        ETHUSDT: 'BLUE',
        'RELIANCE.NS': 'GREEN',
        XAUUSD: 'ORANGE',
      },
      flagFilter: 'ALL',

      setFlag: (symbol, color) =>
        set((state) => ({
          flags: {
            ...state.flags,
            [symbol]: color,
          },
        })),

      cycleFlag: (symbol) => {
        const current = get().flags[symbol] || 'NONE';
        const currentIndex = CYCLE_ORDER.indexOf(current);
        const next = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
        get().setFlag(symbol, next);
      },

      clearAllFlags: () => set({ flags: {} }),

      setActiveList: (activeListId) => set({ activeListId }),

      createList: (name, initialSymbols = []) => {
        const id = `list-${Date.now()}`;
        const newList: WatchlistGroup = {
          id,
          name: name.trim() || 'New Watchlist',
          symbols: initialSymbols,
        };
        set((state) => ({
          lists: [...state.lists, newList],
          activeListId: id,
        }));
        return id;
      },

      deleteList: (listId) => {
        set((state) => {
          const remaining = state.lists.filter((l) => l.id !== listId);
          if (!remaining.length) return state;
          return {
            lists: remaining,
            activeListId: state.activeListId === listId ? remaining[0].id : state.activeListId,
          };
        });
      },

      renameList: (listId, name) => {
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === listId ? { ...l, name: name.trim() || l.name } : l
          ),
        }));
      },

      addSymbolToList: (listId, symbol) => {
        set((state) => ({
          lists: state.lists.map((l) => {
            if (l.id !== listId) return l;
            if (l.symbols.includes(symbol)) return l;
            return { ...l, symbols: [...l.symbols, symbol] };
          }),
        }));
      },

      removeSymbolFromList: (listId, symbol) => {
        set((state) => ({
          lists: state.lists.map((l) => {
            if (l.id !== listId) return l;
            return { ...l, symbols: l.symbols.filter((s) => s !== symbol) };
          }),
        }));
      },

      setFlagFilter: (flagFilter) => set({ flagFilter }),
    }),
    {
      name: 'crt-watchlist-store-v1',
      partialize: (s) => ({
        lists: s.lists,
        activeListId: s.activeListId,
        flags: s.flags,
        flagFilter: s.flagFilter,
      }),
    }
  )
);
