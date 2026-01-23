import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getRaceResult } from '@/lib/scraper/getRaceResult';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';
import { saveScraperData } from '@/lib/firebase/scraper-service';

// Helper function to remove undefined values from objects
function cleanData(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(cleanData).filter(item => item !== undefined);
  }

  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanData(value);
      }
    }
    return cleaned;
  }

  return obj;
}

// Helper function to convert string to slug
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface RiderInput {
  nameID?: string;
  shortName?: string;
  points?: unknown;
  [key: string]: unknown;
}

interface EnrichedRider extends RiderInput {
  rank?: number;
  jerseyImage?: string;
}

// Helper function to enrich riders with data from rankings
async function enrichRiders(riders: RiderInput[], year: number, db: FirebaseFirestore.Firestore): Promise<EnrichedRider[]> {
  const enrichedRiders: EnrichedRider[] = [];

  for (const rider of riders) {
    // Try to find rider in rankings by shortName
    const riderSlug = toSlug(rider.shortName || '');

    if (!riderSlug) {
      enrichedRiders.push(rider);
      continue;
    }

    try {
      const riderDoc = await db.collection(`rankings_${year}`).doc(riderSlug).get();

      if (riderDoc.exists) {
        const riderData = riderDoc.data();

        const enrichedRider: EnrichedRider = {
          ...rider,
          nameID: riderData?.nameID || rider.shortName,
          rank: riderData?.rank,
          jerseyImage: riderData?.jerseyImage || '',
        };

        // Only add ranking points if rider doesn't already have a points field
        if (rider.points === undefined) {
          enrichedRider.rankingPoints = riderData?.points;
        }

        enrichedRiders.push(enrichedRider);
      } else {
        console.warn(`Rider ${rider.shortName} not found in rankings_${year}`);
        // Still add nameID based on slug even if not in rankings
        enrichedRiders.push({
          ...rider,
          nameID: riderSlug,
        });
      }
    } catch (error) {
      console.error(`Error enriching rider ${rider.shortName}:`, error);
      // Still add nameID based on slug even if error occurred
      enrichedRiders.push({
        ...rider,
        nameID: riderSlug,
      });
    }
  }

  return enrichedRiders;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, raceSlug, year } = await request.json();

    if (!userId || !raceSlug || !year) {
      return NextResponse.json(
        { error: 'User ID, race slug, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    const userDataCheck = userDoc.data();

    console.log('[saveRaceResult] Admin check:', {
      userId,
      userExists: userDoc.exists,
      userType: userDataCheck?.userType,
      isAdmin: userDataCheck?.userType === 'admin'
    });

    if (!userDoc.exists || userDataCheck?.userType !== 'admin') {
      return NextResponse.json(
        {
          error: 'Unauthorized - Admin access required',
          debug: {
            userExists: userDoc.exists,
            userType: userDataCheck?.userType
          }
        },
        { status: 403 }
      );
    }

    // Extract race name from slug (remove year suffix)
    const raceName = raceSlug.replace(/_\d{4}$/, '');

    // Validate race slug format (lowercase, alphanumeric with hyphens)
    if (!/^[a-z0-9-]+$/.test(raceName)) {
      return NextResponse.json(
        { error: `Invalid race slug format '${raceName}'. Use lowercase letters, numbers, and hyphens only.` },
        { status: 400 }
      );
    }

    console.log(`[saveRaceResult] Fetching result for ${raceName} ${year}`);

    // Check if this is a multi-stage race
    const multiStageRaces = ['tour-de-france', 'giro-d-italia', 'vuelta-a-espana', 'tour-down-under', 'paris-nice', 'tirreno-adriatico', 'volta-a-catalunya', 'dauphine'];
    const isMultiStage = multiStageRaces.includes(raceName);

    let raceData;
    if (isMultiStage) {
      // For multi-stage races, we need to handle this differently
      return NextResponse.json({
        error: `Multi-stage race '${raceName}' detected. Please use the scraper API with 'all-stages' or individual stage scraping instead.`,
        suggestion: 'Use /api/scraper with type "all-stages" or "stage" for multi-stage races.',
        isMultiStage: true
      }, { status: 400 });
    }

    // Fetch race result from ProCyclingStats (single-day race)
    raceData = await getRaceResult({
      race: raceName,
      year: parseInt(year),
    });

    console.log(`[saveRaceResult] Scraped ${raceData.stageResults.length} riders`);

    // Enrich riders with data from rankings
    console.log(`[saveRaceResult] Enriching riders from rankings_${year}`);
    const enrichedStageResults = await enrichRiders(raceData.stageResults as unknown as RiderInput[] || [], parseInt(year), db);
    const enrichedGeneralClassification = await enrichRiders(raceData.generalClassification as unknown as RiderInput[] || [], parseInt(year), db);
    const enrichedPointsClassification = await enrichRiders(raceData.pointsClassification as unknown as RiderInput[] || [], parseInt(year), db);
    const enrichedMountainsClassification = await enrichRiders(raceData.mountainsClassification as unknown as RiderInput[] || [], parseInt(year), db);
    const enrichedYouthClassification = await enrichRiders(raceData.youthClassification as unknown as RiderInput[] || [], parseInt(year), db);

    console.log(`[saveRaceResult] Enriched ${enrichedStageResults.length} results`);

    // Clean the data to remove undefined values
    const cleanedData = cleanData({
      stage: 'result', // Use 'result' instead of a stage number for single-day races
      race: raceName,
      year: parseInt(year),
      stageTitle: 'Race Result',
      stageResults: enrichedStageResults,
      generalClassification: enrichedGeneralClassification,
      pointsClassification: enrichedPointsClassification,
      mountainsClassification: enrichedMountainsClassification,
      youthClassification: enrichedYouthClassification,
      teamClassification: raceData.teamClassification || [],
      scrapedAt: raceData.scrapedAt,
      source: raceData.source,
    });

    // Save to scraper-data collection for points calculation
    try {
      await saveScraperData({
        race: raceName,
        year: parseInt(year),
        type: 'result'
      }, cleanedData);
      console.log(`[saveRaceResult] Saved to scraper-data collection: ${raceName}-${year}-result`);
    } catch (error) {
      console.error('[saveRaceResult] Error saving to scraper-data:', error);
      // Don't fail the whole request if scraper-data save fails
    }

    // Save to Firestore - for single-day races, save as 'result' document
    const resultDocRef = db.collection(raceSlug).doc('stages').collection('results').doc('result');
    await resultDocRef.set(cleanedData as FirebaseFirestore.DocumentData);

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACE_RESULT_SAVED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        raceSlug,
        ridersCount: raceData.stageResults.length,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Trigger points calculation for all affected games
    console.log(`[saveRaceResult] Triggering points calculation for ${raceSlug}`);
    try {
      const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
        method: 'POST',
        body: JSON.stringify({
          raceSlug,
          stage: 'result',
          year,
        }),
      });

      const calculatePointsResponse = await calculatePoints(mockRequest);
      const pointsResult = await calculatePointsResponse.json();

      if (calculatePointsResponse.status === 200) {
        console.log('[saveRaceResult] Points calculation completed:', pointsResult);
      } else {
        console.error('[saveRaceResult] Failed to calculate points:', pointsResult);
      }
    } catch (error) {
      console.error('[saveRaceResult] Error triggering points calculation:', error);
      // Don't fail the whole request if points calculation fails
    }

    // Trigger Slipstream calculations for any Slipstream games that include this race
    console.log(`[saveRaceResult] Checking for Slipstream games with race ${raceName}`);
    let slipstreamGamesProcessed = 0;
    try {
      const slipstreamGamesSnapshot = await db.collection('games')
        .where('gameType', '==', 'slipstream')
        .where('status', 'in', ['active', 'bidding'])
        .get();

      for (const gameDoc of slipstreamGamesSnapshot.docs) {
        const gameData = gameDoc.data();
        const countingRaces = gameData.config?.countingRaces || [];
        
        // Check if this race is in the game's counting races
        const matchingRace = countingRaces.find((r: { raceSlug: string }) => 
          r.raceSlug === raceName || r.raceSlug === raceSlug
        );

        if (matchingRace) {
          console.log(`[saveRaceResult] Processing Slipstream game ${gameDoc.id} for race ${raceName}`);
          
          try {
            const slipstreamResponse = await fetch(
              `${request.nextUrl.origin}/api/games/${gameDoc.id}/slipstream/calculate-results`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  raceSlug: matchingRace.raceSlug,
                  stageResults: enrichedStageResults
                })
              }
            );

            if (slipstreamResponse.ok) {
              slipstreamGamesProcessed++;
              console.log(`[saveRaceResult] Slipstream calculation completed for game ${gameDoc.id}`);
            } else {
              const errorData = await slipstreamResponse.json();
              console.error(`[saveRaceResult] Slipstream calculation failed for game ${gameDoc.id}:`, errorData);
            }
          } catch (slipstreamError) {
            console.error(`[saveRaceResult] Error calculating Slipstream for game ${gameDoc.id}:`, slipstreamError);
          }
        }
      }
    } catch (error) {
      console.error('[saveRaceResult] Error processing Slipstream games:', error);
      // Don't fail the whole request if Slipstream calculation fails
    }

    return NextResponse.json({
      success: true,
      ridersCount: raceData.stageResults.length,
      slipstreamGamesProcessed,
      message: `Race result succesvol opgeslagen`
    });
  } catch (error) {
    console.error('Error saving race result:', error);
    return NextResponse.json(
      { error: 'Failed to save race result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
