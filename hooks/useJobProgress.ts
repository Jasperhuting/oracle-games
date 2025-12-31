import { useState, useEffect, useCallback, useRef } from 'react';
import { JobProgress, UseJobProgressOptions } from '@/lib/types/hooks';

/**
 * Hook to poll for job progress from Firestore
 *
 * @example
 * const { progress, loading } = useJobProgress(jobId, {
 *   onProgress: (data) => {
 *     console.log('Progress:', data.progress.percentage);
 *   },
 *   onComplete: (result) => {
 *     toast.success('Job completed!');
 *   }
 * });
 */
export function useJobProgress(
  jobId: string | null,
  options: UseJobProgressOptions = {}
) {
  const {
    pollInterval = 2000,
    onProgress,
    onComplete,
    onError,
    enabled = true,
  } = options;

  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use refs to avoid recreating the interval on every callback change
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onProgress, onComplete, onError]);

  const fetchProgress = useCallback(async (): Promise<boolean> => {
    if (!jobId || !enabled) return true; // Stop polling

    try {
      const response = await fetch(`/api/jobs/${jobId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError(new Error('Job not found'));
          return true; // Stop polling
        }
        throw new Error(`Failed to fetch job: ${response.statusText}`);
      }

      const data: JobProgress = await response.json();

      setProgress(data);
      onProgressRef.current?.(data);

      // Stop polling if job is completed or failed
      if (data.status === 'completed') {
        onCompleteRef.current?.(data);
        return true;
      }

      if (data.status === 'failed') {
        onErrorRef.current?.(data);
        setError(new Error(data.error || 'Job failed'));
        return true;
      }

      return false; // Continue polling
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error fetching job progress:', error);
      return true; // Stop polling on error
    }
  }, [jobId, enabled]);

  useEffect(() => {
    if (!jobId || !enabled) {
      setProgress(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Initial fetch
    fetchProgress().then((shouldStop) => {
      if (!isMounted) return;

      setLoading(false);

      if (!shouldStop) {
        // Start polling
        intervalId = setInterval(async () => {
          const stop = await fetchProgress();
          if (stop && intervalId) {
            clearInterval(intervalId);
          }
        }, pollInterval);
      }
    });

    // Cleanup
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, enabled, pollInterval, fetchProgress]);

  return {
    progress,
    loading,
    error,
    isRunning: progress?.status === 'running' || progress?.status === 'pending',
    isCompleted: progress?.status === 'completed',
    isFailed: progress?.status === 'failed',
  };
}
