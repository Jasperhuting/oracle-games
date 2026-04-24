import { useEffect, useState } from 'react';
import type { ForumActivityItem } from '@/app/api/forum/activity-summary/route';

export interface ForumActivitySummary {
  topics: ForumActivityItem[];
  loading: boolean;
}

export function useForumActivitySummary(): ForumActivitySummary {
  const [topics, setTopics] = useState<ForumActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/forum/activity-summary')
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, []);

  return { topics, loading };
}
