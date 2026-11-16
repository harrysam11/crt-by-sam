import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActiveIndicatorInstance,
  IndicatorPlotStyle,
  InputValueType,
} from '../services/indicators/types';
import { INDICATOR_REGISTRY } from '../services/indicators/registry';
import {
  type IndicatorTemplate,
  buildInstancesFromTemplate,
} from '../services/indicators/templates';

interface IndicatorsState {
  activeInstances: ActiveIndicatorInstance[];
  favorites: string[];
  customTemplates: IndicatorTemplate[];
  selectedInstanceForSettings: ActiveIndicatorInstance | null;

  addInstance: (indicatorId: string) => ActiveIndicatorInstance | null;
  removeInstance: (instanceId: string) => void;
  clearAllInstances: () => void;
  toggleVisibility: (instanceId: string) => void;
  updateInstanceInputs: (instanceId: string, inputs: Record<string, InputValueType>) => void;
  updateInstanceStyles: (instanceId: string, styles: Record<string, IndicatorPlotStyle>) => void;
  toggleFavorite: (indicatorId: string) => void;
  applyTemplate: (template: IndicatorTemplate, replaceExisting?: boolean) => void;
  saveCurrentAsTemplate: (name: string, description?: string) => IndicatorTemplate | null;
  deleteCustomTemplate: (templateId: string) => void;
  openSettings: (instance: ActiveIndicatorInstance) => void;
  closeSettings: () => void;
}

const DEFAULT_INSTANCES: ActiveIndicatorInstance[] = [];

export const useIndicatorsStore = create<IndicatorsState>()(
  persist(
    (set, get) => ({
      activeInstances: DEFAULT_INSTANCES,
      favorites: ['ema', 'sma', 'rsi', 'macd', 'bbands', 'supertrend'],
      customTemplates: [],
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

      applyTemplate: (template: IndicatorTemplate, replaceExisting = true) => {
        const curPanes = replaceExisting
          ? 1
          : Math.max(
              1,
              ...get()
                .activeInstances.filter((i) => !i.overlay)
                .map((i) => i.paneIndex + 1)
            );
        const newInstances = buildInstancesFromTemplate(template.indicators, curPanes);
        set((s) => ({
          activeInstances: replaceExisting
            ? newInstances
            : [...s.activeInstances, ...newInstances],
          selectedInstanceForSettings: null,
        }));
      },

      saveCurrentAsTemplate: (name: string, description = '') => {
        const active = get().activeInstances;
        if (active.length === 0) return null;

        const newTemplate: IndicatorTemplate = {
          id: `custom_tmpl_${Date.now()}`,
          name: name.trim() || 'Custom Indicator Set',
          description: description.trim() || `${active.length} active indicators stack`,
          isBuiltIn: false,
          category: 'CUSTOM',
          indicators: active.map((inst) => ({
            indicatorId: inst.indicatorId,
            name: inst.name,
            inputs: { ...inst.inputs },
            styles: JSON.parse(JSON.stringify(inst.styles)),
          })),
        };

        set((s) => ({
          customTemplates: [newTemplate, ...s.customTemplates],
        }));

        return newTemplate;
      },

      deleteCustomTemplate: (templateId: string) => {
        set((s) => ({
          customTemplates: s.customTemplates.filter((t) => t.id !== templateId),
        }));
      },

      openSettings: (instance) => set({ selectedInstanceForSettings: instance }),
      closeSettings: () => set({ selectedInstanceForSettings: null }),
    }),
    {
      name: 'crt_indicator_instances',
      partialize: (s) => ({
        activeInstances: s.activeInstances,
        favorites: s.favorites,
        customTemplates: s.customTemplates,
      }),
    }
  )
);
