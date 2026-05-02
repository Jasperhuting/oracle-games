import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { PointsEvent } from '@/lib/types';

interface StageWin {
  stage: string;
  raceSlug: string;
  riderName: string;
  riderNameId: string;
  riderTeam: string;
}

interface ParticipantStageWins {
  userId: string;
  playername: string;
  stageWins: number;
  wins: StageWin[];
}

/**
 * GET /api/games/[gameId]/stage-wins
 *
 * Returns the etappezege klassement: ranking of participants by number of stage wins.
 * A stage win is a PointsEvent where stagePosition === 1.
 * Only for Giro Auction Master (auctioneer game type).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const db = getServerFirebase();

  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const gameData = gameDoc.data()!;
  const gameType = gameData.gameType ?? gameData?.config?.gameType;
  if (gameType !== 'auctioneer' && gameType !== 'full-grid') {
    return NextResponse.json({ error: 'Stage wins only available for auctioneer and full-grid games' }, { status: 400 });
  }

  // Fetch all playerTeams for this game
  const playerTeamsSnap = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .get();

  // Aggregate stage wins per userId
  const participantMap = new Map<string, ParticipantStageWins>();

  for (const doc of playerTeamsSnap.docs) {
    const data = doc.data();
    const userId: string = data.userId;
    const riderName: string = data.riderName || data.riderNameId || '';
    const riderNameId: string = data.riderNameId || '';
    const riderTeam: string = data.riderTeam || '';
    const breakdown: PointsEvent[] = Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown : [];

    const stageWinEvents = breakdown.filter(e => e.stagePosition === 1);

    if (stageWinEvents.length === 0) continue;

    if (!participantMap.has(userId)) {
      participantMap.set(userId, {
        userId,
        playername: data.playername || userId,
        stageWins: 0,
        wins: [],
      });
    }

    const participant = participantMap.get(userId)!;
    participant.stageWins += stageWinEvents.length;

    for (const event of stageWinEvents) {
      participant.wins.push({
        stage: event.stage,
        raceSlug: event.raceSlug,
        riderName,
        riderNameId,
        riderTeam,
      });
    }
  }

  // Resolve playername from participants collection if missing
  const participantIds = [...participantMap.keys()];
  if (participantIds.length > 0) {
    const participantsSnap = await db.collection('participants')
      .where('gameId', '==', gameId)
      .get();

    for (const doc of participantsSnap.docs) {
      const data = doc.data();
      const userId = data.userId;
      if (participantMap.has(userId) && data.playername) {
        participantMap.get(userId)!.playername = data.playername;
      }
    }
  }

  // Sort by stage wins descending, then alphabetically
  const ranking = [...participantMap.values()].sort((a, b) => {
    if (b.stageWins !== a.stageWins) return b.stageWins - a.stageWins;
    return a.playername.localeCompare(b.playername);
  });

  return NextResponse.json({ gameId, ranking });
}
