import { useEffect, useState, useRef } from 'react';

interface FileMetadata {
  race: string;
  url: string;
  exists: boolean;
  lastModified: string | null;
  etag: string | null;
  status: number;
}

interface UseDataRefreshOptions {
  pollingInterval?: number; // milliseconds
  onDataChanged?: (changedFiles: string[]) => void;
  enableAutoPolling?: boolean; // Default false
}

export function useDataRefresh({ 
  pollingInterval = 3000, // 1 minute
  onDataChanged,
  enableAutoPolling = false 
}: UseDataRefreshOptions = {}) {
  const [lastChecked, setLastChecked] = useState<Record<string, string>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkForUpdates = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    setError(null);

    try {
      // Add cache-busting timestamp
      const cacheBuster = `?_t=${Date.now()}`;
      const response = await fetch(`/api/metadata${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch metadata');
      
      const data = await response.json();
      const files = data.files as FileMetadata[];
      
      const changedFiles: string[] = [];
      const newLastChecked: Record<string, string> = {};

      files.forEach(file => {
        const previousTimestamp = lastChecked[file.race];
        
        if (file.exists && file.lastModified) {
          newLastChecked[file.race] = file.lastModified;
          
          // Check for changes after initial load
          if (hasInitialized.current && previousTimestamp && previousTimestamp !== file.lastModified) {
            changedFiles.push(file.race);
          }
        } else {
          // File doesn't exist or no lastModified
          // If we had a timestamp before but now file doesn't exist, it was deleted
          if (hasInitialized.current && previousTimestamp) {
            changedFiles.push(file.race);
          }
          // Don't update lastChecked for non-existent files
          if (previousTimestamp) {
            newLastChecked[file.race] = previousTimestamp;
          }
        }
      });

      if (changedFiles.length > 0 && onDataChanged) {
        onDataChanged(changedFiles);
      }

      setLastChecked(newLastChecked);
      hasInitialized.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check only once on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      checkForUpdates();
    }
  }, []);

  // Setup/cleanup polling
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (enableAutoPolling && hasInitialized.current) {
      intervalRef.current = setInterval(checkForUpdates, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableAutoPolling, pollingInterval]);

  return {
    isChecking,
    error,
    lastChecked,
    checkNow: checkForUpdates
  };
}