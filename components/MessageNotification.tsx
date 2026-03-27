'use client';

import { useAuth } from '@/hooks/useAuth';
import { useUnreadInboxSummary } from '@/hooks/useUnreadInboxSummary';
import { useEffect, useRef, useState } from 'react';
import { Mail, X } from 'tabler-icons-react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  subject: string;
  senderName: string;
  sentAt: string;
}

function isInboxPath(pathname: string): boolean {
  return pathname === '/inbox' || pathname === '/wk-2026/inbox';
}

export default function MessageNotification() {
  const { user } = useAuth();
  const userId = user?.uid;
  const router = useRouter();
  const { latestMessage } = useUnreadInboxSummary(userId);
  const [notification, setNotification] = useState<Message | null>(null);
  const initializedRef = useRef(false);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const storageKey = `seenMessageIds:${userId}`;

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
    initializedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId || !latestMessage) return;

    const storageKey = `seenMessageIds:${userId}`;

    if (!initializedRef.current) {
      seenMessageIdsRef.current.add(latestMessage.id);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(seenMessageIdsRef.current)));
      initializedRef.current = true;
      return;
    }

    if (!seenMessageIdsRef.current.has(latestMessage.id)) {
      const isOnInboxPage = isInboxPath(window.location.pathname);

      if (!isOnInboxPage) {
        setNotification(latestMessage);

        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          setNotification(null);
        }, 5000);
      }

      seenMessageIdsRef.current.add(latestMessage.id);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(seenMessageIdsRef.current)));
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [latestMessage, userId]);

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
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-2xl px-4 animate-slide-down cursor-pointer pointer-events-auto"
      onClick={handleClick}
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
