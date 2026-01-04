/**
 * Shared cache version management
 * Used by both auctionCache (IndexedDB) and indexedDBCache (rankings)
 * Cache version is stored in Firebase (system/cache document)
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

let cachedVersion: number | null = null;
let cachePromise: Promise<number> | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds - refetch from Firebase after this time

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

  // Return existing promise if one is in flight
  if (cachePromise !== null) return cachePromise;

  cachePromise = (async () => {
    try {
      // Import auth dynamically to avoid circular dependencies
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();

      // Check if user is authenticated before trying to access Firestore
      if (!auth.currentUser) {
        console.log('[CacheVersion] User not authenticated, using default version 1');
        cachedVersion = 1;
        lastFetchTime = Date.now();
        return 1;
      }

      const cacheDocRef = doc(db, 'system', 'cache');
      const cacheDoc = await getDoc(cacheDocRef);

      if (cacheDoc.exists()) {
        const version = cacheDoc.data()?.version || 1;
        const oldVersion = cachedVersion;
        cachedVersion = version;
        lastFetchTime = Date.now();
        
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
      return 1;
    } catch (error: any) {
      // Silently handle permission errors for unauthenticated users
      if (error?.code === 'permission-denied') {
        console.log('[CacheVersion] Permission denied (user not authenticated), using default version 1');
      } else {
        console.error('[CacheVersion] Error fetching cache version from Firebase:', error);
      }
      // Fall back to version 1 if there's an error
      cachedVersion = 1;
      lastFetchTime = Date.now();
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
}
