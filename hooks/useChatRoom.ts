'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatRoom } from '@/lib/types/chat';

export function useChatRoom(roomId: string) {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'chat_rooms', roomId),
      (snapshot) => {
        if (snapshot.exists()) {
          setRoom({ id: snapshot.id, ...snapshot.data() } as ChatRoom);
        } else {
          setRoom(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to chat room:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  return { room, loading, error };
}
