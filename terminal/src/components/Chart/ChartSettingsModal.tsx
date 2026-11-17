/**
 * TradingView Chart Settings Modal.
 * Full customization for Symbol (Body, Borders, Wicks), Status Line, Scales (Margins, Timezone),
 * Canvas appearance, and In-Chart Executions & Events.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { audioHaptics } from '../../utils/notify';

export interface ChartSettingsState {
  candleBodyVisible: boolean;
  candleUpColor: string;
  candleDownColor: string;
  candleBorderVisible: boolean;
  borderUpColor: string;
  borderDownColor: string;
  candleWickVisible: boolean;
  wickUpColor: string;
  wickDownColor: string;
  showLastPriceLine: boolean;
  showHighLowLines: boolean;
  showOhlcValues: boolean;
  showBarChangePercent: boolean;
  showVolumeMetric: boolean;
  priceScalePosition: 'right' | 'left';
  showCountdownTimer: boolean;
  topMarginPercent: number;
  bottomMarginPercent: number;
  timezone: string;
  gridLines: 'both' | 'horizontal' | 'vertical' | 'none';
  gridOpacity: number;
  crosshairStyle: 'dashed' | 'dotted' | 'solid';
  showWatermark: boolean;
  watermarkText: string;
  showPositionsOnChart: boolean;
  showOrdersOnChart: boolean;
  showExecutionsOnChart: boolean;
  showEventsOnChart: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettingsState = {
  candleBodyVisible: true,
  candleUpColor: '#ffffff',
  candleDownColor: '#101015',
  candleBorderVisible: true,
  borderUpColor: '#ffffff',
  borderDownColor: '#71717a',
  candleWickVisible: true,
  wickUpColor: '#ffffff',
  wickDownColor: '#71717a',
  showLastPriceLine: true,
  showHighLowLines: false,
  showOhlcValues: true,
  showBarChangePercent: true,
  showVolumeMetric: false,
  priceScalePosition: 'right',
  showCountdownTimer: true,
  topMarginPercent: 8,
  bottomMarginPercent: 12,
  timezone: 'UTC',
  gridLines: 'both',
  gridOpacity: 0.08,
  crosshairStyle: 'dashed',
  showWatermark: true,
  watermarkText: 'CRT TERMINAL',
  showPositionsOnChart: true,
  showOrdersOnChart: true,
  showExecutionsOnChart: true,
  showEventsOnChart: true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono select-none">
      <div className="clay-modal flex h-[540px] w-full max-w-2xl flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid/50 px-5 py-3.5 bg-panel/90">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-sm font-bold text-white tracking-wide">Chart Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="clay-btn h-7 w-7 text-muted hover:text-white"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selector & Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-44 border-r border-grid/50 bg-[#09090d]/60 p-2 space-y-1.5 text-xs">
            {[
              { id: 'SYMBOL', label: 'Symbol' },
              { id: 'STATUS_LINE', label: 'Status line' },
              { id: 'SCALES', label: 'Scales & Margins' },
              { id: 'CANVAS', label: 'Canvas' },
              { id: 'TRADING', label: 'Trading & Events' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  audioHaptics.tick();
                  setActiveTab(t.id as any);
                }}
                className={`w-full px-3 py-2 text-left transition rounded-md ${
                  activeTab === t.id
                    ? 'clay-pill-active font-bold'
                    : 'clay-pill text-muted hover:text-white'
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
                  Candlestick Body, Border & Wick Appearance
                </div>

                {/* Candle Body */}
                <div className="p-3 rounded-lg border border-grid bg-panel/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={settings.candleBodyVisible !== false}
                        onChange={(e) => onUpdateSettings({ candleBodyVisible: e.target.checked })}
                        className="rounded border-grid text-accent focus:ring-0"
                      />
                      <span>Candle Body</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                      <span className="text-[11px] text-slate-400">Up Body</span>
                      <input
                        type="color"
                        value={settings.candleUpColor || '#ffffff'}
                        onChange={(e) => onUpdateSettings({ candleUpColor: e.target.value })}
                        className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                      <span className="text-[11px] text-slate-400">Down Body</span>
                      <input
                        type="color"
                        value={settings.candleDownColor || '#101015'}
                        onChange={(e) => onUpdateSettings({ candleDownColor: e.target.value })}
                        className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Candle Borders */}
                <div className="p-3 rounded-lg border border-grid bg-panel/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={settings.candleBorderVisible !== false}
                        onChange={(e) => onUpdateSettings({ candleBorderVisible: e.target.checked })}
                        className="rounded border-grid text-accent focus:ring-0"
                      />
                      <span>Candle Borders</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                      <span className="text-[11px] text-slate-400">Up Border</span>
                      <input
                        type="color"
                        value={settings.borderUpColor || settings.candleUpColor || '#ffffff'}
                        onChange={(e) => onUpdateSettings({ borderUpColor: e.target.value })}
                        className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                      <span className="text-[11px] text-slate-400">Down Border</span>
                      <input
                        type="color"
                        value={settings.borderDownColor || '#71717a'}
                        onChange={(e) => onUpdateSettings({ borderDownColor: e.target.value })}
                        className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Candle Wicks */}
                <div className="p-3 rounded-lg border border-grid bg-panel/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={settings.candleWickVisible !== false}
                        onChange={(e) => onUpdateSettings({ candleWickVisible: e.target.checked })}
                        className="rounded border-grid text-accent focus:ring-0"
                      />
                      <span>Candle Wicks</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                      <span className="text-[11px] text-slate-400">Up Wick</span>
                      <input
                        type="color"
                        value={settings.wickUpColor || settings.candleUpColor || '#ffffff'}
                        onChange={(e) => onUpdateSettings({ wickUpColor: e.target.value })}
                        className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                      <span className="text-[11px] text-slate-400">Down Wick</span>
                      <input
                        type="color"
                        value={settings.wickDownColor || '#71717a'}
                        onChange={(e) => onUpdateSettings({ wickDownColor: e.target.value })}
                        className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
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

                <div className="flex items-center justify-between p-2 rounded-lg border border-grid bg-panel/50">
                  <span>Chart Timezone</span>
                  <select
                    value={settings.timezone || 'UTC'}
                    onChange={(e) => onUpdateSettings({ timezone: e.target.value })}
                    className="rounded bg-slate-800 border border-grid px-2 py-1 text-white"
                  >
                    <option value="UTC">UTC (Universal Time)</option>
                    <option value="Asia/Kolkata">IST (UTC+5:30 Kolkata)</option>
                    <option value="America/New_York">EDT / EST (New York)</option>
                    <option value="Europe/London">GMT / BST (London)</option>
                    <option value="Asia/Tokyo">JST (Tokyo)</option>
                  </select>
                </div>

                <div className="font-semibold text-white uppercase text-[10px] tracking-wider text-slate-400 pt-2">
                  Canvas Margins
                </div>
                <div className="space-y-3 p-3 rounded-lg border border-grid bg-panel/50">
                  <div className="flex items-center justify-between">
                    <span>Top Canvas Margin ({settings.topMarginPercent ?? 8}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={35}
                      step={1}
                      value={settings.topMarginPercent ?? 8}
                      onChange={(e) => onUpdateSettings({ topMarginPercent: Number(e.target.value) })}
                      className="w-36 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bottom Canvas Margin ({settings.bottomMarginPercent ?? 12}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={35}
                      step={1}
                      value={settings.bottomMarginPercent ?? 12}
                      onChange={(e) => onUpdateSettings({ bottomMarginPercent: Number(e.target.value) })}
                      className="w-36 cursor-pointer"
                    />
                  </div>
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
                  In-Chart Execution, Orders & Events
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showExecutionsOnChart !== false}
                    onChange={(e) => onUpdateSettings({ showExecutionsOnChart: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Show Trade Executions & Order Fill Markers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showEventsOnChart !== false}
                    onChange={(e) => onUpdateSettings({ showEventsOnChart: e.target.checked })}
                    className="rounded border-grid text-accent focus:ring-0"
                  />
                  <span>Show Economic & Market Event Markers</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid/50 px-5 py-3 bg-panel/90 text-xs">
          <button
            onClick={() => {
              audioHaptics.tick();
              onResetDefaults();
            }}
            className="text-muted hover:text-white transition underline"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="clay-pill-active px-5 py-1.5 font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
