/**
 * Hook to monitor cache invalidation from Firestore
 * Automatically invalidates local cache when server-side changes occur
 */

import { useEffect, useRef } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { invalidateAuctionCache } from '@/lib/utils/auctionCache';

const LAST_CHECK_KEY = 'oracle_last_cache_check';

export function useCacheInvalidation(gameId: string | null) {
  const lastInvalidationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gameId) return;

    // Subscribe to cache invalidation document
    const unsubscribe = onSnapshot(
      doc(db, 'system', 'cacheInvalidation'),
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const lastInvalidated = data.lastInvalidated?.toMillis();

        if (!lastInvalidated) return;

        // Get the last time we checked from localStorage
        const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
        const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0;

        // If there's been an invalidation since we last checked, clear the cache
        if (lastInvalidated > lastCheckTime) {
          console.log('[CacheInvalidation] Server-side change detected, invalidating cache');
          console.log('Reason:', data.reason);
          console.log('GameId:', data.gameId);

          // Invalidate cache for the affected game (or all if no specific game)
          if (!data.gameId || data.gameId === gameId) {
            invalidateAuctionCache(gameId);

            // Update last check time
            localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

            // Reload the page to fetch fresh data
            window.location.reload();
          }
        }

        // Store the latest invalidation time
        lastInvalidationRef.current = lastInvalidated;
      },
      (error) => {
        console.error('[CacheInvalidation] Error monitoring cache invalidation:', error);
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, [gameId]);
}
