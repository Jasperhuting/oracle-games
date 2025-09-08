import { NextRequest } from 'next/server';

const BASE = "https://jasperhuting.github.io/oracle-games-scraper/output";
const RACES = ["tour-de-france", "vuelta-a-espana", "world-championship", "giro-d-italia"] as const;
const YEAR = 2025;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const race = searchParams.get('race');

  try {
    if (race && RACES.includes(race as any)) {
      // Check specific race
      const metadata = await getFileMetadata(race);
      return Response.json({ race, ...metadata });
    }

    // Check all races
    const allMetadata = await Promise.all(
      RACES.map(async (race) => {
        const metadata = await getFileMetadata(race);
        return { race, ...metadata };
      })
    );

    return Response.json({ files: allMetadata });
  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function getFileMetadata(race: string) {
  const url = `${BASE}/startlist-${race}-${YEAR}.json`;
  
  try {
    // Add cache-busting timestamp to URL
    const cacheBustedUrl = `${url}?_t=${Date.now()}`;
    
    const response = await fetch(cacheBustedUrl, { 
      method: 'HEAD',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    return {
      url,
      exists: response.ok,
      lastModified: lastModified ? new Date(lastModified).toISOString() : null,
      etag,
      status: response.status,
      // Add more debug info
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${race}:`, error);
    return {
      url,
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0
    };
  }
}