import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// GET all participants for a game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const orderBy = searchParams.get('orderBy') || 'ranking';
    const limit = parseInt(searchParams.get('limit') || '100');

    const db = getServerFirebase();

    let query = db.collection('gameParticipants')
      .where('gameId', '==', gameId);

    // Order by ranking or totalPoints
    if (orderBy === 'ranking') {
      query = query.orderBy('ranking', 'asc');
    } else if (orderBy === 'points') {
      query = query.orderBy('totalPoints', 'desc');
    } else if (orderBy === 'joinedAt') {
      query = query.orderBy('joinedAt', 'desc');
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    const participants = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        joinedAt: data.joinedAt?.toDate?.()?.toISOString() || data.joinedAt,
        eliminatedAt: data.eliminatedAt?.toDate?.()?.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      participants,
      count: participants.length,
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
