/**
 * Layout Customizer Modal.
 * Lets users fully configure multi-chart workspace:
 *   - Pick grid layout (1x1 / 1x2 / 2x1 / 2x2)
 *   - Per-pane pair and timeframe selection
 *   - Sync toggles (symbol / timeframe / crosshair / range)
 *   - Save / load named workspace presets
 * Mobile responsive, zero emoji policy.
 */

import { useState } from 'react';
import { useLayoutStore, type ChartGridLayout } from '../../store/useLayoutStore';
import { DEFAULT_INSTRUMENTS, TIMEFRAMES } from '../../services/instruments';
import { audioHaptics } from '../../utils/notify';
import type { Timeframe } from '../../types/terminal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GRID_OPTIONS: { id: ChartGridLayout; label: string; desc: string; panes: number; svg: string }[] = [
  { id: '1x1', label: '1 Chart', desc: 'Full workspace single chart', panes: 1, svg: 'M3 3h18v18H3z' },
  { id: '1x2', label: '2 Charts Side', desc: 'Two charts side-by-side', panes: 2, svg: '' },
  { id: '2x1', label: '2 Charts Stack', desc: 'Two charts stacked vertically', panes: 2, svg: '' },
  { id: '2x2', label: '4 Charts Quad', desc: 'Institutional 4-pane grid', panes: 4, svg: '' },
];

const PANE_LABELS: Record<string, { layout: ChartGridLayout; label: string }[]> = {
  '1x1': [{ layout: '1x1', label: 'Main Chart' }],
  '1x2': [
    { layout: '1x2', label: 'Left Chart' },
    { layout: '1x2', label: 'Right Chart' },
  ],
  '2x1': [
    { layout: '2x1', label: 'Top Chart' },
    { layout: '2x1', label: 'Bottom Chart' },
  ],
  '2x2': [
    { layout: '2x2', label: 'Top-Left' },
    { layout: '2x2', label: 'Top-Right' },
    { layout: '2x2', label: 'Bottom-Left' },
    { layout: '2x2', label: 'Bottom-Right' },
  ],
};

const PANE_IDS = ['pane-1', 'pane-2', 'pane-3', 'pane-4'];

const ALL_TIMEFRAMES: Timeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'];

function GridIcon({ id, active }: { id: ChartGridLayout; active: boolean }) {
  const base = `w-7 h-7 rounded border ${active ? 'border-accent' : 'border-white/20'} bg-black/40 overflow-hidden grid gap-px p-0.5`;
  if (id === '1x1') return (
    <div className={base}>
      <div className={`rounded-sm ${active ? 'bg-accent/70' : 'bg-white/20'}`} />
    </div>
  );
  if (id === '1x2') return (
    <div className={`${base} grid-cols-2`}>
      <div className={`rounded-sm ${active ? 'bg-accent/70' : 'bg-white/20'}`} />
      <div className={`rounded-sm ${active ? 'bg-accent/40' : 'bg-white/10'}`} />
    </div>
  );
  if (id === '2x1') return (
    <div className={`${base} grid-rows-2`} style={{ gridTemplateColumns: '1fr' }}>
      <div className={`rounded-sm ${active ? 'bg-accent/70' : 'bg-white/20'}`} />
      <div className={`rounded-sm ${active ? 'bg-accent/40' : 'bg-white/10'}`} />
    </div>
  );
  return (
    <div className={`${base} grid-cols-2 grid-rows-2`}>
      <div className={`rounded-sm ${active ? 'bg-accent/70' : 'bg-white/20'}`} />
      <div className={`rounded-sm ${active ? 'bg-accent/40' : 'bg-white/10'}`} />
      <div className={`rounded-sm ${active ? 'bg-accent/40' : 'bg-white/10'}`} />
      <div className={`rounded-sm ${active ? 'bg-accent/25' : 'bg-white/10'}`} />
    </div>
  );
}

export default function LayoutCustomizerModal({ isOpen, onClose }: Props) {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const panes = useLayoutStore((s) => s.panes);
  const setPaneSymbol = useLayoutStore((s) => s.setPaneSymbol);
  const setPaneTimeframe = useLayoutStore((s) => s.setPaneTimeframe);
  const syncSymbol = useLayoutStore((s) => s.syncSymbol);
  const syncTimeframe = useLayoutStore((s) => s.syncTimeframe);
  const syncCrosshair = useLayoutStore((s) => s.syncCrosshair);
  const syncRange = useLayoutStore((s) => s.syncRange);
  const toggleSync = useLayoutStore((s) => s.toggleSync);
  const savedLayouts = useLayoutStore((s) => s.savedLayouts);
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  const loadLayout = useLayoutStore((s) => s.loadLayout);

  const [presetName, setPresetName] = useState('');
  const [symbolSearch, setSymbolSearch] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const paneCount = layout === '2x2' ? 4 : layout === '1x1' ? 1 : 2;
  const activePaneIds = PANE_IDS.slice(0, paneCount);
  const paneLabels = PANE_LABELS[layout] || [];

  const instruments = DEFAULT_INSTRUMENTS;
  const allSymbols = instruments.map((i) => i.id);

  const handleSave = () => {
    if (!presetName.trim()) return;
    audioHaptics.tick();
    useLayoutStore.getState().saveCurrentLayout(presetName.trim());
    setPresetName('');
  };

  const filteredSymbols = (paneId: string) => {
    const q = (symbolSearch[paneId] || '').toLowerCase();
    if (!q) return allSymbols.slice(0, 20);
    return allSymbols.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-[#090c14] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] shrink-0">
          <div>
            <h2 className="font-heading font-bold text-white text-base tracking-tight">Layout Customizer</h2>
            <p className="text-muted text-[11px] mt-0.5">Configure grid, pair, timeframe and sync settings per chart pane</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-white hover:bg-white/10 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 font-sans text-xs">

          {/* Grid Layout Picker */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Grid Layout</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {GRID_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setLayout(opt.id);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    layout === opt.id
                      ? 'border-accent/60 bg-accent/10 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                      : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15'
                  }`}
                >
                  <GridIcon id={opt.id} active={layout === opt.id} />
                  <div className="min-w-0">
                    <p className={`font-semibold text-[11px] ${layout === opt.id ? 'text-accent' : 'text-white'}`}>{opt.label}</p>
                    <p className="text-muted text-[9px] leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Per-Pane Configurator */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Per-Pane Configuration</p>
            <div className={`grid gap-3 ${paneCount === 1 ? 'grid-cols-1' : paneCount === 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {activePaneIds.map((paneId, idx) => {
                const pane = panes[paneId];
                const label = paneLabels[idx]?.label ?? `Pane ${idx + 1}`;
                const symQ = symbolSearch[paneId] || '';
                const syms = filteredSymbols(paneId);
                return (
                  <div key={paneId} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-[9px] font-bold text-accent">{idx + 1}</span>
                      <span className="font-semibold text-white text-[11px]">{label}</span>
                    </div>

                    {/* Symbol Selector */}
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Trading Pair</label>
                      <input
                        type="text"
                        placeholder={`Search pair... (${pane?.symbol})`}
                        value={symQ}
                        onChange={(e) => setSymbolSearch((prev) => ({ ...prev, [paneId]: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-muted focus:outline-none focus:border-accent/50 font-mono"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto">
                        {syms.map((sym) => (
                          <button
                            key={sym}
                            onClick={() => {
                              audioHaptics.tick();
                              setPaneSymbol(paneId, sym);
                              setSymbolSearch((prev) => ({ ...prev, [paneId]: '' }));
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition font-mono ${
                              pane?.symbol === sym
                                ? 'bg-accent/20 border-accent/50 text-accent'
                                : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                            }`}
                          >
                            {sym}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Timeframe Selector */}
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Timeframe</label>
                      <div className="flex flex-wrap gap-1">
                        {ALL_TIMEFRAMES.map((tf) => (
                          <button
                            key={tf}
                            onClick={() => {
                              audioHaptics.tick();
                              setPaneTimeframe(paneId, tf);
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold border transition font-mono ${
                              pane?.timeframe === tf
                                ? 'bg-accent text-white border-accent'
                                : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sync Toggles */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Multi-Chart Synchronization</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { key: 'syncSymbol' as const, label: 'Sync Symbol', desc: 'All panes follow same pair' },
                { key: 'syncTimeframe' as const, label: 'Sync Timeframe', desc: 'All panes share same TF' },
                { key: 'syncCrosshair' as const, label: 'Sync Crosshair', desc: 'Crosshair synced across panes' },
                { key: 'syncRange' as const, label: 'Sync Range', desc: 'Visible bar range locked' },
              ]).map(({ key, label, desc }) => {
                const checked = key === 'syncSymbol' ? syncSymbol : key === 'syncTimeframe' ? syncTimeframe : key === 'syncCrosshair' ? syncCrosshair : syncRange;
                return (
                  <button
                    key={key}
                    onClick={() => { audioHaptics.tick(); toggleSync(key); }}
                    className={`flex flex-col items-start p-3 rounded-xl border transition text-left ${
                      checked
                        ? 'border-accent/50 bg-accent/10'
                        : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition ${checked ? 'bg-accent border-accent' : 'border-white/30 bg-transparent'}`}>
                        {checked && (
                          <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold ${checked ? 'text-accent' : 'text-slate-300'}`}>{label}</span>
                    </div>
                    <p className="text-[9px] text-muted leading-tight">{desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preset Templates */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Preset Templates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {savedLayouts.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => { audioHaptics.tick(); loadLayout(tmpl.id); }}
                  className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition text-left ${
                    activeLayoutId === tmpl.id
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-[11px] truncate">{tmpl.name}</p>
                    <p className="text-[9px] text-muted mt-0.5">{tmpl.layout} &nbsp;•&nbsp; {Object.keys(tmpl.panes).length} pane{Object.keys(tmpl.panes).length !== 1 ? 's' : ''}</p>
                  </div>
                  <GridIcon id={tmpl.layout} active={activeLayoutId === tmpl.id} />
                </button>
              ))}
            </div>
          </section>

          {/* Save Current as Preset */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Save Current as Preset</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Name your workspace preset..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white placeholder-muted focus:outline-none focus:border-accent/50 font-sans"
              />
              <button
                onClick={handleSave}
                disabled={!presetName.trim()}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[11px] transition shrink-0"
              >
                Save
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/[0.07] shrink-0 bg-black/20">
          <p className="text-[10px] text-muted">Changes apply immediately to the chart canvas</p>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-[11px] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
