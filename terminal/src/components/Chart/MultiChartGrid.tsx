/**
 * TradingView-Style Multi-Chart Grid System.
 * Supports:
 * - 1x1: Single full chart
 * - 1x2: Dual vertical split (side-by-side)
 * - 2x1: Dual horizontal split (stacked)
 * - 2x2: Quad 4-chart layout
 * With synchronized timeframes, crosshair, and symbol linking options.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import TradingChart from './TradingChart';
import { audioHaptics } from '../../utils/notify';
import { useTerminalStore } from '../../store/useTerminalStore';
import type { Timeframe } from '../../types/terminal';

export type ChartGridLayout = '1x1' | '1x2' | '2x1' | '2x2';

interface MultiChartGridProps {
  // Optional props
}

export default function MultiChartGrid() {
  const globalSymbol = useTerminalStore((s) => s.symbol);
  const globalTimeframe = useTerminalStore((s) => s.timeframe);

  const [layout, setLayout] = useState<ChartGridLayout>(() => {
    try {
      const stored = localStorage.getItem('crt_chart_layout');
      return (stored as ChartGridLayout) || '1x1';
    } catch {
      return '1x1';
    }
  });

  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);

  // Secondary pane overrides (e.g. HTF or correlated symbols)
  const [pane2Timeframe, setPane2Timeframe] = useState<Timeframe>('15m');
  const [pane3Timeframe, setPane3Timeframe] = useState<Timeframe>('1h');
  const [pane4Timeframe, setPane4Timeframe] = useState<Timeframe>('1d');

  const changeLayout = (newLayout: ChartGridLayout) => {
    audioHaptics.tick();
    setLayout(newLayout);
    setIsLayoutMenuOpen(false);
    try {
      localStorage.setItem('crt_chart_layout', newLayout);
    } catch {}
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bg">
      {/* Top Floating Multi-Chart Layout Switcher Pill */}
      <div className="absolute right-3 top-2 z-30 flex items-center gap-1 font-mono text-xs select-none">
        <button
          onClick={() => {
            audioHaptics.tick();
            setIsLayoutMenuOpen((v) => !v);
          }}
          className="flex items-center gap-1.5 clay-pill px-3 py-1 text-white hover:text-white transition text-[11px]"
          title="Select Chart Grid Layout"
        >
          {/* Grid Layout Icon */}
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {layout === '1x1' && (
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
            )}
            {layout === '1x2' && (
              <>
                <rect x="3" y="3" width="8" height="18" rx="1.5" strokeWidth="2" />
                <rect x="13" y="3" width="8" height="18" rx="1.5" strokeWidth="2" />
              </>
            )}
            {layout === '2x1' && (
              <>
                <rect x="3" y="3" width="18" height="8" rx="1.5" strokeWidth="2" />
                <rect x="3" y="13" width="18" height="8" rx="1.5" strokeWidth="2" />
              </>
            )}
            {layout === '2x2' && (
              <>
                <rect x="3" y="3" width="8" height="8" rx="1" strokeWidth="2" />
                <rect x="13" y="3" width="8" height="8" rx="1" strokeWidth="2" />
                <rect x="3" y="13" width="8" height="8" rx="1" strokeWidth="2" />
                <rect x="13" y="13" width="8" height="8" rx="1" strokeWidth="2" />
              </>
            )}
          </svg>
          <span className="font-bold text-white">{layout}</span>
        </button>

        {/* Layout Selection Dropdown Popover */}
        {isLayoutMenuOpen && (
          <div className="clay-popover absolute right-0 top-8 z-40 flex flex-col gap-1 p-2 min-w-[150px]">
            <span className="px-2 py-1 text-[10px] uppercase font-bold text-muted">
              Chart Layout
            </span>
            {[
              { id: '1x1', label: '1x1 Single', desc: 'Standard Full Chart' },
              { id: '1x2', label: '1x2 Vertical', desc: 'Side-by-side' },
              { id: '2x1', label: '2x1 Horizontal', desc: 'Top & Bottom' },
              { id: '2x2', label: '2x2 Quad', desc: '4 Independent Panes' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => changeLayout(item.id as ChartGridLayout)}
                className={`flex items-center justify-between px-3 py-1.5 text-left transition text-[11px] ${
                  layout === item.id
                    ? 'clay-pill-active font-bold'
                    : 'clay-pill text-muted hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {layout === item.id && <span className="text-[10px]">*</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="flex-1 min-h-0 w-full h-full">
        {layout === '1x1' && (
          <div className="h-full w-full">
            <TradingChart paneId="pane-1" />
          </div>
        )}

        {layout === '1x2' && (
          <div className="grid h-full w-full grid-cols-2 divide-x divide-grid">
            <div className="h-full min-h-0 relative">
              <TradingChart paneId="pane-1" />
            </div>
            <div className="h-full min-h-0 relative">
              <TradingChart
                paneId="pane-2"
                timeframeOverride={pane2Timeframe}
              />
            </div>
          </div>
        )}

        {layout === '2x1' && (
          <div className="grid h-full w-full grid-rows-2 divide-y divide-grid">
            <div className="h-full min-h-0 relative">
              <TradingChart paneId="pane-1" />
            </div>
            <div className="h-full min-h-0 relative">
              <TradingChart
                paneId="pane-2"
                timeframeOverride={pane2Timeframe}
              />
            </div>
          </div>
        )}

        {layout === '2x2' && (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 divide-x divide-y divide-grid">
            <div className="h-full min-h-0 relative">
              <TradingChart paneId="pane-1" />
            </div>
            <div className="h-full min-h-0 relative">
              <TradingChart
                paneId="pane-2"
                timeframeOverride={pane2Timeframe}
              />
            </div>
            <div className="h-full min-h-0 relative">
              <TradingChart
                paneId="pane-3"
                timeframeOverride={pane3Timeframe}
              />
            </div>
            <div className="h-full min-h-0 relative">
              <TradingChart
                paneId="pane-4"
                timeframeOverride={pane4Timeframe}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
