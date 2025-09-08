import { NextRequest } from 'next/server';

const BASE = "https://jasperhuting.github.io/oracle-games-scraper/output";

async function head(url: string): Promise<Response | null> {
  try {
    const res = await fetch(`${url}?_t=${Date.now()}`, {
      method: 'HEAD',
      // Server-side fetch; no CORS needed here
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    return res;
  } catch {
    return null;
  }
}

function stageUrl(race: string, year: number, stage: number) {
  // Aligned with user's structure: /{year}/{race}/{stage}/results.json
  return `${BASE}/${year}/${race}/${stage}/results.json`;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const race = search.get('race');
  const year = parseInt(search.get('year') || '0', 10);
  const maxStages = parseInt(search.get('maxStages') || '21', 10);

  if (!race || !year) {
    return Response.json({ error: 'Missing race or year' }, { status: 400 });
  }

  const found: Array<{ stage: number; url: string; lastModified: string | null }> = [];

  for (let s = 1; s <= maxStages; s++) {
    const url = stageUrl(race, year, s);
    const res = await head(url);
    if (res && res.ok) {
      const lastModified = res.headers.get('last-modified');
      found.push({
        stage: s,
        url,
        lastModified: lastModified ? new Date(lastModified).toISOString() : null
      });
    }
  }

  return Response.json({ stages: found });
}
