/**
 * TradingView-Style Indicators, Metrics & Strategies Modal.
 * Full categorized library with search, favorites stars, instance management,
 * and built-in Pine Script indicator execution support.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { audioHaptics } from '../../utils/notify';
import { INDICATOR_REGISTRY } from '../../services/indicators/registry';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { PRESET_PINE_SCRIPTS, executePineScript } from '../../services/pineRunner';
import type { IndicatorCategory } from '../../services/indicators/types';
import { StandardCard, StandardCardGrid } from '../common/StandardCard';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Kept for backward compatibility
  activeIndicators?: Record<string, boolean>;
  onToggleIndicator?: (key: string) => void;
}

const CATEGORIES = [
  'ALL',
  'FAVORITES',
  'Moving Averages',
  'Oscillators',
  'Technicals',
  'Volume & Volatility',
  'Order Flow & Deep Studies',
  'Pine Script',
] as const;

type CategoryType = (typeof CATEGORIES)[number];

export default function IndicatorsModal({ isOpen, onClose }: IndicatorsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('ALL');
  const [pineStatus, setPineStatus] = useState<string | null>(null);

  const activeInstances = useIndicatorsStore((s) => s.activeInstances);
  const favorites = useIndicatorsStore((s) => s.favorites);
  const addInstance = useIndicatorsStore((s) => s.addInstance);
  const toggleFavorite = useIndicatorsStore((s) => s.toggleFavorite);

  // Terminal state for Pine Script
  const candles = useTerminalStore((s) => s.candles);
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const pinePlots = useTerminalStore((s) => s.pinePlots);
  const setPinePlots = useTerminalStore((s) => s.setPinePlots);

  const filteredIndicators = useMemo(() => {
    if (selectedCategory === 'Pine Script') return [];
    return INDICATOR_REGISTRY.filter((ind) => {
      // Category filter
      if (selectedCategory === 'FAVORITES') {
        if (!favorites.includes(ind.id)) return false;
      } else if (selectedCategory !== 'ALL') {
        if (ind.category !== selectedCategory) return false;
      }

      // Search query filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        ind.name.toLowerCase().includes(q) ||
        ind.shortName.toLowerCase().includes(q) ||
        ind.description.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory, favorites]);

  const filteredPineScripts = useMemo(() => {
    if (selectedCategory !== 'ALL' && selectedCategory !== 'Pine Script') return [];
    if (!search.trim()) return PRESET_PINE_SCRIPTS;
    const q = search.toLowerCase();
    return PRESET_PINE_SCRIPTS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }, [search, selectedCategory]);

  const handleApplyPine = async (code: string, name: string) => {
    audioHaptics.tick();
    setPineStatus(`Evaluating ${name}...`);
    try {
      const res = await executePineScript(code, candles, symbol, timeframe);
      if (res.ok && res.plots.length > 0) {
        setPinePlots(res.plots);
        setPineStatus(`Applied ${name} (${res.plots.length} series)`);
      } else {
        setPineStatus(res.error || 'No plot outputs generated');
      }
    } catch (err: unknown) {
      setPineStatus(err instanceof Error ? err.message : 'Execution failed');
    }
  };

  const handleClearPine = () => {
    audioHaptics.tick();
    setPinePlots([]);
    setPineStatus('Cleared Pine plots');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-[2px] p-4 select-none font-mono">
      <div className="w-full max-w-5xl flex flex-col rounded-2xl bg-[#0c0c12] border border-[#242434] shadow-2xl shadow-black overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[620px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#20202e] px-5 py-3.5 bg-[#101018]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#181824] border border-[#2a2a3c] text-[#38bdf8]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-100 tracking-wide">Indicators & Metrics</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">25+ Built-in Technicals & Pine Script v5 Studies</p>
            </div>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1a26] transition-colors"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-[#20202e] bg-[#0f0f16]">
          <div className="relative">
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search indicators or Pine Scripts (e.g. EMA, RSI, MACD, VWAP, Ribbon)..."
              className="w-full bg-[#151520] border border-[#262638] pl-9 pr-4 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
            />
          </div>
        </div>

        {/* Layout: Sidebar Categories + Main Grid */}
        <div className="flex flex-1 min-h-0">
          {/* Categories Sidebar */}
          <div className="w-52 border-r border-[#20202e] bg-[#0e0e16] p-2 flex flex-col gap-1 overflow-y-auto">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    audioHaptics.tick();
                    setSelectedCategory(cat);
                  }}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#181824] text-[#38bdf8] border border-[#2c2c40] font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141e]'
                  }`}
                >
                  {cat === 'ALL' ? 'All Technicals' : cat === 'FAVORITES' ? 'Favorites' : cat}
                </button>
              );
            })}
          </div>

          {/* Indicator Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Pine Scripts Section */}
            {filteredPineScripts.length > 0 && (
              <div className="mb-6">
                {selectedCategory === 'ALL' && (
                  <div className="text-[11px] font-semibold text-[#38bdf8] uppercase tracking-wider mb-3">
                    Pine Script v5 Indicators ({filteredPineScripts.length})
                  </div>
                )}
                <StandardCardGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPineScripts.map((ps) => (
                    <StandardCard
                      key={ps.name}
                      title={ps.name}
                      meta={ps.description}
                      badge="Pine Script"
                      badgeColor="amber"
                      icon={
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                      }
                      primaryAction={{
                        label: 'Apply Script',
                        onClick: () => handleApplyPine(ps.code, ps.name),
                      }}
                    />
                  ))}
                </StandardCardGrid>
              </div>
            )}

            {/* Built-in Indicators Cards */}
            {filteredIndicators.length > 0 && (
              <div>
                {selectedCategory === 'ALL' && filteredPineScripts.length > 0 && (
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Built-in Technical Studies ({filteredIndicators.length})
                  </div>
                )}
                <StandardCardGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredIndicators.map((ind) => {
                    const isFav = favorites.includes(ind.id);
                    const activeCount = activeInstances.filter((i) => i.indicatorId === ind.id).length;

                    return (
                      <StandardCard
                        key={ind.id}
                        title={ind.name}
                        meta={`${ind.shortName} • ${ind.description}`}
                        badge={ind.overlay ? 'Overlay' : 'Sub-Pane'}
                        badgeColor={ind.overlay ? 'accent' : 'default'}
                        icon={
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        }
                        primaryAction={{
                          label: activeCount > 0 ? `Add (${activeCount} active)` : '+ Add to Chart',
                          active: activeCount > 0,
                          onClick: () => {
                            audioHaptics.tick();
                            addInstance(ind.id);
                          },
                        }}
                        secondaryAction={{
                          label: isFav ? 'Remove Favorite' : 'Add Favorite',
                          active: isFav,
                          onClick: () => {
                            audioHaptics.tick();
                            toggleFavorite(ind.id);
                          },
                          icon: (
                            <svg className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          ),
                        }}
                      />
                    );
                  })}
                </StandardCardGrid>
              </div>
            )}

            {filteredIndicators.length === 0 && filteredPineScripts.length === 0 && (
              <div className="text-center text-slate-500 py-16 text-xs font-mono">
                No indicators match your search or filter.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#20202e] px-5 py-3 bg-[#101018] text-xs font-mono">
          <div className="text-slate-400 text-[11px]">
            {pineStatus ? (
              <span className="text-[#38bdf8]">{pineStatus}</span>
            ) : (
              <span>Institutional Studies & Pine Script v5 Engine</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pinePlots.length > 0 && (
              <button
                onClick={handleClearPine}
                className="px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] hover:text-white transition"
              >
                Clear Pine Plots ({pinePlots.length})
              </button>
            )}
            <button
              onClick={() => {
                audioHaptics.tick();
                onClose();
              }}
              className="px-5 py-1.5 rounded-lg bg-[#38bdf8] text-black font-mono text-xs font-bold hover:bg-[#7dd3fc] transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
