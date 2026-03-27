import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

const RACE_SLUG_ALIASES: Record<string, string[]> = {
  'e3-saxo-classic': ['e3-harelbeke'],
  'e3-harelbeke': ['e3-saxo-classic'],
};

function parseStoredStageResults(data: FirebaseFirestore.DocumentData | undefined) {
  let stageResults = data?.stageResults;

  if (typeof stageResults === 'string') {
    stageResults = JSON.parse(stageResults);
  }

  return Array.isArray(stageResults) ? stageResults : null;
}

/**
 * GET /api/races/[raceSlug]/results
 * Fetch stored race results for a given race slug (with or without year suffix).
 *
 * The raceSlug may be:
 *   - "milano-sanremo"         → uses current year
 *   - "milano-sanremo_2026"    → uses year 2026
 *
 * Results are read from the scraper-data collection using document ID
 * pattern: {raceName}-{year}-result
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ raceSlug: string }> }
) {
  try {
    const { raceSlug } = await params;

    // Extract race name and optional year from slug
    const yearMatch = raceSlug.match(/_(\d{4})$/);
    const raceName = raceSlug.replace(/_\d{4}$/, '');
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

    const db = getServerFirebase();
    const raceNameCandidates = [raceName, ...(RACE_SLUG_ALIASES[raceName] || [])];
    const dedupedRaceNameCandidates = Array.from(new Set(raceNameCandidates));

    for (const candidateRaceName of dedupedRaceNameCandidates) {
      const docId = `${candidateRaceName}-${year}-result`;

      try {
        const scraperDoc = await db.collection('scraper-data').doc(docId).get();
        if (!scraperDoc.exists) {
          continue;
        }

        const stageResults = parseStoredStageResults(scraperDoc.data());

        if (stageResults && stageResults.length > 0) {
          return NextResponse.json({
            success: true,
            raceName: candidateRaceName,
            requestedRaceName: raceName,
            year,
            source: 'scraper-data',
            stageResults,
          });
        }
      } catch (error) {
        console.error(`[GET_RACE_RESULTS] Failed to read scraper-data doc '${docId}':`, error);
      }
    }

    const raceCollectionCandidates = [raceSlug, raceName, ...(RACE_SLUG_ALIASES[raceName] || [])];
    const dedupedRaceCollectionCandidates = Array.from(new Set(raceCollectionCandidates));

    for (const collectionName of dedupedRaceCollectionCandidates) {
      try {
        const resultDoc = await db
          .collection(collectionName)
          .doc('stages')
          .collection('results')
          .doc('result')
          .get();

        if (!resultDoc.exists) {
          continue;
        }

        const stageResults = parseStoredStageResults(resultDoc.data());

        if (stageResults && stageResults.length > 0) {
          return NextResponse.json({
            success: true,
            raceName: collectionName.replace(/_\d{4}$/, ''),
            requestedRaceName: raceName,
            year,
            source: `race-collection:${collectionName}`,
            stageResults,
          });
        }
      } catch (error) {
        console.error(`[GET_RACE_RESULTS] Failed to read race collection '${collectionName}':`, error);
      }
    }

    return NextResponse.json(
      { error: `No results found for ${raceName} ${year}` },
      { status: 404 }
    );
  } catch (error) {
    console.error('[GET_RACE_RESULTS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch race results',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
