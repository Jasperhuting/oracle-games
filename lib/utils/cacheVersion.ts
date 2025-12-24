/**
 * Shared cache version management
 * Used by both auctionCache (sessionStorage) and indexedDBCache (rankings)
 */

let cachedVersion: number | null = null;

/**
 * Get current cache version from localStorage
 */
export function getCacheVersion(): number {
  if (typeof window === 'undefined') return 1;

  if (cachedVersion !== null) return cachedVersion;

  const stored = localStorage.getItem('oracle_cache_version');
  cachedVersion = stored ? parseInt(stored) : 1;
  return cachedVersion;
}

/**
 * Increment cache version - called when data changes (e.g., rider added)
 * This invalidates all caches across the app
 */
export function incrementCacheVersion(): void {
  if (typeof window === 'undefined') return;

  const currentVersion = getCacheVersion();
  const newVersion = currentVersion + 1;

  localStorage.setItem('oracle_cache_version', String(newVersion));
  cachedVersion = newVersion;

  console.log(`[CacheVersion] Incremented from ${currentVersion} to ${newVersion}`);

  // Reload page to apply new cache version
  window.location.reload();
}

/**
 * Reset the cached version variable (useful for testing)
 */
export function resetCachedVersion(): void {
  cachedVersion = null;
}
