import { NextRequest, NextResponse } from 'next/server';
import { scrapeSeasonRanking, saveRankingData, getRankingData } from '@/lib/firebase/ranking-scraper-service';

export async function POST(request: NextRequest) {
  try {
    const { year, force = false } = await request.json();

    if (!year) {
      return NextResponse.json(
        { error: 'year is required' },
        { status: 400 }
      );
    }

    console.log(`[RANKING_SCRAPER_API] Processing request for year ${year}`);

    // Check if data already exists (unless force is true)
    if (!force) {
      const existingData = await getRankingData(year);
      if (existingData) {
        console.log(`[RANKING_SCRAPER_API] Data already exists for year ${year}`);
        return NextResponse.json({
          success: true,
          message: 'Data already exists',
          data: existingData,
          cached: true,
        });
      }
    }

    // Scrape new data
    const rankingData = await scrapeSeasonRanking(year);
    
    // Save to Firestore
    await saveRankingData(year, rankingData);

    console.log(`[RANKING_SCRAPER_API] Successfully scraped and saved ranking for year ${year}`);

    return NextResponse.json({
      success: true,
      message: 'Ranking data scraped successfully',
      data: rankingData,
      cached: false,
    });

  } catch (error) {
    console.error('[RANKING_SCRAPER_API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape ranking data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json(
        { error: 'year query parameter is required' },
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

    console.log(`[RANKING_SCRAPER_API] Getting ranking data for year ${yearNum}`);

    const rankingData = await getRankingData(yearNum);

    if (!rankingData) {
      return NextResponse.json(
        { error: 'Ranking data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rankingData,
    });

  } catch (error) {
    console.error('[RANKING_SCRAPER_API] GET Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get ranking data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
