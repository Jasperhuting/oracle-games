import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { ApiErrorResponse } from '@/lib/types';

interface BidBackupResponse {
  success: boolean;
  messagesSent: number;
  details: Array<{
    userId: string;
    playername: string;
    ridersCount: number;
  }>;
}

// POST endpoint to send bid backup messages to all players in a specific auction period
export async function POST(
  request: NextRequest
): Promise<NextResponse<BidBackupResponse | ApiErrorResponse>> {
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

    // Get all bids in this auction period
    const bidsSnapshot = await adminDb
      .collection('bids')
      .where('gameId', '==', gameId)
      .get();

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
        return bidDate >= startDate && bidDate <= endDate;
      });

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

    // Send messages to each user
    const messagePromises: Promise<any>[] = [];
    const details: Array<{
      userId: string;
      playername: string;
      ridersCount: number;
    }> = [];

    for (const [userId, bids] of bidsByUser.entries()) {
      // Get user info
      const participantSnapshot = await adminDb
        .collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (participantSnapshot.empty) continue;

      const participant = participantSnapshot.docs[0].data();
      const playername = participant.playername || 'Speler';

      // Create message content with list of riders (without status)
      const ridersList = bids
        .map(bid => `• ${bid.riderName} - €${bid.amount.toFixed(1)}`)
        .join('\n');

      const messageContent = `Beste ${playername},

Vanwege een technisch probleem moet ${periodName} opnieuw worden gespeeld. Alle biedingen uit deze ronde worden verwijderd.

Ter referentie, dit zijn de renners waarop je had geboden in ${periodName}:

${ridersList}

Je kunt binnenkort opnieuw bieden in ${periodName}.

Met excuses voor het ongemak,
Het Oracle Games Team`;

      // Create message document
      const messagePromise = adminDb.collection('messages').add({
        type: 'individual',
        senderId: adminUserId,
        senderName: adminUserDoc.data()?.playername || 'Admin',
        recipientId: userId,
        recipientName: playername,
        subject: `Backup van je biedingen - ${periodName}`,
        message: messageContent,
        sentAt: Timestamp.now(),
        read: false,
        deletedBySender: false,
        deletedByRecipient: false
      });

      messagePromises.push(messagePromise);
      details.push({
        userId,
        playername,
        ridersCount: bids.length
      });
    }

    // Wait for all messages to be sent
    await Promise.all(messagePromises);

    return NextResponse.json({
      success: true,
      messagesSent: messagePromises.length,
      details
    });

  } catch (error: any) {
    console.error('Error sending bid backup messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send bid backup messages' },
      { status: 500 }
    );
  }
}
