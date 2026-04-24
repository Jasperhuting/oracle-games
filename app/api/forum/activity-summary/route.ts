import { adminDb } from '@/lib/firebase/server';
import { userHandler } from '@/lib/api/handler';
import { Timestamp } from 'firebase-admin/firestore';

export interface ForumActivityItem {
  topicId: string;
  title: string;
  gameId: string;
  gameName: string;
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

export const GET = userHandler('forum-activity-summary', async (ctx) => {
  const { uid } = ctx;

  // 1. Get user's game IDs without requiring a composite index
  const participantsSnap = await adminDb
    .collection('gameParticipants')
    .where('userId', '==', uid)
    .get();

  if (participantsSnap.empty) {
    return { topics: [] };
  }

  // Cap at 30 for Firestore `in` limit, preserving newest joins first in memory.
  const gameIds = participantsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        gameId: data.gameId as string | undefined,
        joinedAtMs: toMillis(data.joinedAt),
      };
    })
    .filter((participant): participant is { gameId: string; joinedAtMs: number } => Boolean(participant.gameId))
    .sort((a, b) => b.joinedAtMs - a.joinedAtMs)
    .map((participant) => participant.gameId)
    .filter((gameId, index, arr) => arr.indexOf(gameId) === index)
    .slice(0, 30);

  if (gameIds.length === 0) {
    return { topics: [] };
  }

  // 2. Fetch recent forum topics for these games
  // Use createdAt as ordering fallback for topics that have no replies yet (lastReplyAt may be null)
  const topicsSnap = await adminDb
    .collection('forum_topics')
    .where('gameId', 'in', gameIds)
    .orderBy('lastReplyAt', 'desc')
    .limit(50)
    .get();

  // Also fetch topics ordered by createdAt to catch any without a lastReplyAt value
  const topicsSnap2 = await adminDb
    .collection('forum_topics')
    .where('gameId', 'in', gameIds)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  // Merge both result sets (dedup by doc id)
  const docMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of [...topicsSnap.docs, ...topicsSnap2.docs]) {
    if (!docMap.has(doc.id)) docMap.set(doc.id, doc);
  }

  if (docMap.size === 0) {
    return { topics: [] };
  }

  // Filter out deleted topics in memory
  const activeDocs = [...docMap.values()].filter((d) => !d.data().deleted);

  if (activeDocs.length === 0) {
    return { topics: [] };
  }

  // Sort merged results by lastReplyAt (falling back to createdAt) descending
  activeDocs.sort((a, b) => {
    const aMs = toMillis(a.data().lastReplyAt ?? a.data().createdAt);
    const bMs = toMillis(b.data().lastReplyAt ?? b.data().createdAt);
    return bMs - aMs;
  });

  // 3. Resolve game names
  const uniqueGameIds = [...new Set(activeDocs.map((d) => d.data().gameId as string))];
  const gamesSnap = await adminDb
    .collection('games')
    .where('__name__', 'in', uniqueGameIds)
    .get();
  const gameNameMap = new Map<string, string>();
  for (const doc of gamesSnap.docs) {
    gameNameMap.set(doc.id, (doc.data().name as string) || doc.id);
  }

  // 4. Take the 5 most recently active topics across all games (no per-game dedup)
  const items: ForumActivityItem[] = [];

  for (const doc of activeDocs) {
    const data = doc.data();
    const gameId = data.gameId as string;

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
      gameName: gameNameMap.get(gameId) || gameId,
      lastReplyAt,
      replyCount: (data.replyCount as number) ?? 0,
      lastReplyPreview: (data.lastReplyPreview as string | null) ?? null,
    });

    if (items.length === 5) break;
  }

  return { topics: items };
});
