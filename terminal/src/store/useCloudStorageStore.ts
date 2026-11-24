/**
 * useCloudStorageStore.ts
 * Manages zero-load Bring-Your-Own-Storage (BYOS) configuration and synchronization.
 * ZERO EMOJI POLICY strictly enforced.
 */

import { create } from 'zustand';
import {
  syncToGitHubGist,
  loadFromGitHubGist,
  saveToOpfs,
  readFromOpfs,
  gatherLocalWorkspace,
  restoreLocalWorkspace,
  WorkspacePayload,
} from '../services/storage/cloudStorage';
import { audioHaptics } from '../utils/notify';

export type StorageProviderType = 'GITHUB_GIST' | 'OPFS' | 'SERVER_DB';

interface CloudStorageState {
  provider: StorageProviderType;
  githubToken: string;
  gistId: string;
  lastSyncTime: number | null;
  isSyncing: boolean;
  syncStatus: string | null;
  isModalOpen: boolean;

  // Actions
  openModal: () => void;
  closeModal: () => void;
  setProvider: (p: StorageProviderType) => void;
  setGithubToken: (t: string) => void;
  setGistId: (id: string) => void;
  syncNow: () => Promise<{ success: boolean; message: string }>;
  restoreNow: () => Promise<{ success: boolean; message: string }>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
}

export const useCloudStorageStore = create<CloudStorageState>((set, get) => ({
  provider: (localStorage.getItem('terminalx_storage_provider') as StorageProviderType) || 'GITHUB_GIST',
  githubToken: localStorage.getItem('terminalx_storage_gh_token') || '',
  gistId: localStorage.getItem('terminalx_storage_gist_id') || '',
  lastSyncTime: null,
  isSyncing: false,
  syncStatus: null,
  isModalOpen: false,

  openModal: () => {
    audioHaptics.tick();
    set({ isModalOpen: true });
  },

  closeModal: () => {
    set({ isModalOpen: false });
  },

  setProvider: (provider) => {
    localStorage.setItem('terminalx_storage_provider', provider);
    set({ provider });
  },

  setGithubToken: (githubToken) => {
    localStorage.setItem('terminalx_storage_gh_token', githubToken);
    set({ githubToken });
  },

  setGistId: (gistId) => {
    localStorage.setItem('terminalx_storage_gist_id', gistId);
    set({ gistId });
  },

  syncNow: async () => {
    const { provider, githubToken, gistId } = get();
    set({ isSyncing: true, syncStatus: 'Gathering local workspace...' });

    const payload = gatherLocalWorkspace();

    if (provider === 'GITHUB_GIST') {
      if (!githubToken.trim()) {
        set({ isSyncing: false, syncStatus: 'Missing GitHub Personal Access Token' });
        return { success: false, message: 'Please enter a GitHub Personal Access Token.' };
      }

      set({ syncStatus: 'Pushing to GitHub Gist...' });
      const res = await syncToGitHubGist(payload, githubToken.trim(), gistId.trim() || undefined);

      if (res.success && res.gistId) {
        localStorage.setItem('terminalx_storage_gist_id', res.gistId);
        set({
          gistId: res.gistId,
          isSyncing: false,
          lastSyncTime: Date.now(),
          syncStatus: res.message,
        });
        audioHaptics.tick();
        return { success: true, message: res.message };
      } else {
        set({ isSyncing: false, syncStatus: res.message });
        return { success: false, message: res.message };
      }
    } else if (provider === 'OPFS') {
      set({ syncStatus: 'Writing to high-speed Origin Private File System disk...' });
      const ok = await saveToOpfs('terminalx_backup.json', JSON.stringify(payload));
      set({
        isSyncing: false,
        lastSyncTime: ok ? Date.now() : null,
        syncStatus: ok ? 'Successfully written to local OPFS disk.' : 'OPFS storage unavailable in this browser.',
      });
      return {
        success: ok,
        message: ok ? 'Saved to local OPFS virtual disk.' : 'OPFS disk write failed.',
      };
    } else {
      // SERVER_DB fallback
      set({ syncStatus: 'Pushing to TerminalX Server...' });
      try {
        const token = localStorage.getItem('terminalx_auth_token');
        if (!token) {
          set({ isSyncing: false, syncStatus: 'Sign in required for server database sync.' });
          return { success: false, message: 'Sign in to TerminalX first.' };
        }
        const res = await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ data: payload }),
        });
        if (res.ok) {
          set({ isSyncing: false, lastSyncTime: Date.now(), syncStatus: 'Server database updated.' });
          return { success: true, message: 'Synced to TerminalX Server.' };
        }
      } catch (e: any) {
        set({ isSyncing: false, syncStatus: e.message });
      }
      return { success: false, message: 'Server database sync failed.' };
    }
  },

  restoreNow: async () => {
    const { provider, githubToken, gistId } = get();
    set({ isSyncing: true, syncStatus: 'Fetching backup...' });

    if (provider === 'GITHUB_GIST') {
      if (!githubToken.trim() || !gistId.trim()) {
        set({ isSyncing: false, syncStatus: 'GitHub Token and Gist ID required.' });
        return { success: false, message: 'GitHub Token and Gist ID required.' };
      }

      const res = await loadFromGitHubGist(githubToken.trim(), gistId.trim());
      if (res.success && res.data) {
        restoreLocalWorkspace(res.data);
        set({ isSyncing: false, lastSyncTime: Date.now(), syncStatus: 'Workspace restored.' });
        audioHaptics.tick();
        return { success: true, message: 'Workspace restored from GitHub Gist. Reloading in 1s...' };
      } else {
        set({ isSyncing: false, syncStatus: res.message });
        return { success: false, message: res.message };
      }
    } else if (provider === 'OPFS') {
      const raw = await readFromOpfs('terminalx_backup.json');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          restoreLocalWorkspace(parsed);
          set({ isSyncing: false, lastSyncTime: Date.now(), syncStatus: 'Restored from OPFS disk.' });
          return { success: true, message: 'Restored from local OPFS virtual disk.' };
        } catch {}
      }
      set({ isSyncing: false, syncStatus: 'No backup found in OPFS disk.' });
      return { success: false, message: 'No backup found in OPFS.' };
    }

    set({ isSyncing: false });
    return { success: false, message: 'Restore complete.' };
  },

  testConnection: async () => {
    const { provider, githubToken } = get();
    if (provider === 'GITHUB_GIST') {
      if (!githubToken.trim()) {
        return { success: false, message: 'Please enter a GitHub Personal Access Token.' };
      }
      try {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${githubToken.trim()}`,
            Accept: 'application/vnd.github+json',
          },
        });
        if (res.ok) {
          const u = await res.json();
          return { success: true, message: `Connected to GitHub as @${u.login}.` };
        }
        return { success: false, message: `GitHub authentication failed (${res.status}).` };
      } catch (err: any) {
        return { success: false, message: err.message || 'Network error reaching GitHub.' };
      }
    } else if (provider === 'OPFS') {
      const available = Boolean(navigator.storage && navigator.storage.getDirectory);
      return {
        success: available,
        message: available
          ? 'Browser Origin Private File System is fully available.'
          : 'OPFS is not supported in this browser.',
      };
    }
    return { success: true, message: 'Server database ready.' };
  },
}));
