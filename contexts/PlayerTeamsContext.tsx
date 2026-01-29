'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { PlayerTeamsContextType, RankingsProviderProps } from '@/lib/types/context';
import { PlayerTeam } from '@/lib/types';

const PlayerTeamsContext = createContext<PlayerTeamsContextType | undefined>(undefined);


export function PlayerTeamsProvider({
  children,
  autoLoad = true
}: RankingsProviderProps) {
  const pathname = usePathname();
  const isF1Page = pathname?.startsWith('/f1');
  
  const [riders, setRiders] = useState<PlayerTeam[]>([]);
  const [uniqueRiders, setUniqueRiders] = useState<PlayerTeam[]>([]);
  const [loading, setLoading] = useState(autoLoad && !isF1Page);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setLoading(true);
    setError(null);

    try {
      // Fetch fresh data
      console.log('[PlayerTeamsContext] Fetching fresh player teams data');
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
      console.log(`[PlayerTeamsContext] Fetched ${allRiders.length} riders from API, ${uniqueRiders.length} unique riders`);

      setRiders(allRiders);
      setUniqueRiders(uniqueRiders);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load rankings';
      console.error('[PlayerTeamsContext] Error loading rankings:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load rankings on mount if autoLoad is true and not on F1 pages
  useEffect(() => {
    if (autoLoad && !isF1Page) {
      fetchRankings();
    }
  }, [autoLoad, isF1Page, fetchRankings]);



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

export function usePlayerTeams(): PlayerTeamsContextType;
export function usePlayerTeams(preferredUserId?: string): PlayerTeamsContextType;
export function usePlayerTeams(preferredUserId?: string) {
  const context = useContext(PlayerTeamsContext);
  if (context === undefined) {
    throw new Error('useRankings must be used within a RankingsProvider');
  }

  const uniqueRiders = useMemo(() => {
    if (!preferredUserId) {
      return context.uniqueRiders;
    }

    const uniqueRidersMap = new Map<string, PlayerTeam>();

    context.riders.forEach((rider) => {
      if (!rider.riderNameId) return;

      const existing = uniqueRidersMap.get(rider.riderNameId);
      if (!existing) {
        uniqueRidersMap.set(rider.riderNameId, rider);
        return;
      }

      const existingIsPreferred = existing.userId === preferredUserId;
      const riderIsPreferred = rider.userId === preferredUserId;

      if (!existingIsPreferred && riderIsPreferred) {
        uniqueRidersMap.set(rider.riderNameId, rider);
      }
    });

    return Array.from(uniqueRidersMap.values());
  }, [context.riders, context.uniqueRiders, preferredUserId]);

  if (!preferredUserId) {
    return context;
  }

  return {
    ...context,
    uniqueRiders,
  };
}
