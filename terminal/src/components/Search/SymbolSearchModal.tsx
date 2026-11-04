/**
 * TradingView-Style Institutional Symbol Search Modal.
 * Opens on:
 * - Keyboard shortcut "/" or "Ctrl+K"
 * - Direct alphanumeric typing when not in an input field
 * - Clicking symbol badge in top toolbar or chart legend HUD
 * Features:
 * - Category filters: All, Crypto, India (NSE), Forex, Commodities, Stocks, Indices
 * - Instant fuzzy search across IDs, names, and labels
 * - Keyboard navigation (Up/Down/Enter/Escape)
 * - Recent symbol history & favorites
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { DEFAULT_INSTRUMENTS, CATEGORY_LABEL } from '../../services/instruments';
import type { AssetCategory, Instrument } from '../../types/terminal';
import { audioHaptics } from '../../utils/notify';

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function SymbolSearchModal({
  isOpen,
  onClose,
  initialQuery = '',
}: SymbolSearchModalProps) {
  const currentSymbol = useTerminalStore((s) => s.symbol);
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'ALL'>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Recent symbols from localStorage
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('crt_recent_symbols');
      return stored ? JSON.parse(stored) : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', '^NSEI'];
    } catch {
      return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', '^NSEI'];
    }
  });

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialQuery]);

  // Filter instruments based on search query and category
  const filteredInstruments = useMemo(() => {
    const q = query.trim().toUpperCase();
    return DEFAULT_INSTRUMENTS.filter((inst) => {
      const matchesCategory = selectedCategory === 'ALL' || inst.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        inst.id.toUpperCase().includes(q) ||
        inst.label.toUpperCase().includes(q) ||
        inst.name.toUpperCase().includes(q)
      );
    });
  }, [query, selectedCategory]);

  // Handle selecting an instrument
  const handleSelectInstrument = (inst: Instrument) => {
    audioHaptics.tick();
    setSymbol(inst.id);

    // Save to recents
    setRecentSymbols((prev) => {
      const next = [inst.id, ...prev.filter((s) => s !== inst.id)].slice(0, 8);
      try {
        localStorage.setItem('crt_recent_symbols', JSON.stringify(next));
      } catch {}
      return next;
    });

    onClose();
  };

  // Keyboard navigation inside search modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(filteredInstruments.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredInstruments[selectedIndex];
        if (selected) {
          handleSelectInstrument(selected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredInstruments, selectedIndex]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/80 p-4 backdrop-blur-md font-mono select-none">
      <div className="w-full max-w-2xl rounded-xl border border-grid bg-panel shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="relative flex items-center border-b border-grid px-4 py-3 bg-slate-900/90">
          <svg className="h-5 w-5 text-slate-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search symbol, company, or market..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none tracking-wide"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-white p-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="ml-3 text-slate-400 hover:text-white text-xs border border-grid px-1.5 py-0.5 rounded">
            ESC
          </button>
        </div>

        {/* Category Filters Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-grid bg-panel/80 overflow-x-auto text-xs no-scrollbar">
          {(['ALL', 'CRYPTO', 'IN_STOCK', 'FOREX', 'COMMODITY', 'US_STOCK', 'INDEX'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                audioHaptics.tick();
                setSelectedCategory(cat);
                setSelectedIndex(0);
              }}
              className={`rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-accent/20 border border-accent text-accent'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
            >
              {cat === 'ALL' ? 'All Markets' : CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-grid/40 p-1">
          {filteredInstruments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No matching instruments found for "{query}".
            </div>
          ) : (
            filteredInstruments.map((inst, idx) => {
              const isSelected = selectedIndex === idx;
              const isCurrent = currentSymbol === inst.id;

              return (
                <div
                  key={inst.id}
                  data-index={idx}
                  onClick={() => handleSelectInstrument(inst)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                    isSelected ? 'bg-slate-800/90 text-white' : 'text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-2 w-2 rounded-full bg-accent/80 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-wide text-white">{inst.label}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                            ACTIVE
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 uppercase bg-slate-900 px-1.5 py-0.5 rounded border border-grid">
                          {inst.provider.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                        {inst.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-900/60 px-2 py-0.5 rounded border border-grid/60">
                      {CATEGORY_LABEL[inst.category]}
                    </span>
                    <span className="text-xs font-bold text-slate-300 w-12">
                      {inst.currency}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Info */}
        <div className="flex items-center justify-between border-t border-grid px-4 py-2 bg-slate-900/80 text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-grid text-white">↑</kbd> <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-grid text-white">↓</kbd> to navigate</span>
            <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-grid text-white">ENTER</kbd> to select</span>
            <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-grid text-white">ESC</kbd> to close</span>
          </div>
          <span>{filteredInstruments.length} instruments</span>
        </div>
      </div>
    </div>
  );
}
