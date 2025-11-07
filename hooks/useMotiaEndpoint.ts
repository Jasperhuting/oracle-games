import { useState, useCallback } from 'react';
import { useMotia } from '@/components/MotiaProvider';

/**
 * Hook to call Motia endpoints with loading and error states
 * 
 * @example
 * const { data, loading, error, execute } = useMotiaEndpoint('/api/my-endpoint');
 * 
 * // Call the endpoint
 * await execute({ method: 'POST', body: JSON.stringify({ data }) });
 */
export function useMotiaEndpoint<T = any>(endpoint: string) {
  const { call } = useMotia();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (options?: RequestInit) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await call<T>(endpoint, options);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [endpoint, call]);

  return { data, loading, error, execute };
}
