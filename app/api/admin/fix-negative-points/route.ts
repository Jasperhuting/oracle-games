import { getServerFirebase } from '@/lib/firebase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const db = getServerFirebase();
    const gameId = 'tG5QrMUSMBsbqfKa36Ii';
    
    console.log(`[FIX_NEGATIVE_POINTS] Starting fix for game ${gameId}`);
    
    // Find all playerTeams with negative pointsScored for this game
    const negativePointsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('pointsScored', '<', 0)
      .get();
    
    console.log(`[FIX_NEGATIVE_POINTS] Found ${negativePointsSnapshot.size} playerTeams with negative points`);
    
    if (negativePointsSnapshot.empty) {
      console.log('[FIX_NEGATIVE_POINTS] No negative points found');
      return NextResponse.json({
        success: true,
        message: 'No negative points found',
        fixed: 0
      });
    }
    
    // Update each document to reset points to 0
    const batch = db.batch();
    const fixedRiders: any[] = [];
    
    negativePointsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`[FIX_NEGATIVE_POINTS] Resetting ${data.riderName} (${data.riderNameId}): ${data.pointsScored} -> 0`);
      
      fixedRiders.push({
        riderName: data.riderName,
        riderNameId: data.riderNameId,
        oldPoints: data.pointsScored,
        userId: data.userId
      });
      
      batch.update(doc.ref, {
        pointsScored: 0,
        totalPoints: 0,
        // Also clear pointsBreakdown to avoid inconsistencies
        pointsBreakdown: [],
        updatedAt: new Date()
      });
    });
    
    // Commit all updates
    await batch.commit();
    
    console.log(`[FIX_NEGATIVE_POINTS] Successfully reset ${negativePointsSnapshot.size} playerTeams`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully reset ${negativePointsSnapshot.size} playerTeams`,
      fixed: negativePointsSnapshot.size,
      riders: fixedRiders
    });
    
  } catch (error) {
    console.error('[FIX_NEGATIVE_POINTS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
