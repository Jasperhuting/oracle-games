import { getServerFirebase } from '@/lib/firebase/server';

/**
 * @deprecated PHASE 3: This script is deprecated.
 *
 * This script previously reconstructed the gameParticipants.team[] array
 * from playerTeams collection. Now that playerTeams is the single source of truth,
 * this reconstruction is no longer needed.
 *
 * The team[] array in gameParticipants is being phased out.
 * All team data should be read directly from playerTeams collection.
 *
 * This script now only scans for corrupted participants and logs them,
 * but does NOT write to team[] anymore.
 */

async function fixCorruptedTeamData() {
  console.log('[FIX_CORRUPTED_TEAMS] DEPRECATED: This script no longer writes to team[]');
  console.log('[FIX_CORRUPTED_TEAMS] playerTeams is now the source of truth');
  console.log('[FIX_CORRUPTED_TEAMS] Starting scan for corrupted team data...');

  const db = getServerFirebase();

  try {
    // 1. Find all participants with corrupted team data (for logging only)
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
      return { total: 0, participants: [] };
    }

    // Log the corrupted participants (but don't fix - team[] is deprecated)
    for (const participant of corruptedParticipants) {
      console.log(`[FIX_CORRUPTED_TEAMS] Corrupted: ${participant.playername} (game: ${participant.gameId})`);

      // Verify playerTeams exists for this participant
      const playerTeamsSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', participant.gameId)
        .where('userId', '==', participant.userId)
        .get();

      console.log(`[FIX_CORRUPTED_TEAMS]   -> Has ${playerTeamsSnapshot.size} playerTeams (source of truth)`);
    }

    console.log('[FIX_CORRUPTED_TEAMS] Scan complete');
    console.log('[FIX_CORRUPTED_TEAMS] NOTE: team[] is deprecated, use playerTeams collection instead');

    return {
      total: corruptedParticipants.length,
      participants: corruptedParticipants.map(p => ({
        id: p.id,
        playername: p.playername,
        gameId: p.gameId,
      })),
      note: 'DEPRECATED: team[] is no longer the source of truth. Use playerTeams collection instead.',
    };

  } catch (error) {
    console.error('[FIX_CORRUPTED_TEAMS] Error:', error);
    throw error;
  }
}

// Run the scan
if (require.main === module) {
  fixCorruptedTeamData()
    .then((result) => {
      console.log('[FIX_CORRUPTED_TEAMS] Script completed');
      console.log('[FIX_CORRUPTED_TEAMS] Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[FIX_CORRUPTED_TEAMS] Script failed:', error);
      process.exit(1);
    });
}

export { fixCorruptedTeamData };
