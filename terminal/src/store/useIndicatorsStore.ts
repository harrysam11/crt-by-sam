import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActiveIndicatorInstance,
  IndicatorPlotStyle,
  InputValueType,
} from '../services/indicators/types';
import { INDICATOR_REGISTRY } from '../services/indicators/registry';

interface IndicatorsState {
  activeInstances: ActiveIndicatorInstance[];
  favorites: string[];
  selectedInstanceForSettings: ActiveIndicatorInstance | null;

  addInstance: (indicatorId: string) => ActiveIndicatorInstance | null;
  removeInstance: (instanceId: string) => void;
  clearAllInstances: () => void;
  toggleVisibility: (instanceId: string) => void;
  updateInstanceInputs: (instanceId: string, inputs: Record<string, InputValueType>) => void;
  updateInstanceStyles: (instanceId: string, styles: Record<string, IndicatorPlotStyle>) => void;
  toggleFavorite: (indicatorId: string) => void;
  openSettings: (instance: ActiveIndicatorInstance) => void;
  closeSettings: () => void;
}

const DEFAULT_INSTANCES: ActiveIndicatorInstance[] = [];

export const useIndicatorsStore = create<IndicatorsState>()(
  persist(
    (set, get) => ({
      activeInstances: DEFAULT_INSTANCES,
      favorites: ['ema', 'sma', 'rsi', 'macd', 'bbands', 'supertrend'],
      selectedInstanceForSettings: null,

      addInstance: (indicatorId: string) => {
        const def = INDICATOR_REGISTRY.find((i) => i.id === indicatorId);
        if (!def) return null;

        const defaultInputs: Record<string, InputValueType> = {};
        def.inputs.forEach((inp) => {
          defaultInputs[inp.id] = inp.default;
        });

        // Determine pane index
        const currentPanes = get()
          .activeInstances.filter((inst) => !inst.overlay)
          .map((inst) => inst.paneIndex);
        const nextPaneIndex = def.overlay
          ? 0
          : currentPanes.length > 0
          ? Math.max(...currentPanes) + 1
          : 1;

        const newInstance: ActiveIndicatorInstance = {
          instanceId: `inst_${indicatorId}_${Date.now()}`,
          indicatorId: def.id,
          name: `${def.shortName}`,
          overlay: def.overlay,
          inputs: defaultInputs,
          styles: JSON.parse(JSON.stringify(def.defaultStyles)),
          visible: true,
          paneIndex: nextPaneIndex,
        };

        set((s) => ({
          activeInstances: [...s.activeInstances, newInstance],
        }));

        return newInstance;
      },

      removeInstance: (instanceId: string) =>
        set((s) => ({
          activeInstances: s.activeInstances.filter((inst) => inst.instanceId !== instanceId),
          selectedInstanceForSettings:
            s.selectedInstanceForSettings?.instanceId === instanceId
              ? null
              : s.selectedInstanceForSettings,
        })),

      clearAllInstances: () =>
        set(() => ({
          activeInstances: [],
          selectedInstanceForSettings: null,
        })),

      toggleVisibility: (instanceId: string) =>
        set((s) => ({
          activeInstances: s.activeInstances.map((inst) =>
            inst.instanceId === instanceId ? { ...inst, visible: !inst.visible } : inst
          ),
        })),

      updateInstanceInputs: (instanceId, inputs) =>
        set((s) => ({
          activeInstances: s.activeInstances.map((inst) =>
            inst.instanceId === instanceId ? { ...inst, inputs: { ...inst.inputs, ...inputs } } : inst
          ),
          selectedInstanceForSettings:
            s.selectedInstanceForSettings?.instanceId === instanceId
              ? {
                  ...s.selectedInstanceForSettings,
                  inputs: { ...s.selectedInstanceForSettings.inputs, ...inputs },
                }
              : s.selectedInstanceForSettings,
        })),

      updateInstanceStyles: (instanceId, styles) =>
        set((s) => ({
          activeInstances: s.activeInstances.map((inst) =>
            inst.instanceId === instanceId ? { ...inst, styles: { ...inst.styles, ...styles } } : inst
          ),
          selectedInstanceForSettings:
            s.selectedInstanceForSettings?.instanceId === instanceId
              ? {
                  ...s.selectedInstanceForSettings,
                  styles: { ...s.selectedInstanceForSettings.styles, ...styles },
                }
              : s.selectedInstanceForSettings,
        })),

      toggleFavorite: (indicatorId: string) => {
        const cur = get().favorites;
        const exists = cur.includes(indicatorId);
        set({
          favorites: exists ? cur.filter((id) => id !== indicatorId) : [...cur, indicatorId],
        });
      },

      openSettings: (instance) => set({ selectedInstanceForSettings: instance }),
      closeSettings: () => set({ selectedInstanceForSettings: null }),
    }),
    {
      name: 'crt_indicator_instances',
      partialize: (s) => ({
        activeInstances: s.activeInstances,
        favorites: s.favorites,
      }),
    }
  )
);
