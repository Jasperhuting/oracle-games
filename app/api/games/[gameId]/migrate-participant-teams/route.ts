import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * Migration endpoint to fix participant team data
 * Changes 'amount' field to 'pricePaid' in team arrays
 * 
 * Usage: POST /api/games/[gameId]/migrate-participant-teams
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const db = getServerFirebase();

    console.log(`[MIGRATE] Starting migration for game ${gameId}`);

    // Get all participants for this game
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No participants found for this game',
        updated: 0,
      });
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const participantDoc of participantsSnapshot.docs) {
      try {
        const participantData = participantDoc.data();
        const team = participantData.team;

        // Skip if no team or team is not an array
        if (!team || !Array.isArray(team)) {
          skippedCount++;
          continue;
        }

        // Check if any rider has 'amount' field
        const needsMigration = team.some((rider: any) => 
          rider.hasOwnProperty('amount') && !rider.hasOwnProperty('pricePaid')
        );

        if (!needsMigration) {
          skippedCount++;
          continue;
        }

        // Migrate the team array
        const migratedTeam = team.map((rider: any) => {
          if (rider.hasOwnProperty('amount') && !rider.hasOwnProperty('pricePaid')) {
            const { amount, ...rest } = rider;
            return {
              ...rest,
              pricePaid: amount, // Rename amount to pricePaid
            };
          }
          return rider;
        });

        // Update the participant document
        await participantDoc.ref.update({
          team: migratedTeam,
        });

        updatedCount++;
        console.log(`[MIGRATE] Updated participant ${participantDoc.id} (${participantData.playername || participantData.email})`);
      } catch (error) {
        const errorMsg = `Failed to update participant ${participantDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[MIGRATE] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[MIGRATE] Migration complete. Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      updated: updatedCount,
      skipped: skippedCount,
      total: participantsSnapshot.size,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[MIGRATE] Error during migration:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
