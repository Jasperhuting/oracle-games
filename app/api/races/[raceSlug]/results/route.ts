import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

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
    const docId = `${raceName}-${year}-result`;

    const doc = await db.collection('scraper-data').doc(docId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: `No results found for ${raceName} ${year}` },
        { status: 404 }
      );
    }

    const data = doc.data();

    // stageResults may be stored as a JSON string or as an array
    let stageResults = data?.stageResults;
    if (typeof stageResults === 'string') {
      try {
        stageResults = JSON.parse(stageResults);
      } catch {
        return NextResponse.json(
          { error: 'Failed to parse stored race results' },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(stageResults) || stageResults.length === 0) {
      return NextResponse.json(
        { error: 'No stage results available for this race' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      raceName,
      year,
      stageResults,
    });
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
