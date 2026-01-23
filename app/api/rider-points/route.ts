import { NextRequest, NextResponse } from 'next/server';
import { 
  scrapeRidersWithPoints, 
  getAllRidersWithUsers, 
  getRiderPointsWithUsers 
} from '@/lib/firebase/rider-points-service';

export async function POST(request: NextRequest) {
  try {
    const { action, year, riderNameId } = await request.json();

    if (action === 'scrape-all') {
      if (!year) {
        return NextResponse.json(
          { error: 'year is required for scrape-all action' },
          { status: 400 }
        );
      }

      console.log(`[RIDER_POINTS_API] Starting scrape-all for year ${year}`);
      
      // This is a long-running operation, so we'll run it in the background
      // In a production environment, you might want to use a proper job queue
      scrapeRidersWithPoints(year).catch(error => {
        console.error('[RIDER_POINTS_API] Background scrape error:', error);
      });

      return NextResponse.json({
        success: true,
        message: `Started scraping all riders with points for year ${year}`,
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "scrape-all"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[RIDER_POINTS_API] POST Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request', 
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

    console.log(`[RIDER_POINTS_API] Getting rider points for year ${yearNum}, rider: ${riderNameId || 'all'}`);

    if (riderNameId) {
      // Get specific rider with users
      const riderWithUsers = await getRiderPointsWithUsers(riderNameId, yearNum);
      
      if (!riderWithUsers) {
        return NextResponse.json(
          { error: 'Rider data not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: riderWithUsers,
      });

    } else {
      // Get all riders with users
      const allRidersWithUsers = await getAllRidersWithUsers(yearNum);

      return NextResponse.json({
        success: true,
        data: allRidersWithUsers,
        count: allRidersWithUsers.length,
      });
    }

  } catch (error) {
    console.error('[RIDER_POINTS_API] GET Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get rider points', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
