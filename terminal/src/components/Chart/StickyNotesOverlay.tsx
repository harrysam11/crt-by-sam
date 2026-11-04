import { useState, useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { audioHaptics } from '../../utils/notify';

export interface StickyNote {
  id: string;
  symbol: string;
  time: number; // Unix timestamp in seconds
  text: string;
  category: 'SETUP' | 'MISTAKE' | 'KEY_LEVEL' | 'NOTE';
}

interface StickyNotesOverlayProps {
  symbol: string;
  chartApi: IChartApi | null;
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'crt_sticky_notes';

export default function StickyNotesOverlay({
  symbol,
  isOpen,
  onClose,
}: StickyNotesOverlayProps) {
  const [notes, setNotes] = useState<StickyNote[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [newText, setNewText] = useState('');
  const [category, setCategory] = useState<StickyNote['category']>('SETUP');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  const symbolNotes = notes.filter((n) => n.symbol === symbol);

  const handleAddNote = () => {
    if (!newText.trim()) return;
    audioHaptics.tick();
    const newNote: StickyNote = {
      id: `note-${Date.now()}`,
      symbol,
      time: Math.floor(Date.now() / 1000),
      text: newText.trim(),
      category,
    };
    setNotes((prev) => [newNote, ...prev]);
    setNewText('');
  };

  const handleDelete = (id: string) => {
    audioHaptics.tick();
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  if (!isOpen) return null;

  const categoryColor = (cat: StickyNote['category']) => {
    switch (cat) {
      case 'SETUP':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
      case 'MISTAKE':
        return 'text-red-400 border-red-500/40 bg-red-500/10';
      case 'KEY_LEVEL':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
      default:
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10';
    }
  };

  return (
    <div className="absolute right-3 top-10 z-30 w-80 rounded-lg border border-grid bg-panel/95 p-3.5 shadow-2xl backdrop-blur-md font-mono text-xs text-slate-200">
      <div className="flex items-center justify-between border-b border-grid pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <span className="font-bold uppercase tracking-wider text-white">Sticky Notes ({symbol})</span>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-grid px-1.5 py-0.5 text-[10px] text-muted hover:text-white"
        >
          [Close]
        </button>
      </div>

      {/* Input Form */}
      <div className="space-y-2 mb-3">
        <textarea
          rows={2}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Pin quick candle note (e.g. Volume ignition, liquidity sweep)..."
          className="w-full rounded border border-grid bg-bg p-2 text-xs text-white placeholder:text-muted/60 focus:border-accent focus:outline-none resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as StickyNote['category'])}
            className="rounded border border-grid bg-bg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
          >
            <option value="SETUP">Setup</option>
            <option value="MISTAKE">Mistake</option>
            <option value="KEY_LEVEL">Key Level</option>
            <option value="NOTE">General Note</option>
          </select>

          <button
            onClick={handleAddNote}
            disabled={!newText.trim()}
            className="rounded bg-accent px-3 py-1 text-xs font-semibold text-black hover:brightness-110 disabled:opacity-40"
          >
            Pin Note
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
        {symbolNotes.length === 0 ? (
          <p className="text-center py-4 text-muted text-[11px]">No pinned notes for {symbol}.</p>
        ) : (
          symbolNotes.map((note) => (
            <div
              key={note.id}
              className="rounded border border-grid bg-slate-900/60 p-2.5 space-y-1 hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${categoryColor(note.category)}`}>
                  {note.category}
                </span>
                <span className="text-[10px] text-muted">
                  {new Date(note.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-snug">{note.text}</p>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-[10px] text-muted hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
