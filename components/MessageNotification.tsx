'use client';

import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Mail, X } from 'tabler-icons-react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  subject: string;
  senderName: string;
  sentAt: string;
}

export default function MessageNotification() {
  const { user } = useAuth();
  const userId = user?.uid;
  const router = useRouter();
  const [notification, setNotification] = useState<Message | null>(null);
  const isInitializedRef = useRef(false);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    const storageKey = `seenMessageIds:${userId}`;

    // Load seen message IDs once for this user session.
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          seenMessageIdsRef.current = new Set(JSON.parse(stored));
        } catch {
          seenMessageIdsRef.current = new Set();
        }
      } else {
        seenMessageIdsRef.current = new Set();
      }
    }

    isInitializedRef.current = false;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', userId),
      where('read', '==', false),
      limit(20)
    );

    const pollUnreadMessages = async () => {
      try {
        const snapshot = await getDocs(q);
        if (!isActive) return;

        const unreadDocs = snapshot.docs.filter((doc) => {
          const data = doc.data();
          return data.read === false && !data.deletedAt && !data.deletedByRecipient;
        });

        // On initial load, mark all current messages as seen.
        if (!isInitializedRef.current) {
          seenMessageIdsRef.current = new Set(unreadDocs.map((doc) => doc.id));
          localStorage.setItem(storageKey, JSON.stringify(Array.from(seenMessageIdsRef.current)));
          isInitializedRef.current = true;
          return;
        }

        const unseenDocs = unreadDocs
          .filter((doc) => !seenMessageIdsRef.current.has(doc.id))
          .sort((a, b) => {
            const aDate = a.data().sentAt?.toDate?.()?.getTime?.() ?? 0;
            const bDate = b.data().sentAt?.toDate?.()?.getTime?.() ?? 0;
            return bDate - aDate;
          });

        if (unseenDocs.length > 0) {
          const nextMessage = unseenDocs[0];
          const data = nextMessage.data();
          const isOnInboxPage = window.location.pathname === '/inbox';

          if (!isOnInboxPage) {
            setNotification({
              id: nextMessage.id,
              subject: data.subject,
              senderName: data.senderName,
              sentAt: data.sentAt?.toDate?.()?.toISOString?.(),
            });

            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
            }
            hideTimeoutRef.current = setTimeout(() => {
              setNotification(null);
            }, 5000);
          }

          unseenDocs.forEach((doc) => {
            seenMessageIdsRef.current.add(doc.id);
          });
          localStorage.setItem(storageKey, JSON.stringify(Array.from(seenMessageIdsRef.current)));
        }
      } catch (error) {
        console.error('Error listening to unread messages:', error);
        // Silently fail - don't show notification if there's an error
      }
    };

    void pollUnreadMessages();
    const pollInterval = setInterval(() => {
      void pollUnreadMessages();
    }, 15000);

    return () => {
      isActive = false;
      clearInterval(pollInterval);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [userId]);

  const handleClick = () => {
    router.push('/inbox');
    setNotification(null);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotification(null);
  };

  if (!notification) {
    return null;
  }

  return (
    <div
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-2xl px-4 animate-slide-down cursor-pointer"
      onClick={handleClick}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="bg-white border-l-4 border-primary shadow-xl rounded-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 bg-primary/10 rounded-full p-2">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">
              New Message from {notification.senderName}
            </p>
            <p className="text-sm text-gray-600 mt-0.5 truncate">
              {notification.subject}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 hover:bg-gray-100 rounded-full p-1.5 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
