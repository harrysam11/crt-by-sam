/**
 * TradingView Chart Settings Modal.
 * Full customization for Symbol, Status Line, Scales, Canvas appearance, and In-Chart Trading.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { audioHaptics } from '../../utils/notify';

export interface ChartSettingsState {
  candleUpColor: string;
  candleDownColor: string;
  showLastPriceLine: boolean;
  showHighLowLines: boolean;
  showOhlcValues: boolean;
  showBarChangePercent: boolean;
  showVolumeMetric: boolean;
  priceScalePosition: 'right' | 'left';
  showCountdownTimer: boolean;
  gridLines: 'both' | 'horizontal' | 'vertical' | 'none';
  gridOpacity: number;
  crosshairStyle: 'dashed' | 'dotted' | 'solid';
  showWatermark: boolean;
  watermarkText: string;
  showPositionsOnChart: boolean;
  showOrdersOnChart: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettingsState = {
  candleUpColor: '#26a69a',
  candleDownColor: '#ef5350',
  showLastPriceLine: true,
  showHighLowLines: false,
  showOhlcValues: true,
  showBarChangePercent: true,
  showVolumeMetric: true,
  priceScalePosition: 'right',
  showCountdownTimer: true,
  gridLines: 'both',
  gridOpacity: 0.08,
  crosshairStyle: 'dashed',
  showWatermark: true,
  watermarkText: 'CRT TERMINAL',
  showPositionsOnChart: true,
  showOrdersOnChart: true,
};

interface ChartSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChartSettingsState;
  onUpdateSettings: (patch: Partial<ChartSettingsState>) => void;
  onResetDefaults: () => void;
}

export default function ChartSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetDefaults,
}: ChartSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'SYMBOL' | 'STATUS_LINE' | 'SCALES' | 'CANVAS' | 'TRADING'>('SYMBOL');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none">
      <div className="flex h-[520px] w-full max-w-2xl flex-col rounded-2xl border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 bg-panel/90">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-sm font-semibold text-white">Chart Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selector & Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-44 border-r border-grid bg-panel/40 p-2 space-y-1 text-xs">
            {[
              { id: 'SYMBOL', label: 'Symbol' },
              { id: 'STATUS_LINE', label: 'Status line' },
              { id: 'SCALES', label: 'Scales' },
              { id: 'CANVAS', label: 'Canvas' },
              { id: 'TRADING', label: 'Trading' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  audioHaptics.tick();
                  setActiveTab(t.id as any);
                }}
                className={`w-full px-3 py-2 rounded-lg text-left transition ${
                  activeTab === t.id
                    ? 'bg-accent/15 text-accent font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content Pane */}
          <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-300 space-y-4">
            {activeTab === 'SYMBOL' && (
              <div className="space-y-4">
                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400">
                  Candlestick Palette
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-2 rounded-lg border border-grid bg-panel/50">
                    <span>Up / Bullish Candle</span>
                    <input
                      type="color"
                      value={settings.candleUpColor}
                      onChange={(e) => onUpdateSettings({ candleUpColor: e.target.value })}
                      className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border border-grid bg-panel/50">
                    <span>Down / Bearish Candle</span>
                    <input
                      type="color"
                      value={settings.candleDownColor}
                      onChange={(e) => onUpdateSettings({ candleDownColor: e.target.value })}
                      className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                  </div>
                </div>

                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400 pt-2">
                  Price Lines
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showLastPriceLine}
                    onChange={(e) => onUpdateSettings({ showLastPriceLine: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Last Price Line</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showHighLowLines}
                    onChange={(e) => onUpdateSettings({ showHighLowLines: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>High and Low Price Lines</span>
                </label>
              </div>
            )}

            {activeTab === 'STATUS_LINE' && (
              <div className="space-y-4">
                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400">
                  Top Header Overlay
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showOhlcValues}
                    onChange={(e) => onUpdateSettings({ showOhlcValues: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>OHLC Values (Open, High, Low, Close)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showBarChangePercent}
                    onChange={(e) => onUpdateSettings({ showBarChangePercent: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Bar Change Values (Delta and %)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showVolumeMetric}
                    onChange={(e) => onUpdateSettings({ showVolumeMetric: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Bar Volume Metric</span>
                </label>
              </div>
            )}

            {activeTab === 'SCALES' && (
              <div className="space-y-4">
                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400">
                  Price & Time Scales
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-grid bg-panel/50">
                  <span>Price Scale Placement</span>
                  <select
                    value={settings.priceScalePosition}
                    onChange={(e) => onUpdateSettings({ priceScalePosition: e.target.value as any })}
                    className="rounded bg-slate-800 border border-grid px-2 py-1 text-white"
                  >
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showCountdownTimer}
                    onChange={(e) => onUpdateSettings({ showCountdownTimer: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Countdown to Bar Close Timer</span>
                </label>
              </div>
            )}

            {activeTab === 'CANVAS' && (
              <div className="space-y-4">
                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400">
                  Canvas Appearance
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-grid bg-panel/50">
                  <span>Grid Lines</span>
                  <select
                    value={settings.gridLines}
                    onChange={(e) => onUpdateSettings({ gridLines: e.target.value as any })}
                    className="rounded bg-slate-800 border border-grid px-2 py-1 text-white"
                  >
                    <option value="both">Both (Horiz & Vert)</option>
                    <option value="horizontal">Horizontal Only</option>
                    <option value="vertical">Vertical Only</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-grid bg-panel/50">
                  <span>Crosshair Style</span>
                  <select
                    value={settings.crosshairStyle}
                    onChange={(e) => onUpdateSettings({ crosshairStyle: e.target.value as any })}
                    className="rounded bg-slate-800 border border-grid px-2 py-1 text-white"
                  >
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="solid">Solid</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showWatermark}
                    onChange={(e) => onUpdateSettings({ showWatermark: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Background Watermark</span>
                </label>
              </div>
            )}

            {activeTab === 'TRADING' && (
              <div className="space-y-4">
                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400">
                  In-Chart Execution & Levels
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPositionsOnChart}
                    onChange={(e) => onUpdateSettings({ showPositionsOnChart: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Show Open Positions & Live PnL Line</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showOrdersOnChart}
                    onChange={(e) => onUpdateSettings({ showOrdersOnChart: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Show Pending Limit & Stop Orders on Canvas</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid px-5 py-3 bg-panel/90 text-xs">
          <button
            onClick={() => {
              audioHaptics.tick();
              onResetDefaults();
            }}
            className="text-slate-400 hover:text-white transition underline"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-1.5 font-bold text-black hover:opacity-90 transition"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
}
