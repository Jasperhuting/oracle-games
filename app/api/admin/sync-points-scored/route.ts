import { getServerFirebase } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sync pointsScored from pointsBreakdown for all playerTeams
 *
 * This endpoint recalculates pointsScored from the pointsBreakdown array
 * (source of truth) and updates the document if there's a mismatch.
 *
 * Usage:
 *   POST /api/admin/sync-points-scored
 *   Body: { "dryRun": true } - Preview changes without updating
 *   Body: { "dryRun": false } - Actually update the database
 *   Body: { "gameId": "abc123" } - Only sync for a specific game
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    const gameIdFilter = body.gameId as string | undefined;

    const db = getServerFirebase();

    console.log(`[SYNC_POINTS_SCORED] Starting ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}${gameIdFilter ? ` for game ${gameIdFilter}` : ''}`);

    // Query playerTeams
    let query = db.collection('playerTeams').limit(1000);
    if (gameIdFilter) {
      query = db.collection('playerTeams').where('gameId', '==', gameIdFilter);
    }

    const playerTeamsSnapshot = await query.get();

    console.log(`[SYNC_POINTS_SCORED] Found ${playerTeamsSnapshot.size} playerTeams`);

    const results = {
      total: playerTeamsSnapshot.size,
      updated: 0,
      skipped: 0,
      alreadyInSync: 0,
      errors: [] as string[],
      changes: [] as {
        playerTeamId: string;
        riderName: string;
        gameId: string;
        oldPointsScored: number;
        newPointsScored: number;
        totalPoints: number;
        pointsBreakdownCount: number;
      }[],
    };

    for (const doc of playerTeamsSnapshot.docs) {
      try {
        const data = doc.data();
        const currentPointsScored = data.pointsScored || 0;
        const pointsBreakdown = Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown : [];

        // Calculate correct points from pointsBreakdown (source of truth)
        const calculatedPoints = pointsBreakdown.reduce(
          (sum: number, event: { total?: number }) => sum + (event.total || 0),
          0
        );

        // Check if already in sync
        if (currentPointsScored === calculatedPoints) {
          results.alreadyInSync++;
          continue;
        }

        // Track the change
        results.changes.push({
          playerTeamId: doc.id,
          riderName: data.riderName || 'Unknown',
          gameId: data.gameId || 'Unknown',
          oldPointsScored: currentPointsScored,
          newPointsScored: calculatedPoints,
          totalPoints: calculatedPoints,
          pointsBreakdownCount: pointsBreakdown.length,
        });

        if (!dryRun) {
          await doc.ref.update({
            pointsScored: calculatedPoints,
          });
          results.updated++;
        } else {
          results.updated++;
        }
      } catch (error) {
        results.errors.push(`Error processing ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    results.skipped = results.total - results.updated - results.alreadyInSync - results.errors.length;

    console.log(`[SYNC_POINTS_SCORED] ${dryRun ? 'Would update' : 'Updated'} ${results.updated} playerTeams, ${results.alreadyInSync} already in sync, ${results.errors.length} errors`);

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `DRY RUN: Would sync pointsScored from pointsBreakdown for ${results.updated} playerTeams`
        : `Synced pointsScored from pointsBreakdown for ${results.updated} playerTeams`,
      results: {
        total: results.total,
        updated: results.updated,
        alreadyInSync: results.alreadyInSync,
        skipped: results.skipped,
        errorCount: results.errors.length,
      },
      // Only include first 50 changes in response to avoid huge payloads
      sampleChanges: results.changes.slice(0, 50),
      totalChanges: results.changes.length,
      errors: results.errors.slice(0, 10),
    });

  } catch (error) {
    console.error('[SYNC_POINTS_SCORED] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
