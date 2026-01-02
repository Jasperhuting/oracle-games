import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { PlayerTeamListResponse, ApiErrorResponse, ClientPlayerTeam } from '@/lib/types';
import { jsonWithCacheVersion } from '@/lib/utils/apiCacheHeaders';

// GET all riders in a user's team for a game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<PlayerTeamListResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    let query = db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId);

    if (activeOnly) {
      query = query.where('active', '==', true);
    }

    query = query.orderBy('acquiredAt', 'desc');

    const snapshot = await query.get();

    const riders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        acquiredAt: data.acquiredAt?.toDate?.()?.toISOString() || data.acquiredAt,
      } as ClientPlayerTeam;
    });

    return jsonWithCacheVersion({
      success: true,
      riders,
      count: riders.length,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
