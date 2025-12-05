import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getRacesPuppeteer } from '@/lib/scraper/getRacesPuppeteer';

/**
 * POST /api/scraper/races
 * Scrape races from ProCyclingStats and save to database
 * 
 * Body: { userId: string, year: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, year } = await request.json();

    if (!userId || !year) {
      return NextResponse.json(
        { error: 'User ID and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[scraper/races] Scraping races for year ${year}`);

    // Scrape races from ProCyclingStats using Puppeteer
    const racesData = await getRacesPuppeteer(year);

    console.log(`[scraper/races] Scraped ${racesData.count} races`);

    // Save each race to the database
    const batch = db.batch();
    let savedCount = 0;

    for (const race of racesData.races) {
      // Create a unique document ID: slug_year (e.g., "tour-de-france_2025")
      const docId = `${race.slug}_${year}`;
      const raceRef = db.collection('races').doc(docId);

      batch.set(raceRef, {
        ...race,
        year,
        updatedAt: new Date().toISOString(),
        scrapedAt: racesData.scrapedAt,
        source: racesData.source,
      }, { merge: true });

      savedCount++;
    }

    // Commit the batch
    await batch.commit();

    console.log(`[scraper/races] Saved ${savedCount} races to database`);

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACES_SCRAPED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        year,
        racesCount: savedCount,
        source: racesData.source,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      year,
      racesScraped: racesData.count,
      racesSaved: savedCount,
      message: `Successfully scraped and saved ${savedCount} races for ${year}`,
    });
  } catch (error) {
    console.error('[scraper/races] Error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scraper/races?year=2025
 * Get races from database for a specific year
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Query races for the specified year
    const racesSnapshot = await db.collection('races')
      .where('year', '==', parseInt(year))
      .orderBy('startDate', 'asc')
      .get();

    const races = racesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      year: parseInt(year),
      count: races.length,
      races,
    });
  } catch (error) {
    console.error('[scraper/races] Error fetching races:', error);
    return NextResponse.json(
      { error: 'Failed to fetch races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
