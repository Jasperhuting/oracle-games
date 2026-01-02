/**
 * Hook to monitor cache invalidation via API response headers
 *
 * Instead of using expensive Firestore realtime listeners, this hook polls
 * the cache version by making lightweight API calls and checking the
 * X-Cache-Version header in responses.
 *
 * Benefits:
 * - No Firestore listener costs (saves ~90% of operations)
 * - Works offline/online seamlessly
 * - Automatic invalidation when any API call detects a new version
 * - Configurable polling interval (default: 60 seconds)
 */

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { invalidateAuctionCache } from '@/lib/utils/auctionCache';

const CACHE_VERSION_KEY = 'oracle_cache_version';
const LAST_INVALIDATION_KEY = 'oracle_last_invalidation_time';
const RATE_LIMIT_MS = 5000; // Minimum 5 seconds between invalidations
const POLL_INTERVAL_MS = 60000; // Check every 60 seconds

export function useCacheInvalidation(gameId: string | null) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const processingInvalidationRef = useRef<boolean>(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!gameId) return;

    // Wait for auth state to be determined
    if (isAuthenticated === null) return;

    // Only monitor cache invalidation if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    // Poll cache version periodically
    const checkCacheVersion = async () => {
      try {
        // Make a lightweight API call to check cache version
        const response = await fetch(`/api/games/${gameId}/status`);

        if (!response.ok) {
          console.log('[CacheInvalidation] Failed to check cache version');
          return;
        }

        const cacheVersion = response.headers.get('X-Cache-Version');
        if (!cacheVersion) return;

        const currentVersion = parseInt(cacheVersion);
        const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
        const storedVersionNum = storedVersion ? parseInt(storedVersion) : null;

        // If version has changed, invalidate cache
        if (storedVersionNum !== null && currentVersion > storedVersionNum) {
          handleCacheInvalidation(currentVersion);
        } else if (storedVersionNum === null) {
          // First time - just store the version
          localStorage.setItem(CACHE_VERSION_KEY, String(currentVersion));
        }
      } catch (error) {
        console.error('[CacheInvalidation] Error checking cache version:', error);
      }
    };

    const handleCacheInvalidation = (newVersion: number) => {
      // Rate limiting: Check if we've invalidated recently
      const lastInvalidationStr = localStorage.getItem(LAST_INVALIDATION_KEY);
      const lastInvalidationTime = lastInvalidationStr ? parseInt(lastInvalidationStr) : 0;
      const timeSinceLastInvalidation = Date.now() - lastInvalidationTime;

      if (timeSinceLastInvalidation < RATE_LIMIT_MS) {
        console.log(
          `[CacheInvalidation] Rate limited - ${Math.ceil((RATE_LIMIT_MS - timeSinceLastInvalidation) / 1000)}s remaining`
        );
        return;
      }

      // Prevent duplicate processing
      if (processingInvalidationRef.current) {
        console.log('[CacheInvalidation] Already processing invalidation');
        return;
      }

      processingInvalidationRef.current = true;

      console.log('[CacheInvalidation] Cache version updated, invalidating cache');
      console.log('New version:', newVersion);

      // Invalidate cache
      invalidateAuctionCache(gameId);

      // Update stored version and last invalidation time
      localStorage.setItem(CACHE_VERSION_KEY, String(newVersion));
      localStorage.setItem(LAST_INVALIDATION_KEY, String(Date.now()));

      // Reload the page to fetch fresh data
      window.location.reload();
    };

    // Initial check
    checkCacheVersion();

    // Set up polling interval
    pollIntervalRef.current = setInterval(checkCacheVersion, POLL_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [gameId, isAuthenticated]);
}

/**
 * Helper function to check cache version from any API response
 * Call this after making API requests to detect cache invalidation immediately
 */
export function checkCacheVersionFromResponse(response: Response): void {
  const cacheVersion = response.headers.get('X-Cache-Version');
  if (!cacheVersion) return;

  const currentVersion = parseInt(cacheVersion);
  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  const storedVersionNum = storedVersion ? parseInt(storedVersion) : null;

  if (storedVersionNum === null) {
    // First time - just store the version
    localStorage.setItem(CACHE_VERSION_KEY, String(currentVersion));
  } else if (currentVersion > storedVersionNum) {
    // Version changed - trigger reload after current operation completes
    localStorage.setItem(CACHE_VERSION_KEY, String(currentVersion));

    console.log('[CacheInvalidation] Cache version updated from API response');
    console.log('New version:', currentVersion);

    // Use setTimeout to allow current operation to complete
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}
