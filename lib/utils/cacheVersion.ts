/**
 * Shared cache version management
 * Used by both auctionCache (IndexedDB) and indexedDBCache (rankings)
 * Cache version is stored in Firebase (config/cache document)
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase/client';

let cachedVersion: number | null = null;
let cachePromise: Promise<number> | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 23 * 60 * 60 * 1000; // 23 hours
const VERSION_STORAGE_KEY = 'oracle_cache_version_value';
const VERSION_FETCHED_AT_STORAGE_KEY = 'oracle_cache_version_fetched_at';

// Promise that resolves when auth state is first determined
let authReadyPromise: Promise<void> | null = null;

/**
 * Wait for Firebase Auth to be initialized
 */
function waitForAuth(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
    });
  }
  return authReadyPromise;
}

/**
 * Get current cache version from Firebase
 * Now refetches from Firebase every 30 seconds to pick up changes
 */
export async function getCacheVersionAsync(): Promise<number> {
  if (typeof window === 'undefined') return 1;

  const now = Date.now();
  const cacheExpired = now - lastFetchTime > CACHE_TTL;

  // Return cached version if available and not expired
  if (cachedVersion !== null && !cacheExpired) return cachedVersion;

  // Reuse persisted version across page reloads while TTL is valid
  if (cachedVersion === null) {
    const storedVersionRaw = localStorage.getItem(VERSION_STORAGE_KEY);
    const storedFetchedAtRaw = localStorage.getItem(VERSION_FETCHED_AT_STORAGE_KEY);

    if (storedVersionRaw && storedFetchedAtRaw) {
      const storedVersion = Number.parseInt(storedVersionRaw, 10);
      const storedFetchedAt = Number.parseInt(storedFetchedAtRaw, 10);

      if (!Number.isNaN(storedVersion) && !Number.isNaN(storedFetchedAt) && now - storedFetchedAt <= CACHE_TTL) {
        cachedVersion = storedVersion;
        lastFetchTime = storedFetchedAt;
        return storedVersion;
      }
    }
  }

  // Return existing promise if one is in flight
  if (cachePromise !== null) return cachePromise;

  cachePromise = (async () => {
    try {
      // Wait for auth to be initialized before checking currentUser
      await waitForAuth();

      const auth = getAuth();

      // Check if user is authenticated before trying to access Firestore
      if (!auth.currentUser) {
        cachedVersion = 1;
        lastFetchTime = Date.now();
        return 1;
      }

      const cacheDocRef = doc(db, 'config', 'cache');
      const cacheDoc = await getDoc(cacheDocRef);

      if (cacheDoc.exists()) {
        const version = cacheDoc.data()?.version || 1;
        const oldVersion = cachedVersion;
        cachedVersion = version;
        lastFetchTime = Date.now();
        localStorage.setItem(VERSION_STORAGE_KEY, String(version));
        localStorage.setItem(VERSION_FETCHED_AT_STORAGE_KEY, String(lastFetchTime));
        
        // If version changed, clear local IndexedDB cache
        if (oldVersion !== null && oldVersion !== version) {
          console.log(`[CacheVersion] Version changed from ${oldVersion} to ${version}, clearing local cache`);
        }
        
        return version;
      }

      // If document doesn't exist, initialize it with version 1
      await setDoc(cacheDocRef, { version: 1 }, { merge: true });
      cachedVersion = 1;
      lastFetchTime = Date.now();
      localStorage.setItem(VERSION_STORAGE_KEY, '1');
      localStorage.setItem(VERSION_FETCHED_AT_STORAGE_KEY, String(lastFetchTime));
      return 1;
    } catch (error) {
      // Silently handle permission errors for unauthenticated users
      const errorCode = (error as { code?: string })?.code;
      if (errorCode !== 'permission-denied') {
        // Only log unexpected errors, not permission-denied (expected for unauthenticated users)
        console.error('[CacheVersion] Error fetching cache version from Firebase:', error);
      }
      // Fall back to version 1 if there's an error
      cachedVersion = 1;
      lastFetchTime = Date.now();
      localStorage.setItem(VERSION_STORAGE_KEY, '1');
      localStorage.setItem(VERSION_FETCHED_AT_STORAGE_KEY, String(lastFetchTime));
      return 1;
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
}

/**
 * Synchronous version - returns cached value or 1 as default
 * Use getCacheVersionAsync() for the most up-to-date version
 */
export function getCacheVersion(): number {
  if (typeof window === 'undefined') return 1;

  // If we don't have a cached version yet, trigger async fetch and return 1
  if (cachedVersion === null) {
    getCacheVersionAsync().catch(console.error);
    return 1;
  }

  return cachedVersion;
}

/**
 * Increment cache version - called when data changes (e.g., rider added)
 * This invalidates all caches across the app
 */
export async function incrementCacheVersion(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Call API endpoint to increment version in Firebase
    const response = await fetch('/api/increment-cache-version', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to increment cache version');
    }

    const data = await response.json();
    const newVersion = data.newVersion;

    console.log(`[CacheVersion] Incremented to ${newVersion}`);

    // Update local cache
    cachedVersion = newVersion;
    lastFetchTime = Date.now();
    localStorage.setItem(VERSION_STORAGE_KEY, String(newVersion));
    localStorage.setItem(VERSION_FETCHED_AT_STORAGE_KEY, String(lastFetchTime));

    // Reload page to apply new cache version
    window.location.reload();
  } catch (error) {
    console.error('[CacheVersion] Error incrementing cache version:', error);
    throw error;
  }
}

/**
 * Reset the cached version variable (useful for testing or forcing a refresh)
 */
export function resetCachedVersion(): void {
  cachedVersion = null;
  cachePromise = null;
  lastFetchTime = 0;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(VERSION_STORAGE_KEY);
    localStorage.removeItem(VERSION_FETCHED_AT_STORAGE_KEY);
  }
}

/**
 * Update local cache version without fetching Firestore.
 * Useful when another source (e.g. realtime listener) already knows the latest version.
 */
export function primeCachedVersion(version: number): void {
  if (typeof window === 'undefined') return;

  cachedVersion = version;
  lastFetchTime = Date.now();
  localStorage.setItem(VERSION_STORAGE_KEY, String(version));
  localStorage.setItem(VERSION_FETCHED_AT_STORAGE_KEY, String(lastFetchTime));
}
