import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    const db = getServerFirebase();

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    // Check if game type is auctioneer
    if (gameData?.gameType !== 'auctioneer') {
      return NextResponse.json(
        { error: 'Game does not support bidding' },
        { status: 400 }
      );
    }

    // Get all active bids for this game
    const activeBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    if (activeBidsSnapshot.empty) {
      return NextResponse.json(
        { error: 'No active bids found' },
        { status: 400 }
      );
    }

    // Group bids by rider
    interface BidWithId {
      id: string;
      riderNameId: string;
      userId: string;
      amount: number;
      bidAt: unknown;
      [key: string]: unknown;
    }
    const bidsByRider = new Map<string, BidWithId[]>();

    activeBidsSnapshot.docs.forEach(doc => {
      const bidData = { id: doc.id, ...doc.data() } as BidWithId;
      const riderNameId = bidData.riderNameId;

      if (!bidsByRider.has(riderNameId)) {
        bidsByRider.set(riderNameId, []);
      }
      bidsByRider.get(riderNameId)!.push(bidData);
    });

    // Process each rider's bids
    const results = {
      totalRiders: bidsByRider.size,
      winnersAssigned: 0,
      losersRefunded: 0,
      errors: [] as string[],
    };

    // First pass: collect all winning bids per participant
    const winsByParticipant = new Map<string, Array<{riderNameId: string, bid: BidWithId}>>();

    for (const [riderNameId, bids] of bidsByRider.entries()) {
      // Sort bids: highest amount first, then earliest timestamp
      bids.sort((a, b) => {
        if (b.amount !== a.amount) {
          return b.amount - a.amount; // Higher bid wins
        }
        // If amounts are equal, earlier bid wins
        const timeA = a.bidAt?.toDate?.() || new Date(a.bidAt);
        const timeB = b.bidAt?.toDate?.() || new Date(b.bidAt);
        return timeA.getTime() - timeB.getTime();
      });

      const winningBid = bids[0];
      const losingBids = bids.slice(1);

      // Collect wins by participant
      if (!winsByParticipant.has(winningBid.userId)) {
        winsByParticipant.set(winningBid.userId, []);
      }
      winsByParticipant.get(winningBid.userId)!.push({ riderNameId, bid: winningBid });

      // Mark winning bid as "won"
      await db.collection('bids').doc(winningBid.id).update({ status: 'won' });

      // Mark losing bids as "lost"
      for (const losingBid of losingBids) {
        await db.collection('bids').doc(losingBid.id).update({ status: 'lost' });
        results.losersRefunded++;
      }
    }

    // Second pass: update each participant once with all their wins
    console.log(`[FINALIZE] Processing ${winsByParticipant.size} participants with wins`);

    for (const [userId, wins] of winsByParticipant.entries()) {
      try {
        const participantSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .limit(1)
          .get();

        if (!participantSnapshot.empty) {
          const participantDoc = participantSnapshot.docs[0];
          const participantData = participantDoc.data();

          const currentTeam = participantData.team || [];
          const currentSpentBudget = participantData.spentBudget || 0;

          console.log(`[FINALIZE] User ${userId}: current spentBudget=${currentSpentBudget}, wins=${wins.length}`);

          // Calculate total won amount and build new team
          let totalWonAmount = 0;
          const newRiders = wins.map(({ riderNameId, bid }) => {
            totalWonAmount += bid.amount;
            console.log(`[FINALIZE]   - Won rider ${bid.riderName} for ${bid.amount}`);
            return {
              riderNameId: riderNameId,
              riderName: bid.riderName,
              riderTeam: bid.riderTeam,
              jerseyImage: bid.jerseyImage,
              amount: bid.amount,
              acquiredAt: new Date().toISOString(),
            };
          });

          const newTeam = [...currentTeam, ...newRiders];
          const newSpentBudget = currentSpentBudget + totalWonAmount;

          console.log(`[FINALIZE] User ${userId}: new spentBudget=${newSpentBudget} (added ${totalWonAmount}), teamSize=${newTeam.length}`);

          // Update participant with all wins at once
          await participantDoc.ref.update({
            team: newTeam,
            spentBudget: newSpentBudget,
          });

          results.winnersAssigned += wins.length;

          console.log(`[FINALIZE] User ${userId}: UPDATED in database`);
        }
      } catch (error) {
        const errorMsg = `Failed to update participant ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log('[FINALIZE] All participants updated successfully');

    // Update game status to 'active' after finalization
    await gameDoc.ref.update({
      status: 'active',
      'config.auctionStatus': 'finalized',
      finalizedAt: new Date().toISOString(),
    });

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'AUCTION_FINALIZED',
      details: {
        gameId,
        gameName: gameData?.name,
        results,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Auction finalized successfully',
      results,
    });

  } catch (error) {
    console.error('Error finalizing auction:', error);
    return NextResponse.json(
      { error: 'Failed to finalize auction', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
