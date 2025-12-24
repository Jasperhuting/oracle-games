import { NextRequest, NextResponse } from 'next/server';
import { getRiderProfile } from '@/lib/scraper/getRiderProfile';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!url.includes('procyclingstats.com/rider/')) {
      return NextResponse.json(
        { error: 'Invalid URL. Must be a ProCyclingStats rider URL (e.g., https://www.procyclingstats.com/rider/titouan-fontaine)' },
        { status: 400 }
      );
    }

    const riderData = await getRiderProfile(url);

    return NextResponse.json(riderData);
  } catch (error) {
    console.error('Error scraping rider profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scrape rider profile' },
      { status: 500 }
    );
  }
}
