'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useForumActivitySummary } from '@/hooks/useForumActivitySummary';
import { MessageCircle } from 'tabler-icons-react';
import { useTranslation } from 'react-i18next';

export function ForumActivityCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { topics, loading } = useForumActivitySummary(user?.uid);

  const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t('global.yesterday');
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">{t('forum.activityTitle')}</h2>
        <Link href="/forum" className="text-sm text-primary hover:underline">
          {t('forum.viewForum')}
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t('global.loading')}</p>
      ) : topics.length === 0 ? (
        <p className="text-sm text-gray-400">{t('forum.noRecentActivity')}</p>
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li key={topic.topicId}>
              <Link
                href={`/forum/topic/${topic.topicId}`}
                className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{topic.title}</p>
                  <p className="text-xs text-gray-400">{topic.gameName}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(topic.lastReplyAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
