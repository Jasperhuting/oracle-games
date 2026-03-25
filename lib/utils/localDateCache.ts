/**
 * Shared date helpers for IndexedDB day-keyed caching.
 * Used by RankingsContext and PlayerTeamsContext.
 */

export function getLocalDateCacheKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(timestamp: number): boolean {
  const cachedDate = new Date(timestamp);
  const now = new Date();
  return (
    cachedDate.getFullYear() === now.getFullYear() &&
    cachedDate.getMonth() === now.getMonth() &&
    cachedDate.getDate() === now.getDate()
  );
}
