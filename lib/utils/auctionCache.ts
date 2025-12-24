/**
 * Auction data caching utility using sessionStorage
 * Caches game, bids, and participants data (NOT riders - that's handled by RankingsContext)
 */

import { getCacheVersion, incrementCacheVersion } from './cacheVersion';

interface CachedAuctionData {
  gameData: any;
  participantData: any;
  allBidsData: any[];
  playerTeamsData: any;
  timestamp: number;
}

function getCacheKeyPrefix(): string {
  return `auction_cache_${getCacheVersion()}_`;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached auction data for a specific game
 */
export function getCachedAuctionData(gameId: string): CachedAuctionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = `${getCacheKeyPrefix()}${gameId}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) return null;

    const data: CachedAuctionData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - data.timestamp > CACHE_DURATION) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading auction cache:', error);
    return null;
  }
}

/**
 * Save auction data to cache (excludes riders - use RankingsContext for that)
 */
export function setCachedAuctionData(
  gameId: string,
  gameData: any,
  participantData: any,
  allBidsData: any[],
  playerTeamsData: any
): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = `${getCacheKeyPrefix()}${gameId}`;
    const data: CachedAuctionData = {
      gameData,
      participantData,
      allBidsData,
      playerTeamsData,
      timestamp: Date.now(),
    };

    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing auction cache:', error);
    // If sessionStorage is full, clear old caches
    try {
      clearOldCaches();
      sessionStorage.setItem(`${getCacheKeyPrefix()}${gameId}`, JSON.stringify({
        gameData,
        participantData,
        allBidsData,
        playerTeamsData,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Error writing auction cache after cleanup:', e);
    }
  }
}

/**
 * Invalidate cache for a specific game (call this when bids change)
 */
export function invalidateAuctionCache(gameId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = `${getCacheKeyPrefix()}${gameId}`;
    sessionStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error invalidating auction cache:', error);
  }
}

/**
 * Clear all auction caches
 */
export function clearAllAuctionCaches(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(getCacheKeyPrefix())) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing auction caches:', error);
  }
}

/**
 * Clear caches older than CACHE_DURATION
 */
function clearOldCaches(): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const keys = Object.keys(sessionStorage);

    keys.forEach(key => {
      if (key.startsWith(getCacheKeyPrefix())) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || '');
          if (now - data.timestamp > CACHE_DURATION) {
            sessionStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid cache entry, remove it
          sessionStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('Error clearing old caches:', error);
  }
}

/**
 * Increment cache version - called when riders data changes
 * This invalidates all existing caches by changing the cache key prefix
 */
export function incrementCacheVersionClient(): void {
  if (typeof window === 'undefined') return;

  // Clear all old caches since they're now invalid
  clearAllAuctionCaches();

  // Use shared increment function which will also reload the page
  incrementCacheVersion();
}
