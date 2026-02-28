import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ForumGame } from '@/lib/types/forum';

type TopicStats = {
  topicCount: number;
  lastActivityAt: string | null;
};

function pickLatest(a: string | null, b: string | null): string | null {
  if (a && b) return a > b ? a : b;
  return a || b;
}

export async function GET(): Promise<NextResponse> {
  try {
    const [gamesSnapshot, topicsSnapshot] = await Promise.all([
      adminDb.collection('games').get(),
      adminDb.collection('forum_topics').get(),
    ]);

    const statsByGameId = new Map<string, TopicStats>();

    for (const doc of topicsSnapshot.docs) {
      const data = doc.data();
      if (data.deleted) continue;

      const gameId = typeof data.gameId === 'string' ? data.gameId : '';
      if (!gameId) continue;

      const timestamp =
        data.lastReplyAt?.toDate?.().toISOString?.() ||
        data.lastReplyAt ||
        data.createdAt?.toDate?.().toISOString?.() ||
        data.createdAt ||
        null;

      const current = statsByGameId.get(gameId) || {
        topicCount: 0,
        lastActivityAt: null,
      };

      const nextLastActivity =
        current.lastActivityAt && timestamp
          ? current.lastActivityAt > timestamp
            ? current.lastActivityAt
            : timestamp
          : current.lastActivityAt || timestamp;

      statsByGameId.set(gameId, {
        topicCount: current.topicCount + 1,
        lastActivityAt: nextLastActivity,
      });
    }

    const rawGames = gamesSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const name = String(data.name || '').trim();
        const isTest = Boolean(data.isTest) || name.toLowerCase().includes('test');
        if (!name || isTest) return null;

        const stats = statsByGameId.get(doc.id) || { topicCount: 0, lastActivityAt: null };

        return {
          id: doc.id,
          name,
          status: data.status || null,
          topicCount: stats.topicCount,
          lastActivityAt: stats.lastActivityAt,
          gameIds: [doc.id],
          divisions: [
            {
              id: doc.id,
              division: data.division || null,
              divisionLevel: typeof data.divisionLevel === 'number' ? data.divisionLevel : null,
            },
          ],
        } as ForumGame;
      })
      .filter((game): game is ForumGame => Boolean(game));

    const groupedByName = new Map<string, ForumGame>();
    for (const game of rawGames) {
      const key = game.name.trim().toLowerCase();
      const existing = groupedByName.get(key);
      if (!existing) {
        groupedByName.set(key, game);
        continue;
      }

      const mergedIds = Array.from(new Set([...(existing.gameIds || []), ...(game.gameIds || [])]));
      const preferredId = [existing.id, game.id].sort((a, b) => a.localeCompare(b))[0];
      groupedByName.set(key, {
        ...existing,
        id: preferredId,
        topicCount: existing.topicCount + game.topicCount,
        lastActivityAt: pickLatest(existing.lastActivityAt ?? null, game.lastActivityAt ?? null),
        gameIds: mergedIds.sort((a, b) => a.localeCompare(b)),
        divisions: [...(existing.divisions || []), ...(game.divisions || [])].sort((a, b) => {
          const levelA = a.divisionLevel ?? Number.MAX_SAFE_INTEGER;
          const levelB = b.divisionLevel ?? Number.MAX_SAFE_INTEGER;
          if (levelA !== levelB) return levelA - levelB;
          return (a.division || '').localeCompare(b.division || '', 'nl');
        }),
      });
    }

    const games = Array.from(groupedByName.values())
      .sort((a, b) => {
        const aDate = a.lastActivityAt || '';
        const bDate = b.lastActivityAt || '';
        if (aDate && bDate && aDate !== bDate) {
          return bDate.localeCompare(aDate);
        }
        if (aDate && !bDate) return -1;
        if (!aDate && bDate) return 1;
        return a.name.localeCompare(b.name, 'nl');
      });

    return NextResponse.json({ games });
  } catch (error) {
    console.error('Error fetching forum games:', error);
    return NextResponse.json({ error: 'Failed to fetch forum games' }, { status: 500 });
  }
}
