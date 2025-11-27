import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { userId, bidId } = await request.json();

    if (!userId || !bidId) {
      return NextResponse.json(
        { error: 'userId and bidId are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get the bid
    const bidDoc = await db.collection('bids').doc(bidId).get();
    if (!bidDoc.exists) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      );
    }

    const bidData = bidDoc.data();

    // Verify bid belongs to user
    if (bidData?.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only cancel your own bids' },
        { status: 403 }
      );
    }

    // Verify bid belongs to this game
    if (bidData?.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Bid does not belong to this game' },
        { status: 400 }
      );
    }

    // Only allow canceling active or outbid bids
    if (bidData?.status !== 'active' && bidData?.status !== 'outbid') {
      return NextResponse.json(
        { error: `Cannot cancel a bid with status: ${bidData?.status}` },
        { status: 400 }
      );
    }

    // Get game data to check auction status
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    // Only allow canceling bids if auction is still active/bidding
    const auctionActive = gameData?.status === 'bidding' || gameData?.config?.auctionStatus === 'active';
    const auctionClosed = gameData?.status === 'finished' || gameData?.config?.auctionStatus === 'closed' || gameData?.config?.auctionStatus === 'finalized';

    if (!auctionActive || auctionClosed) {
      return NextResponse.json(
        { error: 'Cannot cancel bids when auction is not active' },
        { status: 400 }
      );
    }

    // If this was an active bid, we need to restore the previous highest bid
    if (bidData?.status === 'active') {
      const riderNameId = bidData?.riderNameId;

      // Get all outbid bids for this rider, sorted by amount descending
      const outbidBidsSnapshot = await db.collection('bids')
        .where('gameId', '==', gameId)
        .where('riderNameId', '==', riderNameId)
        .where('status', '==', 'outbid')
        .orderBy('amount', 'desc')
        .limit(1)
        .get();

      // If there was a previous bid, restore it to active
      if (!outbidBidsSnapshot.empty) {
        await outbidBidsSnapshot.docs[0].ref.update({ status: 'active' });
      }
    }

    // Delete the bid (or mark as cancelled)
    await bidDoc.ref.delete();

    // Get user data for logging
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'BID_CANCELLED',
      userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        bidId,
        riderNameId: bidData?.riderNameId,
        riderName: bidData?.riderName,
        amount: bidData?.amount,
        previousStatus: bidData?.status,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Bid cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling bid:', error);
    return NextResponse.json(
      { error: 'Failed to cancel bid', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
