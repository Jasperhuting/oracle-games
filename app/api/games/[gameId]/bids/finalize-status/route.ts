import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

/**
 * Get the status of an auction finalization
 * Returns information about progress and allows resuming if interrupted
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const auctionPeriodName = searchParams.get('auctionPeriodName');

    console.log(`[FINALIZE_STATUS] Checking status for gameId: ${gameId}, period: ${auctionPeriodName || 'ALL'}`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameDoc.data();

    // Check if game has auction periods
    const auctionPeriods = game?.config?.auctionPeriods;
    if (!auctionPeriods || !Array.isArray(auctionPeriods)) {
      return NextResponse.json({ error: 'Game does not have auction periods' }, { status: 400 });
    }

    // Find the specific period
    let targetPeriod = null;
    if (auctionPeriodName) {
      targetPeriod = auctionPeriods.find((p: any) => p.name === auctionPeriodName);
      if (!targetPeriod) {
        return NextResponse.json({ error: `Auction period "${auctionPeriodName}" not found` }, { status: 404 });
      }
    } else {
      // Find the first non-finalized period
      targetPeriod = auctionPeriods.find((p: any) => p.status !== 'finalized');
    }

    if (!targetPeriod) {
      return NextResponse.json({
        message: auctionPeriodName ? 
          `Auction period "${auctionPeriodName}" is already finalized` : 
          'All auction periods are finalized',
        status: 'completed',
        period: auctionPeriodName,
      });
    }

    // Get all bids for this game and period
    const allBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .get();

    // Helper to convert Firestore timestamp to ISO string
    const toISOString = (value: any): string | null => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof Date) return value.toISOString();
      if (typeof value.toDate === 'function') return value.toDate().toISOString();
      if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
      return null;
    };

    // Filter bids for the specific period
    const periodBids = allBidsSnapshot.docs.filter(doc => {
      const bidData = doc.data();
      const status = bidData.status;

      // Only include active/outbid bids
      if (status !== 'active' && status !== 'outbid') {
        return false;
      }

      // Filter by auction period
      if (auctionPeriodName) {
        const periodStartDate = toISOString(targetPeriod.startDate);
        const periodEndDate = toISOString(targetPeriod.endDate);
        const bidAt = toISOString(bidData.bidAt);

        if (!periodStartDate || !periodEndDate || !bidAt) {
          return false;
        }

        return bidAt >= periodStartDate && bidAt <= periodEndDate;
      }

      return true;
    });

    // Group bids by user to see who needs processing
    const bidsByUser = new Map<string, any[]>();
    periodBids.forEach(doc => {
      const bidData = doc.data();
      const userId = bidData.userId;
      
      if (!bidsByUser.has(userId)) {
        bidsByUser.set(userId, []);
      }
      bidsByUser.get(userId)!.push({ id: doc.id, ...bidData });
    });

    // Check which users already have processed bids for this period
    const processedUsers = new Set<string>();
    const wonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('status', '==', 'won')
      .get();

    wonBidsSnapshot.docs.forEach(doc => {
      const bidData = doc.data();
      const bidAt = toISOString(bidData.bidAt);
      
      if (auctionPeriodName && targetPeriod) {
        const periodStartDate = toISOString(targetPeriod.startDate);
        const periodEndDate = toISOString(targetPeriod.endDate);
        
        if (bidAt && periodStartDate && periodEndDate) {
          if (bidAt >= periodStartDate && bidAt <= periodEndDate) {
            processedUsers.add(bidData.userId);
          }
        }
      }
    });

    // Determine which users still need processing
    const usersToProcess = Array.from(bidsByUser.keys()).filter(userId => !processedUsers.has(userId));
    const sortedUsersToProcess = usersToProcess.sort();

    const status = {
      gameId,
      gameName: game.name,
      period: {
        name: targetPeriod.name,
        status: targetPeriod.status,
        startDate: toISOString(targetPeriod.startDate),
        endDate: toISOString(targetPeriod.endDate),
        finalizeDate: toISOString(targetPeriod.finalizeDate),
      },
      bids: {
        total: periodBids.length,
        users: bidsByUser.size,
        usersProcessed: processedUsers.size,
        usersRemaining: usersToProcess.length,
      },
      progress: {
        totalUsers: bidsByUser.size,
        processedUsers: processedUsers.size,
        remainingUsers: usersToProcess.length,
        percentageComplete: bidsByUser.size > 0 ? Math.round((processedUsers.size / bidsByUser.size) * 100) : 100,
      },
      canResume: usersToProcess.length > 0 && targetPeriod.status !== 'finalized',
      nextUserId: sortedUsersToProcess[0] || null,
      usersToProcess: sortedUsersToProcess,
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('Error checking finalization status:', error);
    return NextResponse.json(
      { error: 'Failed to check finalization status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
