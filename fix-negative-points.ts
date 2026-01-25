import { getServerFirebase } from './lib/firebase/server';

async function fixNegativePoints() {
  const db = getServerFirebase();
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';
  
  console.log(`[FIX_NEGATIVE_POINTS] Starting fix for game ${gameId}`);
  
  try {
    // Find all playerTeams with negative pointsScored for this game
    const negativePointsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('pointsScored', '<', 0)
      .get();
    
    console.log(`[FIX_NEGATIVE_POINTS] Found ${negativePointsSnapshot.size} playerTeams with negative points`);
    
    if (negativePointsSnapshot.empty) {
      console.log('[FIX_NEGATIVE_POINTS] No negative points found');
      return;
    }
    
    // Update each document to reset points to 0
    const batch = db.batch();
    
    negativePointsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`[FIX_NEGATIVE_POINTS] Resetting ${data.riderName} (${data.riderNameId}): ${data.pointsScored} -> 0`);
      
      batch.update(doc.ref, {
        pointsScored: 0,
        totalPoints: 0,
        // Also clear pointsBreakdown to avoid inconsistencies
        pointsBreakdown: [],
        // Keep other fields unchanged
        updatedAt: new Date()
      });
    });
    
    // Commit all updates
    await batch.commit();
    
    console.log(`[FIX_NEGATIVE_POINTS] Successfully reset ${negativePointsSnapshot.size} playerTeams`);
    
  } catch (error) {
    console.error('[FIX_NEGATIVE_POINTS] Error:', error);
    throw error;
  }
}

// Run the script
fixNegativePoints()
  .then(() => {
    console.log('[FIX_NEGATIVE_POINTS] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[FIX_NEGATIVE_POINTS] Script failed:', error);
    process.exit(1);
  });
