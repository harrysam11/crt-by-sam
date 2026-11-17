import { useState, useEffect, useMemo, useRef } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useLayoutStore, type ChartGridLayout } from '../../store/useLayoutStore';
import { useJournalStore } from '../../store/useJournalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { usePsychologyStore } from '../../store/usePsychologyStore';
import { audioHaptics } from '../../utils/notify';
import { DEFAULT_INSTRUMENTS } from '../../services/instruments';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'NAVIGATION' | 'LAYOUT' | 'TRADING' | 'SYMBOL' | 'RISK';
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModal: (name: string) => void;
}

export default function CommandPaletteModal({ isOpen, onClose, onOpenModal }: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const symbol = useTerminalStore((s) => s.symbol);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const toggleChartMaximized = useLayoutStore((s) => s.toggleChartMaximized);
  const openJournalModal = useJournalStore((s) => s.openJournalModal);
  const setActiveRightDrawer = useDrawingStore((s) => s.setActiveRightDrawer);
  const snapBreakEven = useTerminalStore((s) => s.snapBreakEven);
  const flipPosition = useTerminalStore((s) => s.flipPosition);
  const closePosition = useTerminalStore((s) => s.closePosition);
  const triggerLockout = usePsychologyStore((s) => s.triggerLockout);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    return [
      // Navigation & Modals
      {
        id: 'nav-journal',
        title: 'Trade Psychology Journal & Weekly Review',
        subtitle: 'Inspect daily trade logs, canvas snapshots, and weekly debriefs',
        category: 'NAVIGATION',
        shortcut: 'J',
        action: () => openJournalModal(),
      },
      {
        id: 'nav-guardian',
        title: 'TradeXGuardian Risk & Prop Firm Shield',
        subtitle: 'Configure daily loss limits, consecutive loss caps, and prop firm rules',
        category: 'RISK',
        shortcut: 'G',
        action: () => onOpenModal('GUARDIAN'),
      },
      {
        id: 'nav-portfolio',
        title: 'Portfolio Dashboard & PnL Calendar',
        subtitle: 'Equity curve analytics, monthly PnL calendar, win rate stats',
        category: 'NAVIGATION',
        action: () => onOpenModal('PORTFOLIO'),
      },
      {
        id: 'nav-news-panel',
        title: 'Macro News Wire, Tweets & J7 Tracker',
        subtitle: 'Open real-time Forex Factory calendar and political/celebrity finance tweets',
        category: 'NAVIGATION',
        action: () => setActiveRightDrawer('NEWS_FEED'),
      },
      {
        id: 'nav-options',
        title: 'Option Chain Matrix & Volatility Surface',
        subtitle: 'Live strike calls/puts, implied volatility, Open Interest buildup',
        category: 'NAVIGATION',
        action: () => onOpenModal('OPTIONS'),
      },
      {
        id: 'nav-greeks',
        title: 'Options Greeks & Delta Neutral Scanner',
        subtitle: 'Real-time Delta, Gamma, Theta, Vega, and portfolio exposure',
        category: 'NAVIGATION',
        action: () => onOpenModal('GREEKS'),
      },
      {
        id: 'nav-funding',
        title: 'Perpetual Funding Rate Heatmap',
        subtitle: 'Global perpetual funding rates across exchanges',
        category: 'NAVIGATION',
        action: () => onOpenModal('FUNDING'),
      },
      {
        id: 'nav-liquidations',
        title: 'Liquidation Heatmap & Cascade Hunter',
        subtitle: 'Estimate liquidation clusters and stop hunt liquidity pools',
        category: 'NAVIGATION',
        action: () => onOpenModal('LIQUIDATIONS'),
      },
      {
        id: 'nav-vault',
        title: 'Broker API Vault & Hardware Key Storage',
        subtitle: 'Secure institutional API key manager with local AES encryption',
        category: 'NAVIGATION',
        action: () => onOpenModal('VAULT'),
      },
      {
        id: 'nav-tax',
        title: 'FnO & Crypto Tax Ledger (Audit Ready)',
        subtitle: 'Calculate realized turnover, STCG, Section 115BBH compliance',
        category: 'NAVIGATION',
        action: () => onOpenModal('TAX'),
      },
      {
        id: 'nav-screener',
        title: 'Institutional Market Screener',
        subtitle: 'Multi-timeframe momentum, volume breakouts, and RSI filters',
        category: 'NAVIGATION',
        action: () => onOpenModal('SCREENER'),
      },
      {
        id: 'nav-calendar',
        title: 'Forex Factory High-Impact Economic Calendar',
        subtitle: 'Upcoming CPI, NFP, rate decisions, and FOMC speeches',
        category: 'NAVIGATION',
        action: () => onOpenModal('CALENDAR'),
      },
      {
        id: 'nav-sessions',
        title: 'Market Sessions & Auto Backup Vault',
        subtitle: 'Active Asia, London, and New York trading session radar',
        category: 'NAVIGATION',
        action: () => onOpenModal('SESSIONS'),
      },

      // Layout Controls
      {
        id: 'layout-customizer',
        title: 'Customize Layout & Panes (Pairs & Timeframes)',
        subtitle: 'Configure grid, custom symbol and timeframe per pane, sync settings',
        category: 'LAYOUT',
        action: () => onOpenModal('LAYOUT_CUSTOMIZER'),
      },
      {
        id: 'layout-1x1',
        title: 'Layout: 1x1 Single Chart View',
        subtitle: 'Maximize workspace to one chart',
        category: 'LAYOUT',
        action: () => setLayout('1x1'),
      },
      {
        id: 'layout-1x2',
        title: 'Layout: 1x2 Vertical Dual Chart',
        subtitle: 'Side-by-side comparative chart panes',
        category: 'LAYOUT',
        action: () => setLayout('1x2'),
      },
      {
        id: 'layout-2x1',
        title: 'Layout: 2x1 Horizontal Stacked Charts',
        subtitle: 'Stacked top-down timeframes',
        category: 'LAYOUT',
        action: () => setLayout('2x1'),
      },
      {
        id: 'layout-2x2',
        title: 'Layout: 2x2 Quad Multi-Chart Grid',
        subtitle: 'Simultaneous 4-pane institutional grid view',
        category: 'LAYOUT',
        action: () => setLayout('2x2'),
      },
      {
        id: 'layout-maximize',
        title: 'Toggle Chart Maximize / Fullscreen Canvas',
        subtitle: 'Hide watchlists and sidebars for complete chart focus',
        category: 'LAYOUT',
        shortcut: 'Alt+M',
        action: () => toggleChartMaximized(),
      },
      {
        id: 'layout-dom',
        title: 'Toggle Depth of Market (DOM Ladder)',
        subtitle: 'Order book footprint and limit ladder execution',
        category: 'LAYOUT',
        action: () => setActiveRightDrawer((prev) => (prev === 'DOM' ? null : 'DOM')),
      },
      {
        id: 'layout-watchlist',
        title: 'Toggle Watchlist Drawer',
        subtitle: 'Open or close the quick pair watchlist sidebar',
        category: 'LAYOUT',
        action: () => setActiveRightDrawer((prev) => (prev === 'WATCHLIST' ? null : 'WATCHLIST')),
      },

      // Trading Actions
      {
        id: 'trade-snap-be',
        title: `Snap Break-Even on ${symbol}`,
        subtitle: 'Move Stop Loss directly to entry price to eliminate risk',
        category: 'TRADING',
        action: () => snapBreakEven(symbol),
      },
      {
        id: 'trade-flip',
        title: `Reverse / Flip Position on ${symbol}`,
        subtitle: 'Close current position and reverse direction instantly',
        category: 'TRADING',
        action: () => flipPosition(symbol),
      },
      {
        id: 'trade-close-50',
        title: `Close 50% Partial on ${symbol}`,
        subtitle: 'Lock in 50% profit at current market price',
        category: 'TRADING',
        action: () => useTerminalStore.getState().closePartialPosition(symbol, 0.5),
      },
      {
        id: 'trade-close-all',
        title: `Close All Market on ${symbol}`,
        subtitle: 'Instantly flatten active position at current market bid/ask',
        category: 'TRADING',
        action: () => closePosition(symbol),
      },
      {
        id: 'trade-emergency-lock',
        title: 'Emergency KillSwitch Lockdown (30 Minutes)',
        subtitle: 'Freeze trading capabilities and prevent emotional revenge trades',
        category: 'RISK',
        action: () => triggerLockout('Command Palette Manual Lockout', 1800000),
      },

      // Symbols & Quick Switch
      ...DEFAULT_INSTRUMENTS.slice(0, 15).map((item) => {
        return {
          id: `sym-${item.id}`,
          title: `Switch Symbol to ${item.id}`,
          subtitle: `${item.name} • ${item.category}`,
          category: 'SYMBOL' as const,
          action: () => setSymbol(item.id),
        };
      }),
    ];
  }, [symbol, setSymbol, setLayout, toggleChartMaximized, openJournalModal, setActiveRightDrawer, snapBreakEven, flipPosition, closePosition, triggerLockout, onOpenModal]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      return (
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
      );
    });
  }, [commands, query]);

  const handleSelect = (cmd: CommandItem) => {
    audioHaptics.tick();
    onClose();
    cmd.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-md p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#090a10]/95 shadow-2xl overflow-hidden font-sans flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <svg className="h-5 w-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, pair, tool, layout, or feature (e.g. Journal, 2x2, Gold, Stop Loss)..."
            className="flex-1 bg-transparent text-sm text-white placeholder-muted focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-muted">ESC</kbd>
          </div>
        </div>

        {/* Command List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-white/[0.04]">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              No matching commands or tools found for &quot;{query}&quot;.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                    isSelected ? 'bg-accent/20 border border-accent/40 text-white' : 'hover:bg-white/[0.04] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                      cmd.category === 'NAVIGATION' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                      cmd.category === 'LAYOUT' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      cmd.category === 'TRADING' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      cmd.category === 'RISK' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {cmd.category}
                    </span>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-white">{cmd.title}</div>
                      {cmd.subtitle && (
                        <div className="text-[11px] text-muted truncate">{cmd.subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cmd.shortcut && (
                      <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <span className="text-xs text-muted">↵</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 bg-white/[0.01] text-[10px] text-muted font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Institutional CRT Quick Command Palette</span>
        </div>
      </div>
    </div>
  );
}
