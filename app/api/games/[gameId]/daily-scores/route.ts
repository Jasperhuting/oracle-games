import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { PointsEvent } from '@/lib/types';

interface RiderDayScore {
  riderName: string;
  riderNameId: string;
  riderTeam: string;
  stageResult: number;
  gcPoints: number;
  pointsClass: number;
  mountainsClass: number;
  youthClass: number;
  teamPoints: number;
  combativityBonus: number;
  total: number;
}

interface ParticipantDayScore {
  userId: string;
  playername: string;
  total: number;
  riders: RiderDayScore[];
}

interface DayScore {
  stage: string;
  raceSlug: string;
  participants: ParticipantDayScore[];
}

/**
 * GET /api/games/[gameId]/daily-scores?stage=1&race=giro-d-italia
 *
 * Returns the dagscore: points earned per participant per day broken down by source.
 * If no stage/race filters, returns all stages aggregated by day.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const { searchParams } = new URL(request.url);
  const stageFilter = searchParams.get('stage');
  const raceFilter = searchParams.get('race');

  const db = getServerFirebase();

  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const gameData = gameDoc.data()!;
  if (gameData.gameType !== 'auctioneer') {
    return NextResponse.json({ error: 'Daily scores only available for auctioneer games' }, { status: 400 });
  }

  // Fetch all playerTeams for this game
  const playerTeamsSnap = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .get();

  // Resolve participant playername from participants collection
  const participantsSnap = await db.collection('participants')
    .where('gameId', '==', gameId)
    .get();

  const playnameMap = new Map<string, string>();
  for (const doc of participantsSnap.docs) {
    const d = doc.data();
    if (d.userId && d.playername) playnameMap.set(d.userId, d.playername);
  }

  // Build: stageKey → userId → ParticipantDayScore
  // stageKey = "{raceSlug}:{stage}"
  type StageKey = string;
  const stageMap = new Map<StageKey, Map<string, ParticipantDayScore>>();

  for (const doc of playerTeamsSnap.docs) {
    const data = doc.data();
    const userId: string = data.userId;
    const riderName: string = data.riderName || data.riderNameId || '';
    const riderNameId: string = data.riderNameId || '';
    const riderTeam: string = data.riderTeam || '';
    const breakdown: PointsEvent[] = Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown : [];

    for (const event of breakdown) {
      if (raceFilter && event.raceSlug !== raceFilter) continue;
      if (stageFilter && event.stage !== stageFilter) continue;

      const stageKey: StageKey = `${event.raceSlug}:${event.stage}`;

      if (!stageMap.has(stageKey)) {
        stageMap.set(stageKey, new Map());
      }

      const participantMap = stageMap.get(stageKey)!;

      if (!participantMap.has(userId)) {
        participantMap.set(userId, {
          userId,
          playername: playnameMap.get(userId) || userId,
          total: 0,
          riders: [],
        });
      }

      const participant = participantMap.get(userId)!;

      const riderScore: RiderDayScore = {
        riderName,
        riderNameId,
        riderTeam,
        stageResult: event.stageResult || 0,
        gcPoints: event.gcPoints || 0,
        pointsClass: event.pointsClass || 0,
        mountainsClass: event.mountainsClass || 0,
        youthClass: event.youthClass || 0,
        teamPoints: event.teamPoints || 0,
        combativityBonus: event.combativityBonus || 0,
        total: event.total || 0,
      };

      participant.riders.push(riderScore);
      participant.total += riderScore.total;
    }
  }

  // Convert to array sorted by stage, then by score descending
  const days: DayScore[] = [];

  for (const [stageKey, participantMap] of stageMap.entries()) {
    const [raceSlug, stage] = stageKey.split(':');

    const participants = [...participantMap.values()].sort((a, b) => b.total - a.total);

    days.push({ stage, raceSlug, participants });
  }

  // Sort days by stage number
  days.sort((a, b) => {
    const aNum = parseInt(a.stage, 10) || 0;
    const bNum = parseInt(b.stage, 10) || 0;
    return aNum - bNum;
  });

  return NextResponse.json({ gameId, days });
}
