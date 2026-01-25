import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint to fix a missing team after finalize failed to process bids
 * This processes all active bids for a specific user/game combination
 *
 * PHASE 3 UPDATE: This endpoint no longer writes to gameParticipants.team[]
 * as playerTeams is now the single source of truth for team data.
 * Only playerTeams documents are created, and participant metadata
 * (rosterSize, spentBudget) is updated.
 */
export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();

    const body = await request.json();
    const { gameId, userId, adminUserId } = body;

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

    results.push(`Starting fix for user ${userId} in game ${gameId}...`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    const isSelectionBased = gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains';

    results.push(`Game type: ${gameData?.gameType} (selection-based: ${isSelectionBased})`);

    // Get all active bids for this user in this game
    const activeBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    results.push(`Found ${activeBidsSnapshot.size} active bids to process`);

    if (activeBidsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No active bids found to process',
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
    results.push(`Current team size: ${(participantData.team || []).length}`);
    results.push(`Current spent budget: ${participantData.spentBudget || 0}`);

    // Process each active bid
    const newRiderNames: string[] = [];
    let ridersCreated = 0;

    for (const bidDoc of activeBidsSnapshot.docs) {
      const bidData = bidDoc.data();

      results.push(`\nProcessing bid for ${bidData.riderName}...`);

      // Mark bid as won
      await bidDoc.ref.update({ status: 'won' });
      results.push(`  - Marked bid as "won"`);

      // Check if PlayerTeam already exists
      const existingPlayerTeam = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .where('riderNameId', '==', bidData.riderNameId)
        .limit(1)
        .get();

      if (!existingPlayerTeam.empty) {
        results.push(`  - PlayerTeam already exists, skipping creation`);
      } else {
        // Create PlayerTeam document (source of truth)
        await db.collection('playerTeams').add({
          gameId: gameId,
          userId: userId,
          riderNameId: bidData.riderNameId,
          acquiredAt: Timestamp.now(),
          acquisitionType: isSelectionBased ? 'selection' : 'auction',
          pricePaid: bidData.amount,
          riderName: bidData.riderName,
          riderTeam: bidData.riderTeam || '',
          riderCountry: bidData.riderCountry || '',
          jerseyImage: bidData.jerseyImage || '',
          active: true,
          benched: false,
          // LEGACY fields
          pointsScored: 0,
          stagesParticipated: 0,
          // NEW fields (Phase 1+)
          totalPoints: 0,
          pointsBreakdown: [],
        });
        results.push(`  - Created PlayerTeam document`);
        ridersCreated++;
      }

      newRiderNames.push(bidData.riderName);
    }

    // Calculate correct spent budget from ALL won bids
    const allWonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    let correctSpentBudget = 0;
    allWonBidsSnapshot.docs.forEach(bidDoc => {
      correctSpentBudget += bidDoc.data().amount || 0;
    });

    // Get actual team size from playerTeams (source of truth)
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    const actualTeamSize = playerTeamsSnapshot.size;

    // Check if roster is complete
    const maxRiders = gameData?.config?.maxRiders || 0;
    const rosterComplete = actualTeamSize >= maxRiders;

    // Update participant metadata only (NOT team[] - deprecated)
    // PHASE 3: team[] is no longer written to, playerTeams is source of truth
    await participantDoc.ref.update({
      // NOT updating team[] anymore - it's deprecated
      spentBudget: correctSpentBudget,
      rosterSize: actualTeamSize,
      rosterComplete,
    });

    results.push(`\n✓ Updated participant (team[] NOT updated - deprecated):`);
    results.push(`  - Team size (from playerTeams): ${actualTeamSize}`);
    results.push(`  - Spent budget: ${participantData.spentBudget || 0} -> ${correctSpentBudget}`);
    results.push(`  - Roster complete: ${rosterComplete}`);
    results.push(`  - PlayerTeams created: ${ridersCreated}`);

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'ADMIN_FIX_MISSING_TEAM',
      userId: adminUserId,
      details: {
        gameId,
        targetUserId: userId,
        playername: participantData.playername,
        bidsProcessed: activeBidsSnapshot.size,
        ridersAdded: newRiderNames,
        note: 'PHASE 3: team[] no longer updated, playerTeams is source of truth',
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    results.push('\n✓ Fix completed successfully!');

    return NextResponse.json({
      success: true,
      results: results.join('\n'),
      summary: {
        bidsProcessed: activeBidsSnapshot.size,
        playerTeamsCreated: ridersCreated,
        teamSize: actualTeamSize,
        correctSpentBudget,
        note: 'team[] no longer updated - playerTeams is source of truth',
      },
    });
  } catch (error) {
    console.error('Error fixing missing team:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
