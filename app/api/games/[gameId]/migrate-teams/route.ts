import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Migrate existing team arrays in gameParticipants to playerTeams collection
 * This is a one-time migration for games that were finalized before the playerTeams system
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
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

    console.log(`[MIGRATE_TEAMS] Starting migration for game ${gameId}`);

    // Get all participants in this game
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No participants found',
        migrated: 0,
      });
    }

    let totalMigrated = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const participantDoc of participantsSnapshot.docs) {
      const participantData = participantDoc.data();
      const team = participantData.team || [];
      const participantUserId = participantData.userId;

      if (team.length === 0) {
        console.log(`[MIGRATE_TEAMS] Skipping participant ${participantUserId} - no team`);
        continue;
      }

      console.log(`[MIGRATE_TEAMS] Processing participant ${participantUserId} with ${team.length} riders`);

      // Check if playerTeams already exist for this participant
      const existingTeamsSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantUserId)
        .get();

      if (!existingTeamsSnapshot.empty) {
        console.log(`[MIGRATE_TEAMS] Skipping participant ${participantUserId} - already has ${existingTeamsSnapshot.size} playerTeams`);
        totalSkipped += team.length;
        continue;
      }

      // Create PlayerTeam documents for each rider
      for (const rider of team) {
        try {
          await db.collection('playerTeams').add({
            gameId: gameId,
            userId: participantUserId,
            riderNameId: rider.riderNameId,
            
            // Acquisition info
            acquiredAt: rider.acquiredAt ? Timestamp.fromDate(new Date(rider.acquiredAt)) : Timestamp.now(),
            acquisitionType: 'auction',
            pricePaid: rider.amount || 0,
            
            // Rider info (denormalized)
            riderName: rider.riderName || '',
            riderTeam: rider.riderTeam || '',
            riderCountry: rider.riderCountry || '',
            jerseyImage: rider.jerseyImage || '',
            
            // Status
            active: true,
            benched: false,
            
            // Performance (initialized to 0)
            pointsScored: 0,
            stagesParticipated: 0,
          });
          
          totalMigrated++;
          console.log(`[MIGRATE_TEAMS]   - Migrated ${rider.riderName}`);
        } catch (error) {
          const errorMsg = `Failed to migrate rider ${rider.riderName} for user ${participantUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`[MIGRATE_TEAMS] Migration complete: ${totalMigrated} migrated, ${totalSkipped} skipped`);

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'TEAMS_MIGRATED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        totalMigrated,
        totalSkipped,
        errors,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Migrated ${totalMigrated} riders to playerTeams collection`,
      totalMigrated,
      totalSkipped,
      errors,
    });

  } catch (error) {
    console.error('[MIGRATE_TEAMS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
