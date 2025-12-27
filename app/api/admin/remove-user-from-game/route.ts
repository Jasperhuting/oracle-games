import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

interface PlayerTeam {
  id: string;
  gameId: string;
  userId: string;
  riderNameId: string;
  riderName: string;
  pricePaid?: number;
  active: boolean;
  pointsScored: number;
}

interface Bid {
  id: string;
  gameId: string;
  userId: string;
  riderNameId: string;
  amount: number;
  status: 'active' | 'outbid' | 'won' | 'lost';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, userId, dryRun = false } = body;

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId and userId' },
        { status: 400 }
      );
    }

    const result = await removeUserFromGame(gameId, userId, dryRun);

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error removing user from game:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove user from game',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function removeUserFromGame(
  gameId: string,
  userId: string,
  dryRun: boolean
) {
  const summary = {
    participantRemoved: 0,
    playerTeamsDeleted: 0,
    bidsDeleted: 0,
    stagePicksDeleted: 0,
    playerCountUpdated: false,
    details: [] as string[],
  };

  // Step 1: Get game info
  const gameDoc = await adminDb.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error('Game not found');
  }
  const game = gameDoc.data();
  summary.details.push(`Game: ${game?.name}`);
  summary.details.push(`Current player count: ${game?.playerCount}`);

  // Step 2: Get participant info
  const participantSnapshot = await adminDb
    .collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (participantSnapshot.empty) {
    throw new Error('Participant not found in this game');
  }

  const participantDoc = participantSnapshot.docs[0];
  const participant = participantDoc.data();
  summary.details.push(`Participant: ${participant.playername}`);
  summary.details.push(`Roster size: ${participant.rosterSize}`);

  // Step 3: Get all player teams
  const playerTeamsSnapshot = await adminDb
    .collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const playerTeams = playerTeamsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as PlayerTeam)
  );
  summary.playerTeamsDeleted = playerTeams.length;

  summary.details.push(`PlayerTeams to DELETE: ${playerTeams.length}`);
  playerTeams.forEach((pt) => {
    summary.details.push(
      `  - ${pt.riderName} (${pt.pricePaid || 0} credits, ${pt.pointsScored} points) ${pt.active ? '[ACTIVE]' : '[INACTIVE]'}`
    );
  });

  // Step 4: Get all bids
  const bidsSnapshot = await adminDb
    .collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const bids = bidsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Bid)
  );

  summary.bidsDeleted = bids.length;
  summary.details.push(`Bids to DELETE: ${bids.length}`);

  // Step 5: Get stage picks
  const stagePicksSnapshot = await adminDb
    .collection('stagePicks')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  summary.stagePicksDeleted = stagePicksSnapshot.size;
  summary.details.push(`Stage picks to delete: ${stagePicksSnapshot.size}`);

  if (!dryRun) {
    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 500;

    const commitBatch = async () => {
      if (batchCount > 0) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    };

    // 1. Delete ALL playerTeams
    for (const pt of playerTeams) {
      const ref = adminDb.collection('playerTeams').doc(pt.id);
      batch.delete(ref);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await commitBatch();
    }
    await commitBatch();

    // 2. Delete ALL bids
    for (const bid of bids) {
      const ref = adminDb.collection('bids').doc(bid.id);
      batch.delete(ref);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await commitBatch();
    }
    await commitBatch();

    // 3. Delete stage picks
    for (const doc of stagePicksSnapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await commitBatch();
    }
    await commitBatch();

    // 4. Delete participant
    batch.delete(adminDb.collection('gameParticipants').doc(participantDoc.id));
    batchCount++;
    summary.participantRemoved = 1;

    // 5. Update game playerCount
    batch.update(adminDb.collection('games').doc(gameId), {
      playerCount: FieldValue.increment(-1),
    });
    batchCount++;
    summary.playerCountUpdated = true;

    await commitBatch();

    // 6. Trigger cache invalidation by updating a global timestamp
    // This allows clients to check if they need to refresh their cache
    await adminDb.collection('system').doc('cacheInvalidation').set({
      lastInvalidated: FieldValue.serverTimestamp(),
      reason: 'User removed from game',
      gameId,
      userId,
    }, { merge: true });

    summary.details.push('✅ All changes committed successfully');
    summary.details.push('⚠️ REFRESH YOUR BROWSER (F5) to see updated data!');
  } else {
    summary.details.push('ℹ️ DRY RUN - No changes made');
  }

  return summary;
}
