import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// POST - Clean up orphaned pending participants (admin only)
// This removes pending participants for divisions that no longer exist
export async function POST(request: NextRequest) {
  try {
    const { adminUserId } = await request.json();

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log('[CLEANUP_ORPHANED] Starting cleanup of orphaned pending participants');

    let deletedCount = 0;
    const deletedParticipants: Array<{ id: string; playername: string; gameId: string }> = [];

    // Get all participants with pending gameIds
    const allParticipantsSnapshot = await db.collection('gameParticipants').get();

    for (const participantDoc of allParticipantsSnapshot.docs) {
      const participantData = participantDoc.data();
      const gameId = participantData?.gameId;

      // Check if this is a pending participant
      if (gameId && gameId.endsWith('-pending')) {
        const baseGameId = gameId.replace(/-pending$/, '');

        // Check if the base game exists
        const baseGameDoc = await db.collection('games').doc(baseGameId).get();

        if (!baseGameDoc.exists) {
          // Base game doesn't exist, delete this participant
          console.log(`[CLEANUP_ORPHANED] Deleting participant ${participantDoc.id} (${participantData.playername}) - base game ${baseGameId} not found`);
          await participantDoc.ref.delete();
          deletedCount++;
          deletedParticipants.push({
            id: participantDoc.id,
            playername: participantData.playername,
            gameId: gameId,
          });
          continue;
        }

        const baseGameData = baseGameDoc.data();

        // If it's a multi-division game, check if any divisions still exist
        if (baseGameData?.divisionCount && baseGameData.divisionCount > 1) {
          // Find related division games
          const relatedGamesSnapshot = await db.collection('games')
            .where('year', '==', baseGameData.year)
            .where('gameType', '==', baseGameData.gameType)
            .where('divisionCount', '==', baseGameData.divisionCount)
            .get();

          const baseName = baseGameData.name?.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
          const divisionGames = relatedGamesSnapshot.docs.filter(doc => {
            const docData = doc.data();
            const docBaseName = docData.name?.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();

            // Check if has division field OR has "Division X" in name
            const hasDivisionField = docData.division && docData.division.trim() !== '';
            const hasDivisionInName = /Division\s+\d+/i.test(docData.name || '');

            return docBaseName === baseName && (hasDivisionField || hasDivisionInName) && doc.id !== baseGameId;
          });

          // Only delete if there are NO divisions at all
          // If there's even 1 division left, keep the pending participants
          if (divisionGames.length === 0) {
            // No divisions left, delete this participant
            console.log(`[CLEANUP_ORPHANED] Deleting participant ${participantDoc.id} (${participantData.playername}) - no divisions left for ${baseGameId}`);
            await participantDoc.ref.delete();
            deletedCount++;
            deletedParticipants.push({
              id: participantDoc.id,
              playername: participantData.playername,
              gameId: gameId,
            });
          } else {
            console.log(`[CLEANUP_ORPHANED] Keeping participant ${participantDoc.id} (${participantData.playername}) - ${divisionGames.length} division(s) still exist`);
          }
        }
      }
    }

    console.log(`[CLEANUP_ORPHANED] Cleanup complete. Deleted ${deletedCount} orphaned participants`);

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'ORPHANED_PARTICIPANTS_CLEANUP',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        deletedCount,
        deletedParticipants,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} orphaned participant(s)`,
      deletedCount,
      deletedParticipants,
    });
  } catch (error) {
    console.error('Error cleaning up orphaned participants:', error);
    return NextResponse.json(
      { error: 'Failed to clean up orphaned participants', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
