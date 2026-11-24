/**
 * CloudStorageModal.tsx
 * Institutional Bring-Your-Own-Storage (BYOS) Management Modal.
 * Enables zero-load cloud backups to user's personal GitHub Gist, local OPFS disk, or Server DB.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { useCloudStorageStore, StorageProviderType } from '../../store/useCloudStorageStore';
import { audioHaptics } from '../../utils/notify';

export default function CloudStorageModal() {
  const isModalOpen = useCloudStorageStore((s) => s.isModalOpen);
  const closeModal = useCloudStorageStore((s) => s.closeModal);
  const provider = useCloudStorageStore((s) => s.provider);
  const setProvider = useCloudStorageStore((s) => s.setProvider);
  const githubToken = useCloudStorageStore((s) => s.githubToken);
  const setGithubToken = useCloudStorageStore((s) => s.setGithubToken);
  const gistId = useCloudStorageStore((s) => s.gistId);
  const setGistId = useCloudStorageStore((s) => s.setGistId);
  const syncNow = useCloudStorageStore((s) => s.syncNow);
  const restoreNow = useCloudStorageStore((s) => s.restoreNow);
  const testConnection = useCloudStorageStore((s) => s.testConnection);
  const isSyncing = useCloudStorageStore((s) => s.isSyncing);
  const syncStatus = useCloudStorageStore((s) => s.syncStatus);
  const lastSyncTime = useCloudStorageStore((s) => s.lastSyncTime);

  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!isModalOpen) return null;

  const handleTest = async () => {
    audioHaptics.tick();
    setFeedback(null);
    const res = await testConnection();
    setFeedback(res);
  };

  const handleSync = async () => {
    audioHaptics.tick();
    setFeedback(null);
    const res = await syncNow();
    setFeedback(res);
  };

  const handleRestore = async () => {
    audioHaptics.tick();
    setFeedback(null);
    const res = await restoreNow();
    setFeedback(res);
    if (res.success) {
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-xl border border-grid bg-panel p-6 shadow-2xl text-slate-200 font-mono">
        {/* Close Button */}
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-muted hover:text-white transition p-1 rounded hover:bg-white/5"
          title="Close dialog"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded bg-cyan-400 text-black font-black text-xs font-mono shadow-xs">
            BYOS
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-heading tracking-tight">
              Cloud Storage &amp; Workspace Backup
            </h2>
            <p className="text-[11px] text-muted">
              Bring Your Own Storage • Direct Browser-to-Cloud with Zero Server Load
            </p>
          </div>
        </div>

        {/* Provider Switcher Tabs */}
        <div className="flex rounded-lg border border-grid p-1 bg-black/40 mb-5 text-xs">
          <button
            onClick={() => {
              audioHaptics.tick();
              setProvider('GITHUB_GIST');
              setFeedback(null);
            }}
            className={`flex-1 py-1.5 font-semibold rounded transition text-center ${
              provider === 'GITHUB_GIST'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-muted hover:text-white'
            }`}
          >
            GitHub Gist (Free)
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              setProvider('OPFS');
              setFeedback(null);
            }}
            className={`flex-1 py-1.5 font-semibold rounded transition text-center ${
              provider === 'OPFS'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-muted hover:text-white'
            }`}
          >
            Local OPFS Disk
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              setProvider('SERVER_DB');
              setFeedback(null);
            }}
            className={`flex-1 py-1.5 font-semibold rounded transition text-center ${
              provider === 'SERVER_DB'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-muted hover:text-white'
            }`}
          >
            TerminalX Server DB
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-4 rounded-md border p-2.5 text-xs ${
              feedback.success
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Provider Config Body */}
        {provider === 'GITHUB_GIST' && (
          <div className="space-y-4 mb-5">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-cyan-300 block mb-1">Zero-Cost Cloud Persistence</strong>
              Sync your vector drawings, multi-pane layouts, and skins directly to a private GitHub Gist.
              Your data is versioned, permanently accessible, and completely independent of any server downtime.
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                  GitHub Personal Access Token (classic or fine-grained with Gists permission)
                </label>
              </div>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full rounded border border-grid bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Gist ID (Optional: leave blank to automatically create a new Gist)
              </label>
              <input
                type="text"
                value={gistId}
                onChange={(e) => setGistId(e.target.value)}
                placeholder="e.g. 7f3b89a2c4e1..."
                className="w-full rounded border border-grid bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {provider === 'OPFS' && (
          <div className="space-y-3 mb-5">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-cyan-300 block mb-1">Origin Private File System (OPFS)</strong>
              Stores gigabyte-scale snapshots, video skins, and high-frequency tick databases directly in the browser virtual sandboxed disk.
              Completely private, zero cloud network transfer, instantaneous read/write speed.
            </div>
          </div>
        )}

        {provider === 'SERVER_DB' && (
          <div className="space-y-3 mb-5">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-cyan-300 block mb-1">TerminalX PostgreSQL / SQLite DB</strong>
              Stores workspace JSON in the native TerminalX server database associated with your authenticated user account.
            </div>
          </div>
        )}

        {/* Sync Info Strip */}
        <div className="flex items-center justify-between text-[11px] text-muted py-2 border-t border-grid mb-4">
          <span>Last Synced:</span>
          <span className="font-bold text-white">
            {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isSyncing}
            className="rounded border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            Test Auth
          </button>

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="rounded bg-cyan-400 hover:bg-cyan-300 text-black py-2 text-xs font-bold transition shadow-xs font-heading flex items-center justify-center gap-1.5"
          >
            {isSyncing ? (
              <span className="h-3.5 w-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              'Push to Cloud'
            )}
          </button>

          <button
            type="button"
            onClick={handleRestore}
            disabled={isSyncing}
            className="rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 py-2 text-xs font-bold transition"
          >
            Pull &amp; Restore
          </button>
        </div>
      </div>
    </div>
  );
}
