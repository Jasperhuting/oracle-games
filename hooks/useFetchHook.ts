'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PullQueryResult } from '@/lib/data-fetching/types';

/**
 * Shared primitive for HTTP-based platform hooks.
 *
 * @param fetcher  Async function that returns the data. Called when enabled is true.
 * @param emptyValue  Returned as `data` when enabled is false or on error.
 * @param deps     Dependency array — same contract as useCallback/useEffect.
 * @param enabled  When false, fetch is skipped and emptyValue is returned immediately.
 *                 Use `!!userId` to gate on authentication.
 */
export function useFetchHook<T>(
  fetcher: () => Promise<T>,
  emptyValue: T,
  deps: unknown[],
  enabled = true,
): PullQueryResult<T> {
  const [data, setData] = useState<T>(emptyValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(emptyValue);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(emptyValue);
    } finally {
      setLoading(false);
    }
  // deps spread is intentional — callers control re-run via deps array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
