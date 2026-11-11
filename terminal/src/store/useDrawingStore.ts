import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ToolType, MagnetConfig, DrawingItem } from '../components/drawing/types';

interface DrawingState {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  stayInDrawingMode: boolean;
  toggleStayInDrawingMode: () => void;
  setStayInDrawingMode: (v: boolean) => void;

  floatingToolbarPos: { x: number; y: number };
  setFloatingToolbarPos: (pos: { x: number; y: number }) => void;

  selectedDrawingIds: string[];
  setSelectedDrawingIds: (ids: string[]) => void;
  toggleSelectDrawingId: (id: string, multi?: boolean) => void;

  favorites: ToolType[];
  toggleFavorite: (tool: ToolType) => void;
  isFavorite: (tool: ToolType) => boolean;

  isFavoritesBarVisible: boolean;
  toggleFavoritesBar: () => void;
  setFavoritesBarVisible: (visible: boolean) => void;

  magnetConfig: MagnetConfig;
  toggleMagnet: () => void;
  setMagnetConfig: (cfg: Partial<MagnetConfig>) => void;

  isLockedAll: boolean;
  toggleLockAll: () => void;

  isHiddenAll: boolean;
  toggleHideAll: () => void;

  drawingsCount: number;
  setDrawingsCount: (count: number) => void;

  templates: Record<string, Partial<DrawingItem>>;
  saveTemplate: (name: string, template: Partial<DrawingItem>) => void;
  deleteTemplate: (name: string) => void;
}

const DEFAULT_FAVORITES: ToolType[] = [
  'TRENDLINE',
  'HORIZONTAL_LINE',
  'FIBONACCI',
  'RECTANGLE',
  'MEASURE_RULER',
  'POSITION_LONG',
];

export const useDrawingStore = create<DrawingState>()(
  persist(
    (set, get) => ({
      activeTool: 'CURSOR_CROSSHAIR',
      setActiveTool: (tool) => set({ activeTool: tool }),

      stayInDrawingMode: false,
      toggleStayInDrawingMode: () => set((s) => ({ stayInDrawingMode: !s.stayInDrawingMode })),
      setStayInDrawingMode: (v) => set({ stayInDrawingMode: v }),

      floatingToolbarPos: { x: 72, y: 520 },
      setFloatingToolbarPos: (pos) => set({ floatingToolbarPos: pos }),

      selectedDrawingIds: [],
      setSelectedDrawingIds: (ids) => set({ selectedDrawingIds: ids }),
      toggleSelectDrawingId: (id, multi = false) =>
        set((s) => {
          if (!multi) {
            return { selectedDrawingIds: s.selectedDrawingIds.includes(id) ? [] : [id] };
          }
          const exists = s.selectedDrawingIds.includes(id);
          return {
            selectedDrawingIds: exists
              ? s.selectedDrawingIds.filter((item) => item !== id)
              : [...s.selectedDrawingIds, id],
          };
        }),

      favorites: DEFAULT_FAVORITES,
      toggleFavorite: (tool) => {
        const cur = get().favorites;
        const exists = cur.includes(tool);
        set({
          favorites: exists ? cur.filter((t) => t !== tool) : [...cur, tool],
        });
      },
      isFavorite: (tool) => get().favorites.includes(tool),

      isFavoritesBarVisible: true,
      toggleFavoritesBar: () => set((s) => ({ isFavoritesBarVisible: !s.isFavoritesBarVisible })),
      setFavoritesBarVisible: (visible) => set({ isFavoritesBarVisible: visible }),

      magnetConfig: { enabled: false, mode: 'WEAK' },
      toggleMagnet: () =>
        set((s) => ({
          magnetConfig: { ...s.magnetConfig, enabled: !s.magnetConfig.enabled },
        })),
      setMagnetConfig: (cfg) =>
        set((s) => ({ magnetConfig: { ...s.magnetConfig, ...cfg } })),

      isLockedAll: false,
      toggleLockAll: () => set((s) => ({ isLockedAll: !s.isLockedAll })),

      isHiddenAll: false,
      toggleHideAll: () => set((s) => ({ isHiddenAll: !s.isHiddenAll })),

      drawingsCount: 0,
      setDrawingsCount: (count) => set({ drawingsCount: count }),

      templates: {},
      saveTemplate: (name, template) =>
        set((s) => ({
          templates: { ...s.templates, [name]: template },
        })),
      deleteTemplate: (name) =>
        set((s) => {
          const next = { ...s.templates };
          delete next[name];
          return { templates: next };
        }),
    }),
    {
      name: 'crt_drawing_settings',
      partialize: (state) => ({
        favorites: state.favorites,
        isFavoritesBarVisible: state.isFavoritesBarVisible,
        floatingToolbarPos: state.floatingToolbarPos,
        stayInDrawingMode: state.stayInDrawingMode,
        magnetConfig: state.magnetConfig,
        templates: state.templates,
      }),
    }
  )
);
