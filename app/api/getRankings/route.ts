import { getServerFirebase } from "@/lib/firebase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RankingsResponse, ApiErrorResponse, Ranking } from "@/lib/types";
import { FieldPath } from "firebase-admin/firestore";

type RankingsCursor = {
  rank: number;
  id: string;
};

function getTeamPath(teamRef: unknown): string | null {
  if (!teamRef || typeof teamRef !== 'object') return null;

  if ('path' in teamRef && typeof teamRef.path === 'string') {
    return teamRef.path;
  }

  return null;
}

function encodeCursor(cursor: RankingsCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(rawCursor: string | null): RankingsCursor | null {
  if (!rawCursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<RankingsCursor>;
    if (typeof parsed.rank !== 'number' || typeof parsed.id !== 'string') {
      return null;
    }
    return { rank: parsed.rank, id: parsed.id };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<RankingsResponse | ApiErrorResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const cursor = decodeCursor(searchParams.get('cursor'));

  try {
    const db = getServerFirebase();

    let query = db.collection(`rankings_2026`)
      .orderBy('rank')
      .orderBy(FieldPath.documentId());

    if (cursor) {
      query = query.startAfter(cursor.rank, cursor.id);
    } else if (offset > 0) {
      query = query.offset(offset);
    }
    query = query.limit(limit);

    const snapshot = await query.get();

    // Get total count (only if offset is 0 to avoid extra reads)
    let totalCount = null;
    if (offset === 0) {
      const countSnapshot = await db.collection(`rankings_2026`).count().get();
      totalCount = countSnapshot.data().count;
    }

    const teamPaths = Array.from(
      new Set(
        snapshot.docs
          .map((doc) => getTeamPath(doc.data().team))
          .filter((path): path is string => Boolean(path))
      )
    );
    const teamSnapshots = teamPaths.length > 0
      ? await db.getAll(...teamPaths.map((path) => db.doc(path)))
      : [];
    const teamsByPath = new Map<string, Record<string, unknown> | null>();

    teamSnapshots.forEach((teamDoc) => {
      teamsByPath.set(teamDoc.ref.path, teamDoc.exists ? (teamDoc.data() as Record<string, unknown>) : null);
    });

    const riders: Ranking[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const teamPath = getTeamPath(data.team);
      const teamData = (teamPath ? teamsByPath.get(teamPath) ?? null : null) as Ranking['team'];

      return {
        id: doc.id,
        rank: data.rank,
        name: data.name,
        nameID: data.nameID,
        retired: data.retired,
        points: data.points,
        jerseyImage: data.jerseyImage,
        age: data.age,
        country: data.country,
        team: teamData,
      };
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc
      ? encodeCursor({
          rank: lastDoc.get('rank'),
          id: lastDoc.id,
        })
      : null;

    const response = NextResponse.json({
      riders,
      pagination: {
        offset: cursor ? 0 : offset,
        limit,
        count: riders.length,
        totalCount,
        nextCursor,
      }
    });

    // Add HTTP caching headers
    // Cache for 1 hour in the browser, revalidate in background (stale-while-revalidate)
    // Note: For development, you may want to disable caching
    response.headers.set('Cache-Control', 'no-store, max-age=0');

    return response;
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}
