import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint to sync playerTeams with won bids
 * This ensures all won bids have corresponding playerTeams entries.
 *
 * It can also convert cancelled_overflow bids to "won" status if needed.
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

    results.push(`${dryRun ? '[DRY RUN] ' : ''}Starting fix for user ${userId} in game ${gameId}...`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    const isSelectionBased = gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains';

    results.push(`Game type: ${gameData?.gameType} (selection-based: ${isSelectionBased})`);

    // Get all cancelled_overflow bids for this user in this game
    const cancelledBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'cancelled_overflow')
      .get();

    results.push(`Found ${cancelledBidsSnapshot.size} cancelled_overflow bids to process`);

    if (cancelledBidsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No cancelled_overflow bids found to process',
        results: results.join('\n'),
      });
    }

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

    // Get existing playerTeams for this user
    const existingPlayerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    const existingRiderIds = new Set(
      existingPlayerTeamsSnapshot.docs.map(doc => doc.data().riderNameId)
    );

    results.push(`Current playerTeams count: ${existingPlayerTeamsSnapshot.size}`);
    results.push(`Existing rider IDs: ${Array.from(existingRiderIds).join(', ')}`);

    // Process each cancelled_overflow bid
    const bidsToUpdate: { id: string; riderName: string; riderNameId: string; amount: number; bidAt: FirebaseFirestore.Timestamp }[] = [];
    const playerTeamsToCreate: { riderName: string; riderNameId: string; amount: number; riderTeam: string; jerseyImage: string; bidAt: FirebaseFirestore.Timestamp }[] = [];

    for (const bidDoc of cancelledBidsSnapshot.docs) {
      const bidData = bidDoc.data();

      results.push(`\nAnalyzing bid for ${bidData.riderName} (${bidData.riderNameId})...`);
      results.push(`  - Bid amount: ${bidData.amount}`);
      results.push(`  - Bid date: ${bidData.bidAt?.toDate?.().toISOString() || 'unknown'}`);

      bidsToUpdate.push({
        id: bidDoc.id,
        riderName: bidData.riderName,
        riderNameId: bidData.riderNameId,
        amount: bidData.amount,
        bidAt: bidData.bidAt,
      });

      if (existingRiderIds.has(bidData.riderNameId)) {
        results.push(`  - ⚠️ PlayerTeam already exists for this rider, will only update bid status`);
      } else {
        results.push(`  - ✓ Will create PlayerTeam document`);
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

    results.push(`\n--- Summary ---`);
    results.push(`Bids to update to "won": ${bidsToUpdate.length}`);
    results.push(`PlayerTeams to create: ${playerTeamsToCreate.length}`);

    if (dryRun) {
      results.push(`\n[DRY RUN] No changes made. Set dryRun: false to apply changes.`);

      return NextResponse.json({
        success: true,
        dryRun: true,
        results: results.join('\n'),
        summary: {
          bidsToUpdate: bidsToUpdate.length,
          playerTeamsToCreate: playerTeamsToCreate.length,
          bids: bidsToUpdate.map(b => ({ id: b.id, riderName: b.riderName, amount: b.amount })),
          newRiders: playerTeamsToCreate.map(p => ({ riderName: p.riderName, amount: p.amount })),
        },
      });
    }

    // Execute changes
    results.push(`\n--- Executing changes ---`);

    // Update bids to "won"
    for (const bid of bidsToUpdate) {
      await db.collection('bids').doc(bid.id).update({ status: 'won' });
      results.push(`✓ Updated bid ${bid.id} (${bid.riderName}) to status: won`);
    }

    // Create missing PlayerTeam documents
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
    const allWonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    let correctSpentBudget = 0;
    allWonBidsSnapshot.docs.forEach(bidDoc => {
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
      action: 'ADMIN_FIX_CANCELLED_OVERFLOW',
      userId: adminUserId,
      details: {
        gameId,
        targetUserId: userId,
        playername: participantData.playername,
        bidsUpdated: bidsToUpdate.length,
        playerTeamsCreated: playerTeamsToCreate.length,
        riders: bidsToUpdate.map(b => b.riderName),
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    results.push('\n✓ Fix completed successfully!');

    return NextResponse.json({
      success: true,
      dryRun: false,
      results: results.join('\n'),
      summary: {
        bidsUpdated: bidsToUpdate.length,
        playerTeamsCreated: playerTeamsToCreate.length,
        teamSize: actualTeamSize,
        spentBudget: correctSpentBudget,
      },
    });
  } catch (error) {
    console.error('Error fixing cancelled_overflow bids:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
