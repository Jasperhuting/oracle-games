'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Rider } from '@/lib/types/rider';
import { RankingsContextType, RankingsProviderProps } from '@/lib/types/context';
import { getFromCache, saveToCache, clearOldVersions } from '@/lib/utils/indexedDBCache';
import { getCacheVersionAsync, primeCachedVersion } from '@/lib/utils/cacheVersion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const RankingsContext = createContext<RankingsContextType | undefined>(undefined);

const RANKINGS_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours (daily scrape)

export function RankingsProvider({
  children,
  autoLoad = true
}: RankingsProviderProps) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const lastKnownVersionRef = useRef<number | null>(null);

  const fetchRankings = useCallback(async (forceRefresh = false) => {
    if (typeof window === 'undefined') return;

    setLoading(true);
    setError(null);

    try {
      // Get current cache version dynamically from Firebase
      const cacheVersion = await getCacheVersionAsync();
      
      // Check if version changed - if so, clear old cache entries
      if (lastKnownVersionRef.current !== null && lastKnownVersionRef.current !== cacheVersion) {
        console.log(`[RankingsContext] Cache version changed from ${lastKnownVersionRef.current} to ${cacheVersion}, clearing old cache...`);
        await clearOldVersions(cacheVersion);
        forceRefresh = true; // Force fresh fetch since version changed
      }
      
      // Store the version we're using
      lastKnownVersionRef.current = cacheVersion;

      // Try to get from cache first (skip if forceRefresh)
      const cacheKey = `rankings_2026`;
      if (!forceRefresh) {
        const cached = await getFromCache<Rider[]>(cacheKey, cacheVersion, RANKINGS_CACHE_MAX_AGE);

        if (cached && cached.length > 0) {
          console.log(`[RankingsContext] Using cached rankings data (${cached.length} riders, version ${cacheVersion})`);
          setRiders(cached);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data if cache miss
      console.log(`[RankingsContext] Fetching fresh rankings data (cache version ${cacheVersion})`);
      let allRiders: Rider[] = [];
      let offset = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`/api/getRankings?limit=${limit}&offset=${offset}`);

        if (!response.ok) {
          throw new Error('Failed to load rankings');
        }

        const data = await response.json();
        allRiders = allRiders.concat(data.riders || []);

        hasMore = data.riders.length === limit;
        offset += limit;
      }

      console.log(`[RankingsContext] Fetched ${allRiders.length} riders from API`);

      // Store in IndexedDB for future use
      await saveToCache(cacheKey, allRiders, cacheVersion);
      await clearOldVersions(cacheVersion);

      setRiders(allRiders);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load rankings';
      console.error('[RankingsContext] Error loading rankings:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load rankings on mount if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      fetchRankings();
    }
  }, [autoLoad, fetchRankings]);

  // Poll cache version to avoid Firestore watch-stream instability in dev.
  useEffect(() => {
    let isActive = true;
    let permissionDenied = false;
    const cacheRef = doc(db, 'config', 'cache');

    const checkCacheVersion = async () => {
      try {
        if (permissionDenied || !isActive) return;
        const snapshot = await getDoc(cacheRef);
        if (!isActive || !snapshot.exists()) return;

        const version = snapshot.data()?.version ?? 1;

        const previousVersion = lastKnownVersionRef.current;

        // First check only initializes local tracking.
        if (previousVersion === null) {
          lastKnownVersionRef.current = version;
          primeCachedVersion(version);
          return;
        }

        if (version !== previousVersion) {
          console.log(`[RankingsContext] Cache version changed from ${previousVersion} to ${version}, refetching rankings...`);
          primeCachedVersion(version);
          lastKnownVersionRef.current = version;
          await clearOldVersions(version);
          if (!isActive) return;
          await fetchRankings(true);
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'permission-denied'
        ) {
          permissionDenied = true;
          console.warn('[RankingsContext] No permission for config/cache; skipping cache-version polling.');
          return;
        }
        console.error('[RankingsContext] Error checking cache version updates:', error);
      }
    };

    void checkCacheVersion();
    const pollInterval = setInterval(() => {
      void checkCacheVersion();
    }, 30000);

    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, [fetchRankings]);

  // Helper function to get a single rider by ID
  const getRiderById = useCallback((id: string): Rider | undefined => {
    return riders.find(r => r.id === id || r.nameID === id);
  }, [riders]);

  // Helper function to get multiple riders by IDs
  const getRidersByIds = useCallback((ids: string[]): Rider[] => {
    const idSet = new Set(ids);
    return riders.filter(r => idSet.has(r.id) || (r.nameID && idSet.has(r.nameID)));
  }, [riders]);

  return (
    <RankingsContext.Provider
      value={{
        riders,
        loading,
        error,
        refetch: fetchRankings,
        getRiderById,
        getRidersByIds,
      }}
    >
      {children}
    </RankingsContext.Provider>
  );
}

export function useRankings() {
  const context = useContext(RankingsContext);
  if (context === undefined) {
    throw new Error('useRankings must be used within a RankingsProvider');
  }
  return context;
}
