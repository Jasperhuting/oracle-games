import { getFromCache, removeFromCache, saveToCache } from './indexedDBCache';
import { getCacheVersionAsync } from './cacheVersion';

type TeamPayload = {
  riders?: unknown[];
  count?: number;
  [key: string]: unknown;
};

const inFlightByKey = new Map<string, Promise<TeamPayload>>();
const CACHE_VERSION_TIMEOUT_MS = 1500;

function getCacheKey(gameId: string, userId: string): string {
  return `team_${gameId}_${userId}`;
}

async function getSafeCacheVersion(): Promise<number> {
  if (typeof window === 'undefined') return 1;
  try {
    return await Promise.race<number>([
      getCacheVersionAsync(),
      new Promise<number>((resolve) => setTimeout(() => resolve(1), CACHE_VERSION_TIMEOUT_MS)),
    ]);
  } catch {
    return 1;
  }
}

function isValidTeamPayload(value: unknown): value is TeamPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as TeamPayload;
  if (payload.riders !== undefined && !Array.isArray(payload.riders)) return false;
  return true;
}

export async function getCachedTeam(
  gameId: string,
  userId: string,
  maxAgeMs: number
): Promise<TeamPayload | null> {
  if (typeof window === 'undefined') return null;
  const version = await getSafeCacheVersion();
  const cached = await getFromCache<TeamPayload>(getCacheKey(gameId, userId), version, maxAgeMs);
  if (!cached) return null;
  if (!isValidTeamPayload(cached)) {
    // Corrupt or stale shape in cache, discard and refetch.
    await invalidateTeamCache(gameId, userId);
    return null;
  }
  return cached;
}

export async function saveCachedTeam(
  gameId: string,
  userId: string,
  data: TeamPayload
): Promise<void> {
  if (typeof window === 'undefined') return;
  const version = await getSafeCacheVersion();
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
    if (!isValidTeamPayload(data)) {
      throw new Error('Ongeldige teamdata ontvangen');
    }
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
