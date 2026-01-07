import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import process from "process";

const DEFAULT_YEAR = process.env.NEXT_PUBLIC_PLAYING_YEAR;

interface AffectedParticipant {
  participantId: string;
  participantDocId: string;
  gameId: string;
  gameName: string;
  userId: string;
  playername: string;
  pricePaid: number;
  playerTeamDocId: string;
}

interface RefundResult {
  riderId: string;
  riderName: string;
  affectedParticipants: AffectedParticipant[];
  refundsProcessed: number;
  totalRefunded: number;
  errors: string[];
}

/**
 * POST - Retire a rider with refund
 * This will:
 * 1. Mark the rider as retired
 * 2. Find all participants who have this rider in their team (across all games)
 * 3. Remove the rider from their playerTeams
 * 4. Refund the pricePaid to their budget (reduce spentBudget)
 * 5. Update their rosterSize
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUserId, riderId, year, dryRun = false } = body;
    const YEAR = year || DEFAULT_YEAR;

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    if (!riderId) {
      return NextResponse.json(
        { error: 'Rider ID is required' },
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

    // Get rider info
    const riderDoc = await db.collection(`rankings_${YEAR}`).doc(riderId).get();
    if (!riderDoc.exists) {
      return NextResponse.json(
        { error: `Rider not found: ${riderId}` },
        { status: 404 }
      );
    }

    const riderData = riderDoc.data();
    const riderName = riderData?.name || riderId;
    const riderNameId = riderData?.nameID || riderId;

    console.log(`[RETIRE_WITH_REFUND] Processing rider: ${riderName} (${riderId})`);
    console.log(`[RETIRE_WITH_REFUND] Dry run: ${dryRun}`);

    // Find all playerTeams entries with this rider
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('riderNameId', '==', riderNameId)
      .where('active', '==', true)
      .get();

    console.log(`[RETIRE_WITH_REFUND] Found ${playerTeamsSnapshot.size} active playerTeams with this rider`);

    const result: RefundResult = {
      riderId,
      riderName,
      affectedParticipants: [],
      refundsProcessed: 0,
      totalRefunded: 0,
      errors: [],
    };

    // Get all game info for affected participants
    const gameIds = new Set<string>();
    playerTeamsSnapshot.docs.forEach(doc => {
      gameIds.add(doc.data().gameId);
    });

    const gamesMap = new Map<string, string>();
    for (const gameId of gameIds) {
      const gameDoc = await db.collection('games').doc(gameId).get();
      if (gameDoc.exists) {
        gamesMap.set(gameId, gameDoc.data()?.name || gameId);
      }
    }

    // Process each playerTeam entry
    for (const playerTeamDoc of playerTeamsSnapshot.docs) {
      const playerTeamData = playerTeamDoc.data();
      const { gameId, userId, pricePaid = 0 } = playerTeamData;

      try {
        // Get participant info
        const participantSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .limit(1)
          .get();

        if (participantSnapshot.empty) {
          console.log(`[RETIRE_WITH_REFUND] No participant found for gameId=${gameId}, userId=${userId}`);
          result.errors.push(`No participant found for game ${gameId}, user ${userId}`);
          continue;
        }

        const participantDoc = participantSnapshot.docs[0];
        const participantData = participantDoc.data();

        const affectedParticipant: AffectedParticipant = {
          participantId: participantDoc.id,
          participantDocId: participantDoc.id,
          gameId,
          gameName: gamesMap.get(gameId) || gameId,
          userId,
          playername: participantData.playername || userId,
          pricePaid,
          playerTeamDocId: playerTeamDoc.id,
        };

        result.affectedParticipants.push(affectedParticipant);

        if (!dryRun) {
          // 1. Delete/deactivate the playerTeam entry
          await playerTeamDoc.ref.update({
            active: false,
            removedAt: Timestamp.now(),
            removalReason: 'rider_retired_with_refund',
          });

          // 2. Update participant's spentBudget and rosterSize
          const currentSpentBudget = participantData.spentBudget || 0;
          const currentRosterSize = participantData.rosterSize || 0;

          const newSpentBudget = Math.max(0, currentSpentBudget - pricePaid);
          const newRosterSize = Math.max(0, currentRosterSize - 1);

          await participantDoc.ref.update({
            spentBudget: newSpentBudget,
            rosterSize: newRosterSize,
            rosterComplete: false, // Reset roster complete status
          });

          console.log(`[RETIRE_WITH_REFUND] Refunded ${pricePaid} to ${participantData.playername} in game ${gamesMap.get(gameId)}`);
          console.log(`[RETIRE_WITH_REFUND]   spentBudget: ${currentSpentBudget} -> ${newSpentBudget}`);
          console.log(`[RETIRE_WITH_REFUND]   rosterSize: ${currentRosterSize} -> ${newRosterSize}`);
        }

        result.refundsProcessed++;
        result.totalRefunded += pricePaid;

      } catch (error) {
        const errorMsg = `Failed to process participant ${userId} in game ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[RETIRE_WITH_REFUND] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // Mark rider as retired (if not dry run)
    if (!dryRun) {
      await db.collection(`rankings_${YEAR}`).doc(riderId).update({
        retired: true,
        updatedAt: new Date(),
      });

      // Log the activity
      const adminData = adminDoc.data();
      await db.collection('activityLogs').add({
        action: 'RIDER_RETIRED_WITH_REFUND',
        userId: adminUserId,
        userEmail: adminData?.email,
        userName: adminData?.playername || adminData?.email,
        details: {
          riderId,
          riderName,
          affectedParticipantsCount: result.affectedParticipants.length,
          totalRefunded: result.totalRefunded,
          affectedGames: [...gameIds],
        },
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });
    }

    console.log(`[RETIRE_WITH_REFUND] Completed. Processed ${result.refundsProcessed} refunds, total: ${result.totalRefunded}`);

    return NextResponse.json({
      success: true,
      dryRun,
      result,
      message: dryRun
        ? `DRY RUN: Would retire ${riderName} and refund ${result.refundsProcessed} participants for a total of ${result.totalRefunded}`
        : `Retired ${riderName} and refunded ${result.refundsProcessed} participants for a total of ${result.totalRefunded}`,
    });

  } catch (error) {
    console.error('[RETIRE_WITH_REFUND] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retire rider with refund', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
