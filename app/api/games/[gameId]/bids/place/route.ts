import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { PlaceBidRequest, PlaceBidResponse, ApiErrorResponse, ClientBid, BidStatus } from '@/lib/types';
import { placeBidSchema, validateRequest } from '@/lib/validation';
import { jsonWithCacheVersion } from '@/lib/utils/apiCacheHeaders';

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
    if (gameData?.gameType !== 'auctioneer' && gameData?.gameType !== 'worldtour-manager' && gameData?.gameType !== 'marginal-gains') {
      return NextResponse.json(
        { error: 'Game does not support bidding' },
        { status: 400 }
      );
    }

    // Check if game status is 'bidding' (strict validation - game.status is the single source of truth)
    if (gameData?.status !== 'bidding') {
      // Log auction not active validation failure
      await db.collection('activityLogs').add({
        action: 'BID_VALIDATION_FAILED',
        userId,
        userEmail: userData?.email,
        userName: userData?.playername || userData?.email,
        details: {
          gameId,
          gameName: gameData?.name,
          riderNameId,
          riderName,
          amount,
          validationType: 'AUCTION_NOT_ACTIVE',
          errorMessage: 'Auction is not active. Current game status: ' + (gameData?.status || 'unknown'),
          currentGameStatus: gameData?.status || 'unknown',
        },
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

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
    let existingBidRef: FirebaseFirestore.DocumentReference | null = null;

    // If user already has an active bid on this rider, we'll update it instead of creating a new one
    if (!existingUserBid.empty) {
      // Mark that we're updating an existing bid
      isUpdatingOwnBid = true;
      currentUserBidOnThisRider = existingUserBid.docs[0].data().amount || 0;

      // IMPORTANT: Store the reference but DO NOT delete yet!
      // We'll delete it AFTER all validations pass and right before creating the new bid
      existingBidRef = existingUserBid.docs[0].ref;
    }

    if (!highestBidSnapshot.empty) {
      const highestBidData = highestBidSnapshot.docs[0].data();
      const highestBidDoc = highestBidSnapshot.docs[0];

      // Check if the highest bid is from the current user
      if (highestBidData.userId === userId) {
        isUpdatingOwnBid = true;
        currentUserBidOnThisRider = highestBidData.amount || 0;

        // IMPORTANT: Store the reference but DO NOT delete yet!
        // Only update existingBidRef if we haven't already found one
        if (!existingBidRef) {
          existingBidRef = highestBidDoc.ref;
        }

        // Allow users to update their bid to any amount (increase or decrease)
        // No restrictions on the new amount
      } else {
        // Someone else has the highest bid
        // Allow any bid amount - users can bid lower than the current highest bid
        // Do NOT mark previous bids as outbid during bidding - this is only done during finalization
      }
    }

    // Get user's active bids to calculate available budget
    const activeBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    // For maxRiders check, we need to count BOTH active AND won bids
    // (won bids represent riders already on the team)
    const allBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'won'])
      .get();

    // Filter out ALL bids on the current rider (to handle duplicate bids edge case)
    // This ensures we don't double-count any bids on this rider
    const activeBidsExcludingCurrentRider = activeBidsSnapshot.docs.filter(doc => {
      const data = doc.data();
      // If we're updating an existing bid, exclude ALL bids on this rider
      return !isUpdatingOwnBid || data.riderNameId !== riderNameId;
    });

    // Check maxRiders limit - count unique riders from BOTH active and won bids
    const uniqueRiderIds = new Set<string>();
    allBidsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Exclude current rider only if updating an existing bid
      if (!isUpdatingOwnBid || data.riderNameId !== riderNameId) {
        uniqueRiderIds.add(data.riderNameId);
      }
    });

    const maxRiders = gameData?.config?.maxRiders;

    // Only block NEW bids if we're at or over the limit
    // Allow updating existing bids even if over the limit (e.g., if admin reduced maxRiders after bids were placed)
    if (maxRiders && !isUpdatingOwnBid && uniqueRiderIds.size >= maxRiders) {
      // Log maxRiders limit validation failure
      await db.collection('activityLogs').add({
        action: 'BID_VALIDATION_FAILED',
        userId,
        userEmail: userData?.email,
        userName: userData?.playername || userData?.email,
        details: {
          gameId,
          gameName: gameData?.name,
          riderNameId,
          riderName,
          amount,
          validationType: 'MAX_RIDERS_LIMIT',
          errorMessage: `Maximum number of riders reached (${maxRiders})`,
          currentRidersCount: uniqueRiderIds.size,
          maxRiders,
          isNewBid: !isUpdatingOwnBid,
        },
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      return NextResponse.json(
        { error: `Maximum number of riders reached (${uniqueRiderIds.size}/${maxRiders}). Cancel a bid before placing a new one.` },
        { status: 400 }
      );
    }

    // Calculate total active bids from the filtered list
    // This correctly handles duplicate bids by excluding ALL bids on the current rider
    const totalActiveBids = activeBidsExcludingCurrentRider.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.amount || 0);
    }, 0);

    // Check if user has enough budget (budget - spent - active bids)
    // Skip budget validation for marginal-gains (no budget system)
    // Use game's budget (in case admin updated it) instead of participant's budget
    const budget = gameData?.config?.budget || 0;
    
    // IMPORTANT: Calculate spentBudget from actual won bids instead of using stored value
    // This prevents double-counting when the game goes back to 'bidding' status after finalization
    // The stored spentBudget may include won bids that are now active again
    const wonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();
    
    const spentBudget = wonBidsSnapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data().amount || 0);
    }, 0);
    
    const availableBudget = budget - spentBudget - totalActiveBids;

    if (gameData?.gameType !== 'marginal-gains' && amount > availableBudget) {
      // Log budget validation failure
      await db.collection('activityLogs').add({
        action: 'BID_VALIDATION_FAILED',
        userId,
        userEmail: userData?.email,
        userName: userData?.playername || userData?.email,
        details: {
          gameId,
          gameName: gameData?.name,
          riderNameId,
          riderName,
          amount,
          validationType: 'INSUFFICIENT_BUDGET',
          errorMessage: `Insufficient budget. Available: ${availableBudget.toFixed(1)}, Attempted: ${amount}`,
          budget,
          spentBudget,
          totalActiveBids,
          availableBudget: availableBudget.toFixed(1),
          isUpdate: isUpdatingOwnBid,
          previousAmount: isUpdatingOwnBid ? currentUserBidOnThisRider : null,
        },
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      return NextResponse.json(
        { error: `Insufficient budget. Available: ${availableBudget.toFixed(1)}, Attempted: ${amount}` },
        { status: 400 }
      );
    }

    // CRITICAL: Only delete the existing bid AFTER all validations have passed
    // This prevents the bug where a bid is deleted but the new one fails to be created

    // Store the old bid data in case we need to restore it
    let oldBidData: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (existingBidRef) {
      const oldBidDoc = await existingBidRef.get();
      oldBidData = oldBidDoc.exists ? oldBidDoc.data() : null;
      await existingBidRef.delete();
    }

    // Create new bid - wrap in try-catch to restore old bid if this fails
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

    let bidRef;
    try {
      bidRef = await db.collection('bids').add(bid);
    } catch (createError) {
      // If creating the new bid fails, restore the old bid
      if (oldBidData && existingBidRef) {
        try {
          await db.collection('bids').add(oldBidData);
          console.error('[BID PLACE] Failed to create new bid, restored old bid:', createError);

          // Log the restore action - this is CRITICAL to track
          await db.collection('activityLogs').add({
            action: 'BID_RESTORE_SUCCESS',
            userId,
            userEmail: userData?.email,
            userName: userData?.playername || userData?.email,
            details: {
              gameId,
              gameName: gameData?.name,
              riderNameId,
              riderName,
              attemptedAmount: amount,
              restoredAmount: oldBidData.amount,
              errorMessage: createError instanceof Error ? createError.message : 'Unknown error creating bid',
              errorType: 'BID_CREATE_FAILED',
            },
            timestamp: Timestamp.now(),
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          });
        } catch (restoreError) {
          console.error('[BID PLACE] CRITICAL: Failed to restore old bid after create failure:', restoreError);

          // Log the CRITICAL failure to restore - this means data loss!
          await db.collection('activityLogs').add({
            action: 'BID_RESTORE_FAILED',
            userId,
            userEmail: userData?.email,
            userName: userData?.playername || userData?.email,
            details: {
              gameId,
              gameName: gameData?.name,
              riderNameId,
              riderName,
              attemptedAmount: amount,
              lostBidAmount: oldBidData?.amount,
              createError: createError instanceof Error ? createError.message : 'Unknown error creating bid',
              restoreError: restoreError instanceof Error ? restoreError.message : 'Unknown error restoring bid',
              severity: 'CRITICAL',
              dataLoss: true,
            },
            timestamp: Timestamp.now(),
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          });
        }
      }
      throw createError; // Re-throw to be caught by outer catch
    }

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
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return jsonWithCacheVersion({
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
          timestamp: Timestamp.now(),
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
