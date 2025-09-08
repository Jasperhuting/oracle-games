import { NextRequest } from 'next/server';

const BASE = 'https://jasperhuting.github.io/oracle-games-scraper/output';

function stageUrl(race: string, year: number, stage: number) {
  return `${BASE}/${year}/${race}/${stage}/results.json`;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const race = search.get('race');
  const year = parseInt(search.get('year') || '0', 10);
  const stage = parseInt(search.get('stage') || '0', 10);

  if (!race || !year || !stage) {
    return Response.json({ error: 'Missing race, year, or stage' }, { status: 400 });
  }

  const url = stageUrl(race, year, stage);
  try {
    const res = await fetch(`${url}?_t=${Date.now()}`, {
      // Server-side fetch avoids browser CORS
      headers: {
        'Cache-Control': 'no-cache'
      },
      next: { revalidate: 60 } // small revalidate window
    });
    if (!res.ok) {
      return Response.json({ error: `Upstream HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();

    // Pass-through with minimal wrapping
    return Response.json({ url, data });
  } catch {
    return Response.json({ error: 'Failed to fetch stage data' }, { status: 500 });
  }
}
