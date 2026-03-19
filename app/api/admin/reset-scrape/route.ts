import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { generateDocumentId, type ScraperDataKey } from '@/lib/firebase/scraper-service';

/**
 * POST /api/admin/reset-scrape
 *
 * Deletes a scraper-data document so the race/stage is treated as
 * "not yet scraped" (pending) and will be picked up by the next cron run.
 *
 * Body: { userId, race, year, type, stage? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, race, year, type, stage } = body;

    if (!userId || !race || !year || !type) {
      return NextResponse.json(
        { error: 'userId, race, year and type are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Build the document ID
    const key: ScraperDataKey = { race, year: Number(year), type, stage } as ScraperDataKey;
    const docId = generateDocumentId(key);

    const ref = db.collection('scraper-data').doc(docId);
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: `No scraper data found for ${docId}` },
        { status: 404 }
      );
    }

    await ref.delete();

    console.log(`[RESET_SCRAPE] Deleted scraper-data/${docId} by admin ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Scrape data reset for ${docId}. The stage is now pending and will be picked up by the next cron run.`,
      docId,
    });
  } catch (error) {
    console.error('[RESET_SCRAPE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset scrape data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
