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

export const GET = userHandler('forum-activity-summary', async (ctx) => {
  const { uid } = ctx;

  // 1. Get user's game IDs, ordered by most recently joined
  const participantsSnap = await adminDb
    .collection('gameParticipants')
    .where('userId', '==', uid)
    .orderBy('joinedAt', 'desc')
    .get();

  if (participantsSnap.empty) {
    return { topics: [] };
  }

  // Cap at 30 for Firestore `in` limit
  const gameIds = participantsSnap.docs
    .map((d) => d.data().gameId as string)
    .filter(Boolean)
    .slice(0, 30);

  if (gameIds.length === 0) {
    return { topics: [] };
  }

  // 2. Fetch recent forum topics for these games
  const topicsSnap = await adminDb
    .collection('forum_topics')
    .where('gameId', 'in', gameIds)
    .orderBy('lastReplyAt', 'desc')
    .limit(20)
    .get();

  if (topicsSnap.empty) {
    return { topics: [] };
  }

  // Filter out deleted topics in memory
  const activeDocs = topicsSnap.docs.filter((d) => !d.data().deleted);

  if (activeDocs.length === 0) {
    return { topics: [] };
  }

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

  // 4. Deduplicate: one topic per game (most recent), take top 5
  const seen = new Set<string>();
  const items: ForumActivityItem[] = [];

  for (const doc of activeDocs) {
    const data = doc.data();
    const gameId = data.gameId as string;
    if (seen.has(gameId)) continue;
    seen.add(gameId);

    const lastReplyAt =
      data.lastReplyAt instanceof Timestamp
        ? data.lastReplyAt.toDate().toISOString()
        : data.lastReplyAt
          ? new Date(data.lastReplyAt).toISOString()
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
