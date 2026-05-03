'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChatRoom } from '@/lib/types/chat';
import { useAuth } from '@/hooks/useAuth';

const CHAT_SEEN_EVENT = 'chat-seen-updated';
const POLL_INTERVAL_MS = 30_000; // 30 seconds

type FirestoreTimestampLike = {
  toDate: () => Date;
};

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

const toIso = (val: unknown): string | null => {
  if (!val) return null;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as FirestoreTimestampLike).toDate === 'function') {
    return (val as FirestoreTimestampLike).toDate().toISOString();
  }
  return String(val);
};

export function useChatRooms(): UseChatRoomsResult {
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(authLoading);
  const [error, setError] = useState<Error | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      roomsRef.current = [];
      setRooms([]);
      setUnreadByRoom(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    const fetchRooms = async () => {
      try {
        const response = await fetch('/api/chat/rooms?skipRecount=true', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch chat rooms (${response.status})`);
        }

        const data = await response.json();
        const fetched: ChatRoom[] = (data.rooms ?? [])
          .filter((room: ChatRoom) => room.status === 'open')
          .map((room: ChatRoom) => ({
            id: room.id,
            title: room.title,
            description: room.description,
            gameType: room.gameType,
            opensAt: toIso(room.opensAt) || null,
            closesAt: toIso(room.closesAt) || '',
            createdAt: toIso(room.createdAt) || '',
            createdBy: room.createdBy,
            status: room.status,
            messageCount: room.messageCount || 0,
          }));

        roomsRef.current = fetched;
        setRooms(fetched);
        setUnreadByRoom(computeUnreadCounts(fetched));
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('[useChatRooms] Error fetching rooms:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };

    // Initial fetch
    fetchRooms();

    // Poll every 30 seconds instead of keeping a persistent Firestore listener
    const interval = setInterval(fetchRooms, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [authLoading, user]);

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
