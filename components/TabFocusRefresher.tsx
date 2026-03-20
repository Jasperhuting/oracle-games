'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/client';

// After this many ms hidden, refresh token + router on return
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function TabFocusRefresher() {
  const router = useRouter();
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      // Tab became visible again
      if (hiddenAtRef.current === null) return;

      const hiddenMs = Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = null;

      if (hiddenMs < STALE_THRESHOLD_MS) return;

      // Force Firebase token refresh so API calls don't get 401s
      const user = auth.currentUser;
      if (user) {
        try {
          await user.getIdToken(/* forceRefresh */ true);
        } catch {
          // Ignore — user may have been signed out
        }
      }

      // Re-fetch server components so data is fresh
      router.refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router]);

  return null;
}
