import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

type PublicFullGridStanding = {
  playername?: string;
  totalPoints?: number;
  ranking?: number;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const limit = parseInt(searchParams.get('limit') || '200');

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    const db = getServerFirebase();

    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    // if (gameData?.gameType !== 'full-grid') {
    //   return NextResponse.json({ error: 'Game is not full-grid' }, { status: 400 });
    // }

    let query = db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .limit(limit);

    const snapshot = await query.get();

    const standingsRaw: PublicFullGridStanding[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        playername: data.playername,
        totalPoints: data.totalPoints ?? 0,
        ranking: 0,
      };
    });

    standingsRaw.sort((a, b) => {
      if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0)) {
        return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
      }
      return (a.playername || '').localeCompare(b.playername || '');
    });

    let currentRank = 1;
    let previousPoints: number | null = null;
    const standings = standingsRaw.map((entry, index) => {
      if (previousPoints === null || entry.totalPoints !== previousPoints) {
        currentRank = index + 1;
        previousPoints = entry.totalPoints ?? 0;
      }
      return { ...entry, ranking: currentRank };
    });

    const response = NextResponse.json({
      gameName: gameData?.name || 'Full Grid',
      count: standings.length,
      standings,
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    console.error('Error fetching public full-grid standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch standings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
