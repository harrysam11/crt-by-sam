import React, { useState } from 'react';
import { useJournalStore } from '../../store/useJournalStore';
import { fmtPnl, fmtPrice, fmtTime, labelOf, pnlClass } from '../../utils/formatters';
import type { JournalEntry } from '../../types/psychology';

const EMOTION_BADGES: Record<JournalEntry['emotionTag'], { label: string; cls: string }> = {
  PLANNED: { label: 'Planned Setup', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  FOMO: { label: 'FOMO Chase', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  REVENGE: { label: 'Revenge Trade', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  IMPULSE: { label: 'Impulse Entry', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export default function JournalModal() {
  const isModalOpen = useJournalStore((s) => s.isModalOpen);
  const closeJournalModal = useJournalStore((s) => s.closeJournalModal);
  const entries = useJournalStore((s) => s.entries);
  const selectedEntryId = useJournalStore((s) => s.selectedEntryId);
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const deleteEntry = useJournalStore((s) => s.deleteEntry);
  const filterEmotion = useJournalStore((s) => s.filterEmotion);
  const setFilterEmotion = useJournalStore((s) => s.setFilterEmotion);

  const [activeId, setActiveId] = useState<string | null>(selectedEntryId);

  if (!isModalOpen) return null;

  const filteredEntries = entries.filter((e) =>
    filterEmotion === 'ALL' ? true : e.emotionTag === filterEmotion
  );

  const selected = entries.find((e) => e.id === (activeId || selectedEntryId)) || filteredEntries[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-accent" />
            <h2 className="text-lg font-bold text-white">Trade Psychology Journal & Canvas Archive</h2>
            <span className="rounded-full bg-grid px-2.5 py-0.5 text-xs text-muted">
              {entries.length} snapshots recorded
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter buttons */}
            <div className="flex items-center gap-1">
              {(['ALL', 'PLANNED', 'FOMO', 'REVENGE', 'IMPULSE'] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterEmotion(tag)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                    filterEmotion === tag
                      ? 'bg-accent text-white'
                      : 'bg-grid/60 text-muted hover:text-white'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <button
              onClick={closeJournalModal}
              className="rounded-lg p-1.5 text-muted hover:bg-grid hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex min-h-0 flex-1">
          {/* Entries Sidebar List */}
          <div className="w-80 shrink-0 border-r border-grid overflow-y-auto bg-bg/30">
            {filteredEntries.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted">
                No entries matching the filter.
              </p>
            ) : (
              filteredEntries.map((e) => {
                const isSelected = selected?.id === e.id;
                const badge = EMOTION_BADGES[e.emotionTag];
                return (
                  <div
                    key={e.id}
                    onClick={() => setActiveId(e.id)}
                    className={`cursor-pointer border-b border-grid p-3.5 transition ${
                      isSelected ? 'bg-grid/80' : 'hover:bg-grid/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{labelOf(e.symbol)}</span>
                      <span className={`text-xs font-bold ${e.side === 'BUY' || e.side === 'LONG' ? 'text-up' : 'text-down'}`}>
                        {e.side}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-muted">{fmtTime(e.timestamp)}</span>
                      {e.pnl !== undefined && (
                        <span className={`num font-semibold ${pnlClass(e.pnl)}`}>
                          {fmtPnl(e.pnl)}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {e.chartDataUrl && (
                        <span className="text-[10px] text-muted">[Snapshot]</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Entry Detail View */}
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            {selected ? (
              <div className="space-y-6">
                {/* Meta details bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-grid bg-bg/60 p-4">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {labelOf(selected.symbol)} Execution Review
                    </h3>
                    <p className="text-xs text-muted">
                      Executed at {new Date(selected.timestamp).toLocaleString()} • Trade ID: {selected.tradeId.slice(0, 8)}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[11px] text-muted block">Entry Price</span>
                      <span className="num font-semibold text-white">{fmtPrice(selected.entryPrice, selected.symbol)}</span>
                    </div>
                    {selected.exitPrice && (
                      <div>
                        <span className="text-[11px] text-muted block">Exit Price</span>
                        <span className="num font-semibold text-white">{fmtPrice(selected.exitPrice, selected.symbol)}</span>
                      </div>
                    )}
                    {selected.pnl !== undefined && (
                      <div>
                        <span className="text-[11px] text-muted block">Realized PnL</span>
                        <span className={`num font-bold text-base ${pnlClass(selected.pnl)}`}>
                          {fmtPnl(selected.pnl)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart Snapshot Display */}
                <div className="relative overflow-hidden rounded-xl border border-grid bg-black/60 shadow-inner">
                  {selected.chartDataUrl ? (
                    <img
                      src={selected.chartDataUrl}
                      alt="Trade Chart Snapshot"
                      className="max-h-[420px] w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-xs text-muted">
                      No canvas snapshot captured for this order.
                    </div>
                  )}
                </div>

                {/* Psychology Tagging & Notes Editor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-grid bg-bg/40 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
                      Psychological State Tag
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['PLANNED', 'FOMO', 'REVENGE', 'IMPULSE'] as const).map((tag) => {
                        const b = EMOTION_BADGES[tag];
                        const isCurrent = selected.emotionTag === tag;
                        return (
                          <button
                            key={tag}
                            onClick={() => updateEntry(selected.id, { emotionTag: tag })}
                            className={`rounded-lg border p-2.5 text-xs font-bold transition text-left ${
                              isCurrent ? b.cls + ' ring-2 ring-white/20' : 'border-grid text-muted hover:text-white'
                            }`}
                          >
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-grid bg-bg/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Trade Notes & Rationale
                      </label>
                      <button
                        onClick={() => deleteEntry(selected.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete Log
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={selected.notes}
                      onChange={(e) => updateEntry(selected.id, { notes: e.target.value })}
                      placeholder="Why did you take this trade? Did you adhere to your risk rules?"
                      className="w-full rounded-lg border border-grid bg-bg px-3 py-2 text-xs text-white placeholder-muted/50 focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                Select an execution log to inspect its chart snapshot and psychology review.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
