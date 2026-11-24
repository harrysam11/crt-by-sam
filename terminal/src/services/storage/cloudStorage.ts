/**
 * cloudStorage.ts
 * Zero-Load Bring-Your-Own-Storage (BYOS) Client-Side Engine for TerminalX.
 * Direct browser-to-cloud integrations:
 *  1. GitHub Gist (Unlimited, Free, Versioned, Zero Server Load)
 *  2. AWS S3 / Cloudflare R2 / Supabase Storage (Direct Client S3 REST)
 *  3. Browser OPFS (Origin Private File System: Native high-speed disk caching for video wallpapers & skins)
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface WorkspacePayload {
  drawings: any[];
  layout: any;
  wallpaper: string;
  watchlist: any[];
  chartSettings: any;
  timestamp: number;
}

export interface CloudStorageConfig {
  provider: 'GITHUB_GIST' | 'S3_R2' | 'OPFS' | 'SERVER_DB';
  githubToken?: string;
  gistId?: string;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
}

// -----------------------------------------------------------------------------
// 1. GitHub Gist Storage Provider
// -----------------------------------------------------------------------------
export async function syncToGitHubGist(
  payload: WorkspacePayload,
  token: string,
  existingGistId?: string
): Promise<{ success: boolean; gistId: string; message: string }> {
  if (!token) {
    return { success: false, gistId: '', message: 'GitHub Personal Access Token is required.' };
  }

  const files = {
    'terminalx_workspace.json': {
      content: JSON.stringify(payload, null, 2),
    },
    'terminalx_drawings.json': {
      content: JSON.stringify(payload.drawings || [], null, 2),
    },
    'terminalx_meta.txt': {
      content: `TerminalX Cloud Workspace Backup\nUpdated: ${new Date().toISOString()}\nDrawings Count: ${
        (payload.drawings || []).length
      }`,
    },
  };

  const isUpdate = Boolean(existingGistId);
  const url = isUpdate
    ? `https://api.github.com/gists/${existingGistId}`
    : 'https://api.github.com/gists';
  const method = isUpdate ? 'PATCH' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        description: 'TerminalX Pro Trading Workspace & Vector Drawings (BYOS)',
        public: false,
        files,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, gistId: existingGistId || '', message: `GitHub API error (${res.status}): ${err}` };
    }

    const data = await res.json();
    return {
      success: true,
      gistId: data.id,
      message: isUpdate
        ? `Workspace revision committed to Gist ${data.id.slice(0, 8)}.`
        : `New secret Gist created: ${data.id.slice(0, 8)}.`,
    };
  } catch (err: any) {
    return { success: false, gistId: existingGistId || '', message: err.message || 'Network error reaching GitHub.' };
  }
}

export async function loadFromGitHubGist(
  token: string,
  gistId: string
): Promise<{ success: boolean; data?: WorkspacePayload; message: string }> {
  if (!token || !gistId) {
    return { success: false, message: 'GitHub Token and Gist ID are required.' };
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      return { success: false, message: `Failed to fetch Gist (${res.status}). Verify Gist ID.` };
    }

    const data = await res.json();
    const file = data.files?.['terminalx_workspace.json'];
    if (!file || !file.content) {
      return { success: false, message: 'No terminalx_workspace.json found in this Gist.' };
    }

    const parsed = JSON.parse(file.content);
    return { success: true, data: parsed, message: 'Workspace successfully restored from GitHub Gist.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to read Gist payload.' };
  }
}

// -----------------------------------------------------------------------------
// 2. Browser OPFS (Origin Private File System) Native Disk Storage
// -----------------------------------------------------------------------------
export async function saveToOpfs(filename: string, content: string | Blob): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    return false;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('OPFS write failed:', e);
    return false;
  }
}

export async function readFromOpfs(filename: string): Promise<string | null> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 3. Local Workspace Snapshot Gatherer & Loader
// -----------------------------------------------------------------------------
export function gatherLocalWorkspace(): WorkspacePayload {
  let drawings = [];
  let layout = {};
  let wallpaper = '';
  let watchlist = [];
  let chartSettings = {};

  try {
    drawings = JSON.parse(localStorage.getItem('crt_drawings_v2') || '[]');
  } catch {}
  try {
    layout = JSON.parse(localStorage.getItem('crt_layout') || '{}');
  } catch {}
  try {
    wallpaper = localStorage.getItem('crt_chart_skin') || '';
  } catch {}
  try {
    watchlist = JSON.parse(localStorage.getItem('crt_watchlist') || '[]');
  } catch {}
  try {
    chartSettings = JSON.parse(localStorage.getItem('crt_chart_settings') || '{}');
  } catch {}

  return {
    drawings,
    layout,
    wallpaper,
    watchlist,
    chartSettings,
    timestamp: Date.now(),
  };
}

export function restoreLocalWorkspace(payload: WorkspacePayload) {
  if (payload.drawings) {
    localStorage.setItem('crt_drawings_v2', JSON.stringify(payload.drawings));
  }
  if (payload.layout) {
    localStorage.setItem('crt_layout', JSON.stringify(payload.layout));
  }
  if (payload.wallpaper) {
    localStorage.setItem('crt_chart_skin', payload.wallpaper);
  }
  if (payload.watchlist) {
    localStorage.setItem('crt_watchlist', JSON.stringify(payload.watchlist));
  }
  if (payload.chartSettings) {
    localStorage.setItem('crt_chart_settings', JSON.stringify(payload.chartSettings));
  }
}
