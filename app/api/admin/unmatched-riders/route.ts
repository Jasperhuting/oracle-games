import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { findUnmatchedRiders, addRiderAlias, RiderIdentifier } from '@/lib/matching/rider-matcher';
import { getScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';

/**
 * Unmatched Riders API
 *
 * Helps identify riders in scraper data that don't match any known riders in a game,
 * and allows adding aliases to fix matching issues.
 */

// GET /api/admin/unmatched-riders - Find unmatched riders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const gameId = searchParams.get('gameId');
    const raceSlug = searchParams.get('race');
    const year = searchParams.get('year');
    const stage = searchParams.get('stage');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!gameId && !raceSlug) {
      return NextResponse.json(
        { error: 'Either gameId or race parameters are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin user
    const adminDoc = await db.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    let knownRiders: RiderIdentifier[] = [];
    let scraperRiders: RiderIdentifier[] = [];

    if (gameId) {
      // Get all riders in this game
      const teamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .get();

      teamSnapshot.forEach(doc => {
        const data = doc.data();
        knownRiders.push({
          nameID: data.riderNameId,
          name: data.riderName,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      });

      // Get the game to find its races
      const gameDoc = await db.collection('games').doc(gameId).get();
      if (!gameDoc.exists) {
        return NextResponse.json(
          { error: 'Game not found' },
          { status: 404 }
        );
      }

      const gameData = gameDoc.data();
      const gameYear = gameData?.year || new Date().getFullYear();

      // Get recent scraper data for comparison
      // If race and stage specified, use those; otherwise get latest stage results
      if (raceSlug && stage) {
        const stageNum = stage === 'prologue' ? 0 : parseInt(stage);
        const key: ScraperDataKey = {
          race: raceSlug,
          year: parseInt(year || gameYear.toString()),
          type: 'stage',
          stage: isNaN(stageNum) ? undefined : stageNum,
        };

        const scraperData = await getScraperData(key);
        if (scraperData && 'stageResults' in scraperData) {
          scraperRiders = scraperData.stageResults.flatMap(r => {
            // Handle TTT results (has 'riders' array)
            if ('riders' in r && Array.isArray(r.riders)) {
              return r.riders.map(rider => ({
                nameID: rider.shortName || '',
                name: `${rider.firstName} ${rider.lastName}`,
                firstName: rider.firstName,
                lastName: rider.lastName,
                shortName: rider.shortName,
              }));
            }
            // Regular stage result - cast to StageRider since we know it's not TTT
            const stageRider = r as { shortName?: string; name?: string; firstName?: string; lastName?: string };
            return [{
              nameID: stageRider.shortName || '',
              name: stageRider.name || (stageRider.firstName && stageRider.lastName ? `${stageRider.firstName} ${stageRider.lastName}` : ''),
              firstName: stageRider.firstName,
              lastName: stageRider.lastName,
              shortName: stageRider.shortName,
            }];
          });
        }
      }
    } else if (raceSlug && year) {
      // Just check a specific race's scraper data against all known riders
      const yearNum = parseInt(year);
      const stageNum = stage === 'prologue' ? 0 : (stage ? parseInt(stage) : 1);

      const key: ScraperDataKey = {
        race: raceSlug,
        year: yearNum,
        type: 'stage',
        stage: isNaN(stageNum) ? 1 : stageNum,
      };

      const scraperData = await getScraperData(key);
      if (scraperData && 'stageResults' in scraperData) {
        scraperRiders = scraperData.stageResults.flatMap(r => {
          // Handle TTT results (has 'riders' array)
          if ('riders' in r && Array.isArray(r.riders)) {
            return r.riders.map(rider => ({
              nameID: rider.shortName || '',
              name: `${rider.firstName} ${rider.lastName}`,
              firstName: rider.firstName,
              lastName: rider.lastName,
              shortName: rider.shortName,
            }));
          }
          // Regular stage result
          const stageRider = r as { shortName?: string; name?: string; firstName?: string; lastName?: string };
          return [{
            nameID: stageRider.shortName || '',
            name: stageRider.name || (stageRider.firstName && stageRider.lastName ? `${stageRider.firstName} ${stageRider.lastName}` : ''),
            firstName: stageRider.firstName,
            lastName: stageRider.lastName,
            shortName: stageRider.shortName,
          }];
        });
      }

      // Get all riders from all games for this year
      const gamesSnapshot = await db.collection('games')
        .where('year', '==', yearNum)
        .where('status', 'in', ['active', 'bidding'])
        .get();

      for (const gameDoc of gamesSnapshot.docs) {
        const teamSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', gameDoc.id)
          .get();

        teamSnapshot.forEach(doc => {
          const data = doc.data();
          // Avoid duplicates
          if (!knownRiders.some(r => r.nameID === data.riderNameId)) {
            knownRiders.push({
              nameID: data.riderNameId,
              name: data.riderName,
              firstName: data.firstName,
              lastName: data.lastName,
            });
          }
        });
      }
    }

    if (scraperRiders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scraper data found',
        unmatchedRiders: [],
        stats: {
          totalScraperRiders: 0,
          totalKnownRiders: knownRiders.length,
          unmatchedCount: 0,
        },
      });
    }

    // Find unmatched riders
    const unmatched = await findUnmatchedRiders(scraperRiders, knownRiders);

    return NextResponse.json({
      success: true,
      unmatchedRiders: unmatched,
      stats: {
        totalScraperRiders: scraperRiders.length,
        totalKnownRiders: knownRiders.length,
        unmatchedCount: unmatched.length,
        matchedCount: scraperRiders.length - unmatched.length,
      },
    });

  } catch (error) {
    console.error('[UNMATCHED_RIDERS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to find unmatched riders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/unmatched-riders - Add a rider alias
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, canonicalNameId, alias } = body;

    if (!userId || !canonicalNameId || !alias) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, canonicalNameId, alias' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin user
    const adminDoc = await db.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Add the alias
    await addRiderAlias(canonicalNameId, alias);

    // Log the action
    await db.collection('activityLogs').add({
      action: 'ALIAS_ADDED',
      userId,
      details: {
        canonicalNameId,
        alias,
      },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Alias "${alias}" added for rider "${canonicalNameId}"`,
    });

  } catch (error) {
    console.error('[UNMATCHED_RIDERS] Error adding alias:', error);
    return NextResponse.json(
      { error: 'Failed to add rider alias', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
