import React from 'react';

interface HotkeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HotkeyModal({ isOpen, onClose }: HotkeyModalProps) {
  if (!isOpen) return null;

  const categories = [
    {
      title: 'Lightning Execution',
      keys: [
        { key: 'B', desc: 'Instant Market Buy (0.01 lot size)' },
        { key: 'S', desc: 'Instant Market Sell (0.01 lot size)' },
        { key: 'C', desc: 'Cancel all active pending orders for current symbol' },
        { key: 'Esc', desc: 'Panic Flatten active position immediately' },
      ],
    },
    {
      title: 'Timeframe & Navigation',
      keys: [
        { key: '/', desc: 'Instant focus on global symbol search' },
        { key: '1 - 5', desc: 'Switch timeframe (1m, 5m, 15m, 1h, 1d)' },
        { key: 'H', desc: 'Jump directly to 1-Hour timeframe' },
      ],
    },
    {
      title: 'Psychology & System',
      keys: [
        { key: 'Alt + Z', desc: 'Toggle Zen Stream Mode (PnL Obfuscation & Box Breathing)' },
        { key: '?', desc: 'Open this Keyboard Hotkeys Cheatsheet' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="w-full max-w-xl rounded-[10px] border border-white/[0.08] bg-panel p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-grid pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold text-white">
              Keyboard Hotkeys & Navigation
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {categories.map((cat) => (
            <div key={cat.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                {cat.title}
              </h3>
              <div className="space-y-1.5">
                {cat.keys.map((k) => (
                  <div
                    key={k.key}
                    className="flex items-center justify-between rounded-lg border border-grid/60 bg-bg/50 px-3 py-2"
                  >
                    <span className="text-muted">{k.desc}</span>
                    <kbd className="rounded border border-grid bg-[#10141c] px-2 py-0.5 font-bold text-white shadow-inner">
                      {k.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-grid pt-3 text-[10px] text-muted flex items-center justify-between">
          <span>Keyboard shortcuts are disabled while typing inside input fields.</span>
          <button
            onClick={onClose}
            className="rounded bg-grid px-3 py-1 font-semibold text-white hover:bg-grid/80"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
