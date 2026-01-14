import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getStageResult } from '@/lib/scraper/getStageResult';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';
import { Timestamp } from 'firebase-admin/firestore';

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

        if (rider.points === undefined) {
          enrichedRider.rankingPoints = riderData?.points;
        }

        enrichedRiders.push(enrichedRider);
      } else {
        enrichedRiders.push(rider);
      }
    } catch (error) {
      console.error(`Error enriching rider ${rider.shortName}:`, error);
      enrichedRiders.push(rider);
    }
  }

  return enrichedRiders;
}

/**
 * POST /api/admin/rescrape-year
 *
 * Clears season points for a year and re-scrapes all finished races.
 * Body: { userId, year }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, year } = await request.json();

    if (!userId || !year) {
      return NextResponse.json(
        { error: 'userId and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if requesting user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const yearNum = parseInt(year);
    console.log(`[RESCRAPE_YEAR] Starting rescrape for year ${yearNum}`);

    // Step 1: Clear all season points for this year
    console.log(`[RESCRAPE_YEAR] Clearing season points for ${yearNum}`);
    const seasonPointsSnapshot = await db.collection('seasonPoints')
      .where('year', '==', yearNum)
      .get();

    if (!seasonPointsSnapshot.empty) {
      const batchSize = 500;
      const docs = seasonPointsSnapshot.docs;

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + batchSize);

        for (const doc of chunk) {
          batch.delete(doc.ref);
        }

        await batch.commit();
      }
      console.log(`[RESCRAPE_YEAR] Deleted ${docs.length} season points documents`);
    }

    // Step 2: Find all races with results for this year
    console.log(`[RESCRAPE_YEAR] Finding races with results for ${yearNum}`);
    const racesSnapshot = await db.collection('races')
      .where('year', '==', yearNum)
      .get();

    interface StageToRescrape {
      stage: string;
      pcsRaceName: string;
    }
    const racesToRescrape: { raceSlug: string; stages: StageToRescrape[] }[] = [];

    const skippedRaces: { slug: string; reason: string }[] = [];

    for (const raceDoc of racesSnapshot.docs) {
      const raceData = raceDoc.data();
      const raceSlug = raceData.slug;

      if (!raceSlug) {
        skippedRaces.push({ slug: raceDoc.id, reason: 'no slug' });
        continue;
      }

      // Check if race has finished
      const dateStr = raceData.endDate || raceData.startDate;
      if (!dateStr) {
        skippedRaces.push({ slug: raceSlug, reason: 'no date' });
        continue;
      }

      const raceDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log(`[RESCRAPE_YEAR] Race ${raceSlug}: date=${dateStr}, parsed=${raceDate.toISOString()}, today=${today.toISOString()}, finished=${raceDate < today}`);

      if (raceDate >= today) {
        skippedRaces.push({ slug: raceSlug, reason: `not finished (${dateStr})` });
        continue; // Race hasn't finished yet
      }

      // Check if race has scraped results
      try {
        const resultsSnapshot = await db
          .collection(raceSlug)
          .doc('stages')
          .collection('results')
          .get();

        if (!resultsSnapshot.empty) {
          const stages: StageToRescrape[] = [];

          console.log(`[RESCRAPE_YEAR] Found ${resultsSnapshot.docs.length} result docs for ${raceSlug}`);

          for (const doc of resultsSnapshot.docs) {
            const docId = doc.id;
            const stageData = doc.data();

            console.log(`[RESCRAPE_YEAR] Processing ${raceSlug}/${docId}:`, {
              hasRaceField: !!stageData.race,
              raceField: stageData.race,
              hasSourceField: !!stageData.source,
              sourceField: stageData.source?.substring(0, 100),
            });

            // Get the PCS race name from the stored data
            // The 'race' field contains the PCS slug used for scraping
            let pcsRaceName = stageData.race || '';

            // If not found, try to extract from source URL
            // e.g., "https://www.procyclingstats.com/race/national-championships-australia-me-itt/2026/result"
            if (!pcsRaceName && stageData.source) {
              const match = stageData.source.match(/\/race\/([^/]+)\//);
              if (match) {
                pcsRaceName = match[1];
                console.log(`[RESCRAPE_YEAR] Extracted PCS race name from source URL: ${pcsRaceName}`);
              }
            }

            // Fallback: extract race name from raceSlug by removing _YEAR suffix
            // e.g., "nc-australia-itt_2026" -> "nc-australia-itt"
            if (!pcsRaceName) {
              const raceNameFromSlug = raceSlug.replace(/_\d{4}$/, '');
              if (raceNameFromSlug && raceNameFromSlug !== raceSlug) {
                pcsRaceName = raceNameFromSlug;
                console.log(`[RESCRAPE_YEAR] Extracted PCS race name from raceSlug: ${pcsRaceName}`);
              }
            }

            if (!pcsRaceName) {
              console.warn(`[RESCRAPE_YEAR] Could not determine PCS race name for ${raceSlug} ${docId}, skipping`);
              continue;
            }

            const stage = docId === 'result' ? 'result' : docId.replace('stage-', '');
            stages.push({ stage, pcsRaceName });
          }

          if (stages.length > 0) {
            racesToRescrape.push({ raceSlug, stages });
          }
        }
      } catch {
        // Collection doesn't exist
      }
    }

    console.log(`[RESCRAPE_YEAR] Found ${racesToRescrape.length} races to rescrape`);

    // Step 3: Rescrape each race
    const results: { raceSlug: string; stage: string; success: boolean; error?: string }[] = [];

    for (const race of racesToRescrape) {
      for (const stageInfo of race.stages) {
        const { stage, pcsRaceName } = stageInfo;
        console.log(`[RESCRAPE_YEAR] Rescraping ${race.raceSlug} stage ${stage} (PCS: ${pcsRaceName})`);

        try {
          // Fetch stage result from ProCyclingStats using the original PCS race name
          const stageData = await getStageResult({
            race: pcsRaceName,
            year: yearNum,
            stage: stage,
          });

          // Enrich riders
          const enrichedStageResults = await enrichRiders(stageData.stageResults as unknown as RiderInput[] || [], yearNum, db);
          const enrichedGeneralClassification = await enrichRiders(stageData.generalClassification as unknown as RiderInput[] || [], yearNum, db);
          const enrichedPointsClassification = await enrichRiders(stageData.pointsClassification as unknown as RiderInput[] || [], yearNum, db);
          const enrichedMountainsClassification = await enrichRiders(stageData.mountainsClassification as unknown as RiderInput[] || [], yearNum, db);
          const enrichedYouthClassification = await enrichRiders(stageData.youthClassification as unknown as RiderInput[] || [], yearNum, db);

          // Clean data
          const cleanedData = cleanData({
            stage: stage,
            race: pcsRaceName,
            year: yearNum,
            stageTitle: stageData.stageResults[0] ? `Stage ${stage}` : '',
            stageResults: enrichedStageResults,
            generalClassification: enrichedGeneralClassification,
            pointsClassification: enrichedPointsClassification,
            mountainsClassification: enrichedMountainsClassification,
            youthClassification: enrichedYouthClassification,
            teamClassification: stageData.teamClassification || [],
            scrapedAt: stageData.scrapedAt,
            source: stageData.source,
          });

          // Save to Firestore
          const docId = stage === 'result' ? 'result' : `stage-${stage}`;
          const stageDocRef = db.collection(race.raceSlug).doc('stages').collection('results').doc(docId);
          await stageDocRef.set(cleanedData as FirebaseFirestore.DocumentData);

          // Calculate points
          const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
            method: 'POST',
            body: JSON.stringify({
              raceSlug: race.raceSlug,
              stage,
              year: yearNum.toString(),
            }),
          });

          await calculatePoints(mockRequest);

          results.push({ raceSlug: race.raceSlug, stage, success: true });
          console.log(`[RESCRAPE_YEAR] Successfully rescraped ${race.raceSlug} stage ${stage}`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ raceSlug: race.raceSlug, stage, success: false, error: errorMessage });
          console.error(`[RESCRAPE_YEAR] Error rescraping ${race.raceSlug} stage ${stage}:`, error);
        }
      }
    }

    // Log activity
    await db.collection('activityLogs').add({
      action: 'YEAR_RESCRAPED',
      userId,
      details: {
        year: yearNum,
        racesCount: racesToRescrape.length,
        results,
      },
      timestamp: Timestamp.now(),
    });

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[RESCRAPE_YEAR] Completed: ${successCount} successful, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Rescraped ${successCount} stages for year ${yearNum}`,
      seasonPointsCleared: seasonPointsSnapshot.size,
      racesInYear: racesSnapshot.size,
      racesSkipped: skippedRaces.length,
      skippedReasons: skippedRaces,
      racesProcessed: racesToRescrape.length,
      stagesProcessed: results.length,
      successCount,
      failCount,
      results,
    });

  } catch (error) {
    console.error('[RESCRAPE_YEAR] Error:', error);
    return NextResponse.json(
      { error: 'Failed to rescrape year', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
