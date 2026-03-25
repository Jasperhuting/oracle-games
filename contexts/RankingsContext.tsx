'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Rider } from '@/lib/types/rider';
import { RankingsContextType, RankingsProviderProps } from '@/lib/types/context';
import { getCacheSnapshot, saveToCache, clearOldVersions, removeCacheEntriesByPrefix } from '@/lib/utils/indexedDBCache';
import { getCacheVersionAsync } from '@/lib/utils/cacheVersion';

const RankingsContext = createContext<RankingsContextType | undefined>(undefined);

function getLocalDateCacheKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(timestamp: number): boolean {
  const cachedDate = new Date(timestamp);
  const now = new Date();
  return (
    cachedDate.getFullYear() === now.getFullYear() &&
    cachedDate.getMonth() === now.getMonth() &&
    cachedDate.getDate() === now.getDate()
  );
}

export function RankingsProvider({
  children,
  autoLoad = true
}: RankingsProviderProps) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async (forceRefresh = false) => {
    if (typeof window === 'undefined') return;

    setLoading(true);
    setError(null);

    try {
      const cacheVersion = await getCacheVersionAsync();
      const dayKey = getLocalDateCacheKey();
      const cachePrefix = 'rankings_2026_';
      const cacheKey = `${cachePrefix}${dayKey}`;

      if (!forceRefresh) {
        const cached = await getCacheSnapshot<Rider[]>(cacheKey, cacheVersion);

        if (cached && cached.data.length > 0 && isSameLocalDay(cached.timestamp)) {
          console.log(`[RankingsContext] Using cached rankings data (${cached.data.length} riders, ${dayKey})`);
          setRiders(cached.data);
          setLoading(false);
          return;
        }
      }

      console.log(`[RankingsContext] Fetching fresh rankings data for ${dayKey}`);
      let allRiders: Rider[] = [];
      let nextCursor: string | null = null;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (nextCursor) {
          params.set('cursor', nextCursor);
        }

        const response = await fetch(`/api/getRankings?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to load rankings');
        }

        const data = await response.json();
        allRiders = allRiders.concat(data.riders || []);

        nextCursor = data.pagination?.nextCursor ?? null;
        hasMore = Boolean(nextCursor) && data.riders.length === limit;
      }

      console.log(`[RankingsContext] Fetched ${allRiders.length} riders from API`);

      await saveToCache(cacheKey, allRiders, cacheVersion);
      await clearOldVersions(cacheVersion);
      await removeCacheEntriesByPrefix(cachePrefix, cacheKey);

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
        uniqueRiders: riders,
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
