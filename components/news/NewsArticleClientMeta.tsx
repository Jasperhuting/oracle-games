'use client';

import { useEffect, useState } from 'react';
import { useReadingTime } from 'react-hook-reading-time';

function formatReadingTimeLabel(minutes: number) {
  return `${Math.max(1, Math.ceil(minutes))} min leestijd`;
}

export function NewsArticleClientMeta({
  newsId,
  content,
  initialViewCount,
}: {
  newsId: string;
  content: string;
  initialViewCount: number;
}) {
  const reading = useReadingTime(content || '');
  const [viewCount, setViewCount] = useState(initialViewCount);

  useEffect(() => {
    const storageKey = `news-viewed:${newsId}`;

    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(storageKey)) return;

    let cancelled = false;

    const trackView = async () => {
      try {
        const response = await fetch(`/api/news/${newsId}/view`, { method: 'POST' });
        if (!response.ok) return;

        const data = await response.json();
        window.sessionStorage.setItem(storageKey, '1');

        if (!cancelled && typeof data.viewCount === 'number') {
          setViewCount(data.viewCount);
        }
      } catch (error) {
        console.error('[NEWS] Failed to track view:', error);
      }
    };

    trackView();

    return () => {
      cancelled = true;
    };
  }, [newsId]);

  return (
    <>
      <span>{viewCount} weergaven</span>
      <span className="h-1 w-1 rounded-full bg-gray-300" />
      <span>{formatReadingTimeLabel(reading.minutes || 1)}</span>
    </>
  );
}
