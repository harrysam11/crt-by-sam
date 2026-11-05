/**
 * TradingView-Style Sub-Pane Indicator Chart.
 * Renders separate oscillator panes (RSI, MACD, Stoch, ATR, etc.) below the main price chart.
 * Synchronizes time scale with main chart and includes in-pane legend HUD.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { ActiveIndicatorInstance } from '../../services/indicators/types';
import { INDICATOR_REGISTRY } from '../../services/indicators/registry';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import type { Candle } from '../../types/terminal';
import { audioHaptics } from '../../utils/notify';

interface SubPaneChartProps {
  instance: ActiveIndicatorInstance;
  candles: Candle[];
  mainChartApi: IChartApi | null;
  height?: number;
}

export default function SubPaneChart({
  instance,
  candles,
  mainChartApi,
  height = 130,
}: SubPaneChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line' | 'Histogram'>>>(new Map());

  const [liveValues, setLiveValues] = useState<Record<string, number | null>>({});

  const toggleVisibility = useIndicatorsStore((s) => s.toggleVisibility);
  const removeInstance = useIndicatorsStore((s) => s.removeInstance);
  const openSettings = useIndicatorsStore((s) => s.openSettings);

  const definition = INDICATOR_REGISTRY.find((i) => i.id === instance.indicatorId);

  // Initialize SubPane Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#050508' },
        textColor: '#828290',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      rightPriceScale: {
        borderColor: '#1e1e26',
        scaleMargins: { top: 0.15, bottom: 0.15 },
        autoScale: true,
      },
      timeScale: {
        borderColor: '#1e1e26',
        timeVisible: true,
        secondsVisible: false,
        visible: false, // Time axis hidden on subpanes to avoid clutter (docked to main chart)
      },
      crosshair: {
        horzLine: {
          color: 'rgba(255, 255, 255, 0.35)',
          width: 1,
          style: LineStyle.Dashed,
        },
        vertLine: {
          color: 'rgba(255, 255, 255, 0.35)',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
    });

    chartApiRef.current = chart;

    // Time scale synchronization with main chart
    if (mainChartApi) {
      const syncTimeScale = () => {
        try {
          const mainRange = mainChartApi.timeScale().getVisibleLogicalRange();
          if (mainRange) {
            chart.timeScale().setVisibleLogicalRange(mainRange);
          }
        } catch {}
      };
      mainChartApi.timeScale().subscribeVisibleLogicalRangeChange(syncTimeScale);
      syncTimeScale();
    }

    return () => {
      chart.remove();
      chartApiRef.current = null;
      seriesMapRef.current.clear();
    };
  }, [mainChartApi]);

  // Compute and update plot data
  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart || !definition || !candles.length) return;

    const result = definition.calculate(candles, instance.inputs);
    const latestValues: Record<string, number | null> = {};

    Object.entries(result.plots).forEach(([plotKey, points]) => {
      const style = instance.styles[plotKey] || definition.defaultStyles[plotKey];
      if (!style || !style.visible || !instance.visible) {
        // If series already exists, remove or hide it
        const existing = seriesMapRef.current.get(plotKey);
        if (existing) {
          existing.applyOptions({ visible: false });
        }
        return;
      }

      let series = seriesMapRef.current.get(plotKey);
      if (!series) {
        if (style.plotType === 'histogram') {
          series = chart.addHistogramSeries({
            color: style.color,
            priceFormat: { type: 'volume' },
          });
        } else {
          series = chart.addLineSeries({
            color: style.color,
            lineWidth: style.lineWidth as 1 | 2 | 3 | 4,
            lineStyle:
              style.lineStyle === 'dashed'
                ? LineStyle.Dashed
                : style.lineStyle === 'dotted'
                ? LineStyle.Dotted
                : LineStyle.Solid,
          });
        }
        seriesMapRef.current.set(plotKey, series);
      } else {
        series.applyOptions({
          visible: true,
          color: style.color,
          lineWidth: style.lineWidth as 1 | 2 | 3 | 4,
        });
      }

      // Format data points for series
      const seriesData = points
        .filter((p) => p.value !== null && !isNaN(p.value))
        .map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value as number,
          color: p.color || style.color,
        }));

      series.setData(seriesData);

      // Record latest value
      if (seriesData.length > 0) {
        latestValues[plotKey] = seriesData[seriesData.length - 1].value;
      }
    });

    setLiveValues(latestValues);
  }, [candles, instance, definition]);

  return (
    <div
      style={{ height }}
      className="relative w-full border-t border-grid bg-[#050508] select-none font-mono shrink-0"
    >
      {/* Sub-Pane Legend HUD */}
      <div className="absolute left-3 top-1.5 z-20 flex items-center gap-2 bg-panel/80 px-2 py-0.5 rounded border border-grid/60 backdrop-blur-sm text-[10.5px]">
        <span className="font-bold text-slate-200">{instance.name}</span>

        {/* Live values */}
        {Object.entries(liveValues).map(([key, val]) => (
          <span key={key} className="font-semibold text-accent">
            {val !== null && val !== undefined ? val.toFixed(2) : '-'}
          </span>
        ))}

        {/* Action icons */}
        <div className="flex items-center gap-1 border-l border-grid/80 pl-1.5">
          {/* Eye */}
          <button
            onClick={() => {
              audioHaptics.tick();
              toggleVisibility(instance.instanceId);
            }}
            className="text-slate-400 hover:text-white p-0.5 transition"
            title={instance.visible ? 'Hide pane' : 'Show pane'}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              audioHaptics.tick();
              openSettings(instance);
            }}
            className="text-slate-400 hover:text-white p-0.5 transition"
            title="Indicator settings"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Remove */}
          <button
            onClick={() => {
              audioHaptics.tick();
              removeInstance(instance.instanceId);
            }}
            className="text-slate-400 hover:text-rose-400 p-0.5 transition"
            title="Remove pane"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
