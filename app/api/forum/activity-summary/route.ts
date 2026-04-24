import { adminDb } from '@/lib/firebase/server';
import { userHandler } from '@/lib/api/handler';
import { Timestamp } from 'firebase-admin/firestore';

export interface ForumActivityItem {
  topicId: string;
  title: string;
  gameId: string | null;
  gameName: string | null;
  lastReplyAt: string;
  replyCount: number;
  lastReplyPreview: string | null;
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export const GET = userHandler('forum-activity-summary', async () => {
  // Fetch recent topics ordered by lastReplyAt
  const [snap1, snap2] = await Promise.all([
    adminDb.collection('forum_topics').orderBy('lastReplyAt', 'desc').limit(50).get(),
    // Second query catches topics where lastReplyAt is missing/null
    adminDb.collection('forum_topics').orderBy('createdAt', 'desc').limit(50).get(),
  ]);

  // Merge, dedup by doc id
  const docMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of [...snap1.docs, ...snap2.docs]) {
    if (!docMap.has(doc.id)) docMap.set(doc.id, doc);
  }

  if (docMap.size === 0) {
    return { topics: [] };
  }

  // Filter deleted, sort by most recent activity
  const activeDocs = [...docMap.values()]
    .filter((d) => !d.data().deleted)
    .sort((a, b) => {
      const aMs = toMillis(a.data().lastReplyAt ?? a.data().createdAt);
      const bMs = toMillis(b.data().lastReplyAt ?? b.data().createdAt);
      return bMs - aMs;
    });

  if (activeDocs.length === 0) {
    return { topics: [] };
  }

  // Resolve game names for topics that have a gameId
  const uniqueGameIds = [
    ...new Set(
      activeDocs
        .map((d) => d.data().gameId as string | undefined)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const gameNameMap = new Map<string, string>();
  if (uniqueGameIds.length > 0) {
    const gamesSnap = await adminDb
      .collection('games')
      .where('__name__', 'in', uniqueGameIds.slice(0, 30))
      .get();
    for (const doc of gamesSnap.docs) {
      gameNameMap.set(doc.id, (doc.data().name as string) || doc.id);
    }
  }

  // Take the 5 most recently active topics
  const items: ForumActivityItem[] = [];

  for (const doc of activeDocs) {
    const data = doc.data();
    const gameId = (data.gameId as string | undefined) ?? null;

    const lastReplyAt =
      data.lastReplyAt instanceof Timestamp
        ? data.lastReplyAt.toDate().toISOString()
        : data.lastReplyAt
          ? new Date(data.lastReplyAt).toISOString()
          : data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : new Date(0).toISOString();

    items.push({
      topicId: doc.id,
      title: (data.title as string) || '(geen titel)',
      gameId,
      gameName: gameId ? (gameNameMap.get(gameId) ?? gameId) : null,
      lastReplyAt,
      replyCount: (data.replyCount as number) ?? 0,
      lastReplyPreview: (data.lastReplyPreview as string | null) ?? null,
    });

    if (items.length === 5) break;
  }

  return { topics: items };
});
