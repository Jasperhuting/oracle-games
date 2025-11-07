import { NextRequest } from 'next/server';

const BASE = 'https://jasperhuting.github.io/oracle-games-scraper/output';

function ridersUrl(year: number) {
  return `${BASE}/${year}/riders.json`;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const year = parseInt(search.get('year') || '0', 10);

  if (!year) {
    return Response.json({ error: 'Missing year' }, { status: 400 });
  }

  const url = ridersUrl(year);
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
