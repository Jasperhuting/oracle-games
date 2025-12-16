import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ApiErrorResponse } from '@/lib/types';

interface PreviewResponse {
  success: boolean;
  totalPlayers: number;
  totalBids: number;
  preview: Array<{
    userId: string;
    playername: string;
    bids: Array<{
      riderName: string;
      amount: number;
    }>;
  }>;
}

// POST endpoint to preview bid backup messages without sending them
export async function POST(
  request: NextRequest
): Promise<NextResponse<PreviewResponse | ApiErrorResponse>> {
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

    // Get all bids in this auction period
    const bidsSnapshot = await adminDb
      .collection('bids')
      .where('gameId', '==', gameId)
      .get();

    console.log(`Total bids in game: ${bidsSnapshot.size}`);
    console.log(`Auction period ${auctionPeriodIndex}: ${startDate} - ${endDate}`);

    // Filter bids by auction period dates
    const bidsInPeriod = bidsSnapshot.docs
      .map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((bid: any) => {
        // Handle both Firestore Timestamp and string dates
        const bidDate = typeof bid.bidAt === 'object' && 'toDate' in bid.bidAt
          ? bid.bidAt.toDate()
          : new Date(bid.bidAt);

        const isInPeriod = bidDate >= startDate && bidDate <= endDate;
        console.log(`Bid ${bid.id}: ${bid.riderName} by ${bid.playername} - bidAt: ${bidDate.toISOString()} - In period: ${isInPeriod} (period: ${startDate.toISOString()} to ${endDate.toISOString()})`);
        return isInPeriod;
      });

    console.log(`Bids in period: ${bidsInPeriod.length}`);

    // Group bids by user
    const bidsByUser = new Map<string, Array<{
      riderName: string;
      amount: number;
    }>>();

    bidsInPeriod.forEach((bid: any) => {
      if (!bidsByUser.has(bid.userId)) {
        bidsByUser.set(bid.userId, []);
      }
      bidsByUser.get(bid.userId)!.push({
        riderName: bid.riderName || 'Unknown Rider',
        amount: bid.amount
      });
    });

    // Build preview data
    const preview: Array<{
      userId: string;
      playername: string;
      bids: Array<{
        riderName: string;
        amount: number;
      }>;
    }> = [];

    let totalBids = 0;

    for (const [userId, bids] of bidsByUser.entries()) {
      // Get user info
      const participantSnapshot = await adminDb
        .collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (participantSnapshot.empty) {
        console.log(`No participant found for userId: ${userId}`);
        continue;
      }

      const participant = participantSnapshot.docs[0].data();
      const playername = participant.playername || 'Speler';

      preview.push({
        userId,
        playername,
        bids: bids.sort((a, b) => b.amount - a.amount) // Sort by amount descending
      });

      totalBids += bids.length;
    }

    // Sort preview by playername
    preview.sort((a, b) => a.playername.localeCompare(b.playername));

    return NextResponse.json({
      success: true,
      totalPlayers: preview.length,
      totalBids,
      preview
    });

  } catch (error: any) {
    console.error('Error previewing bid backup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview bid backup' },
      { status: 500 }
    );
  }
}
