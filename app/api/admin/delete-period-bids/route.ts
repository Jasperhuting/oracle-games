import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { ApiErrorResponse } from '@/lib/types';

interface DeleteBidsResponse {
  success: boolean;
  deletedCount: number;
  details: {
    totalBids: number;
    bidsInPeriod: number;
    deletedBids: number;
  };
}

// POST endpoint to delete all bids from a specific auction period
export async function POST(
  request: NextRequest
): Promise<NextResponse<DeleteBidsResponse | ApiErrorResponse>> {
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
    const periodName = auctionPeriod.name || `Ronde ${auctionPeriodIndex + 1}`;

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

    console.log(`Found ${bidsInPeriod.length} bids in ${periodName} to delete`);

    // Delete bids in batches (Firestore limit is 500 per batch)
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < bidsInPeriod.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchDocs = bidsInPeriod.slice(i, i + batchSize);

      batchDocs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchDocs.length} bids`);
    }

    // Log activity
    const activityLogRef = adminDb.collection('activityLogs').doc();
    await activityLogRef.set({
      action: 'bids_deleted',
      userId: adminUserId,
      userName: adminUserDoc.data()?.playername || 'Admin',
      details: {
        gameId,
        gameName: game?.name,
        periodName,
        periodIndex: auctionPeriodIndex,
        deletedCount
      },
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      details: {
        totalBids: bidsSnapshot.size,
        bidsInPeriod: bidsInPeriod.length,
        deletedBids: deletedCount
      }
    });

  } catch (error: any) {
    console.error('Error deleting bids:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete bids' },
      { status: 500 }
    );
  }
}
