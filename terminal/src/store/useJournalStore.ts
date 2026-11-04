import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JournalEntry } from '../types/psychology';

interface JournalStoreState {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  isModalOpen: boolean;
  filterEmotion: 'ALL' | JournalEntry['emotionTag'];
  filterSymbol: string | null;

  addEntry: (entry: Omit<JournalEntry, 'id'>) => JournalEntry;
  updateEntry: (id: string, patch: Partial<JournalEntry>) => void;
  deleteEntry: (id: string) => void;
  openJournalModal: (entryId?: string) => void;
  closeJournalModal: () => void;
  setFilterEmotion: (tag: 'ALL' | JournalEntry['emotionTag']) => void;
  setFilterSymbol: (symbol: string | null) => void;
  clearAllEntries: () => void;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const useJournalStore = create<JournalStoreState>()(
  persist(
    (set, get) => ({
      entries: [],
      selectedEntryId: null,
      isModalOpen: false,
      filterEmotion: 'ALL',
      filterSymbol: null,

      addEntry: (data) => {
        const newEntry: JournalEntry = {
          ...data,
          id: uid(),
        };
        set((s) => ({
          entries: [newEntry, ...s.entries].slice(0, 500),
        }));
        return newEntry;
      },

      updateEntry: (id, patch) => {
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
      },

      deleteEntry: (id) => {
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
          selectedEntryId: s.selectedEntryId === id ? null : s.selectedEntryId,
        }));
      },

      openJournalModal: (entryId) => {
        set({
          isModalOpen: true,
          selectedEntryId: entryId ?? (get().entries[0]?.id || null),
        });
      },

      closeJournalModal: () => {
        set({ isModalOpen: false, selectedEntryId: null });
      },

      setFilterEmotion: (filterEmotion) => set({ filterEmotion }),
      setFilterSymbol: (filterSymbol) => set({ filterSymbol }),

      clearAllEntries: () => set({ entries: [], selectedEntryId: null }),
    }),
    {
      name: 'trade-journal-store',
      version: 1,
    }
  )
);
