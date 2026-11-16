/**
 * Client-Side Database & High-Capacity Session Storage Engine.
 * Built with native IndexedDB to bypass the 5MB browser localStorage limit.
 * Manages:
 * - Full terminal sessions & multi-chart workspaces
 * - High-res chart snapshots and drawing backups per symbol
 * - Full JSON backup export & restore
 * - Storage quota & database health monitoring
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface TerminalSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  symbol: string;
  timeframe: string;
  layout: string;
  panes?: Record<string, { symbol: string; timeframe: string }>;
  drawingsCount: number;
  activeIndicatorsCount: number;
  description?: string;
  snapshotDataUrl?: string;
}

export interface DatabaseBackup {
  version: number;
  timestamp: number;
  appName: string;
  sessions: TerminalSession[];
  drawings: Record<string, any[]>;
  settings: Record<string, any>;
}

const DB_NAME = 'crt_terminal_db';
const DB_VERSION = 1;

class TerminalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Object store for saved trading workspace sessions
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('name', 'name', { unique: false });
          sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Object store for drawing snapshots per symbol
        if (!db.objectStoreNames.contains('drawings')) {
          db.createObjectStore('drawings', { keyPath: 'symbol' });
        }

        // Object store for journal snapshots and attachments
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Object store for audit logs
        if (!db.objectStoreNames.contains('audit_logs')) {
          const logStore = db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      req.onsuccess = () => {
        resolve(req.result);
      };

      req.onerror = () => {
        reject(req.error || new Error('Failed to open terminal database.'));
      };
    });

    return this.dbPromise;
  }

  // Session Operations
  async saveSession(session: TerminalSession): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        const store = tx.objectStore('sessions');
        const req = store.put(session);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage if IndexedDB is blocked in private browsing
      try {
        const key = `crt_session_${session.id}`;
        localStorage.setItem(key, JSON.stringify(session));
      } catch {}
    }
  }

  async listSessions(): Promise<TerminalSession[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: TerminalSession[] = req.result || [];
          // Sort newest first
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(list);
        };
        req.onerror = () => {
          resolve(this.listSessionsFallback());
        };
      });
    } catch {
      return this.listSessionsFallback();
    }
  }

  private listSessionsFallback(): TerminalSession[] {
    const list: TerminalSession[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('crt_session_')) {
          const raw = localStorage.getItem(key);
          if (raw) list.push(JSON.parse(raw));
        }
      }
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {}
    return list;
  }

  async loadSession(id: string): Promise<TerminalSession | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(this.loadSessionFallback(id));
      });
    } catch {
      return this.loadSessionFallback(id);
    }
  }

  private loadSessionFallback(id: string): TerminalSession | null {
    try {
      const raw = localStorage.getItem(`crt_session_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        const store = tx.objectStore('sessions');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
    try {
      localStorage.removeItem(`crt_session_${id}`);
    } catch {}
  }

  // Drawings Backups per Symbol
  async saveDrawingBackup(symbol: string, drawings: any[]): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('drawings', 'readwrite');
        const store = tx.objectStore('drawings');
        store.put({ symbol, drawings, timestamp: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  async loadDrawingBackup(symbol: string): Promise<any[] | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('drawings', 'readonly');
        const store = tx.objectStore('drawings');
        const req = store.get(symbol);
        req.onsuccess = () => resolve(req.result ? req.result.drawings : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // Storage Quota and Health
  async getStorageQuota(): Promise<{ usedBytes: number; quotaBytes: number; pctUsed: number; isSupported: boolean }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const used = est.usage ?? 0;
        const total = est.quota ?? (50 * 1024 * 1024 * 1024); // 50GB default quota
        const pct = total > 0 ? (used / total) * 100 : 0;
        return {
          usedBytes: used,
          quotaBytes: total,
          pctUsed: Number(pct.toFixed(2)),
          isSupported: true,
        };
      } catch {}
    }

    return {
      usedBytes: 0,
      quotaBytes: 50 * 1024 * 1024 * 1024,
      pctUsed: 0,
      isSupported: false,
    };
  }

  // Full Database Backup Export & Restore
  async exportFullBackup(): Promise<DatabaseBackup> {
    const sessions = await this.listSessions();
    const drawings: Record<string, any[]> = {};

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('crt_drawings_')) {
          const sym = key.replace('crt_drawings_', '');
          const val = localStorage.getItem(key);
          if (val) drawings[sym] = JSON.parse(val);
        }
      }
    } catch {}

    const settings: Record<string, any> = {};
    try {
      const settingsKeys = [
        'crt_theme_mode',
        'crt_language',
        'crt_telegram_config',
        'crt_chart_settings',
        'crt_favorite_tools',
        'crt_indicator_instances',
      ];
      settingsKeys.forEach((k) => {
        const val = localStorage.getItem(k);
        if (val) settings[k] = val;
      });
    } catch {}

    return {
      version: DB_VERSION,
      timestamp: Date.now(),
      appName: 'CRT Institutional Terminal',
      sessions,
      drawings,
      settings,
    };
  }

  async importFullBackup(backup: DatabaseBackup): Promise<{ ok: boolean; count: number }> {
    if (!backup || !backup.sessions) {
      return { ok: false, count: 0 };
    }

    let restored = 0;

    // Restore sessions
    for (const session of backup.sessions) {
      await this.saveSession(session);
      restored++;
    }

    // Restore drawings
    if (backup.drawings) {
      for (const [sym, items] of Object.entries(backup.drawings)) {
        try {
          localStorage.setItem(`crt_drawings_${sym}`, JSON.stringify(items));
          await this.saveDrawingBackup(sym, items);
        } catch {}
      }
    }

    // Restore settings
    if (backup.settings) {
      for (const [key, val] of Object.entries(backup.settings)) {
        try {
          localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        } catch {}
      }
    }

    return { ok: true, count: restored };
  }
}

export const dbService = new TerminalDatabase();
