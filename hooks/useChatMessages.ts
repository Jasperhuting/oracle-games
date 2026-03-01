'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatMessage } from '@/lib/types/chat';

const PAGE_SIZE = 100;

export function useChatMessages(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [oldestDoc, setOldestDoc] = useState<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `chat_rooms/${roomId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage))
          .reverse();
        setMessages(msgs);
        setHasMore(snapshot.docs.length >= PAGE_SIZE);
        if (snapshot.docs.length > 0) {
          setOldestDoc(snapshot.docs[snapshot.docs.length - 1]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to messages:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const loadMore = useCallback(async () => {
    if (!roomId || !oldestDoc) return;

    const q = query(
      collection(db, `chat_rooms/${roomId}/messages`),
      orderBy('createdAt', 'desc'),
      endBefore(oldestDoc),
      limitToLast(PAGE_SIZE)
    );

    const snapshot = await getDocs(q);
    const olderMsgs = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage))
      .reverse();

    setMessages((prev) => [...olderMsgs, ...prev]);
    setHasMore(snapshot.docs.length >= PAGE_SIZE);
    if (snapshot.docs.length > 0) {
      setOldestDoc(snapshot.docs[snapshot.docs.length - 1]);
    }
  }, [roomId, oldestDoc]);

  return { messages, loading, error, hasMore, loadMore };
}
