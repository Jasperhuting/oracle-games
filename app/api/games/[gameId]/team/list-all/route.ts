import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { ApiErrorResponse } from '@/lib/types';

interface PlayerTeamWithOwner {
  id: string;
  gameId: string;
  userId: string;
  playername?: string;
  userName?: string;
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  pricePaid?: number;
  acquiredAt: string;
  acquisitionType: string;
}

interface PlayerTeamsListAllResponse {
  success: true;
  teams: PlayerTeamWithOwner[];
  count: number;
}

// GET all riders in all teams for a game (for checking sold riders)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<PlayerTeamsListAllResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default to true

    const db = getServerFirebase();

    let query = db.collection('playerTeams')
      .where('gameId', '==', gameId);

    const snapshot = await query.get();

    // Get all unique user IDs to fetch participant data
    const userIds = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });

    // Fetch participant data to get player names
    const participantsMap = new Map<string, { playername?: string; userName?: string }>();
    if (userIds.size > 0) {
      const participantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .get();
      
      participantsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
          participantsMap.set(data.userId, {
            playername: data.playername,
            userName: data.userName,
          });
        }
      });
    }

    const teams = snapshot.docs.map(doc => {
      const data = doc.data();
      const participantData = participantsMap.get(data.userId);
      
      return {
        id: doc.id,
        gameId: data.gameId,
        userId: data.userId,
        playername: participantData?.playername,
        userName: participantData?.userName,
        riderNameId: data.riderNameId,
        riderName: data.riderName,
        riderTeam: data.riderTeam,
        riderCountry: data.riderCountry,
        pricePaid: data.pricePaid,
        active: data.active,
        acquiredAt: data.acquiredAt?.toDate?.()?.toISOString() || data.acquiredAt,
        acquisitionType: data.acquisitionType,
      } as PlayerTeamWithOwner;
    });

    return NextResponse.json({
      success: true,
      teams,
      count: teams.length,
    });
  } catch (error) {
    console.error('Error fetching all teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
