import { adminHandler, ApiError } from '@/lib/api/handler';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

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
export const POST = adminHandler('delete-period-bids', async ({ uid, request }) => {
  const { gameId, auctionPeriodIndex } = await request.json();

  if (!gameId || auctionPeriodIndex === undefined) {
    throw new ApiError('Missing required fields: gameId, auctionPeriodIndex', 400);
  }

  // Get game document
  const gameDoc = await adminDb.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    throw new ApiError('Game not found', 404);
  }

  const game = gameDoc.data();
  const auctionPeriods = game?.config?.auctionPeriods;

  if (!auctionPeriods || !auctionPeriods[auctionPeriodIndex]) {
    throw new ApiError('Invalid auction period index', 400);
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

  // Fetch admin doc for activity log
  const adminUserDoc = await adminDb.collection('users').doc(uid).get();

  // Log activity
  const activityLogRef = adminDb.collection('activityLogs').doc();
  await activityLogRef.set({
    action: 'bids_deleted',
    userId: uid,
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

  return {
    success: true,
    deletedCount,
    details: {
      totalBids: bidsSnapshot.size,
      bidsInPeriod: bidsInPeriod.length,
      deletedBids: deletedCount
    }
  } satisfies DeleteBidsResponse;
});
