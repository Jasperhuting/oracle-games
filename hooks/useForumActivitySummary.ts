import { useEffect, useState } from 'react';
import type { ForumActivityItem } from '@/app/api/forum/activity-summary/route';

export interface ForumActivitySummary {
  topics: ForumActivityItem[];
  loading: boolean;
}

export function useForumActivitySummary(userId: string | undefined): ForumActivitySummary {
  const [topics, setTopics] = useState<ForumActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch('/api/forum/activity-summary')
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { topics, loading };
}
