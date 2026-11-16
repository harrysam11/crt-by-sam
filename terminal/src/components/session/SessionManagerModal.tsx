import React, { useState, useEffect, useRef } from 'react';
import { dbService, type TerminalSession, type DatabaseBackup } from '../../services/dbService';
import { computeActiveSessions } from '../../services/marketSessions';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';
import { audioHaptics } from '../../utils/notify';
import { labelOf } from '../../utils/formatters';
import { safeJsonParse } from '../../utils/safeJson';

interface SessionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySession?: (session: TerminalSession) => void;
}

export default function SessionManagerModal({
  isOpen,
  onClose,
  onApplySession,
}: SessionManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'SESSIONS' | 'MARKET_SESSIONS' | 'DATABASE'>('SESSIONS');

  // Terminal state selectors
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const layout = useLayoutStore((s) => s.layout);
  const panes = useLayoutStore((s) => s.panes);
  const activeSymbolDrawings = useDrawingStore((s) => s.activeSymbolDrawings);
  const activeInstances = useIndicatorsStore((s) => s.activeInstances);

  // Sessions list
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [sessionNameInput, setSessionNameInput] = useState('');
  const [sessionDescInput, setSessionDescInput] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  // Market Sessions live tick state
  const [marketInfo, setMarketInfo] = useState(() => computeActiveSessions());

  // Database Quota state
  const [quota, setQuota] = useState<{ usedBytes: number; quotaBytes: number; pctUsed: number; isSupported: boolean }>({
    usedBytes: 0,
    quotaBytes: 50 * 1024 * 1024 * 1024,
    pctUsed: 0,
    isSupported: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions and quota on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const refreshData = async () => {
      const list = await dbService.listSessions();
      if (isMounted) setSessions(list);
      const q = await dbService.getStorageQuota();
      if (isMounted) setQuota(q);
    };
    refreshData();

    // Market session clock 1-second interval
    const interval = setInterval(() => {
      setMarketInfo(computeActiveSessions());
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const showFeedback = (text: string, ok: boolean = true) => {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSaveCurrentSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = sessionNameInput.trim() || `${labelOf(symbol)} ${timeframe.toUpperCase()} [${layout}]`;

    const newSession: TerminalSession = {
      id: `session_${Date.now()}`,
      name,
      description: sessionDescInput.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      symbol,
      timeframe,
      layout,
      panes: {
        'pane-1': { symbol: panes['pane-1']?.symbol || symbol, timeframe: panes['pane-1']?.timeframe || timeframe },
        'pane-2': { symbol: panes['pane-2']?.symbol || 'ETHUSDT', timeframe: panes['pane-2']?.timeframe || '1h' },
        'pane-3': { symbol: panes['pane-3']?.symbol || 'SOLUSDT', timeframe: panes['pane-3']?.timeframe || '4h' },
        'pane-4': { symbol: panes['pane-4']?.symbol || 'BNBUSDT', timeframe: panes['pane-4']?.timeframe || '1d' },
      },
      drawingsCount: activeSymbolDrawings.length,
      activeIndicatorsCount: activeInstances.length,
    };

    audioHaptics.tick();
    await dbService.saveSession(newSession);

    // Save drawing backup for current symbol
    await dbService.saveDrawingBackup(symbol, activeSymbolDrawings);

    setSessionNameInput('');
    setSessionDescInput('');
    const updated = await dbService.listSessions();
    setSessions(updated);
    showFeedback(`Workspace session "${name}" persisted in IndexedDB.`);
  };

  const handleLoadSession = (session: TerminalSession) => {
    audioHaptics.tick();

    // 1. Set symbol and timeframe
    useTerminalStore.getState().setSymbol(session.symbol as any);
    useTerminalStore.getState().setTimeframe(session.timeframe as any);

    // 2. Set multi-chart layout
    useLayoutStore.getState().setLayout(session.layout as any);
    if (session.panes) {
      Object.entries(session.panes).forEach(([pId, cfg]) => {
        useLayoutStore.getState().setPaneSymbol(pId, cfg.symbol);
        useLayoutStore.getState().setPaneTimeframe(pId, cfg.timeframe as any);
      });
    }

    if (onApplySession) {
      onApplySession(session);
    }

    showFeedback(`Loaded session: ${session.name}`);
    setTimeout(() => onClose(), 600);
  };

  const handleDeleteSession = async (id: string, name: string) => {
    audioHaptics.tick();
    await dbService.deleteSession(id);
    const updated = await dbService.listSessions();
    setSessions(updated);
    showFeedback(`Deleted session "${name}".`);
  };

  const handleExportBackup = async () => {
    audioHaptics.tick();
    try {
      const backup = await dbService.exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crt-terminal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showFeedback('Full database backup exported successfully.');
    } catch (err) {
      showFeedback('Export failed: ' + String(err), false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    audioHaptics.tick();
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = safeJsonParse<DatabaseBackup | null>(text, null);
        if (!parsed || (!parsed.sessions && !parsed.drawings)) {
          showFeedback('Invalid backup format or corrupted payload.', false);
          return;
        }

        const res = await dbService.importFullBackup(parsed);
        const updated = await dbService.listSessions();
        setSessions(updated);
        showFeedback(`Successfully restored ${res.count} workspace sessions.`);
      } catch (err) {
        showFeedback('Import failed: ' + String(err), false);
      }
    };
    reader.readAsText(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono select-none text-xs pointer-events-auto"
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[88vh] rounded-xl border border-grid bg-[#0c0d14] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid px-4 py-3 bg-panel/60">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <h3 className="text-sm font-bold tracking-wide text-white uppercase">
              Trading Sessions & Database Engine
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-grid bg-[#10111a] px-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('SESSIONS')}
            className={`px-3 py-2.5 border-b-2 transition ${
              activeTab === 'SESSIONS'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Saved Workspace Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('MARKET_SESSIONS')}
            className={`px-3 py-2.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'MARKET_SESSIONS'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Global Market Sessions</span>
            {marketInfo.isLondonNyOverlap && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/40">
                Peak Overlap
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('DATABASE')}
            className={`px-3 py-2.5 border-b-2 transition ${
              activeTab === 'DATABASE'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Database & Backups
          </button>
        </div>

        {/* Toast Feedback */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs font-semibold border-b ${
              feedback.ok
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'SESSIONS' && (
            <div className="space-y-4">
              {/* Save New Session Form */}
              <form onSubmit={handleSaveCurrentSession} className="rounded-xl border border-grid bg-bg/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Snapshot Current Workspace
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Live: {labelOf(symbol)} | {timeframe.toUpperCase()} | Layout: {layout}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={sessionNameInput}
                    onChange={(e) => setSessionNameInput(e.target.value)}
                    placeholder="Session name (e.g. London Gold Breakout)"
                    className="rounded border border-grid bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-accent focus:outline-none"
                  />
                  <input
                    type="text"
                    value={sessionDescInput}
                    onChange={(e) => setSessionDescInput(e.target.value)}
                    placeholder="Optional notes or trading plan"
                    className="rounded border border-grid bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-accent focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="clay-pill-active w-full py-1.5 font-bold text-xs"
                >
                  Save Workspace Session to Local Database
                </button>
              </form>

              {/* Sessions List */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Persisted Sessions ({sessions.length})
                </span>

                {sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-grid p-6 text-center text-slate-500">
                    <p>No saved sessions yet. Create one above to preserve your current chart layout and settings.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {sessions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-grid bg-panel/70 hover:border-slate-600 transition"
                      >
                        <div className="flex flex-col gap-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white truncate text-xs">{item.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-white/10 text-cyan-400 text-[9.5px] font-semibold uppercase">
                              {item.symbol}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-white/5 text-slate-300 text-[9.5px]">
                              {item.timeframe}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-white/5 text-amber-300 text-[9.5px]">
                              Grid: {item.layout}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-[9.5px] text-slate-500">
                            <span>Drawings: {item.drawingsCount}</span>
                            <span>Indicators: {item.activeIndicatorsCount}</span>
                            <span>Saved: {new Date(item.updatedAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleLoadSession(item)}
                            className="clay-pill-active px-3 py-1 font-bold text-[10.5px]"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteSession(item.id, item.name)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Delete session"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'MARKET_SESSIONS' && (
            <div className="space-y-4">
              {/* UTC Status Bar */}
              <div className="flex items-center justify-between rounded-xl border border-grid bg-bg/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white text-xs">UTC Market Clock</span>
                  <span className="font-mono text-cyan-400 text-xs font-semibold ml-1">
                    {marketInfo.currentUtcTimeString}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    Active Sessions: <span className="text-white font-bold">{marketInfo.activeCount}</span>
                  </span>
                  {marketInfo.isLondonNyOverlap && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                      London-NY Liquidity Overlap Active
                    </span>
                  )}
                </div>
              </div>

              {/* Major Sessions Grid */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Global Trading Sessions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {marketInfo.sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className={`p-3 rounded-xl border transition ${
                        sess.isActive
                          ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                          : 'border-grid bg-panel/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: sess.isActive ? sess.color : '#52525b' }}
                          />
                          <span className={`font-bold text-xs ${sess.isActive ? 'text-white' : 'text-slate-400'}`}>
                            {sess.name}
                          </span>
                        </div>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            sess.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {sess.isActive ? 'Open' : 'Closed'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>{sess.region}</span>
                        <span>{sess.startHourUtc}:00 - {sess.endHourUtc}:00 UTC</span>
                      </div>

                      {sess.isActive && (
                        <div>
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden my-1">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${sess.progressPct}%`, backgroundColor: sess.color }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500">
                            <span>Progress: {sess.progressPct}%</span>
                            <span>Remaining: {Math.floor(sess.remainingMinutes / 60)}h {sess.remainingMinutes % 60}m</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ICT Institutional Killzones */}
              <div className="space-y-2 border-t border-grid/60 pt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Institutional Killzones (High-Volume Setup Windows)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {marketInfo.activeKillzones.map((kz) => (
                    <div
                      key={kz.id}
                      className={`p-2.5 rounded-lg border text-[10.5px] ${
                        kz.isActive
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-grid bg-slate-950/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-bold ${kz.isActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                          {kz.name}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {kz.startHourUtc}:00 - {kz.endHourUtc}:00 UTC
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-tight">{kz.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DATABASE' && (
            <div className="space-y-4">
              {/* Storage Health Gauge */}
              <div className="rounded-xl border border-grid bg-bg/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase">
                      Client Storage Health (IndexedDB)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Status: Optimal (High Capacity)
                  </span>
                </div>

                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>Utilized Space: <strong className="text-white font-mono">{formatBytes(quota.usedBytes)}</strong></span>
                  <span>Estimated Quota: <strong className="text-white font-mono">{formatBytes(quota.quotaBytes)}</strong></span>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden my-1">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${Math.max(1, quota.pctUsed)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Unlike standard localStorage (capped at 5MB), CRT Terminal uses a dedicated IndexedDB engine, allowing high-resolution chart snapshots, hundreds of drawing annotations, and deep session logs without memory exhaustion.
                </p>
              </div>

              {/* Backup & Restore Controls */}
              <div className="rounded-xl border border-grid bg-panel/60 p-4 space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Export & Import Workspace Backups
                </span>
                <p className="text-[10.5px] text-slate-400 leading-relaxed">
                  Export a complete JSON backup of your trading terminal state — including all saved sessions, drawing objects across all symbols, indicators, and user settings — to transfer across devices or safeguard your technical analysis.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExportBackup}
                    className="clay-pill-active px-4 py-2 font-bold text-xs flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export Full Backup (.json)</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="clay-btn px-4 py-2 font-bold text-xs text-slate-200 hover:text-white flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <span>Import Backup (.json)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-grid px-4 py-3 bg-panel/40 flex items-center justify-between text-[11px] text-slate-400">
          <span>CRT Institutional Terminal v2.0 - IndexedDB Session Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded text-white bg-slate-800 hover:bg-slate-700 transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
