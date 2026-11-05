/**
 * TradingView-Style Institutional Symbol Search Modal.
 * Integrates directly with DatafeedHub (Binance, Yahoo Finance, Custom User Provider).
 * Opens on:
 * - Keyboard shortcut "/" or "Ctrl+K"
 * - Direct alphanumeric typing when not in an input field
 * - Clicking symbol badge in top toolbar or chart legend HUD
 * Features:
 * - Category filters: All, Crypto, India (NSE/BSE), Forex, Commodities, Stocks, Indices
 * - Dynamic debounced multi-provider search across symbols, companies, and tickers
 * - Keyboard navigation (Up/Down/Enter/Escape)
 * - Recent symbol history & favorites
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { DEFAULT_INSTRUMENTS, CATEGORY_LABEL, registerInstruments } from '../../services/instruments';
import { datafeedHub } from '../../services/datafeed';
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
  const [searchResults, setSearchResults] = useState<Instrument[]>(DEFAULT_INSTRUMENTS);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Recent symbols from localStorage
  const [, setRecentSymbols] = useState<string[]>(() => {
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

  // Dynamic debounced search via DatafeedHub
  useEffect(() => {
    if (!isOpen) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cat = selectedCategory === 'ALL' ? undefined : selectedCategory;
        const results = await datafeedHub.searchSymbols(query, cat, controller.signal);
        setSearchResults(results);
        setSelectedIndex(0);
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          setSearchResults(DEFAULT_INSTRUMENTS.filter((i) => selectedCategory === 'ALL' || i.category === selectedCategory));
        }
      } finally {
        setIsLoading(false);
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query, selectedCategory]);

  // Handle selecting an instrument
  const handleSelectInstrument = (inst: Instrument) => {
    audioHaptics.tick();
    registerInstruments([inst]);
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
        setSelectedIndex((prev) => Math.min(searchResults.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = searchResults[selectedIndex];
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
  }, [isOpen, searchResults, selectedIndex]);

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
      <div className="clay-modal w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="relative flex items-center border-b border-grid/50 px-4 py-3 bg-panel/90">
          <svg className="h-5 w-5 text-muted mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            placeholder="Search symbol, company, ticker, or NSE/BSE stock..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none tracking-wide"
          />
          {isLoading && (
            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2 shrink-0" />
          )}
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="text-muted hover:text-white p-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="clay-btn ml-3 text-muted hover:text-white text-xs px-2 py-0.5">
            ESC
          </button>
        </div>

        {/* Category Filters Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-grid/50 bg-[#09090d]/60 overflow-x-auto text-xs no-scrollbar">
          {(['ALL', 'CRYPTO', 'IN_STOCK', 'FOREX', 'COMMODITY', 'US_STOCK', 'INDEX'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                audioHaptics.tick();
                setSelectedCategory(cat);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'clay-pill-active font-bold'
                  : 'clay-pill text-muted hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'All Markets' : CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-grid/30 p-2 space-y-1">
          {searchResults.length === 0 ? (
            <div className="py-12 text-center text-muted text-xs">
              {isLoading ? 'Searching live markets...' : `No matching instruments found for "${query}".`}
            </div>
          ) : (
            searchResults.map((inst, idx) => {
              const isSelected = selectedIndex === idx;
              const isCurrent = currentSymbol === inst.id;

              return (
                <div
                  key={inst.id}
                  data-index={idx}
                  onClick={() => handleSelectInstrument(inst)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                    isSelected ? 'bg-white/10 text-white shadow-clay-card' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-2 w-2 rounded-full bg-white shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-wide text-white">{inst.label}</span>
                        {isCurrent && (
                          <span className="clay-badge text-[9px] font-bold text-white">
                            ACTIVE
                          </span>
                        )}
                        <span className="clay-badge text-[9px] uppercase">
                          {inst.provider.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted truncate max-w-sm mt-0.5">
                        {inst.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <span className="clay-badge text-[9px] font-semibold uppercase">
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
        <div className="flex items-center justify-between border-t border-grid/50 px-4 py-2.5 bg-panel/90 text-[10px] text-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="clay-badge px-1 py-0.5 text-white">^</kbd> <kbd className="clay-badge px-1 py-0.5 text-white">v</kbd> navigate</span>
            <span><kbd className="clay-badge px-1.5 py-0.5 text-white">ENTER</kbd> select</span>
            <span><kbd className="clay-badge px-1 py-0.5 text-white">ESC</kbd> close</span>
          </div>
          <span>{searchResults.length} instruments</span>
        </div>
      </div>
    </div>
  );
}
