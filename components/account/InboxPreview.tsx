'use client';

import { useAuth } from '@/hooks/useAuth';
import { useUnreadInboxSummary } from '@/hooks/useUnreadInboxSummary';
import Link from 'next/link';
import { Mail } from 'tabler-icons-react';
import { useTranslation } from 'react-i18next';

export function InboxPreview() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { count, latestMessage, loading } = useUnreadInboxSummary(user?.uid);

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
      ) : count > 0 && latestMessage ? (
        <>
          <p className="text-sm text-gray-500 mb-3">
            {count === 1 ? '1 ongelezen bericht:' : `${count} ongelezen berichten:`}
          </p>
          <ul className="space-y-2">
            <li key={latestMessage.id}>
              <Link
                href="/inbox"
                className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    &quot;{latestMessage.subject || '(geen onderwerp)'}&quot;
                  </p>
                  <p className="text-xs text-gray-500">
                    {latestMessage.senderName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(latestMessage.sentAt)}
                  </p>
                </div>
              </Link>
            </li>
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-400">Geen ongelezen berichten</p>
      )}
    </div>
  );
}
