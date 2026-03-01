import { getFromCache, saveToCache } from './indexedDBCache';
import { getCacheVersionAsync } from './cacheVersion';

type TeamsOverviewPayload = {
  teams?: unknown[];
  lastScoreUpdate?: string | null;
  [key: string]: unknown;
};

const inFlightByGame = new Map<string, Promise<TeamsOverviewPayload>>();
const CACHE_VERSION_TIMEOUT_MS = 1500;

function getCacheKey(gameId: string): string {
  return `teams_overview_${gameId}`;
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

export async function getCachedTeamsOverview(
  gameId: string,
  maxAgeMs: number
): Promise<TeamsOverviewPayload | null> {
  if (typeof window === 'undefined') return null;
  const version = await getSafeCacheVersion();
  return getFromCache<TeamsOverviewPayload>(getCacheKey(gameId), version, maxAgeMs);
}

export async function saveCachedTeamsOverview(
  gameId: string,
  data: TeamsOverviewPayload
): Promise<void> {
  if (typeof window === 'undefined') return;
  const version = await getSafeCacheVersion();
  await saveToCache(getCacheKey(gameId), data, version);
}

export async function fetchTeamsOverviewWithCache(
  gameId: string,
  options?: {
    maxAgeMs?: number;
    forceRefresh?: boolean;
  }
): Promise<{ data: TeamsOverviewPayload; fromCache: boolean }> {
  const maxAgeMs = options?.maxAgeMs ?? 2 * 60 * 1000;
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = await getCachedTeamsOverview(gameId, maxAgeMs);
    if (cached) {
      return { data: cached, fromCache: true };
    }
  }

  const existingRequest = inFlightByGame.get(gameId);
  if (existingRequest) {
    const data = await existingRequest;
    return { data, fromCache: false };
  }

  const requestPromise = (async () => {
    const response = await fetch(`/api/games/${gameId}/teams-overview`);
    if (!response.ok) {
      throw new Error('Kon teams-overview niet laden');
    }
    const data = (await response.json()) as TeamsOverviewPayload;
    await saveCachedTeamsOverview(gameId, data);
    return data;
  })();

  inFlightByGame.set(gameId, requestPromise);

  try {
    const data = await requestPromise;
    return { data, fromCache: false };
  } finally {
    inFlightByGame.delete(gameId);
  }
}
