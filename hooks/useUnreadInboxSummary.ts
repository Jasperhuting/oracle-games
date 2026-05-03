'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const POLL_INTERVAL_MS = 60000;

export type UnreadInboxSummary = {
  count: number;
  latestMessage: {
    id: string;
    subject: string;
    senderName: string;
    sentAt: string;
  } | null;
  loading: boolean;
};

type Subscriber = (state: UnreadInboxSummary) => void;

let currentUserId: string | null = null;
let currentState: UnreadInboxSummary = { count: 0, latestMessage: null, loading: true };
const subscribers = new Set<Subscriber>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlightPromise: Promise<void> | null = null;
let visibilityHandler: (() => void) | null = null;

function emit(nextState: UnreadInboxSummary) {
  currentState = nextState;
  subscribers.forEach((subscriber) => subscriber(nextState));
}

async function fetchSummary(userId: string): Promise<void> {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const response = await fetch(`/api/messages/unread-summary?userId=${encodeURIComponent(userId)}`, {
        cache: 'no-store',
      });

      if (response.status === 401) {
        emit({
          ...currentState,
          loading: false,
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch unread summary');
      }

      const data = await response.json();
      emit({
        count: typeof data.count === 'number' ? data.count : 0,
        latestMessage: data.latestMessage ?? null,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching unread summary:', error);
      emit({
        ...currentState,
        loading: false,
      });
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(userId: string) {
  if (pollTimer || typeof window === 'undefined') {
    return;
  }

  const poll = () => {
    if (document.visibilityState !== 'visible') {
      return;
    }
    void fetchSummary(userId);
  };

  void fetchSummary(userId);
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  visibilityHandler = poll;
  document.addEventListener('visibilitychange', visibilityHandler);
}

function subscribe(userId: string, subscriber: Subscriber): () => void {
  if (currentUserId !== userId) {
    currentUserId = userId;
    currentState = { count: 0, latestMessage: null, loading: true };
    stopPolling();
  }

  subscribers.add(subscriber);
  subscriber(currentState);
  startPolling(userId);

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      stopPolling();
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
    }
  };
}

export function refreshUnreadInboxSummary(): void {
  if (currentUserId) {
    void fetchSummary(currentUserId);
  }
}

export function useUnreadInboxSummary(userId: string | undefined): UnreadInboxSummary {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isReadyForInboxSummary = !!userId && isAuthenticated && user?.uid === userId;
  const [state, setState] = useState<UnreadInboxSummary>(
    userId ? currentState : { count: 0, latestMessage: null, loading: authLoading }
  );

  useEffect(() => {
    if (authLoading || !isReadyForInboxSummary || !userId) {
      return;
    }

    return subscribe(userId, setState);
  }, [authLoading, isReadyForInboxSummary, userId]);

  if (authLoading) {
    return {
      ...state,
      loading: true,
    };
  }

  if (!isReadyForInboxSummary) {
    return { count: 0, latestMessage: null, loading: false };
  }

  return state;
}
