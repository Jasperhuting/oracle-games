import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { gameId, dryRun = true, debug = false, rankingsCollection } = await request.json();

    const db = getServerFirebase();

    let resolvedRankingsCollection = rankingsCollection as string | undefined;
    if (!resolvedRankingsCollection && gameId) {
      const gameDoc = await db.collection('games').doc(gameId).get();
      const gameData = gameDoc.exists ? gameDoc.data() : null;
      const year = typeof gameData?.year === 'number' ? gameData.year : null;
      if (year) {
        resolvedRankingsCollection = `rankings_${year}`;
      }
    }
    if (!resolvedRankingsCollection) {
      resolvedRankingsCollection = 'rankings_2026';
    }

    // Load rankings and teams once (source of truth for team names)
    const [rankingsSnapshot, teamsSnapshot] = await Promise.all([
      db.collection(resolvedRankingsCollection).get(),
      db.collection('teams').get(),
    ]);
    const teamsMap = new Map<string, { name?: string; jerseyImageTeam?: string; teamImage?: string }>();
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      teamsMap.set(doc.id, {
        name: data.name,
        jerseyImageTeam: data.jerseyImageTeam,
        teamImage: data.teamImage,
      });
    });
    const ridersMap = new Map<string, { teamName?: string; jerseyImageTeam?: string; country?: string; rank?: number }>();
    rankingsSnapshot.forEach(doc => {
      const rider = doc.data();
      const riderId = rider.nameID || rider.id || doc.id;
      if (!riderId) return;
      let teamName: string | undefined;
      let jerseyImageTeam: string | undefined;
      if (typeof rider.team === 'string') {
        teamName = rider.team;
      } else if (rider.team && typeof rider.team === 'object') {
        if (typeof (rider.team as any).name === 'string') {
          teamName = (rider.team as any).name;
        } else if (typeof (rider.team as any).id === 'string') {
          const teamDoc = teamsMap.get((rider.team as any).id);
          teamName = teamDoc?.name;
          jerseyImageTeam = teamDoc?.jerseyImageTeam || teamDoc?.teamImage;
        }
      }
      ridersMap.set(riderId, {
        teamName: teamName || undefined,
        jerseyImageTeam: jerseyImageTeam || rider.team?.jerseyImageTeam || undefined,
        country: rider.country || undefined,
        rank: rider.rank || undefined,
      });
    });

    let query = db.collection('playerTeams');
    if (gameId) {
      query = query.where('gameId', '==', gameId);
    }

    const playerTeamsSnapshot = await query.get();
    let checked = 0;
    let updates = 0;
    let skipped = 0;
    let missingRankings = 0;
    let missingTeamName = 0;
    const sampleMissingIds: string[] = [];

    let batch = db.batch();
    let batchCount = 0;
    const batchCommits: Promise<FirebaseFirestore.WriteResult>[] = [];

    playerTeamsSnapshot.forEach(doc => {
      checked += 1;
      const data = doc.data();
      const riderId = data.riderNameId;
      if (!riderId) {
        skipped += 1;
        return;
      }
      const riderInfo = ridersMap.get(riderId);
      if (!riderInfo) {
        skipped += 1;
        missingRankings += 1;
        if (sampleMissingIds.length < 20) {
          sampleMissingIds.push(riderId);
        }
        return;
      }
      if (!riderInfo.teamName) {
        skipped += 1;
        missingTeamName += 1;
        if (sampleMissingIds.length < 20) {
          sampleMissingIds.push(riderId);
        }
        return;
      }

      const currentTeam = data.riderTeam || '';
      if (currentTeam === riderInfo.teamName) {
        return;
      }

      updates += 1;
      if (!dryRun) {
        batch.update(doc.ref, {
          riderTeam: riderInfo.teamName,
          ...(riderInfo.country ? { riderCountry: riderInfo.country } : {}),
          ...(typeof riderInfo.rank === 'number' ? { riderRank: riderInfo.rank } : {}),
          ...(riderInfo.jerseyImageTeam ? { jerseyImage: riderInfo.jerseyImageTeam } : {}),
        });
        batchCount += 1;

        if (batchCount >= 400) {
          batchCommits.push(batch.commit());
          batch = db.batch();
          batchCount = 0;
        }
      }
    });

    if (!dryRun && batchCount > 0) {
      batchCommits.push(batch.commit());
    }

    if (!dryRun && batchCommits.length > 0) {
      await Promise.all(batchCommits);
    }

    const response: Record<string, unknown> = {
      success: true,
      dryRun,
      gameId: gameId || null,
      checked,
      updates,
      skipped,
      message: dryRun
        ? 'Dry run completed. No data was written.'
        : 'Updates applied successfully.',
    };

    if (debug) {
      const sampleSnapshot = await db.collection('playerTeams').limit(200).get();
      const sampleGameIds = Array.from(new Set(sampleSnapshot.docs.map(doc => doc.data().gameId).filter(Boolean))).slice(0, 50);
      response.sampleGameIds = sampleGameIds;
      response.sampleCount = sampleSnapshot.size;
      response.rankingsCollection = resolvedRankingsCollection;
      response.missingRankings = missingRankings;
      response.missingTeamName = missingTeamName;
      response.sampleMissingIds = sampleMissingIds;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fixing playerTeams riderTeam:', error);
    return NextResponse.json(
      { error: 'Failed to fix playerTeams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
