'use client';

import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { useEffect, useState } from 'react';
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
  const router = useRouter();
  const [notification, setNotification] = useState<Message | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [seenMessageIds, setSeenMessageIds] = useState<Set<string>>(() => {
    // Load seen message IDs from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('seenMessageIds');
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // Save seenMessageIds to localStorage whenever it changes
  useEffect(() => {
    if (seenMessageIds.size > 0) {
      localStorage.setItem('seenMessageIds', JSON.stringify(Array.from(seenMessageIds)));
    }
  }, [seenMessageIds]);

  useEffect(() => {
    if (!user) return;

    // Listen for new unread messages (simplified query for testing)
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', user.uid),
      limit(50) // Get recent messages and filter client-side
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('MessageNotification: snapshot received, docs:', snapshot.docs.length);
        
        // On initial load, mark all current messages as seen
        if (!isInitialized) {
          const currentMessageIds = snapshot.docs
            .filter(doc => {
              const data = doc.data();
              return data.read === false && !data.deletedAt;
            })
            .map(doc => doc.id);
          
          console.log('MessageNotification: initial load, marking', currentMessageIds.length, 'messages as seen');
          setSeenMessageIds(new Set(currentMessageIds));
          setIsInitialized(true);
          return;
        }
        
        // Check for new documents only (not updates)
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const doc = change.doc;
            const data = doc.data();
            const messageId = doc.id;
            
            // Only show notification if it's unread, not deleted, and not seen before
            if (data.read === false && !data.deletedAt && !seenMessageIds.has(messageId)) {
              console.log('MessageNotification: NEW MESSAGE added, checking if should show notification');
              
              // Check if user is on inbox page at the moment of notification
              const currentPath = window.location.pathname;
              const isOnInboxPage = currentPath === '/inbox';
              
              if (!isOnInboxPage) {
                console.log('MessageNotification: User not on inbox, showing notification');
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
              } else {
                console.log('MessageNotification: User on inbox page, skipping notification');
              }
              
              // Mark this message as seen
              setSeenMessageIds(prev => new Set([...prev, messageId]));
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
  }, [user, isInitialized, seenMessageIds]);

  const handleClick = () => {
    router.push('/inbox');
    setNotification(null);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotification(null);
  };

  if (!notification) {
    console.log('MessageNotification: notification is null, not rendering');
    return null;
  }

  console.log('MessageNotification: RENDERING snackbar with notification:', notification);

  return (
    <div
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-2xl px-4 animate-slide-down"
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
            className="flex-shrink-0 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
