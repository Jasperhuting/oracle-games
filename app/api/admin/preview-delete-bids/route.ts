import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ApiErrorResponse } from '@/lib/types';

interface PreviewDeleteResponse {
  success: boolean;
  totalBids: number;
  bidsToDelete: number;
  affectedPlayers: number;
  bidsDetails: Array<{
    playername: string;
    riderName: string;
    amount: number;
    bidAt: string;
  }>;
}

// POST endpoint to preview bid deletion without actually deleting
export async function POST(
  request: NextRequest
): Promise<NextResponse<PreviewDeleteResponse | ApiErrorResponse>> {
  try {
    const { gameId, auctionPeriodIndex, adminUserId } = await request.json();

    if (!gameId || auctionPeriodIndex === undefined || !adminUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, auctionPeriodIndex, adminUserId' },
        { status: 400 }
      );
    }

    // Verify admin user
    const adminUserDoc = await adminDb.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Get game document
    const gameDoc = await adminDb.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const game = gameDoc.data();
    const auctionPeriods = game?.config?.auctionPeriods;

    if (!auctionPeriods || !auctionPeriods[auctionPeriodIndex]) {
      return NextResponse.json(
        { error: 'Invalid auction period index' },
        { status: 400 }
      );
    }

    const auctionPeriod = auctionPeriods[auctionPeriodIndex];
    const startDate = typeof auctionPeriod.startDate === 'object' && 'toDate' in auctionPeriod.startDate
      ? auctionPeriod.startDate.toDate()
      : new Date(auctionPeriod.startDate);
    const endDate = typeof auctionPeriod.endDate === 'object' && 'toDate' in auctionPeriod.endDate
      ? auctionPeriod.endDate.toDate()
      : new Date(auctionPeriod.endDate);

    // Get all bids for this game
    const bidsSnapshot = await adminDb
      .collection('bids')
      .where('gameId', '==', gameId)
      .get();

    // Filter bids by auction period dates
    const bidsInPeriod = bidsSnapshot.docs.filter((doc: any) => {
      const bid = doc.data();
      // Handle both Firestore Timestamp and string dates
      const bidDate = typeof bid.bidAt === 'object' && 'toDate' in bid.bidAt
        ? bid.bidAt.toDate()
        : new Date(bid.bidAt);
      return bidDate >= startDate && bidDate <= endDate;
    });

    // Count unique users affected and build details
    const affectedUsers = new Set<string>();
    const bidsDetails: Array<{
      playername: string;
      riderName: string;
      amount: number;
      bidAt: string;
    }> = [];

    for (const doc of bidsInPeriod) {
      const bid = doc.data();
      affectedUsers.add(bid.userId);

      // Convert bidAt to ISO string
      const bidAtString = typeof bid.bidAt === 'object' && 'toDate' in bid.bidAt
        ? bid.bidAt.toDate().toISOString()
        : new Date(bid.bidAt).toISOString();

      bidsDetails.push({
        playername: bid.playername || 'Unknown',
        riderName: bid.riderName || 'Unknown Rider',
        amount: bid.amount || 0,
        bidAt: bidAtString
      });
    }

    // Sort by bidAt descending (most recent first)
    bidsDetails.sort((a, b) => new Date(b.bidAt).getTime() - new Date(a.bidAt).getTime());

    return NextResponse.json({
      success: true,
      totalBids: bidsSnapshot.size,
      bidsToDelete: bidsInPeriod.length,
      affectedPlayers: affectedUsers.size,
      bidsDetails
    });

  } catch (error: any) {
    console.error('Error previewing bid deletion:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview bid deletion' },
      { status: 500 }
    );
  }
}
