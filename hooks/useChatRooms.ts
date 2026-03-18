'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatRoom } from '@/lib/types/chat';

const CHAT_SEEN_EVENT = 'chat-seen-updated';

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
  // Notify all useChatRooms instances to recompute unread counts immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_SEEN_EVENT));
  }
}

export function useChatRooms(): UseChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Keep a ref to current rooms so the event listener always has fresh data
  const roomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'chat_rooms'),
      where('status', '==', 'open')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as ChatRoom)
        );
        roomsRef.current = fetched;
        const counts = computeUnreadCounts(fetched);
        setRooms(fetched);
        setUnreadByRoom(counts);
        setLoading(false);
      },
      (err) => {
        console.error('[useChatRooms] Firestore error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Recompute unread counts immediately when markRoomAsSeen is called anywhere
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
