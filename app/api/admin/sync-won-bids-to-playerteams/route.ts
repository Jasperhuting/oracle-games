import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint to sync ALL won bids to playerTeams
 * This ensures every won bid has a corresponding playerTeams entry.
 *
 * Use this when playerTeams is out of sync with won bids.
 */
export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();

    const body = await request.json();
    const { gameId, userId, adminUserId, dryRun = true } = body;

    // Verify admin
    if (!adminUserId) {
      return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
    }

    const adminUserDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: 'gameId and userId are required' },
        { status: 400 }
      );
    }

    const results: string[] = [];

    results.push(`${dryRun ? '[DRY RUN] ' : ''}Syncing won bids to playerTeams for user ${userId} in game ${gameId}...`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    const isSelectionBased = gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains';

    results.push(`Game type: ${gameData?.gameType} (selection-based: ${isSelectionBased})`);

    // Get current participant data
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();

    results.push(`\nParticipant: ${participantData.playername}`);

    // Get ALL won bids for this user in this game
    const wonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    results.push(`Found ${wonBidsSnapshot.size} won bids`);

    // Get existing playerTeams for this user
    const existingPlayerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    const existingRiderIds = new Set(
      existingPlayerTeamsSnapshot.docs.map(doc => doc.data().riderNameId)
    );

    results.push(`Current playerTeams count: ${existingPlayerTeamsSnapshot.size}`);

    // Find won bids that don't have a playerTeam entry
    const playerTeamsToCreate: {
      riderName: string;
      riderNameId: string;
      amount: number;
      riderTeam: string;
      jerseyImage: string;
      bidAt: FirebaseFirestore.Timestamp
    }[] = [];

    const alreadyExist: string[] = [];

    for (const bidDoc of wonBidsSnapshot.docs) {
      const bidData = bidDoc.data();

      if (existingRiderIds.has(bidData.riderNameId)) {
        alreadyExist.push(bidData.riderName);
      } else {
        playerTeamsToCreate.push({
          riderName: bidData.riderName,
          riderNameId: bidData.riderNameId,
          amount: bidData.amount,
          riderTeam: bidData.riderTeam || '',
          jerseyImage: bidData.jerseyImage || '',
          bidAt: bidData.bidAt,
        });
      }
    }

    results.push(`\n--- Analysis ---`);
    results.push(`Won bids with existing playerTeam: ${alreadyExist.length}`);
    results.push(`Won bids MISSING playerTeam: ${playerTeamsToCreate.length}`);

    if (playerTeamsToCreate.length > 0) {
      results.push(`\nMissing riders:`);
      playerTeamsToCreate.forEach(r => {
        results.push(`  - ${r.riderName} (${r.riderNameId}) - ${r.amount}`);
      });
    }

    if (dryRun) {
      results.push(`\n[DRY RUN] No changes made. Set dryRun: false to apply changes.`);

      return NextResponse.json({
        success: true,
        dryRun: true,
        results: results.join('\n'),
        summary: {
          wonBidsCount: wonBidsSnapshot.size,
          existingPlayerTeamsCount: existingPlayerTeamsSnapshot.size,
          playerTeamsToCreate: playerTeamsToCreate.length,
          missingRiders: playerTeamsToCreate.map(p => ({
            riderName: p.riderName,
            riderNameId: p.riderNameId,
            amount: p.amount
          })),
        },
      });
    }

    // Execute changes
    results.push(`\n--- Creating missing playerTeams ---`);

    for (const rider of playerTeamsToCreate) {
      await db.collection('playerTeams').add({
        gameId: gameId,
        userId: userId,
        riderNameId: rider.riderNameId,
        acquiredAt: rider.bidAt || Timestamp.now(),
        acquisitionType: isSelectionBased ? 'selection' : 'auction',
        pricePaid: rider.amount,
        riderName: rider.riderName,
        riderTeam: rider.riderTeam,
        riderCountry: '',
        jerseyImage: rider.jerseyImage,
        pointsScored: 0,
        stagesParticipated: 0,
        totalPoints: 0,
        pointsBreakdown: [],
      });
      results.push(`✓ Created PlayerTeam for ${rider.riderName}`);
    }

    // Recalculate participant metadata
    let correctSpentBudget = 0;
    wonBidsSnapshot.docs.forEach(bidDoc => {
      correctSpentBudget += bidDoc.data().amount || 0;
    });

    const updatedPlayerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    const actualTeamSize = updatedPlayerTeamsSnapshot.size;
    const maxRiders = gameData?.config?.maxRiders || 0;
    const rosterComplete = actualTeamSize >= maxRiders;

    await participantDoc.ref.update({
      spentBudget: correctSpentBudget,
      rosterSize: actualTeamSize,
      rosterComplete,
    });

    results.push(`\n✓ Updated participant metadata:`);
    results.push(`  - Team size: ${actualTeamSize}`);
    results.push(`  - Spent budget: ${correctSpentBudget}`);
    results.push(`  - Roster complete: ${rosterComplete}`);

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'ADMIN_SYNC_WON_BIDS_TO_PLAYERTEAMS',
      userId: adminUserId,
      details: {
        gameId,
        targetUserId: userId,
        playername: participantData.playername,
        playerTeamsCreated: playerTeamsToCreate.length,
        riders: playerTeamsToCreate.map(r => r.riderName),
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    results.push('\n✓ Sync completed successfully!');

    return NextResponse.json({
      success: true,
      dryRun: false,
      results: results.join('\n'),
      summary: {
        playerTeamsCreated: playerTeamsToCreate.length,
        teamSize: actualTeamSize,
        spentBudget: correctSpentBudget,
      },
    });
  } catch (error) {
    console.error('Error syncing won bids to playerTeams:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
