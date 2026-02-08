/**
 * IndexedDB cache utility for storing large datasets like rider rankings
 * Provides much larger storage capacity (~50MB+) compared to sessionStorage (~5-10MB)
 */

const DB_NAME = 'OracleGamesCache';
const DB_VERSION = 5; // Bumped to 5 to force cache clear after config/cache migration (Jan 2026)
const STORE_NAME = 'rankings';

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  version: number;
}

/**
 * Initialize IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available in server environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      
      console.log(`[IndexedDB] Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

      // Clear all data when upgrading to version 4 (force fresh data after rider enrichment)
      // We do this by deleting and recreating the stores
      if (oldVersion > 0 && oldVersion < 5) {
        console.log('[IndexedDB] Clearing all cached data due to major update');
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        if (db.objectStoreNames.contains('auction')) {
          db.deleteObjectStore('auction');
        }
      }

      // Create rankings store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('version', 'version', { unique: false });
      }

      // Create auction store if it doesn't exist (for auctionCache.ts)
      if (!db.objectStoreNames.contains('auction')) {
        const auctionStore = db.createObjectStore('auction', { keyPath: 'key' });
        auctionStore.createIndex('timestamp', 'timestamp', { unique: false });
        auctionStore.createIndex('version', 'version', { unique: false });
      }
    };
  });
}

/**
 * Get data from IndexedDB cache
 */
export async function getFromCache<T>(
  key: string,
  currentVersion: number,
  maxAgeMs?: number
): Promise<T | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if cache version matches
        if (entry.version !== currentVersion) {
          console.log(`Cache version mismatch for ${key}. Expected ${currentVersion}, got ${entry.version}`);
          resolve(null);
          return;
        }

        // Check if cache is too old
        if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
          const age = Date.now() - entry.timestamp;
          if (age > maxAgeMs) {
            console.log(`Cache expired for ${key}. Age ${Math.round(age / 1000)}s > ${Math.round(maxAgeMs / 1000)}s`);
            resolve(null);
            return;
          }
        }

        resolve(entry.data);
      };

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error reading from IndexedDB cache:', error);
    return null;
  }
}

/**
 * Save data to IndexedDB cache
 */
export async function saveToCache<T>(key: string, data: T, version: number): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        version,
      };

      const request = objectStore.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const sizeEstimate = JSON.stringify(data).length;
        const sizeInMB = (sizeEstimate * 2) / (1024 * 1024);
        console.log(`Successfully cached ${key} to IndexedDB (${sizeInMB.toFixed(2)}MB)`);
        resolve(true);
      };

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error writing to IndexedDB cache:', error);
    return false;
  }
}

/**
 * Remove specific entry from cache
 */
export async function removeFromCache(key: string): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error removing from IndexedDB cache:', error);
    return false;
  }
}

/**
 * Clear all entries from cache
 */
export async function clearCache(): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('IndexedDB cache cleared');
        resolve(true);
      };

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error clearing IndexedDB cache:', error);
    return false;
  }
}

/**
 * Clear old cache entries by version
 */
export async function clearOldVersions(currentVersion: number): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('version');
      const request = index.openCursor();

      const keysToDelete: string[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;

        if (cursor) {
          const entry = cursor.value as CacheEntry<unknown>;
          if (entry.version !== currentVersion) {
            keysToDelete.push(entry.key);
          }
          cursor.continue();
        } else {
          // Cursor exhausted, now delete old entries
          keysToDelete.forEach(key => objectStore.delete(key));
          if (keysToDelete.length > 0) {
            console.log(`Cleared ${keysToDelete.length} old cache entries`);
          }
        }
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error clearing old IndexedDB versions:', error);
    return false;
  }
}
