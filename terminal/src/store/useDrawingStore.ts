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

  drawingContextBarPos: { x: number; y: number };
  setDrawingContextBarPos: (pos: { x: number; y: number }) => void;

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

  activeSymbolDrawings: DrawingItem[];
  setActiveSymbolDrawings: (drawings: DrawingItem[]) => void;

  activeCandleOhlc: {
    time?: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  } | null;
  setActiveCandleOhlc: (
    ohlc: {
      time?: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    } | null
  ) => void;

  activeIndicatorsTelemetry: Array<{
    id: string;
    name: string;
    color: string;
    value?: string | number | null;
  }>;
  setActiveIndicatorsTelemetry: (
    telemetry: Array<{
      id: string;
      name: string;
      color: string;
      value?: string | number | null;
    }>
  ) => void;

  isLegendHudVisible: boolean;
  setIsLegendHudVisible: (v: boolean) => void;
  toggleLegendHud: () => void;

  activeRightDrawer:
    | 'WATCHLIST'
    | 'DOM'
    | 'TRADE'
    | 'ANALYTICS'
    | 'OBJECT_TREE'
    | 'DATA_WINDOW'
    | null;
  setActiveRightDrawer: (
    drawer:
      | 'WATCHLIST'
      | 'DOM'
      | 'TRADE'
      | 'ANALYTICS'
      | 'OBJECT_TREE'
      | 'DATA_WINDOW'
      | null
      | ((
          prev:
            | 'WATCHLIST'
            | 'DOM'
            | 'TRADE'
            | 'ANALYTICS'
            | 'OBJECT_TREE'
            | 'DATA_WINDOW'
            | null
        ) =>
          | 'WATCHLIST'
          | 'DOM'
          | 'TRADE'
          | 'ANALYTICS'
          | 'OBJECT_TREE'
          | 'DATA_WINDOW'
          | null)
  ) => void;

  editingDrawingModalItem: DrawingItem | null;
  setEditingDrawingModalItem: (item: DrawingItem | null) => void;

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

      floatingToolbarPos: { x: 80, y: 120 },
      setFloatingToolbarPos: (pos) => set({ floatingToolbarPos: pos }),

      drawingContextBarPos: { x: 280, y: 65 },
      setDrawingContextBarPos: (pos) => set({ drawingContextBarPos: pos }),

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

      activeSymbolDrawings: [],
      setActiveSymbolDrawings: (drawings) => set({ activeSymbolDrawings: drawings }),

      activeCandleOhlc: null,
      setActiveCandleOhlc: (ohlc) => set({ activeCandleOhlc: ohlc }),

      activeIndicatorsTelemetry: [],
      setActiveIndicatorsTelemetry: (telemetry) => set({ activeIndicatorsTelemetry: telemetry }),

      isLegendHudVisible: true,
      setIsLegendHudVisible: (v) => set({ isLegendHudVisible: v }),
      toggleLegendHud: () => set((s) => ({ isLegendHudVisible: !s.isLegendHudVisible })),

      activeRightDrawer: 'WATCHLIST',
      setActiveRightDrawer: (drawerOrUpdater) =>
        set((s) => ({
          activeRightDrawer:
            typeof drawerOrUpdater === 'function'
              ? drawerOrUpdater(s.activeRightDrawer)
              : drawerOrUpdater,
        })),

      editingDrawingModalItem: null,
      setEditingDrawingModalItem: (item) => set({ editingDrawingModalItem: item }),

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
        drawingContextBarPos: state.drawingContextBarPos,
        stayInDrawingMode: state.stayInDrawingMode,
        magnetConfig: state.magnetConfig,
        templates: state.templates,
        isLegendHudVisible: state.isLegendHudVisible,
      }),
    }
  )
);
