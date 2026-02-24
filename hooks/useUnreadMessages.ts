import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';

export function useUnreadMessages(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Set up real-time listener for unread messages
    const messagesRef = collection(db, 'messages');
    // Listen only to unread messages to reduce Firestore reads.
    const q = query(
      messagesRef,
      where('recipientId', '==', userId),
      where('read', '==', false),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter unread and non-deleted messages on client side
        const unreadMessages = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.read === false && !data.deletedAt && !data.deletedByRecipient;
        });
        setUnreadCount(unreadMessages.length);
        setLoading(false);
      },
      () => {
        // Silently handle permission errors - user might not have messages yet
        console.log('Unable to listen to messages (this is normal if no messages exist yet)');
        setUnreadCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { unreadCount, loading };
}
