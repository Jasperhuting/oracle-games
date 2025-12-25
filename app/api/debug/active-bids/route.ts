import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to show all active bids for a game
 * Usage: /api/debug/active-bids?gameId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gameId = searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId parameter is required' },
        { status: 400 }
      );
    }

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const auctionPeriods = gameData?.config?.auctionPeriods || [];

    // Get all bids for this game
    const allBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .get();

    console.log(`[DEBUG] Found ${allBidsSnapshot.size} total bids for game ${gameId}`);

    // Group bids by status
    const bidsByStatus: Record<string, any[]> = {
      active: [],
      outbid: [],
      won: [],
      lost: [],
    };

    // Helper to convert Firestore timestamp to ISO string
    const toISOString = (value: any): string | null => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof Date) return value.toISOString();
      if (typeof value.toDate === 'function') return value.toDate().toISOString();
      if (value._seconds) return new Date(value._seconds * 1000).toISOString();
      return null;
    };

    allBidsSnapshot.docs.forEach(doc => {
      const bidData = doc.data();
      const status = bidData.status || 'unknown';

      if (!bidsByStatus[status]) {
        bidsByStatus[status] = [];
      }

      // Determine which period this bid belongs to based on timestamp
      let matchedPeriod = null;
      let periodStatus = 'No Period Match';

      if (auctionPeriods.length > 0 && bidData.bidAt) {
        const bidAt = toISOString(bidData.bidAt); // Convert to ISO string

        if (bidAt) {
          // Check each period to see if bid falls within its date range
          for (const period of auctionPeriods) {
            if (period.startDate && period.endDate) {
              // String comparison works for ISO dates
              if (bidAt >= period.startDate && bidAt <= period.endDate) {
                matchedPeriod = period.name;
                periodStatus = period.status || 'unknown';
                break;
              }
            }
          }

          // Check if bid is before all periods
          if (!matchedPeriod && auctionPeriods[0].startDate) {
            if (bidAt < auctionPeriods[0].startDate) {
              matchedPeriod = 'Before All Periods';
              periodStatus = 'N/A';
            }
          }

          // Check if bid is after all periods
          if (!matchedPeriod && auctionPeriods[auctionPeriods.length - 1].endDate) {
            if (bidAt > auctionPeriods[auctionPeriods.length - 1].endDate) {
              matchedPeriod = 'After All Periods';
              periodStatus = 'N/A';
            }
          }
        }
      }

      bidsByStatus[status].push({
        id: doc.id,
        userId: bidData.userId,
        riderName: bidData.riderName,
        amount: bidData.amount,
        bidAt: toISOString(bidData.bidAt) || bidData.bidAt, // Convert to ISO string for display
        status: bidData.status,
        matchedPeriod: matchedPeriod || 'No Match',
        periodStatus,
      });
    });

    // Sort each group by bidAt
    Object.keys(bidsByStatus).forEach(status => {
      bidsByStatus[status].sort((a, b) => {
        const dateA = new Date(a.bidAt).getTime();
        const dateB = new Date(b.bidAt).getTime();
        return dateA - dateB;
      });
    });

    // Summary stats
    const stats = {
      total: allBidsSnapshot.size,
      active: bidsByStatus.active.length,
      outbid: bidsByStatus.outbid.length,
      won: bidsByStatus.won.length,
      lost: bidsByStatus.lost.length,
    };

    // Period info
    const periodInfo = auctionPeriods.map((p: any) => ({
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      finalizeDate: p.finalizeDate,
    }));

    return NextResponse.json({
      gameId,
      gameName: gameData?.name,
      stats,
      periods: periodInfo,
      bids: bidsByStatus,
    });

  } catch (error) {
    console.error('Error fetching active bids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bids', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
