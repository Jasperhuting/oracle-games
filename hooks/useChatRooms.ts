'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatRoom } from '@/lib/types/chat';

export interface UseChatRoomsResult {
  rooms: ChatRoom[];
  unreadByRoom: Map<string, number>;
  totalUnread: number;
  loading: boolean;
}

/** Exported for unit testing. Computes per-room unread counts from localStorage. */
export function computeUnreadCounts(rooms: ChatRoom[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const room of rooms) {
    const stored = localStorage.getItem(`chat_unread_${room.id}`);
    const lastSeen = stored !== null ? parseInt(stored, 10) : room.messageCount;
    map.set(room.id, Math.max(0, room.messageCount - lastSeen));
  }
  return map;
}

/** Call this when a user opens a room to mark all current messages as seen. */
export function markRoomAsSeen(roomId: string, messageCount: number): void {
  localStorage.setItem(`chat_unread_${roomId}`, String(messageCount));
}

export function useChatRooms(): UseChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

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
        const counts = computeUnreadCounts(fetched);
        setRooms(fetched);
        setUnreadByRoom(counts);
        setLoading(false);
      },
      (err) => {
        console.error('[useChatRooms] Firestore error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const totalUnread = Array.from(unreadByRoom.values()).reduce((a, b) => a + b, 0);

  return { rooms, unreadByRoom, totalUnread, loading };
}
