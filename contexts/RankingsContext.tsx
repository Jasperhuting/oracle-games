'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Rider } from '@/lib/types/rider';
import { getFromCache, saveToCache, clearOldVersions } from '@/lib/utils/indexedDBCache';
import { getCacheVersion } from '@/lib/utils/cacheVersion';

interface RankingsContextType {
  riders: Rider[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getRiderById: (id: string) => Rider | undefined;
  getRidersByIds: (ids: string[]) => Rider[];
}

const RankingsContext = createContext<RankingsContextType | undefined>(undefined);

interface RankingsProviderProps {
  children: ReactNode;
  autoLoad?: boolean; // Whether to automatically load rankings on mount (default: true)
}

export function RankingsProvider({
  children,
  autoLoad = true
}: RankingsProviderProps) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setLoading(true);
    setError(null);

    try {
      // Get current cache version dynamically
      const cacheVersion = getCacheVersion();

      // Try to get from cache first
      const cacheKey = `rankings_2026`;
      const cached = await getFromCache<Rider[]>(cacheKey, cacheVersion);

      if (cached && cached.length > 0) {
        console.log(`[RankingsContext] Using cached rankings data (${cached.length} riders, version ${cacheVersion})`);
        setRiders(cached);
        setLoading(false);
        return;
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
