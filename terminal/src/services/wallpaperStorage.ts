/**
 * IndexedDB Storage for Custom ChartSkins Wallpapers (MP4, GIF, Image).
 * Solves browser blob revocation on page refresh so user wallpapers persist permanently.
 * ZERO EMOJI POLICY strictly enforced.
 */

const DB_NAME = 'crt_wallpaper_vault';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const KEY_CURRENT = 'current_custom_wallpaper';

export interface StoredWallpaper {
  key: string;
  blob: Blob;
  name: string;
  type: 'VIDEO' | 'GIF' | 'IMAGE';
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save custom uploaded wallpaper file/blob to IndexedDB
 */
export async function saveCustomWallpaper(
  file: File | Blob,
  name: string,
  type: 'VIDEO' | 'GIF' | 'IMAGE'
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredWallpaper = {
        key: KEY_CURRENT,
        blob: file,
        name,
        type,
        updatedAt: Date.now(),
      };

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (err) {
    console.error('Failed to save wallpaper in IndexedDB:', err);
  }
}

/**
 * Retrieve saved custom wallpaper from IndexedDB
 */
export async function loadCustomWallpaper(): Promise<StoredWallpaper | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const getReq = store.get(KEY_CURRENT);
      getReq.onsuccess = () => {
        resolve(getReq.result || null);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.error('Failed to load wallpaper from IndexedDB:', err);
    return null;
  }
}

/**
 * Delete custom wallpaper from IndexedDB
 */
export async function clearCustomWallpaper(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const delReq = store.delete(KEY_CURRENT);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
    });
  } catch (err) {
    console.error('Failed to clear wallpaper from IndexedDB:', err);
  }
}
