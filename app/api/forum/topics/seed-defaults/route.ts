import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { ensureDefaultForumTopicsForGame } from '@/lib/forum/defaultTopics';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId, gameId, gameIds, allGames } = body || {};

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const targetGameIds = Array.from(
      new Set(
        [
          ...(Array.isArray(gameIds) ? gameIds : []),
          gameId,
        ]
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );

    const db = getServerFirebase();
    const userDoc = await db.collection('users').doc(String(userId)).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let effectiveGameIds = targetGameIds;
    if (effectiveGameIds.length === 0 && allGames) {
      const allGamesSnapshot = await db.collection('games').get();
      effectiveGameIds = allGamesSnapshot.docs
        .filter((doc) => {
          const data = doc.data();
          const name = String(data.name || '').toLowerCase();
          return !(Boolean(data.isTest) || name.includes('test'));
        })
        .map((doc) => doc.id);
    }

    if (effectiveGameIds.length === 0) {
      return NextResponse.json({ error: 'gameId, gameIds or allGames is required' }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;

    let processedGames = 0;
    for (const id of effectiveGameIds) {
      const gameDoc = await db.collection('games').doc(id).get();
      if (!gameDoc.exists) {
        continue;
      }
      processedGames += 1;

      const result = await ensureDefaultForumTopicsForGame({
        db,
        gameId: id,
        userId: String(userId),
      });

      created += result.created;
      skipped += result.skipped;
    }

    return NextResponse.json({ success: true, created, skipped, processedGames });
  } catch (error) {
    console.error('Error seeding default forum topics:', error);
    return NextResponse.json({ error: 'Failed to seed default topics' }, { status: 500 });
  }
}
