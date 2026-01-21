import { getServerFirebase } from '@/lib/firebase/server';

/**
 * Script to fix corrupted team data in gameParticipants collection
 * Reconstructs team arrays from playerTeams collection
 */

async function fixCorruptedTeamData() {
  console.log('[FIX_CORRUPTED_TEAMS] Starting team data fix...');
  
  const db = getServerFirebase();
  
  try {
    // 1. Find all participants with corrupted team data
    const allParticipantsSnapshot = await db.collection('gameParticipants').get();
    
    const corruptedParticipants: Array<{
      id: string;
      gameId: string;
      userId: string;
      playername: string;
      team: string;
    }> = [];
    
    allParticipantsSnapshot.forEach(doc => {
      const data = doc.data();
      const team = data.team;
      
      // Check if team is corrupted (contains "[object Object]" pattern)
      if (typeof team === 'string' && team.includes('[object Object]')) {
        corruptedParticipants.push({
          id: doc.id,
          gameId: data.gameId,
          userId: data.userId,
          playername: data.playername,
          team: team
        });
      }
    });
    
    console.log(`[FIX_CORRUPTED_TEAMS] Found ${corruptedParticipants.length} participants with corrupted team data`);
    
    if (corruptedParticipants.length === 0) {
      console.log('[FIX_CORRUPTED_TEAMS] No corrupted data found. All good!');
      return;
    }
    
    // 2. For each corrupted participant, reconstruct team from playerTeams
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const participant of corruptedParticipants) {
      try {
        console.log(`[FIX_CORRUPTED_TEAMS] Fixing participant: ${participant.playername} (${participant.userId})`);
        
        // Get playerTeams for this participant
        const playerTeamsSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', participant.gameId)
          .where('userId', '==', participant.userId)
          .where('active', '==', true)
          .get();
        
        if (playerTeamsSnapshot.empty) {
          console.log(`[FIX_CORRUPTED_TEAMS] No playerTeams found for ${participant.playername}, setting team to empty array`);
          await db.collection('gameParticipants').doc(participant.id).update({
            team: []
          });
          fixedCount++;
          continue;
        }
        
        // Reconstruct team array from playerTeams
        const reconstructedTeam = playerTeamsSnapshot.docs.map(doc => {
          const teamData = doc.data();
          return {
            riderNameId: teamData.riderNameId,
            riderName: teamData.riderName,
            riderTeam: teamData.riderTeam,
            riderCountry: teamData.riderCountry,
            jerseyImage: teamData.jerseyImage,
            acquiredAt: teamData.acquiredAt?.toDate?.()?.toISOString() || teamData.acquiredAt,
            amount: teamData.pricePaid || 0,
            acquisitionType: teamData.acquisitionType || 'auction',
            active: teamData.active,
            benched: teamData.benched,
            pointsScored: teamData.pointsScored || 0,
            stagesParticipated: teamData.stagesParticipated || 0
          };
        });
        
        console.log(`[FIX_CORRUPTED_TEAMS] Reconstructed team with ${reconstructedTeam.length} riders for ${participant.playername}`);
        
        // Update the participant with correct team data
        await db.collection('gameParticipants').doc(participant.id).update({
          team: reconstructedTeam
        });
        
        fixedCount++;
        
      } catch (error) {
        console.error(`[FIX_CORRUPTED_TEAMS] Error fixing participant ${participant.playername}:`, error);
        errorCount++;
      }
    }
    
    console.log(`[FIX_CORRUPTED_TEAMS] Fix complete: ${fixedCount} fixed, ${errorCount} errors`);
    
    // 3. Verify the fix by checking a few participants
    console.log('[FIX_CORRUPTED_TEAMS] Verifying fix...');
    const verificationSnapshot = await db.collection('gameParticipants')
      .where('team', '!=', null)
      .limit(5)
      .get();
    
    verificationSnapshot.forEach(doc => {
      const data = doc.data();
      const team = data.team;
      const isCorrupted = typeof team === 'string' && team.includes('[object Object]');
      const isArray = Array.isArray(team);
      
      console.log(`[FIX_CORRUPTED_TEAMS] Verification - ${data.playername}: corrupted=${isCorrupted}, array=${isArray}, length=${isArray ? team.length : 'N/A'}`);
    });
    
  } catch (error) {
    console.error('[FIX_CORRUPTED_TEAMS] Fatal error:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixCorruptedTeamData()
    .then(() => {
      console.log('[FIX_CORRUPTED_TEAMS] Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[FIX_CORRUPTED_TEAMS] Script failed:', error);
      process.exit(1);
    });
}

export { fixCorruptedTeamData };
