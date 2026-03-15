'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

const PING_INTERVAL_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'last-active-ping-at';

export function LastActiveTracker() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (loading || !user?.uid) return;

    const pingLastActive = async (force = false) => {
      if (inFlightRef.current) return;

      const lastPingAt = Number(localStorage.getItem(STORAGE_KEY) || '0');
      const now = Date.now();

      if (!force && now - lastPingAt < PING_INTERVAL_MS) {
        return;
      }

      inFlightRef.current = true;

      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const response = await fetch('/api/updateLastActive', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          localStorage.setItem(STORAGE_KEY, String(now));
        }
      } catch (error) {
        console.error('Error updating last active:', error);
      } finally {
        inFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pingLastActive();
      }
    };

    const handleWindowFocus = () => {
      void pingLastActive();
    };

    void pingLastActive();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void pingLastActive();
      }
    }, PING_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loading, pathname, user?.uid]);

  return null;
}
