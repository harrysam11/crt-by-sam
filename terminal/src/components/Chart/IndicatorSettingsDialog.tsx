/**
 * TradingView-Style Indicator Settings Dialog.
 * Provides Inputs, Style, and Visibility tabs.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import type { ActiveIndicatorInstance, IndicatorPlotStyle, InputValueType } from '../../services/indicators/types';
import { INDICATOR_REGISTRY } from '../../services/indicators/registry';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import { audioHaptics } from '../../utils/notify';

const PRESET_COLORS = [
  '#38bdf8', // Cyan
  '#f0b90b', // Gold
  '#22c55e', // Green
  '#ef4444', // Red
  '#c084fc', // Purple
  '#ffffff', // White
  '#f97316', // Orange
  '#14b8a6', // Teal
];

export default function IndicatorSettingsDialog() {
  const selectedInstance = useIndicatorsStore((s) => s.selectedInstanceForSettings);
  const closeSettings = useIndicatorsStore((s) => s.closeSettings);
  const updateInputs = useIndicatorsStore((s) => s.updateInstanceInputs);
  const updateStyles = useIndicatorsStore((s) => s.updateInstanceStyles);

  const [activeTab, setActiveTab] = useState<'inputs' | 'style' | 'visibility'>('inputs');

  if (!selectedInstance) return null;

  const definition = INDICATOR_REGISTRY.find((i) => i.id === selectedInstance.indicatorId);
  if (!definition) return null;

  const handleInputChange = (inputId: string, value: InputValueType) => {
    updateInputs(selectedInstance.instanceId, { [inputId]: value });
  };

  const handleStyleChange = (plotId: string, patch: Partial<IndicatorPlotStyle>) => {
    const curStyle = selectedInstance.styles[plotId];
    if (curStyle) {
      updateStyles(selectedInstance.instanceId, {
        [plotId]: { ...curStyle, ...patch },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-mono">
      <div className="clay-popover w-full max-w-md flex flex-col rounded-[10px] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-4 py-3 bg-panel/90">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">{definition.name}</span>
            <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-slate-800 border border-grid">
              {definition.category}
            </span>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              closeSettings();
            }}
            className="p-1 rounded text-slate-400 hover:text-white transition"
          >
            x
          </button>
        </div>

        {/* Tab Switcher (Inputs / Style / Visibility) */}
        <div className="flex items-center gap-1 border-b border-grid px-4 py-2 bg-panel/50 text-xs">
          <button
            onClick={() => setActiveTab('inputs')}
            className={`px-3 py-1 rounded-lg transition font-medium ${
              activeTab === 'inputs' ? 'clay-btn-active text-accent' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inputs
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`px-3 py-1 rounded-lg transition font-medium ${
              activeTab === 'style' ? 'clay-btn-active text-accent' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Style
          </button>
          <button
            onClick={() => setActiveTab('visibility')}
            className={`px-3 py-1 rounded-lg transition font-medium ${
              activeTab === 'visibility' ? 'clay-btn-active text-accent' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Visibility
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 flex-1 overflow-y-auto max-h-[360px] flex flex-col gap-4 text-xs">
          {/* Inputs Tab */}
          {activeTab === 'inputs' && (
            <div className="flex flex-col gap-3">
              {definition.inputs.length === 0 ? (
                <div className="text-center text-muted py-6">No configurable inputs for this indicator.</div>
              ) : (
                definition.inputs.map((field) => {
                  const currentValue = selectedInstance.inputs[field.id] ?? field.default;

                  return (
                    <div key={field.id} className="flex items-center justify-between gap-4">
                      <label className="text-slate-300 font-medium">{field.label}</label>
                      {field.type === 'number' && (
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          step={field.step || 1}
                          value={Number(currentValue)}
                          onChange={(e) => handleInputChange(field.id, parseFloat(e.target.value) || 0)}
                          className="bg-slate-900 border border-grid px-2.5 py-1 rounded text-right text-white w-24 focus:outline-none focus:border-accent"
                        />
                      )}
                      {field.type === 'boolean' && (
                        <input
                          type="checkbox"
                          checked={Boolean(currentValue)}
                          onChange={(e) => handleInputChange(field.id, e.target.checked)}
                          className="accent-accent h-4 w-4 cursor-pointer"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Style Tab */}
          {activeTab === 'style' && (
            <div className="flex flex-col gap-4">
              {Object.entries(selectedInstance.styles).map(([plotKey, style]) => (
                <div key={plotKey} className="flex flex-col gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-grid/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={style.visible}
                        onChange={(e) => handleStyleChange(plotKey, { visible: e.target.checked })}
                        className="accent-accent h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-200">{style.label}</span>
                    </div>

                    {/* Thickness Selector */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((w) => (
                        <button
                          key={w}
                          onClick={() => handleStyleChange(plotKey, { lineWidth: w })}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            style.lineWidth === w ? 'clay-btn-active font-bold text-white' : 'clay-btn text-muted'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Swatches */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {PRESET_COLORS.map((col) => (
                      <button
                        key={col}
                        onClick={() => handleStyleChange(plotKey, { color: col })}
                        className={`h-4 w-4 rounded-full border transition ${
                          style.color === col ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                    <input
                      type="color"
                      value={style.color}
                      onChange={(e) => handleStyleChange(plotKey, { color: e.target.value })}
                      className="h-4 w-5 bg-transparent cursor-pointer rounded ml-1"
                      title="Custom color"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Visibility Tab */}
          {activeTab === 'visibility' && (
            <div className="flex flex-col gap-2.5">
              <span className="text-slate-400 text-[11px]">Display indicator on the following timeframe groups:</span>
              <div className="grid grid-cols-2 gap-2">
                {['Seconds (1s)', 'Intraday Minutes (1m - 59m)', 'Hours (1h - 4h)', 'Daily / Weekly / Monthly'].map(
                  (tfGroup) => (
                    <label key={tfGroup} className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-grid/50 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-accent h-3.5 w-3.5" />
                      <span className="text-slate-300 text-[11px]">{tfGroup}</span>
                    </label>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid px-4 py-3 bg-panel/90">
          <button
            onClick={() => {
              audioHaptics.tick();
              const defaultInputs: Record<string, InputValueType> = {};
              definition.inputs.forEach((inp) => {
                defaultInputs[inp.id] = inp.default;
              });
              updateInputs(selectedInstance.instanceId, defaultInputs);
              updateStyles(selectedInstance.instanceId, JSON.parse(JSON.stringify(definition.defaultStyles)));
            }}
            className="clay-btn px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            Reset
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              closeSettings();
            }}
            className="clay-btn-active px-4 py-1.5 text-xs font-bold text-accent"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
}
