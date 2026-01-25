import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * @deprecated PHASE 3: This endpoint is deprecated.
 *
 * Previously, this endpoint reconstructed the gameParticipants.team[] array
 * from playerTeams collection. Now that playerTeams is the single source of truth,
 * this reconstruction is no longer needed.
 *
 * The team[] array in gameParticipants is being phased out.
 * All team data should be read directly from playerTeams collection.
 *
 * This endpoint now only logs corrupted participants for reference,
 * but does NOT write to team[] anymore.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log('[FIX_CORRUPTED_TEAMS_API] DEPRECATED: This endpoint no longer writes to team[]');
    console.log('[FIX_CORRUPTED_TEAMS_API] playerTeams is now the source of truth');

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

    console.log(`[FIX_CORRUPTED_TEAMS_API] Found ${corruptedParticipants.length} participants with corrupted team data`);

    // Log the activity (but don't fix - team[] is deprecated)
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'CORRUPTED_TEAM_DATA_SCAN',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        totalCorrupted: corruptedParticipants.length,
        note: 'DEPRECATED: team[] is no longer the source of truth. Use playerTeams collection instead.',
        corruptedParticipants: corruptedParticipants.map(p => ({
          id: p.id,
          playername: p.playername,
          gameId: p.gameId,
        }))
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      deprecated: true,
      message: 'DEPRECATED: This endpoint no longer writes to team[]. Use playerTeams as source of truth.',
      note: 'The gameParticipants.team[] array is being phased out. Read team data from playerTeams collection instead.',
      totalCorrupted: corruptedParticipants.length,
      corruptedParticipants: corruptedParticipants.map(p => ({
        id: p.id,
        playername: p.playername,
        gameId: p.gameId,
        userId: p.userId
      }))
    });

  } catch (error) {
    console.error('[FIX_CORRUPTED_TEAMS_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to scan for corrupted team data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
