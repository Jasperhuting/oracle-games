import { getServerFirebase } from '@/lib/firebase/server';
import { NextResponse, NextRequest } from 'next/server';

interface UpdatePointsRequest {
  riderNameId: string;
  pointsScored: number;
  gameId?: string; // Optional: if provided, only update for this game
}

export async function POST(request: NextRequest) {
  try {
    const { riderNameId, pointsScored, gameId }: UpdatePointsRequest = await request.json();

    // Validate input
    if (!riderNameId || typeof pointsScored !== 'number') {
      return NextResponse.json({
        success: false,
        error: 'riderNameId and pointsScored (number) are required'
      }, { status: 400 });
    }

    const db = getServerFirebase();
    
    console.log(`[UPDATE_POINTS] Updating ${riderNameId} to ${pointsScored} points${gameId ? ` for game ${gameId}` : ' for all games'}`);

    // Build query
    let query = db.collection('playerTeams').where('riderNameId', '==', riderNameId);
    if (gameId) {
      query = query.where('gameId', '==', gameId);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: false,
        error: `No playerTeams found for riderNameId: ${riderNameId}${gameId ? ` in game ${gameId}` : ''}`
      }, { status: 404 });
    }

    // Update all matching documents
    const batch = db.batch();
    const updatedRiders: any[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const oldPoints = data.pointsScored || 0;
      const oldTotalPoints = data.totalPoints || 0;

      console.log(`[UPDATE_POINTS] Updating ${data.riderName} (${data.userId}): ${oldPoints} → ${pointsScored}`);

      updatedRiders.push({
        riderName: data.riderName,
        riderNameId: data.riderNameId,
        userId: data.userId,
        gameId: data.gameId,
        oldPoints,
        newPoints: pointsScored,
        oldTotalPoints,
        newTotalPoints: pointsScored
      });

      batch.update(doc.ref, {
        pointsScored: pointsScored,
        totalPoints: pointsScored,
        // Clear pointsBreakdown to avoid inconsistencies
        pointsBreakdown: [],
        updatedAt: new Date()
      });
    });

    // Commit all updates
    await batch.commit();

    console.log(`[UPDATE_POINTS] Successfully updated ${snapshot.size} playerTeams`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${snapshot.size} playerTeams`,
      updated: snapshot.size,
      riders: updatedRiders
    });

  } catch (error) {
    console.error('[UPDATE_POINTS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
