'use client';

import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
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

  useEffect(() => {
    if (!userId) return;

    // Load seen message IDs once for this user session.
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('seenMessageIds');
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

    // Listen only to this user's unread messages, capped to keep reads low.
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', userId),
      where('read', '==', false),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // On initial load, mark all current messages as seen.
        if (!isInitializedRef.current) {
          const currentMessageIds = snapshot.docs
            .filter(doc => {
              const data = doc.data();
              return data.read === false && !data.deletedAt && !data.deletedByRecipient;
            })
            .map(doc => doc.id);
          seenMessageIdsRef.current = new Set(currentMessageIds);
          localStorage.setItem('seenMessageIds', JSON.stringify(Array.from(seenMessageIdsRef.current)));
          isInitializedRef.current = true;
          return;
        }

        // Check for new documents only (not updates)
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const doc = change.doc;
            const data = doc.data();
            const messageId = doc.id;
            
            // Only show notification if it's unread, not deleted, and not seen before
            if (data.read === false && !data.deletedAt && !data.deletedByRecipient && !seenMessageIdsRef.current.has(messageId)) {
              
              // Check if user is on inbox page at the moment of notification
              const currentPath = window.location.pathname;
              const isOnInboxPage = currentPath === '/inbox';
              
              if (!isOnInboxPage) {
                setNotification({
                  id: messageId,
                  subject: data.subject,
                  senderName: data.senderName,
                  sentAt: data.sentAt?.toDate().toISOString(),
                });

                // Auto-hide after 5 seconds
                setTimeout(() => {
                  setNotification(null);
                }, 5000);
              }
              
              // Mark this message as seen
              seenMessageIdsRef.current.add(messageId);
              localStorage.setItem('seenMessageIds', JSON.stringify(Array.from(seenMessageIdsRef.current)));
            }
          }
        });
      },
      (error) => {
        console.error('Error listening to unread messages:', error);
        // Silently fail - don't show notification if there's an error
      }
    );

    return () => unsubscribe();
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
