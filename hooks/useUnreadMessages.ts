import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export function useUnreadMessages(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    let isActive = true;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', userId),
      where('read', '==', false),
      limit(100)
    );

    const fetchUnreadCount = async () => {
      try {
        const snapshot = await getDocs(q);
        if (!isActive) return;

        const unreadMessages = snapshot.docs.filter((doc) => {
          const data = doc.data();
          return data.read === false && !data.deletedAt && !data.deletedByRecipient;
        });

        setUnreadCount(unreadMessages.length);
        setLoading(false);
      } catch {
        if (!isActive) return;
        console.log('Unable to listen to messages (this is normal if no messages exist yet)');
        setUnreadCount(0);
        setLoading(false);
      }
    };

    void fetchUnreadCount();
    const pollInterval = setInterval(() => {
      void fetchUnreadCount();
    }, 15000);

    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, [userId]);

  return { unreadCount, loading };
}
