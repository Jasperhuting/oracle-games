import { getFromCache, removeFromCache, saveToCache } from './indexedDBCache';
import { getCacheVersionAsync } from './cacheVersion';

type TeamPayload = {
  riders?: unknown[];
  count?: number;
  [key: string]: unknown;
};

const inFlightByKey = new Map<string, Promise<TeamPayload>>();

function getCacheKey(gameId: string, userId: string): string {
  return `team_${gameId}_${userId}`;
}

export async function getCachedTeam(
  gameId: string,
  userId: string,
  maxAgeMs: number
): Promise<TeamPayload | null> {
  if (typeof window === 'undefined') return null;
  const version = await getCacheVersionAsync();
  return getFromCache<TeamPayload>(getCacheKey(gameId, userId), version, maxAgeMs);
}

export async function saveCachedTeam(
  gameId: string,
  userId: string,
  data: TeamPayload
): Promise<void> {
  if (typeof window === 'undefined') return;
  const version = await getCacheVersionAsync();
  await saveToCache(getCacheKey(gameId, userId), data, version);
}

export async function invalidateTeamCache(gameId: string, userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  await removeFromCache(getCacheKey(gameId, userId));
}

export async function fetchTeamWithCache(
  gameId: string,
  userId: string,
  options?: {
    maxAgeMs?: number;
    forceRefresh?: boolean;
  }
): Promise<{ data: TeamPayload; fromCache: boolean }> {
  const maxAgeMs = options?.maxAgeMs ?? 2 * 60 * 1000;
  const forceRefresh = options?.forceRefresh ?? false;
  const key = getCacheKey(gameId, userId);

  if (!forceRefresh) {
    const cached = await getCachedTeam(gameId, userId, maxAgeMs);
    if (cached) {
      return { data: cached, fromCache: true };
    }
  }

  const existingRequest = inFlightByKey.get(key);
  if (existingRequest) {
    const data = await existingRequest;
    return { data, fromCache: false };
  }

  const requestPromise = (async () => {
    const response = await fetch(`/api/games/${gameId}/team?userId=${userId}`);
    if (!response.ok) {
      throw new Error('Kon team niet laden');
    }
    const data = (await response.json()) as TeamPayload;
    await saveCachedTeam(gameId, userId, data);
    return data;
  })();

  inFlightByKey.set(key, requestPromise);

  try {
    const data = await requestPromise;
    return { data, fromCache: false };
  } finally {
    inFlightByKey.delete(key);
  }
}
