/**
 * TradingView-Style Indicators, Metrics & Strategies Modal.
 * Full categorized library with search, favorites stars, and instance management.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { audioHaptics } from '../../utils/notify';
import { INDICATOR_REGISTRY } from '../../services/indicators/registry';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import type { IndicatorCategory } from '../../services/indicators/types';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Kept for backward compatibility
  activeIndicators?: Record<string, boolean>;
  onToggleIndicator?: (key: string) => void;
}

const CATEGORIES: Array<'ALL' | 'FAVORITES' | IndicatorCategory> = [
  'ALL',
  'FAVORITES',
  'Moving Averages',
  'Oscillators',
  'Technicals',
  'Volume & Volatility',
];

export default function IndicatorsModal({ isOpen, onClose }: IndicatorsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'FAVORITES' | IndicatorCategory>('ALL');

  const activeInstances = useIndicatorsStore((s) => s.activeInstances);
  const favorites = useIndicatorsStore((s) => s.favorites);
  const addInstance = useIndicatorsStore((s) => s.addInstance);
  const removeInstance = useIndicatorsStore((s) => s.removeInstance);
  const toggleFavorite = useIndicatorsStore((s) => s.toggleFavorite);

  const filteredIndicators = useMemo(() => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-mono">
      <div className="clay-popover w-full max-w-2xl flex flex-col rounded-2xl border border-grid shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[560px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 bg-panel/90">
          <div>
            <h2 className="font-bold text-base text-slate-100 tracking-wide">Indicators & Metrics</h2>
            <p className="text-[11px] text-muted">25+ Technical Indicators, Moving Averages & Oscillators</p>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="p-1 rounded text-slate-400 hover:text-white transition"
          >
            x
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-grid bg-panel/50">
          <div className="relative">
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
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
              placeholder="Search 27 indicators (e.g. EMA, RSI, MACD, Supertrend, Ichimoku)..."
              className="w-full bg-slate-900 border border-grid pl-9 pr-4 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Layout: Sidebar Categories + Main List */}
        <div className="flex flex-1 min-h-0">
          {/* Categories Sidebar */}
          <div className="w-48 border-r border-grid bg-panel/30 p-2 flex flex-col gap-1 overflow-y-auto">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    audioHaptics.tick();
                    setSelectedCategory(cat);
                  }}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? 'clay-btn-active text-accent'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {cat === 'ALL' ? 'All Technicals' : cat === 'FAVORITES' ? 'Favorites' : cat}
                </button>
              );
            })}
          </div>

          {/* Indicator Items List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
            {filteredIndicators.length === 0 ? (
              <div className="text-center text-muted py-12 text-xs">No indicators match your filter.</div>
            ) : (
              filteredIndicators.map((ind) => {
                const isFav = favorites.includes(ind.id);
                const activeCount = activeInstances.filter((i) => i.indicatorId === ind.id).length;

                return (
                  <div
                    key={ind.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-grid/50 hover:border-grid hover:bg-slate-900 transition group"
                  >
                    <div className="flex items-start gap-2.5 flex-1 pr-3">
                      {/* Favorite Star */}
                      <button
                        onClick={() => {
                          audioHaptics.tick();
                          toggleFavorite(ind.id);
                        }}
                        className={`pt-0.5 transition ${
                          isFav ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-100">{ind.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({ind.shortName})</span>
                          {ind.overlay ? (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                              Overlay
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                              Pane
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{ind.description}</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          {activeCount} active
                        </span>
                      )}

                      <button
                        onClick={() => {
                          audioHaptics.tick();
                          addInstance(ind.id);
                        }}
                        className="clay-btn px-2.5 py-1 text-xs text-accent hover:text-white hover:bg-accent/20 transition rounded-lg font-medium"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid px-5 py-2.5 bg-panel/90 text-xs text-muted">
          <span>{INDICATOR_REGISTRY.length} indicators available in library</span>
          <span>{activeInstances.length} total active on chart</span>
        </div>
      </div>
    </div>
  );
}
