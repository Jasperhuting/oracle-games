import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { PlaceBidRequest, PlaceBidResponse, ApiErrorResponse, ClientBid, BidStatus } from '@/lib/types';
import { placeBidSchema, validateRequest } from '@/lib/validation';

// TEMPORARY: Toggle to disable bidding
const BIDDING_DISABLED = false;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<PlaceBidResponse | ApiErrorResponse>> {
  // Parse params and body at the top so they're available in catch block
  const { gameId } = await params;
  let userId: string | undefined;
  let riderNameId: string | undefined;
  let amount: number | undefined;

  try {
    // Check if bidding is temporarily disabled
    if (BIDDING_DISABLED) {
      return NextResponse.json(
        { error: 'Bidding is temporarily disabled for maintenance. Please try again later.' },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validation = validateRequest(placeBidSchema, body);
    if (!validation.success) {
      return validation.error;
    }

    const validatedData = validation.data;
    userId = validatedData.userId;
    riderNameId = validatedData.riderNameId;
    amount = validatedData.amount;
    const { riderName, riderTeam, jerseyImage } = validatedData;

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

    // Check if game type supports bidding/selection
    if (gameData?.gameType !== 'auctioneer' && gameData?.gameType !== 'worldtour-manager') {
      return NextResponse.json(
        { error: 'Game does not support bidding' },
        { status: 400 }
      );
    }

    // Check if game status is 'bidding' (strict validation - game.status is the single source of truth)
    if (gameData?.status !== 'bidding') {
      return NextResponse.json(
        { error: 'Auction is not active. Current game status: ' + (gameData?.status || 'unknown') },
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

    // Check if user already has an active bid on this rider
    const existingUserBid = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('riderNameId', '==', riderNameId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

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

    // If user already has an active bid on this rider, we'll update it instead of creating a new one
    if (!existingUserBid.empty) {
      // Mark that we're updating an existing bid
      isUpdatingOwnBid = true;
      currentUserBidOnThisRider = existingUserBid.docs[0].data().amount || 0;
      
      // Delete the existing bid - we'll create a new one with the updated amount
      await existingUserBid.docs[0].ref.delete();
    }

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
        // Do NOT mark previous bids as outbid during bidding - this is only done during finalization
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

    // If updating own bid, delete the old bid before creating new one
    if (isUpdatingOwnBid && !highestBidSnapshot.empty) {
      await highestBidSnapshot.docs[0].ref.delete();
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
      status: 'active' as BidStatus,
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
      } as ClientBid,
    });
  } catch (error) {
    console.error('Error placing bid:', error);

    // Log the error to activity log
    try {
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
