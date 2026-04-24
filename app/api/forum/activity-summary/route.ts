import { adminDb } from '@/lib/firebase/server';
import { publicHandler } from '@/lib/api/handler';
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

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as { toDate?: () => Date; _seconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    if (typeof obj._seconds === 'number') return new Date(obj._seconds * 1000).toISOString();
  }
  return null;
}

export const GET = publicHandler('forum-activity-summary', async () => {
  const snapshot = await adminDb
    .collection('forum_topics')
    .orderBy('lastReplyAt', 'desc')
    .limit(20)
    .get();

  const activeDocs = snapshot.docs.filter((d) => !d.data().deleted);

  if (activeDocs.length === 0) {
    return { topics: [] };
  }

  // Resolve game names
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

  const items: ForumActivityItem[] = activeDocs.slice(0, 5).map((doc) => {
    const data = doc.data();
    const gameId = (data.gameId as string | undefined) ?? null;
    const lastReplyAt =
      toIso(data.lastReplyAt) ?? toIso(data.createdAt) ?? new Date(0).toISOString();

    return {
      topicId: doc.id,
      title: (data.title as string) || '(geen titel)',
      gameId,
      gameName: gameId ? (gameNameMap.get(gameId) ?? gameId) : null,
      lastReplyAt,
      replyCount: (data.replyCount as number) ?? 0,
      lastReplyPreview: (data.lastReplyPreview as string | null) ?? null,
    };
  });

  return { topics: items };
});
