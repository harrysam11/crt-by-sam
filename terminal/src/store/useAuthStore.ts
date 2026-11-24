import { create } from 'zustand';
import { audioHaptics } from '../utils/notify';

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  created_at: number;
}

interface AuthState {
  user: UserPublic | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'LOGIN' | 'REGISTER';
  isSyncing: boolean;
  lastSyncedAt: number | null;

  // Actions
  openAuthModal: (mode?: 'LOGIN' | 'REGISTER') => void;
  closeAuthModal: () => void;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  initSession: () => Promise<void>;
  syncWorkspace: () => Promise<boolean>;
  loadWorkspace: () => Promise<boolean>;
}

const TOKEN_KEY = 'terminalx_auth_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  isAuthenticated: false,
  isLoading: false,
  isAuthModalOpen: false,
  authModalMode: 'LOGIN',
  isSyncing: false,
  lastSyncedAt: null,

  openAuthModal: (mode = 'LOGIN') => {
    audioHaptics.tick();
    set({ isAuthModalOpen: true, authModalMode: mode });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false });
  },

  login: async (identifier, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.error || 'Authentication failed' };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
      });

      audioHaptics.tick();
      // Auto-load user workspace upon successful sign-in
      get().loadWorkspace();
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Network error occurred' };
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.error || 'Registration failed' };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
      });

      audioHaptics.tick();
      // Auto-sync initial workspace upon registration
      get().syncWorkspace();
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Network error occurred' };
    }
  },

  logout: () => {
    audioHaptics.tick();
    localStorage.removeItem(TOKEN_KEY);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      lastSyncedAt: null,
    });
  },

  initSession: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        set({ user, token, isAuthenticated: true });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        set({ user: null, token: null, isAuthenticated: false });
      }
    } catch {
      // Offline fallback: keep token for offline access
    }
  },

  syncWorkspace: async () => {
    const { token, isAuthenticated } = get();
    if (!token || !isAuthenticated) return false;

    set({ isSyncing: true });
    try {
      // Gather workspace state: drawings, indicators, layouts, wallpaper
      const drawings = localStorage.getItem('crt_drawings_v2') || '[]';
      const chartLayout = localStorage.getItem('crt_layout') || '{}';
      const wallpaper = localStorage.getItem('crt_chart_skin') || '';
      const watchlist = localStorage.getItem('crt_watchlist') || '[]';

      const payload = {
        data: {
          drawings: JSON.parse(drawings),
          chartLayout: JSON.parse(chartLayout),
          wallpaper,
          watchlist: JSON.parse(watchlist),
          clientTimestamp: Date.now(),
        },
      };

      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resp = await res.json();
        set({ isSyncing: false, lastSyncedAt: resp.updated_at * 1000 });
        return true;
      }
    } catch (e) {
      console.warn('Failed to sync workspace:', e);
    }
    set({ isSyncing: false });
    return false;
  },

  loadWorkspace: async () => {
    const { token, isAuthenticated } = get();
    if (!token || !isAuthenticated) return false;

    set({ isSyncing: true });
    try {
      const res = await fetch('/api/user/sync', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const resp = await res.json();
        if (resp.data) {
          const { drawings, chartLayout, wallpaper, watchlist } = resp.data;
          if (drawings) localStorage.setItem('crt_drawings_v2', JSON.stringify(drawings));
          if (chartLayout) localStorage.setItem('crt_layout', JSON.stringify(chartLayout));
          if (wallpaper) localStorage.setItem('crt_chart_skin', wallpaper);
          if (watchlist) localStorage.setItem('crt_watchlist', JSON.stringify(watchlist));
        }
        set({ isSyncing: false, lastSyncedAt: (resp.updated_at || Date.now() / 1000) * 1000 });
        return true;
      }
    } catch (e) {
      console.warn('Failed to load workspace:', e);
    }
    set({ isSyncing: false });
    return false;
  },
}));
