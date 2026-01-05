/**
 * Auction data caching utility using IndexedDB
 * Caches game, bids, and participants data (NOT riders - that's handled by RankingsContext)
 */

import { getCacheVersionAsync, incrementCacheVersion } from './cacheVersion';

const DB_NAME = 'OracleGamesCache';
const DB_VERSION = 5; // Bumped to 5 to force cache clear after config/cache migration (Jan 2026)
const STORE_NAME = 'auction';

interface CachedAuctionData {
  gameData: any;
  participantData: any;
  allBidsData: any[];
  playerTeamsData: any;
  timestamp: number;
}

interface CacheEntry {
  key: string;
  data: CachedAuctionData;
  timestamp: number;
  version: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
      
      console.log(`[IndexedDB/Auction] Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

      // Clear all data when upgrading to version 4 (force fresh data after rider enrichment)
      // We do this by deleting and recreating the stores
      if (oldVersion > 0 && oldVersion < 5) {
        console.log('[IndexedDB/Auction] Clearing all cached data due to major update');
        if (db.objectStoreNames.contains('rankings')) {
          db.deleteObjectStore('rankings');
        }
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
      }

      // Create rankings store if it doesn't exist (from indexedDBCache)
      if (!db.objectStoreNames.contains('rankings')) {
        const rankingsStore = db.createObjectStore('rankings', { keyPath: 'key' });
        rankingsStore.createIndex('timestamp', 'timestamp', { unique: false });
        rankingsStore.createIndex('version', 'version', { unique: false });
      }

      // Create auction store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('version', 'version', { unique: false });
      }
    };
  });
}

/**
 * Get cached auction data for a specific game
 */
export async function getCachedAuctionData(gameId: string): Promise<CachedAuctionData | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await openDatabase();
    const currentVersion = await getCacheVersionAsync();
    const cacheKey = `auction_${gameId}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(cacheKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if cache version matches
        if (entry.version !== currentVersion) {
          console.log(`Cache version mismatch for ${cacheKey}. Expected ${currentVersion}, got ${entry.version}`);
          resolve(null);
          return;
        }

        const now = Date.now();
        // Check if cache is still valid
        if (now - entry.timestamp > CACHE_DURATION) {
          console.log(`Cache expired for ${cacheKey}`);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error reading auction cache:', error);
    return null;
  }
}

/**
 * Save auction data to cache (excludes riders - use RankingsContext for that)
 */
export async function setCachedAuctionData(
  gameId: string,
  gameData: any,
  participantData: any,
  allBidsData: any[],
  playerTeamsData: any
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDatabase();
    const currentVersion = await getCacheVersionAsync();
    const cacheKey = `auction_${gameId}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      const data: CachedAuctionData = {
        gameData,
        participantData,
        allBidsData,
        playerTeamsData,
        timestamp: Date.now(),
      };

      const entry: CacheEntry = {
        key: cacheKey,
        data,
        timestamp: Date.now(),
        version: currentVersion,
      };

      const request = objectStore.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const sizeEstimate = JSON.stringify(data).length;
        const sizeInKB = (sizeEstimate * 2) / 1024;
        console.log(`Successfully cached ${cacheKey} to IndexedDB (${sizeInKB.toFixed(2)}KB)`);
        resolve();
      };

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error writing auction cache:', error);
  }
}

/**
 * Invalidate cache for a specific game (call this when bids change)
 */
export async function invalidateAuctionCache(gameId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDatabase();
    const cacheKey = `auction_${gameId}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(cacheKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log(`Invalidated auction cache for ${gameId}`);
        resolve();
      };

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error invalidating auction cache:', error);
  }
}

/**
 * Clear all auction caches
 */
export async function clearAllAuctionCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('All auction caches cleared');
        resolve();
      };

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error clearing auction caches:', error);
  }
}

/**
 * Clear old cache entries by version
 */
export async function clearOldVersions(currentVersion: number): Promise<void> {
  if (typeof window === 'undefined') return;

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
          const entry = cursor.value as CacheEntry;
          if (entry.version !== currentVersion) {
            keysToDelete.push(entry.key);
          }
          cursor.continue();
        } else {
          // Cursor exhausted, now delete old entries
          keysToDelete.forEach(key => objectStore.delete(key));
          if (keysToDelete.length > 0) {
            console.log(`Cleared ${keysToDelete.length} old auction cache entries`);
          }
        }
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error clearing old auction cache versions:', error);
  }
}

/**
 * Increment cache version - called when riders data changes
 * This invalidates all existing caches by changing the cache key prefix
 */
export async function incrementCacheVersionClient(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Clear all old caches since they're now invalid
  await clearAllAuctionCaches();

  // Use shared increment function which will also reload the page
  incrementCacheVersion();
}
