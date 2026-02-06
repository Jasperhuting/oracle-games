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
      .orderBy('totalPoints', 'desc')
      .limit(limit);

    const snapshot = await query.get();

    const standings: PublicFullGridStanding[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        playername: data.playername,
        totalPoints: data.totalPoints ?? 0,
        ranking: data.ranking,
      };
    });

    return NextResponse.json({
      gameName: gameData?.name || 'Full Grid',
      count: standings.length,
      standings,
    });
  } catch (error) {
    console.error('Error fetching public full-grid standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch standings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
