import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint to reopen a finalized auction period
 * This allows the finalize to run again for the period
 *
 * POST /api/admin/reopen-auction-period
 * Body: { gameId, periodName, adminUserId }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();

    const body = await request.json();
    const { gameId, periodName, adminUserId, resetBidsToActive } = body;

    // Verify admin
    if (!adminUserId) {
      return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
    }

    const adminUserDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (!gameId || !periodName) {
      return NextResponse.json(
        { error: 'gameId and periodName are required' },
        { status: 400 }
      );
    }

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    const auctionPeriods = gameData?.config?.auctionPeriods || [];

    // Find the period
    const periodIndex = auctionPeriods.findIndex((p: { name: string }) => p.name === periodName);
    if (periodIndex === -1) {
      return NextResponse.json(
        { error: `Period "${periodName}" not found` },
        { status: 404 }
      );
    }

    const period = auctionPeriods[periodIndex];
    const results: string[] = [];

    results.push(`Reopening auction period: ${periodName}`);
    results.push(`Current status: ${period.status}`);

    // Update period status to 'closed' (so finalize will process it)
    const updatedPeriods = [...auctionPeriods];
    updatedPeriods[periodIndex] = {
      ...period,
      status: 'closed',
    };

    // Update the game
    await gameDoc.ref.update({
      'config.auctionPeriods': updatedPeriods,
      'config.auctionStatus': 'active', // Reset auction status
    });

    results.push(`Period status changed to: closed`);

    // Optionally reset bids to active status
    if (resetBidsToActive) {
      results.push(`\nResetting bids to active status...`);

      // Get all won bids for this period
      const periodStartDate = period.startDate?.toDate?.() || period.startDate;
      const periodEndDate = period.endDate?.toDate?.() || period.endDate;

      const wonBidsSnapshot = await db.collection('bids')
        .where('gameId', '==', gameId)
        .where('status', '==', 'won')
        .get();

      let bidsReset = 0;
      for (const bidDoc of wonBidsSnapshot.docs) {
        const bidData = bidDoc.data();
        const bidAt = bidData.bidAt?.toDate?.() || new Date(bidData.bidAt);

        // Check if bid is within this period
        if (bidAt >= periodStartDate && bidAt <= periodEndDate) {
          await bidDoc.ref.update({ status: 'active' });
          bidsReset++;
        }
      }

      results.push(`Reset ${bidsReset} bids to active status`);

      // Also reset bids with cancelled_* statuses from failed finalize
      const cancelledStatuses = ['cancelled_team_full', 'cancelled_over_budget', 'cancelled_duplicate'];
      for (const cancelStatus of cancelledStatuses) {
        const cancelledBidsSnapshot = await db.collection('bids')
          .where('gameId', '==', gameId)
          .where('status', '==', cancelStatus)
          .get();

        for (const bidDoc of cancelledBidsSnapshot.docs) {
          const bidData = bidDoc.data();
          const bidAt = bidData.bidAt?.toDate?.() || new Date(bidData.bidAt);

          if (bidAt >= periodStartDate && bidAt <= periodEndDate) {
            await bidDoc.ref.update({ status: 'active' });
            bidsReset++;
          }
        }
      }

      results.push(`Total bids reset: ${bidsReset}`);
    }

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'ADMIN_REOPEN_AUCTION_PERIOD',
      userId: adminUserId,
      details: {
        gameId,
        gameName: gameData?.name,
        periodName,
        previousStatus: period.status,
        resetBidsToActive: resetBidsToActive || false,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    results.push(`\n✓ Period reopened successfully!`);
    results.push(`The finalize will run again when finalizeDate is reached.`);

    return NextResponse.json({
      success: true,
      results: results.join('\n'),
    });
  } catch (error) {
    console.error('Error reopening auction period:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
