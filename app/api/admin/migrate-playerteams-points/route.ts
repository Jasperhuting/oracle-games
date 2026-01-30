import { getServerFirebase } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { PointsEvent } from '@/lib/types/games';

/**
 * Migrate existing playerTeams to the new pointsBreakdown format
 *
 * This is a one-time migration script that:
 * 1. Reads all playerTeams documents
 * 2. Converts racePoints data to pointsBreakdown array
 * 3. Calculates totalPoints from the breakdown
 * 4. Updates each document with the new fields
 *
 * The migration is idempotent - running it multiple times won't cause issues
 * because we check if pointsBreakdown already exists.
 *
 * POST /api/admin/migrate-playerteams-points
 * Body: { dryRun?: boolean, gameId?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = true, gameId, limit = 100 } = body;

    const db = getServerFirebase();

    // Build query
    let query: FirebaseFirestore.Query = db.collection('playerTeams');

    if (gameId) {
      query = query.where('gameId', '==', gameId);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    console.log(`[MIGRATE_PLAYERTEAMS] Found ${snapshot.size} playerTeams to process (dryRun: ${dryRun})`);

    const results = {
      total: snapshot.size,
      migrated: 0,
      initializedEmpty: 0,  // Documents that got empty pointsBreakdown (no racePoints to migrate)
      alreadyMigrated: 0,
      errors: [] as string[],
      samples: [] as any[],
    };

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        // Skip if already migrated (has pointsBreakdown)
        if (data.pointsBreakdown && Array.isArray(data.pointsBreakdown) && data.pointsBreakdown.length > 0) {
          results.alreadyMigrated++;
          continue;
        }

        // Initialize empty pointsBreakdown if no racePoints data to migrate
        if (!data.racePoints || Object.keys(data.racePoints).length === 0) {
          // Still set empty pointsBreakdown and totalPoints for consistency
          const currentPoints = data.pointsScored || data.totalPoints || 0;
          if (!dryRun) {
            await doc.ref.update({
              pointsBreakdown: [],
              totalPoints: currentPoints,
              pointsScored: currentPoints, // Keep both in sync
            });
          }

          // Store sample for verification
          if (results.samples.length < 3) {
            results.samples.push({
              id: doc.id,
              gameId: data.gameId,
              riderName: data.riderName,
              oldPointsScored: data.pointsScored || 0,
              newTotalPoints: currentPoints,
              breakdownCount: 0,
              type: 'initialized_empty',
            });
          }

          results.initializedEmpty++;
          continue;
        }

        // Convert racePoints to pointsBreakdown
        const pointsBreakdown: PointsEvent[] = [];

        for (const [raceSlug, raceData] of Object.entries(data.racePoints)) {
          const raceInfo = raceData as {
            totalPoints: number;
            stagePoints: Record<string, {
              stageResult?: number;
              gcPoints?: number;
              pointsClass?: number;
              mountainsClass?: number;
              youthClass?: number;
              mountainPoints?: number;
              sprintPoints?: number;
              combativityBonus?: number;
              teamPoints?: number;
              total: number;
            }>;
          };

          if (!raceInfo.stagePoints) continue;

          for (const [stage, stageData] of Object.entries(raceInfo.stagePoints)) {
            const event: PointsEvent = {
              raceSlug,
              stage,
              total: stageData.total || 0,
              calculatedAt: new Date().toISOString(), // Migration timestamp
            };

            // Add optional fields if they exist
            if (stageData.stageResult) event.stageResult = stageData.stageResult;
            if (stageData.gcPoints) event.gcPoints = stageData.gcPoints;
            if (stageData.pointsClass) event.pointsClass = stageData.pointsClass;
            if (stageData.mountainsClass) event.mountainsClass = stageData.mountainsClass;
            if (stageData.youthClass) event.youthClass = stageData.youthClass;
            if (stageData.mountainPoints) event.mountainPoints = stageData.mountainPoints;
            if (stageData.sprintPoints) event.sprintPoints = stageData.sprintPoints;
            if (stageData.combativityBonus) event.combativityBonus = stageData.combativityBonus;
            if (stageData.teamPoints) event.teamPoints = stageData.teamPoints;

            pointsBreakdown.push(event);
          }
        }

        // Calculate totalPoints from breakdown
        const totalPoints = pointsBreakdown.reduce(
          (sum, event) => sum + (event.total || 0),
          0
        );

        // Store sample for verification
        if (results.samples.length < 5) {
          results.samples.push({
            id: doc.id,
            gameId: data.gameId,
            riderName: data.riderName,
            oldPointsScored: data.pointsScored,
            newTotalPoints: totalPoints,
            breakdownCount: pointsBreakdown.length,
            pointsBreakdown: pointsBreakdown.slice(0, 3), // First 3 events
          });
        }

        // Update document
        if (!dryRun) {
          await doc.ref.update({
            pointsBreakdown,
            totalPoints,
            pointsScored: totalPoints, // Sync pointsScored for backward compatibility
          });
        }

        results.migrated++;

        // Log progress every 50 documents
        if (results.migrated % 50 === 0) {
          console.log(`[MIGRATE_PLAYERTEAMS] Progress: ${results.migrated}/${results.total}`);
        }

      } catch (error) {
        const errorMsg = `Error migrating ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[MIGRATE_PLAYERTEAMS] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    console.log(`[MIGRATE_PLAYERTEAMS] Complete: ${results.migrated} migrated, ${results.initializedEmpty} initialized empty, ${results.alreadyMigrated} already migrated, ${results.errors.length} errors`);

    const totalProcessed = results.migrated + results.initializedEmpty;

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete. Would process ${totalProcessed} documents (${results.migrated} with racePoints, ${results.initializedEmpty} initialized empty).`
        : `Migration complete. Processed ${totalProcessed} documents (${results.migrated} with racePoints, ${results.initializedEmpty} initialized empty).`,
      results,
    });

  } catch (error) {
    console.error('[MIGRATE_PLAYERTEAMS] Error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check migration status
 */
export async function GET(request: NextRequest) {
  try {
    const db = getServerFirebase();
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    // Build query
    let query: FirebaseFirestore.Query = db.collection('playerTeams');

    if (gameId) {
      query = query.where('gameId', '==', gameId);
    }

    const snapshot = await query.get();

    let withBreakdown = 0;
    let withEmptyBreakdown = 0;  // Has pointsBreakdown but it's empty (initialized)
    let withoutBreakdown = 0;
    let withTotalPoints = 0;
    let withRacePoints = 0;
    let withoutRacePoints = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Check pointsBreakdown status
      if (data.pointsBreakdown && Array.isArray(data.pointsBreakdown)) {
        if (data.pointsBreakdown.length > 0) {
          withBreakdown++;
        } else {
          withEmptyBreakdown++;
        }
      } else {
        withoutBreakdown++;
      }

      // Check totalPoints status
      if (data.totalPoints !== undefined) {
        withTotalPoints++;
      }

      // Check racePoints status
      if (data.racePoints && Object.keys(data.racePoints).length > 0) {
        withRacePoints++;
      } else {
        withoutRacePoints++;
      }
    }

    // Migration is complete when all documents have pointsBreakdown (empty or with data)
    const needsMigration = withoutBreakdown;
    const migrationComplete = needsMigration === 0;

    return NextResponse.json({
      success: true,
      total: snapshot.size,
      status: {
        withPointsBreakdownData: withBreakdown,
        withEmptyPointsBreakdown: withEmptyBreakdown,
        withoutPointsBreakdown: withoutBreakdown,
        withTotalPoints,
        withRacePoints,
        withoutRacePoints,
      },
      migrationComplete,
      needsMigration,
      message: migrationComplete
        ? 'All documents have been migrated (pointsBreakdown field exists on all)'
        : `${withoutBreakdown} documents still need migration (${withoutBreakdown - withoutRacePoints} have racePoints data)`,
    });

  } catch (error) {
    console.error('[MIGRATE_PLAYERTEAMS] Status check error:', error);
    return NextResponse.json(
      { error: 'Status check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
