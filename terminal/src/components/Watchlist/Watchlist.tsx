/**
 * TradingView-Style Institutional Watchlist Component.
 * Supports:
 * - Color Flags per symbol (Red, Blue, Green, Orange, Purple)
 * - Filtering by color flag or asset category
 * - Multiple custom watchlists (create, rename, delete, switch)
 * - Real-time quotes, price changes, and 1-click symbol activation
 * - Hotkey cycling (Space / Shift+Space)
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useWatchlistStore, FLAG_COLORS, type WatchlistFlagColor, type WatchlistFlagFilter } from '../../store/useWatchlistStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { CATEGORY_LABEL, getInstrument } from '../../services/instruments';
import { fmtPct, fmtPrice } from '../../utils/formatters';
import { audioHaptics } from '../../utils/notify';
import type { AssetCategory } from '../../types/terminal';
import SymbolSearch from './SymbolSearch';

const CATS = Object.keys(CATEGORY_LABEL) as AssetCategory[];
const FLAG_ORDER: WatchlistFlagColor[] = ['RED', 'BLUE', 'GREEN', 'ORANGE', 'PURPLE'];

export default function Watchlist() {
  const activeSymbol = useTerminalStore((s) => s.symbol);
  const setStoreSymbol = useTerminalStore((s) => s.setSymbol);
  const instruments = useTerminalStore((s) => s.instruments);
  const quoteList = useTerminalStore((s) => s.watchlist);

  const activePaneId = useLayoutStore((s) => s.activePaneId);
  const setPaneSymbol = useLayoutStore((s) => s.setPaneSymbol);

  // Watchlist Store
  const lists = useWatchlistStore((s) => s.lists);
  const activeListId = useWatchlistStore((s) => s.activeListId);
  const setActiveList = useWatchlistStore((s) => s.setActiveList);
  const createList = useWatchlistStore((s) => s.createList);
  const deleteList = useWatchlistStore((s) => s.deleteList);
  const renameList = useWatchlistStore((s) => s.renameList);
  const addSymbolToList = useWatchlistStore((s) => s.addSymbolToList);
  const removeSymbolFromList = useWatchlistStore((s) => s.removeSymbolFromList);
  const flags = useWatchlistStore((s) => s.flags);
  const setFlag = useWatchlistStore((s) => s.setFlag);
  const cycleFlag = useWatchlistStore((s) => s.cycleFlag);
  const flagFilter = useWatchlistStore((s) => s.flagFilter);
  const setFlagFilter = useWatchlistStore((s) => s.setFlagFilter);

  // Local UI states
  const [isSearching, setIsSearching] = useState(false);
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [isFlagMenuOpen, setIsFlagMenuOpen] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [flagPickerSymbol, setFlagPickerSymbol] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);

  const listMenuRef = useRef<HTMLDivElement>(null);
  const flagMenuRef = useRef<HTMLDivElement>(null);
  const flagPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listMenuRef.current && !listMenuRef.current.contains(target)) {
        setIsListMenuOpen(false);
      }
      if (flagMenuRef.current && !flagMenuRef.current.contains(target)) {
        setIsFlagMenuOpen(false);
      }
      if (flagPickerRef.current && !flagPickerRef.current.contains(target)) {
        setFlagPickerSymbol(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsListMenuOpen(false);
        setIsFlagMenuOpen(false);
        setFlagPickerSymbol(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const activeGroup = lists.find((l) => l.id === activeListId) || lists[0];

  // Resolve symbols in the active group into instrument items
  const resolvedSymbols = activeGroup.symbols
    .map((sym) => instruments.find((i) => i.id === sym) || getInstrument(sym))
    .filter((i): i is NonNullable<typeof i> => i !== undefined);

  // Apply Category & Color Flag Filters
  const displayedSymbols = resolvedSymbols.filter((item) => {
    if (selectedCategory && item.category !== selectedCategory) return false;
    if (flagFilter !== 'ALL') {
      const itemFlag = flags[item.id] || 'NONE';
      if (itemFlag !== flagFilter) return false;
    }
    return true;
  });

  // Symbol activation updates both active pane and global store
  const handleSelectSymbol = (sym: string) => {
    audioHaptics.tick();
    setStoreSymbol(sym);
    setPaneSymbol(activePaneId, sym);
  };

  // Expose global hotkey triggers (Space / Shift+Space cycling)
  useEffect(() => {
    (window as any).__cycleWatchlistSymbol = (direction: number) => {
      if (!displayedSymbols.length) return;
      const curIdx = displayedSymbols.findIndex((i) => i.id === activeSymbol);
      const nextIdx = (curIdx + direction + displayedSymbols.length) % displayedSymbols.length;
      handleSelectSymbol(displayedSymbols[nextIdx].id);
    };
    return () => {
      delete (window as any).__cycleWatchlistSymbol;
    };
  }, [displayedSymbols, activeSymbol, activePaneId]);

  const handleCreateListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    audioHaptics.tick();
    createList(newListName.trim());
    setNewListName('');
    setIsCreatingList(false);
    setIsListMenuOpen(false);
  };

  return (
    <aside className="flex w-full h-full flex-col bg-panel font-mono text-xs select-none">
      {/* Top Header: Active List Selector, Flag Filter, and Add Symbol */}
      <div className="flex items-center justify-between border-b border-grid/60 px-3 py-2 bg-[#09090d]/80 backdrop-blur-md">
        {/* Watchlist Selection Dropdown */}
        <div className="relative" ref={listMenuRef}>
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsListMenuOpen((v) => !v);
              setIsFlagMenuOpen(false);
            }}
            className="flex items-center gap-1.5 font-bold text-white hover:text-white transition text-xs"
          >
            <span className="truncate max-w-[130px]">{activeGroup.name}</span>
            <svg className="h-3 w-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Watchlists Menu Popover */}
          {isListMenuOpen && (
            <div className="clay-popover absolute left-0 top-7 z-50 flex flex-col gap-1 p-2 min-w-[200px]">
              <div className="flex items-center justify-between px-2 py-1 border-b border-grid text-[10px] uppercase font-bold text-muted">
                <span>Watchlists</span>
                <button
                  onClick={() => setIsCreatingList(true)}
                  className="clay-pill px-2 py-0.5 text-[9px] text-white"
                >
                  + New
                </button>
              </div>

              {isCreatingList && (
                <form onSubmit={handleCreateListSubmit} className="p-1.5 border-b border-grid flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="List name..."
                    autoFocus
                    className="clay-inset px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none w-full"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingList(false)}
                      className="clay-btn px-2 py-0.5 text-[10px] text-muted hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="clay-pill-active px-2.5 py-0.5 text-[10px]"
                    >
                      Create
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-col gap-0.5 mt-1 max-h-[220px] overflow-y-auto">
                {lists.map((l) => (
                  <div
                    key={l.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition group ${
                      activeListId === l.id ? 'clay-pill-active font-bold' : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        setActiveList(l.id);
                        setIsListMenuOpen(false);
                      }}
                      className="flex-1 text-left truncate"
                    >
                      {l.name}
                    </button>
                    {lists.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          audioHaptics.tick();
                          deleteList(l.id);
                        }}
                        className="hidden group-hover:block text-muted hover:text-white px-1 text-[11px]"
                        title="Delete list"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls: Flag Filter & Add Symbol Button */}
        <div className="flex items-center gap-1.5">
          {/* Flag Filter Dropdown */}
          <div className="relative" ref={flagMenuRef}>
            <button
              onClick={() => {
                audioHaptics.tick();
                setIsFlagMenuOpen((v) => !v);
                setIsListMenuOpen(false);
              }}
              className="clay-pill px-2 py-1 flex items-center gap-1 text-[10px] text-slate-300 hover:text-white"
              title="Filter by Color Flag"
            >
              {flagFilter === 'ALL' ? (
                <span>All Flags</span>
              ) : (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: FLAG_COLORS[flagFilter].hex }}
                />
              )}
              <svg className="h-2.5 w-2.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isFlagMenuOpen && (
              <div className="clay-popover absolute right-0 top-7 z-50 flex flex-col gap-1 p-1.5 min-w-[130px]">
                <button
                  onClick={() => {
                    audioHaptics.tick();
                    setFlagFilter('ALL');
                    setIsFlagMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-1 text-[11px] rounded transition ${
                    flagFilter === 'ALL' ? 'clay-pill-active font-bold' : 'hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full border border-zinc-500" />
                  <span>All Flags</span>
                </button>
                {FLAG_ORDER.map((fColor) => {
                  const conf = FLAG_COLORS[fColor];
                  return (
                    <button
                      key={fColor}
                      onClick={() => {
                        audioHaptics.tick();
                        setFlagFilter(fColor);
                        setIsFlagMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 px-2 py-1 text-[11px] rounded transition ${
                        flagFilter === fColor ? 'clay-pill-active font-bold' : 'hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: conf.hex }}
                      />
                      <span>{conf.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Symbol Trigger */}
          <button
            onClick={() => {
              audioHaptics.tick();
              setIsSearching((v) => !v);
            }}
            className="clay-btn px-2.5 py-1 text-[11px] text-muted hover:text-white"
          >
            {isSearching ? 'Close' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Embedded Quick Symbol Search Drawer */}
      {isSearching && (
        <SymbolSearch
          onDone={() => setIsSearching(false)}
          onSelect={(inst) => {
            addSymbolToList(activeListId, inst.id);
            setIsSearching(false);
          }}
        />
      )}

      {/* Category Pills Strip */}
      <div className="flex flex-wrap gap-1 border-b border-grid/50 p-2 bg-[#09090d]/40">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-2 py-0.5 text-[10px] rounded-full transition ${
            selectedCategory === null ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'
          }`}
        >
          All
        </button>
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory((prev) => (prev === c ? null : c))}
            className={`px-2 py-0.5 text-[10px] rounded-full transition ${
              selectedCategory === c ? 'clay-pill-active font-bold' : 'clay-pill text-muted hover:text-white'
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* Watchlist Symbol Rows List */}
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1">
        {displayedSymbols.length === 0 ? (
          <div className="p-6 text-center text-muted">
            <p>No symbols in this filter.</p>
            <button
              onClick={() => {
                setFlagFilter('ALL');
                setSelectedCategory(null);
              }}
              className="mt-2 text-white hover:underline text-[11px]"
            >
              Reset filters
            </button>
          </div>
        ) : (
          displayedSymbols.map((item) => {
            const ticker = quoteList[item.id];
            const isUp = (ticker?.change ?? 0) >= 0;
            const flagColor = flags[item.id] || 'NONE';
            const flagConf = FLAG_COLORS[flagColor];
            const isActive = item.id === activeSymbol;

            return (
              <li
                key={item.id}
                className={`group relative flex items-center rounded-xl transition ${
                  isActive ? 'clay-card border-white/20 bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {/* Color Flag Trigger Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.tick();
                    setFlagPickerSymbol((prev) => (prev === item.id ? null : item.id));
                  }}
                  className="pl-2 pr-1 py-2 flex items-center justify-center text-muted hover:text-white transition"
                  title={`Flag: ${flagConf.label} (click to change)`}
                >
                  {flagColor === 'NONE' ? (
                    <span className="h-2 w-2 rounded-full border border-zinc-600 group-hover:border-zinc-400 transition" />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-sm"
                      style={{ backgroundColor: flagConf.hex }}
                    />
                  )}
                </button>

                {/* Symbol Main Row Button */}
                <button
                  onClick={() => handleSelectSymbol(item.id)}
                  className="flex min-w-0 flex-1 items-center justify-between py-2 pr-2 text-left"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate font-bold text-white text-xs" title={item.name}>
                      {item.label}
                    </span>
                    <span className="truncate text-[10px] text-muted">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end leading-tight shrink-0 font-mono">
                    <span className="num font-bold text-white text-xs">
                      {ticker ? fmtPrice(ticker.price, item.id) : '—'}
                    </span>
                    <span className={`num text-[10px] font-semibold ${isUp ? 'text-white' : 'text-zinc-500'}`}>
                      {ticker ? fmtPct(ticker.change) : ''}
                    </span>
                  </div>
                </button>

                {/* Remove Symbol from List Button */}
                <button
                  aria-label={`Remove ${item.label}`}
                  className="hidden px-2 text-muted hover:text-white group-hover:block transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    audioHaptics.tick();
                    removeSymbolFromList(activeListId, item.id);
                  }}
                  title="Remove from watchlist"
                >
                  x
                </button>

                {/* Color Flag Selector Popover */}
                {flagPickerSymbol === item.id && (
                  <div ref={flagPickerRef} className="clay-popover absolute left-2 top-8 z-50 flex items-center gap-1.5 p-1.5 bg-[#14141c] border border-white/10 shadow-2xl rounded-full">
                    {FLAG_ORDER.map((fColor) => {
                      const c = FLAG_COLORS[fColor];
                      return (
                        <button
                          key={fColor}
                          onClick={(e) => {
                            e.stopPropagation();
                            audioHaptics.tick();
                            setFlag(item.id, fColor);
                            setFlagPickerSymbol(null);
                          }}
                          className="h-4 w-4 rounded-full transition transform hover:scale-125"
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      );
                    })}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        audioHaptics.tick();
                        setFlag(item.id, 'NONE');
                        setFlagPickerSymbol(null);
                      }}
                      className="h-4 w-4 rounded-full border border-zinc-500 hover:border-white flex items-center justify-center text-[8px] text-zinc-400"
                      title="Clear flag"
                    >
                      x
                    </button>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>

      {/* Bottom Status Bar */}
      <div className="border-t border-grid/50 px-3 py-1.5 flex items-center justify-between text-[10px] text-muted bg-[#09090d]/60">
        <span>{displayedSymbols.length} symbols</span>
        <span className="text-[9px]">Space: Next symbol</span>
      </div>
    </aside>
  );
}
