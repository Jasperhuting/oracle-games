'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Rider } from '@/lib/types/rider';
import { PlayerTeamsContextType, RankingsProviderProps } from '@/lib/types/context';
import { getFromCache, saveToCache, clearOldVersions } from '@/lib/utils/indexedDBCache';
import { getCacheVersionAsync, resetCachedVersion } from '@/lib/utils/cacheVersion';
import { PlayerTeam } from '@/lib/types';

const PlayerTeamsContext = createContext<PlayerTeamsContextType | undefined>(undefined);

const VERSION_CHECK_INTERVAL = 30 * 1000; // Check for new version every 30 seconds

export function PlayerTeamsProvider({
  children,
  autoLoad = true
}: RankingsProviderProps) {
  const [riders, setRiders] = useState<PlayerTeam[]>([]);
  const [uniqueRiders, setUniqueRiders] = useState<PlayerTeam[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const lastKnownVersionRef = useRef<number | null>(null);

  const fetchRankings = useCallback(async (forceRefresh = false) => {
    if (typeof window === 'undefined') return;

    setLoading(true);
    setError(null);

    try {
      // Always reset cached version to get fresh version from Firebase
      // This ensures we always check the latest version
      resetCachedVersion();
      
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
      const cacheKey = `playerTeams_1_2`;
      if (!forceRefresh) {
        const cached = await getFromCache<PlayerTeam[]>(cacheKey, cacheVersion);

        if (cached && cached.length > 0) {
          console.log(`[PlayerTeamsContext] Using cached player teams data (${cached.length} riders, version ${cacheVersion})`);
          
          // Filter duplicates from cached data as well
          const uniqueRidersMap = new Map<string, PlayerTeam>();
          cached.forEach(rider => {
            if (rider.riderNameId && !uniqueRidersMap.has(rider.riderNameId)) {
              uniqueRidersMap.set(rider.riderNameId, rider);
            }
          });
          
          const uniqueCachedRiders = Array.from(uniqueRidersMap.values());
          console.log(`[PlayerTeamsContext] Filtered cached data: ${cached.length} -> ${uniqueCachedRiders.length} unique riders`);
          
          setRiders(cached);
          setUniqueRiders(uniqueCachedRiders);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data if cache miss
      console.log(`[PlayerTeamsContext] Fetching fresh player teams data (cache version ${cacheVersion})`);
      let allRiders: PlayerTeam[] = [];
      let offset = 0;
      const limit = 2000;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`/api/getPlayerTeams?limit=${limit}&offset=${offset}`);

        

        if (!response.ok) {
          throw new Error('Failed to load player teams');
        }

        const data = await response.json();

        console.log('data', data)
        allRiders = allRiders.concat(data.riders || []);

        hasMore = data.riders.length === limit;
        offset += limit;
      }

      // Filter duplicates based on riderNameId, keeping only the first occurrence
      const uniqueRidersMap = new Map<string, PlayerTeam>();
      allRiders.forEach(rider => {
        if (rider.riderNameId && !uniqueRidersMap.has(rider.riderNameId)) {
          uniqueRidersMap.set(rider.riderNameId, rider);
        }
      });
      
      const uniqueRiders = Array.from(uniqueRidersMap.values());
      console.log(`[RankingsContext] Fetched ${allRiders.length} riders from API, ${uniqueRiders.length} unique riders`);

      // Store in IndexedDB for future use
      await saveToCache(cacheKey, uniqueRiders, cacheVersion);
      await clearOldVersions(cacheVersion);

      setRiders(allRiders);
      setUniqueRiders(uniqueRiders);
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

  // Periodically check for cache version changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkForVersionChange = async () => {
      try {
        // Reset to force fresh fetch from Firebase
        resetCachedVersion();
        const currentVersion = await getCacheVersionAsync();
        
        if (lastKnownVersionRef.current !== null && currentVersion !== lastKnownVersionRef.current) {
          console.log(`[RankingsContext] Cache version changed from ${lastKnownVersionRef.current} to ${currentVersion}, clearing IndexedDB and refetching...`);
          
          // Clear the old cached data from IndexedDB
          await clearOldVersions(currentVersion);
          
          // Refetch with force refresh
          fetchRankings(true);
        }
      } catch (error) {
        console.error('[RankingsContext] Error checking cache version:', error);
      }
    };

    const intervalId = setInterval(checkForVersionChange, VERSION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchRankings]);


  return (
    <PlayerTeamsContext.Provider
      value={{
        riders,
        uniqueRiders,
        loading,
        error,
        refetch: fetchRankings,
        total: riders.length
      }}
    >
      {children}
    </PlayerTeamsContext.Provider>
  );
}

export function usePlayerTeams() {
  const context = useContext(PlayerTeamsContext);
  if (context === undefined) {
    throw new Error('useRankings must be used within a RankingsProvider');
  }
  return context;
}
