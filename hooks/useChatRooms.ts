'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatRoom } from '@/lib/types/chat';

const CHAT_SEEN_EVENT = 'chat-seen-updated';
const POLL_INTERVAL_MS = 30_000; // 30 seconds

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
  if (typeof (val as any).toDate === 'function') return (val as any).toDate().toISOString();
  return String(val);
};

export function useChatRooms(): UseChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'chat_rooms'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const fetchRooms = async () => {
      try {
        const snapshot = await getDocs(q);
        const fetched: ChatRoom[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetched.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            gameType: data.gameType,
            opensAt: toIso(data.opensAt) || null,
            closesAt: toIso(data.closesAt) || '',
            createdAt: toIso(data.createdAt) || '',
            createdBy: data.createdBy,
            status: data.status,
            messageCount: data.messageCount || 0,
          });
        });

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
