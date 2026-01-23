import { NextRequest, NextResponse } from 'next/server';
import { scrapeRiderData, saveRiderData, getRiderData } from '@/lib/firebase/rider-scraper-service';

export async function POST(request: NextRequest) {
  try {
    const { riderNameId, year, force = false } = await request.json();

    if (!riderNameId || !year) {
      return NextResponse.json(
        { error: 'riderNameId and year are required' },
        { status: 400 }
      );
    }

    console.log(`[RIDER_SCRAPER_API] Processing request for ${riderNameId}, year ${year}`);

    // Check if data already exists (unless force is true)
    if (!force) {
      const existingData = await getRiderData({ rider: riderNameId, year });
      if (existingData) {
        console.log(`[RIDER_SCRAPER_API] Data already exists for ${riderNameId} ${year}`);
        return NextResponse.json({
          success: true,
          message: 'Data already exists',
          data: existingData,
          cached: true,
        });
      }
    }

    // Scrape new data
    const riderData = await scrapeRiderData(riderNameId, year);
    
    // Save to Firestore
    await saveRiderData({ rider: riderNameId, year }, riderData);

    console.log(`[RIDER_SCRAPER_API] Successfully scraped and saved ${riderNameId} ${year}`);

    return NextResponse.json({
      success: true,
      message: 'Rider data scraped successfully',
      data: riderData,
      cached: false,
    });

  } catch (error) {
    console.error('[RIDER_SCRAPER_API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape rider data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riderNameId = searchParams.get('rider');
    const year = searchParams.get('year');

    if (!riderNameId || !year) {
      return NextResponse.json(
        { error: 'rider and year query parameters are required' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json(
        { error: 'year must be a valid number' },
        { status: 400 }
      );
    }

    console.log(`[RIDER_SCRAPER_API] Getting data for ${riderNameId}, year ${yearNum}`);

    const riderData = await getRiderData({ rider: riderNameId, year: yearNum });

    if (!riderData) {
      return NextResponse.json(
        { error: 'Rider data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: riderData,
    });

  } catch (error) {
    console.error('[RIDER_SCRAPER_API] GET Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get rider data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
