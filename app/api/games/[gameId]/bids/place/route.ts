import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { userId, riderNameId, amount, riderName, riderTeam, jerseyImage } = await request.json();

    if (!userId || !riderNameId || amount === undefined) {
      return NextResponse.json(
        { error: 'userId, riderNameId, and amount are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

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

    // Check if auction is active (either game status is 'bidding' or config.auctionStatus is 'active')
    const isAuctionActive = gameData?.status === 'bidding' || gameData?.config?.auctionStatus === 'active';
    if (!isAuctionActive) {
      return NextResponse.json(
        { error: 'Auction is not active' },
        { status: 400 }
      );
    }

    // Get participant data
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: 'User is not a participant in this game' },
        { status: 400 }
      );
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();

    // Get highest bid for this rider
    const highestBidSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('riderNameId', '==', riderNameId)
      .where('status', '==', 'active')
      .orderBy('amount', 'desc')
      .limit(1)
      .get();

    let currentUserBidOnThisRider = 0;
    let isUpdatingOwnBid = false;

    if (!highestBidSnapshot.empty) {
      const highestBidData = highestBidSnapshot.docs[0].data();
      const highestBidDoc = highestBidSnapshot.docs[0];

      // Check if the highest bid is from the current user
      if (highestBidData.userId === userId) {
        isUpdatingOwnBid = true;
        currentUserBidOnThisRider = highestBidData.amount || 0;

        // Allow users to update their bid to any amount (increase or decrease)
        // No restrictions on the new amount
      } else {
        // Someone else has the highest bid
        // Allow any bid amount - users can bid lower than the current highest bid
        // Only mark previous highest bid as outbid if new bid is higher
        if (amount > highestBidData.amount) {
          await highestBidDoc.ref.update({ status: 'outbid' });
        }
      }
    }

    // Get user's active bids to calculate available budget and check maxRiders limit
    const activeBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    // Check maxRiders limit - count unique riders (excluding current rider if updating)
    const uniqueRiderIds = new Set<string>();
    activeBidsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!isUpdatingOwnBid || data.riderNameId !== riderNameId) {
        uniqueRiderIds.add(data.riderNameId);
      }
    });

    const maxRiders = gameData?.config?.maxRiders;
    if (maxRiders && uniqueRiderIds.size >= maxRiders && !isUpdatingOwnBid) {
      return NextResponse.json(
        { error: `Maximum number of riders reached (${maxRiders}). Cancel a bid to place a new one.` },
        { status: 400 }
      );
    }

    // Calculate total active bids, excluding the current bid on this rider (if updating)
    const totalActiveBids = activeBidsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      // Skip the existing bid on this rider when calculating total
      if (isUpdatingOwnBid && data.riderNameId === riderNameId) {
        return sum;
      }
      return sum + (data.amount || 0);
    }, 0);

    // Check if user has enough budget (budget - spent - active bids)
    // Use game's budget (in case admin updated it) instead of participant's budget
    const budget = gameData?.config?.budget || 0;
    const spentBudget = participantData?.spentBudget || 0;
    const availableBudget = budget - spentBudget - totalActiveBids;

    if (amount > availableBudget) {
      return NextResponse.json(
        { error: `Insufficient budget. Available: ${availableBudget.toFixed(1)}, Attempted: ${amount}` },
        { status: 400 }
      );
    }

    // If updating own bid, mark the old bid as outbid before creating new one
    if (isUpdatingOwnBid && !highestBidSnapshot.empty) {
      await highestBidSnapshot.docs[0].ref.update({ status: 'outbid' });
    }

    // Create new bid
    const now = new Date();
    const bid = {
      gameId,
      userId,
      playername: userData?.playername || userData?.email,
      riderNameId,
      amount,
      bidAt: now,
      status: 'active',
      riderName: riderName || '',
      riderTeam: riderTeam || '',
      jerseyImage: jerseyImage || null,
    };

    const bidRef = await db.collection('bids').add(bid);

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'BID_PLACED',
      userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        bidId: bidRef.id,
        riderNameId,
        riderName,
        riderTeam: riderTeam || '',
        amount,
        isUpdate: isUpdatingOwnBid,
        previousAmount: isUpdatingOwnBid ? currentUserBidOnThisRider : null,
        availableBudget: availableBudget.toFixed(1),
        totalActiveBids: (totalActiveBids + amount).toFixed(1),
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      bidId: bidRef.id,
      bid: {
        id: bidRef.id,
        ...bid,
        bidAt: bid.bidAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error placing bid:', error);

    // Log the error to activity log
    try {
      const { gameId } = await params;
      const body = await request.json().catch(() => ({}));
      const { userId, riderNameId, amount } = body;

      if (userId) {
        const db = getServerFirebase();
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        await db.collection('activityLogs').add({
          action: 'ERROR',
          userId,
          userEmail: userData?.email,
          userName: userData?.playername || userData?.email,
          details: {
            operation: 'Place Bid',
            errorMessage: error instanceof Error ? error.message : 'Unknown error placing bid',
            errorDetails: error instanceof Error ? error.stack : undefined,
            gameId,
            endpoint: `/api/games/${gameId}/bids/place`,
            riderNameId,
            attemptedAmount: amount,
          },
          timestamp: new Date().toISOString(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }
    } catch (logError) {
      // Silently fail if we can't log the error
      console.error('Failed to log error to activity log:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to place bid', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
