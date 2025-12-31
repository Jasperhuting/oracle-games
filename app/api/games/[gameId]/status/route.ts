import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { GAME_STATUSES } from '@/lib/types/games';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { status } = await request.json();

    // Validate status
    if (!status || !GAME_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${GAME_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if game exists
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const currentGameData = gameDoc.data();

    // Prepare update object
    const updateData: Record<string, unknown> = {
      status: status,
      updatedAt: new Date().toISOString(),
    };

    // For auction/auctioneer games, sync the config.auctionStatus with game status
    // This ensures config.auctionStatus is always in sync with game.status
    if (currentGameData?.gameType === 'auction' || currentGameData?.gameType === 'auctioneer') {
      if (status === 'bidding') {
        updateData['config.auctionStatus'] = 'active';
      } else if (status === 'active') {
        // When moving to active, check if it was previously bidding
        // If so, it might mean the auction was finalized
        if (currentGameData?.status === 'bidding') {
          updateData['config.auctionStatus'] = 'finalized';
        } else {
          // If not coming from bidding, set to active (safe default)
          updateData['config.auctionStatus'] = 'active';
        }
      } else if (status === 'finished') {
        updateData['config.auctionStatus'] = 'closed';
      } else if (status === 'registration' || status === 'draft') {
        updateData['config.auctionStatus'] = 'pending';
      }
    }

    // Update game status
    await gameRef.update(updateData);

    // Log the status change with auction status details for auction games
    const logDetails: Record<string, unknown> = {
      oldStatus: currentGameData?.status,
      newStatus: status,
    };
    
    // Add auction status info for auction/auctioneer games
    if (currentGameData?.gameType === 'auction' || currentGameData?.gameType === 'auctioneer') {
      logDetails.oldAuctionStatus = currentGameData?.config?.auctionStatus;
      logDetails.newAuctionStatus = updateData['config.auctionStatus'];
    }

    await db.collection('activityLogs').add({
      action: 'GAME_STATUS_CHANGED',
      gameId: gameId,
      gameName: currentGameData?.name,
      details: logDetails,
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Game status updated successfully',
      gameId: gameId,
      newStatus: status,
    });

  } catch (error) {
    console.error('Error updating game status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update game status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
