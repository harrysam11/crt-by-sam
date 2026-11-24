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
import {
  BUILT_IN_INDICATOR_TEMPLATES,
  type IndicatorTemplate,
} from '../../services/indicators/templates';
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
  'TEMPLATES',
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
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  const activeInstances = useIndicatorsStore((s) => s.activeInstances);
  const favorites = useIndicatorsStore((s) => s.favorites);
  const customTemplates = useIndicatorsStore((s) => s.customTemplates);
  const addInstance = useIndicatorsStore((s) => s.addInstance);
  const toggleFavorite = useIndicatorsStore((s) => s.toggleFavorite);
  const applyTemplate = useIndicatorsStore((s) => s.applyTemplate);
  const saveCurrentAsTemplate = useIndicatorsStore((s) => s.saveCurrentAsTemplate);
  const deleteCustomTemplate = useIndicatorsStore((s) => s.deleteCustomTemplate);

  // Terminal state for Pine Script
  const candles = useTerminalStore((s) => s.candles);
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const pinePlots = useTerminalStore((s) => s.pinePlots);
  const pineDrawings = useTerminalStore((s) => s.pineDrawings);
  const activePineScripts = useTerminalStore((s) => s.activePineScripts);
  const addPineScript = useTerminalStore((s) => s.addPineScript);
  const removePineScript = useTerminalStore((s) => s.removePineScript);

  const allTemplates = useMemo(() => {
    return [...customTemplates, ...BUILT_IN_INDICATOR_TEMPLATES];
  }, [customTemplates]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory !== 'ALL' && selectedCategory !== 'TEMPLATES') return [];
    if (!search.trim()) return allTemplates;
    const q = search.toLowerCase();
    return allTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.indicators.some((i) => i.name?.toLowerCase().includes(q) || i.indicatorId.toLowerCase().includes(q))
    );
  }, [allTemplates, search, selectedCategory]);

  const filteredIndicators = useMemo(() => {
    if (selectedCategory === 'Pine Script' || selectedCategory === 'TEMPLATES') return [];
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

  const handleApplyTemplate = (tmpl: IndicatorTemplate, replaceExisting = true) => {
    audioHaptics.fill();
    applyTemplate(tmpl, replaceExisting);
    setTemplateNotice(`Applied ${tmpl.name} (${tmpl.indicators.length} indicators)`);
    setTimeout(() => setTemplateNotice(null), 3000);
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!newTemplateName.trim()) return;
    audioHaptics.tick();
    const created = saveCurrentAsTemplate(newTemplateName.trim());
    if (created) {
      setNewTemplateName('');
      setIsSavingTemplate(false);
      setTemplateNotice(`Template "${created.name}" saved!`);
      setTimeout(() => setTemplateNotice(null), 3000);
    }
  };

  const handleApplyPine = async (code: string, name: string) => {
    audioHaptics.tick();
    setPineStatus(`Adding ${name} to chart...`);
    try {
      addPineScript({ name, code });
      setPineStatus(`Applied ${name} to chart`);
    } catch (err: unknown) {
      setPineStatus(err instanceof Error ? err.message : 'Execution failed');
    }
  };

  const handleClearPine = () => {
    audioHaptics.tick();
    activePineScripts.forEach((p) => removePineScript(p.id));
    setPineStatus('Cleared all Pine studies');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 select-none font-mono">
      <div className="w-full max-w-5xl flex flex-col rounded-2xl bg-panel border border-grid shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[620px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 bg-panel">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-grid text-accent">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-sm text-primary tracking-wide">Indicators & Metrics</h2>
              <p className="text-[11px] text-secondary mt-0.5">25+ Built-in Technicals & Pine Script v5 Studies</p>
            </div>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface transition-colors"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-grid bg-panel">
          <div className="relative">
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-muted"
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
              className="w-full bg-surface border border-grid pl-9 pr-4 py-2 rounded-xl text-xs text-primary placeholder-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Layout: Sidebar Categories + Main Grid */}
        <div className="flex flex-1 min-h-0">
          {/* Categories Sidebar */}
          <div className="w-52 border-r border-grid bg-panel p-2 flex flex-col gap-1 overflow-y-auto">
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
                      ? 'bg-surface text-accent border border-grid font-semibold'
                      : 'text-secondary hover:text-primary hover:bg-surface/50'
                  }`}
                >
                  {cat === 'ALL' ? 'All Technicals' : cat === 'FAVORITES' ? 'Favorites' : cat}
                </button>
              );
            })}
          </div>

          {/* Indicator Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Template Save / Status Notice */}
            {templateNotice && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                <span>{templateNotice}</span>
                <span className="text-[10px] text-emerald-400 font-semibold">[Persistent]</span>
              </div>
            )}

            {/* Indicator Templates Section */}
            {(selectedCategory === 'ALL' || selectedCategory === 'TEMPLATES') && filteredTemplates.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Institutional Indicator Templates ({filteredTemplates.length})
                  </div>

                  {/* Save Current as Template Action */}
                  {activeInstances.length > 0 && !isSavingTemplate && (
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        setIsSavingTemplate(true);
                      }}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition flex items-center gap-1.5"
                    >
                      <span>Save Current Stack ({activeInstances.length}) as Template</span>
                    </button>
                  )}
                </div>

                {/* Inline Save Form */}
                {isSavingTemplate && (
                  <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveCurrentAsTemplate();
                        if (e.key === 'Escape') setIsSavingTemplate(false);
                      }}
                      placeholder="Template Name (e.g. My 5m Scalp Setup)"
                      className="flex-1 bg-black/60 border border-grid px-3 py-1.5 rounded text-white text-xs placeholder:text-muted focus:outline-none focus:border-emerald-400"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveCurrentAsTemplate}
                      disabled={!newTemplateName.trim()}
                      className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 disabled:opacity-50 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsSavingTemplate(false)}
                      className="px-2.5 py-1.5 rounded text-muted hover:text-white text-xs transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Templates Grid */}
                <StandardCardGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredTemplates.map((tmpl) => (
                    <StandardCard
                      key={tmpl.id}
                      title={tmpl.name}
                      meta={`${tmpl.description} (${tmpl.indicators.map((i) => i.name || i.indicatorId).join(', ')})`}
                      badge={tmpl.isBuiltIn ? 'Built-In' : 'Custom'}
                      badgeColor={tmpl.isBuiltIn ? 'accent' : 'emerald'}
                      icon={
                        <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                      }
                      primaryAction={{
                        label: 'Apply Template',
                        onClick: () => handleApplyTemplate(tmpl, true),
                      }}
                      secondaryAction={{
                        label: tmpl.isBuiltIn ? '+ Append' : 'Delete',
                        active: false,
                        onClick: () => {
                          audioHaptics.tick();
                          if (tmpl.isBuiltIn) {
                            handleApplyTemplate(tmpl, false);
                          } else {
                            deleteCustomTemplate(tmpl.id);
                          }
                        },
                      }}
                    />
                  ))}
                </StandardCardGrid>
              </div>
            )}

            {/* Pine Scripts Section */}
            {filteredPineScripts.length > 0 && (
              <div className="mb-6">
                {selectedCategory === 'ALL' && (
                  <div className="text-[11px] font-semibold text-[#38bdf8] uppercase tracking-wider mb-3">
                    Pine Script v5 Indicators ({filteredPineScripts.length})
                  </div>
                )}
                <StandardCardGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPineScripts.map((ps) => {
                    const active = activePineScripts.find((p) => p.name === ps.name);
                    const isActive = active?.visible ?? false;

                    return (
                      <StandardCard
                        key={ps.name}
                        title={ps.name}
                        meta={ps.description}
                        badge={isActive ? 'Active on Chart' : 'Pine Script'}
                        badgeColor={isActive ? 'emerald' : 'amber'}
                        icon={
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                          </svg>
                        }
                        primaryAction={{
                          label: isActive ? 'Active (Remove)' : '+ Add to Chart',
                          active: isActive,
                          onClick: () => {
                            audioHaptics.tick();
                            if (isActive && active) {
                              removePineScript(active.id);
                              setPineStatus(`Removed ${ps.name}`);
                            } else {
                              addPineScript({ name: ps.name, code: ps.code });
                              setPineStatus(`Added ${ps.name} to chart`);
                            }
                          },
                        }}
                        secondaryAction={{
                          label: 'Edit in Pine Editor',
                          active: false,
                          icon: (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          ),
                          onClick: () => {
                            audioHaptics.tick();
                            onClose();
                            window.dispatchEvent(new CustomEvent('crt_open_pine_tab'));
                          },
                        }}
                      />
                    );
                  })}
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

            {filteredIndicators.length === 0 && filteredPineScripts.length === 0 && filteredTemplates.length === 0 && (
              <div className="text-center text-slate-500 py-16 text-xs font-mono">
                No indicators or templates match your search or filter.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-grid px-5 py-3 bg-panel text-xs font-mono">
          <div className="text-secondary text-[11px]">
            {pineStatus ? (
              <span className="text-accent">{pineStatus}</span>
            ) : (
              <span>Institutional Studies & Pine Script v5 Engine</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activePineScripts.length > 0 && (
              <button
                onClick={handleClearPine}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 text-[11px] hover:opacity-80 transition"
              >
                Clear Pine Studies ({activePineScripts.length})
              </button>
            )}
            <button
              onClick={() => {
                audioHaptics.tick();
                onClose();
              }}
              className="px-5 py-1.5 rounded-lg bg-accent text-black font-mono text-xs font-bold hover:opacity-90 transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
