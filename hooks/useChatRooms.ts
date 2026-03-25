'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChatRoom } from '@/lib/types/chat';

const CHAT_SEEN_EVENT = 'chat-seen-updated';
const POLL_INTERVAL_MS = 60000;

export interface UseChatRoomsResult {
  rooms: ChatRoom[];
  unreadByRoom: Map<string, number>;
  totalUnread: number;
  loading: boolean;
  error: Error | null;
}

/** Exported for unit testing. Computes per-room unread counts from localStorage. */
export function computeUnreadCounts(rooms: ChatRoom[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const room of rooms) {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem(`chat_unread_${room.id}`)
      : null;
    const parsed = parseInt(stored ?? '', 10);
    const lastSeen = stored !== null && !isNaN(parsed) ? parsed : room.messageCount;
    map.set(room.id, Math.max(0, room.messageCount - lastSeen));
  }
  return map;
}

/** Call this when a user opens a room to mark all current messages as seen. */
export function markRoomAsSeen(roomId: string, messageCount: number): void {
  localStorage.setItem(`chat_unread_${roomId}`, String(messageCount));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_SEEN_EVENT));
  }
}

export function useChatRooms(): UseChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    let isActive = true;

    const loadRooms = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      try {
        const response = await fetch('/api/chat/rooms?skipRecount=true', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load chat rooms');
        }

        const data = await response.json();
        if (!isActive) return;

        const fetched = (data.rooms ?? []).filter((room: ChatRoom) => room.status === 'open') as ChatRoom[];
        roomsRef.current = fetched;
        setRooms(fetched);
        setUnreadByRoom(computeUnreadCounts(fetched));
        setLoading(false);
        setError(null);
      } catch (err) {
        if (!isActive) return;
        console.error('[useChatRooms] Error loading rooms:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };

    void loadRooms();
    const intervalId = window.setInterval(() => {
      void loadRooms();
    }, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleSeen = () => {
      setUnreadByRoom(computeUnreadCounts(roomsRef.current));
    };
    window.addEventListener(CHAT_SEEN_EVENT, handleSeen);
    return () => window.removeEventListener(CHAT_SEEN_EVENT, handleSeen);
  }, []);

  const totalUnread = Array.from(unreadByRoom.values()).reduce((a, b) => a + b, 0);

  return { rooms, unreadByRoom, totalUnread, loading, error };
}
