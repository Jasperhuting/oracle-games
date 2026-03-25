import { adminHandler, ApiError } from '@/lib/api/handler';
import { adminDb } from '@/lib/firebase/server';

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
export const POST = adminHandler('preview-delete-bids', async ({ request }) => {
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

  return {
    success: true,
    totalBids: bidsSnapshot.size,
    bidsToDelete: bidsInPeriod.length,
    affectedPlayers: affectedUsers.size,
    bidsDetails
  } satisfies PreviewDeleteResponse;
});
