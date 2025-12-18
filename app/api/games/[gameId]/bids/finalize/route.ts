import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    // Parse request body to get auction period name
    const body = await request.json().catch(() => ({}));
    const { auctionPeriodName } = body;

    console.log(`[FINALIZE] Request for gameId: ${gameId}, auctionPeriodName: ${auctionPeriodName || 'ALL'}`);

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

    // Check if game type supports bidding/selection
    if (gameData?.gameType !== 'auctioneer' && gameData?.gameType !== 'worldtour-manager') {
      return NextResponse.json(
        { error: 'Game does not support bidding' },
        { status: 400 }
      );
    }

    // If game has auction periods, validate that auctionPeriodName is provided
    const auctionPeriods = gameData?.config?.auctionPeriods;
    if (auctionPeriods && auctionPeriods.length > 0) {
      if (!auctionPeriodName) {
        return NextResponse.json(
          { error: 'auctionPeriodName is required for games with multiple auction periods' },
          { status: 400 }
        );
      }

      // Validate that the period exists
      const periodExists = auctionPeriods.some((p: any) => p.name === auctionPeriodName);
      if (!periodExists) {
        return NextResponse.json(
          { error: `Auction period "${auctionPeriodName}" not found` },
          { status: 404 }
        );
      }

      // Get the period start date to filter bids
      const period = auctionPeriods.find((p: any) => p.name === auctionPeriodName);
      const periodStartDate = period?.startDate?.toDate?.() || new Date(period?.startDate);

      console.log(`[FINALIZE] Filtering bids for period "${auctionPeriodName}" starting from ${periodStartDate.toISOString()}`);
    }

    // Get all bids for this game (without status filter to avoid index requirement)
    console.log(`[FINALIZE] Querying all bids for gameId: ${gameId}`);
    const allBidsForGameSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .get();

    console.log(`[FINALIZE] Found ${allBidsForGameSnapshot.size} total bids for game`);

    // Filter for active and outbid bids in memory (outbid status may exist from legacy data)
    // AND filter by auction period if specified
    const activeBidsDocs = allBidsForGameSnapshot.docs.filter(doc => {
      const bidData = doc.data();
      const status = bidData.status;

      // Filter by status
      if (status !== 'active' && status !== 'outbid') {
        return false;
      }

      // Filter by auction period if specified
      if (auctionPeriodName && auctionPeriods && auctionPeriods.length > 0) {
        const period = auctionPeriods.find((p: any) => p.name === auctionPeriodName);
        const periodStartDate = period?.startDate?.toDate?.() || new Date(period?.startDate);
        const bidAt = bidData.bidAt?.toDate?.() || new Date(bidData.bidAt);

        // Only include bids made during or after the period start
        return bidAt >= periodStartDate;
      }

      return true;
    });
    console.log(`[FINALIZE] Found ${activeBidsDocs.length} active/outbid bids after filtering`);

    // Create a snapshot-like object for compatibility with existing code
    const activeBidsSnapshot = {
      empty: activeBidsDocs.length === 0,
      size: activeBidsDocs.length,
      docs: activeBidsDocs
    };

    // If no active bids, provide detailed error
    if (activeBidsSnapshot.empty) {
      if (allBidsForGameSnapshot.size > 0) {
        const statusCounts: Record<string, number> = {};
        allBidsForGameSnapshot.docs.forEach(doc => {
          const status = doc.data().status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log(`[FINALIZE] Bid status breakdown:`, statusCounts);
        
        return NextResponse.json(
          { 
            error: 'No active bids found', 
            details: `Found ${allBidsForGameSnapshot.size} total bids with statuses: ${JSON.stringify(statusCounts)}` 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'No bids found for this game' },
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
              pricePaid: bid.amount, // Use pricePaid instead of amount for consistency
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
            rosterSize: newTeam.length,
          });

          // IMPORTANT: Also create PlayerTeam documents for each won rider
          // This is required for the points calculation system
          console.log(`[FINALIZE] Creating ${wins.length} PlayerTeam documents for user ${userId}`);
          for (const { riderNameId, bid } of wins) {
            try {
              await db.collection('playerTeams').add({
                gameId: gameId,
                userId: userId,
                riderNameId: riderNameId,
                
                // Acquisition info
                acquiredAt: new Date(),
                acquisitionType: 'auction',
                pricePaid: bid.amount,
                
                // Rider info (denormalized)
                riderName: bid.riderName,
                riderTeam: bid.riderTeam,
                riderCountry: bid.riderCountry || '',
                jerseyImage: bid.jerseyImage || '',
                
                // Status
                active: true,
                benched: false,
                
                // Performance (initialized to 0)
                pointsScored: 0,
                stagesParticipated: 0,
              });
              console.log(`[FINALIZE]   - Created PlayerTeam document for ${bid.riderName}`);
            } catch (error) {
              console.error(`[FINALIZE]   - ERROR creating PlayerTeam for ${bid.riderName}:`, error);
              results.errors.push(`Failed to create PlayerTeam for ${bid.riderName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

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

    // Update game status and period status
    const updateData: any = {
      status: 'active',
      finalizedAt: new Date().toISOString(),
    };

    // If this is a specific auction period, update that period's status to 'finalized'
    if (auctionPeriodName && auctionPeriods && auctionPeriods.length > 0) {
      const updatedPeriods = auctionPeriods.map((p: any) => {
        if (p.name === auctionPeriodName) {
          console.log(`[FINALIZE] Marking period "${auctionPeriodName}" as finalized`);
          return { ...p, status: 'finalized' };
        }
        return p;
      });

      updateData['config.auctionPeriods'] = updatedPeriods;

      // Check if all periods are finalized
      const allPeriodsFinalized = updatedPeriods.every((p: any) => p.status === 'finalized');
      if (allPeriodsFinalized) {
        updateData['config.auctionStatus'] = 'finalized';
        console.log(`[FINALIZE] All auction periods finalized, marking game auction as finalized`);
      }
    } else {
      // For games without periods, mark the whole auction as finalized
      updateData['config.auctionStatus'] = 'finalized';
    }

    await gameDoc.ref.update(updateData);

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
