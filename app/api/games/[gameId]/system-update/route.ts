import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * System endpoint for automated updates from Motia cronjobs
 * Uses API key authentication instead of admin user verification
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<{ success: boolean; message: string } | ApiErrorResponse>> {
  try {
    const { gameId } = await params;

    // Verify system API key
    const apiKey = request.headers.get('x-system-api-key');
    const expectedApiKey = process.env.SYSTEM_API_KEY;

    if (!expectedApiKey) {
      console.error('[SYSTEM_UPDATE] SYSTEM_API_KEY not configured in environment');
      return NextResponse.json(
        { error: 'System API key not configured' },
        { status: 500 }
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid system API key' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, auctionPeriods } = body;

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
      updatedAt: new Date(),
    };

    // Update game status if provided
    if (status) {
      updateData.status = status;

      // Sync config.auctionStatus for auction/auctioneer games
      if (currentGameData?.gameType === 'auction' || currentGameData?.gameType === 'auctioneer') {
        if (status === 'bidding') {
          updateData['config.auctionStatus'] = 'active';
        } else if (status === 'active') {
          if (currentGameData?.status === 'bidding') {
            updateData['config.auctionStatus'] = 'finalized';
          } else {
            updateData['config.auctionStatus'] = 'active';
          }
        } else if (status === 'finished') {
          updateData['config.auctionStatus'] = 'closed';
        } else if (status === 'registration' || status === 'draft') {
          updateData['config.auctionStatus'] = 'pending';
        }
      }
    }

    // Update auction periods if provided
    if (auctionPeriods && Array.isArray(auctionPeriods)) {
      updateData['config.auctionPeriods'] = auctionPeriods;
    }

    // Update game
    await gameRef.update(updateData);

    // Log the activity
    const logDetails: Record<string, unknown> = {
      updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt'),
      source: 'system-automated',
    };

    if (status) {
      logDetails.oldStatus = currentGameData?.status;
      logDetails.newStatus = status;
    }

    if (auctionPeriods) {
      logDetails.auctionPeriodsUpdated = true;
    }

    await db.collection('activityLogs').add({
      action: 'GAME_SYSTEM_UPDATE',
      gameId: gameId,
      gameName: currentGameData?.name,
      details: logDetails,
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'system',
      userAgent: 'motia-cronjob',
    });

    return NextResponse.json({
      success: true,
      message: 'Game updated successfully by system',
    });

  } catch (error) {
    console.error('[SYSTEM_UPDATE] Error updating game:', error);
    return NextResponse.json(
      {
        error: 'Failed to update game',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
