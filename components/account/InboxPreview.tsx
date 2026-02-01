'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import Link from 'next/link';
import { Mail, MailOpened } from 'tabler-icons-react';
import { useTranslation } from 'react-i18next';

interface PreviewMessage {
  id: string;
  senderName: string;
  subject: string;
  sentAt: string;
  read: boolean;
}

export function InboxPreview() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'messages');

    // Get recent messages (limit to 10, will filter to unread)
    const inboxQuery = query(
      messagesRef,
      where('recipientId', '==', user.uid),
      orderBy('sentAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      inboxQuery,
      (snapshot) => {
        const messagesData: PreviewMessage[] = snapshot.docs
          .filter(doc => {
            const data = doc.data();
            // Filter: not deleted and unread
            return !data.deletedAt && !data.deletedByRecipient && data.read === false;
          })
          .slice(0, 5) // Take max 5 unread
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              senderName: data.senderName || 'Onbekend',
              subject: data.subject || '(geen onderwerp)',
              sentAt: data.sentAt?.toDate().toISOString() || '',
              read: data.read || false,
            };
          });
        setMessages(messagesData);
        setLoading(false);
      },
      () => {
        // Handle errors silently
        setMessages([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Gisteren';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('nl-NL', { weekday: 'short' });
    }
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">Inbox</h2>
        <Link
          href="/inbox"
          className="text-sm text-primary hover:underline"
        >
          Bekijk alles
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden...</p>
      ) : messages.length > 0 ? (
        <>
          <p className="text-sm text-gray-500 mb-3">
            Ongelezen berichten:
          </p>
          <ul className="space-y-2">
            {messages.map((msg) => (
              <li key={msg.id}>
                <Link
                  href="/inbox"
                  className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      &quot;{msg.subject}&quot;
                    </p>
                    <p className="text-xs text-gray-500">
                      {msg.senderName}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-400">Geen ongelezen berichten</p>
      )}
    </div>
  );
}
