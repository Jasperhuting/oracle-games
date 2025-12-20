import { getServerFirebase } from "@/lib/firebase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RankingsResponse, ApiErrorResponse, Ranking } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse<RankingsResponse | ApiErrorResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const db = getServerFirebase();

    // Get paginated results
    let query = db.collection(`rankings_2026`).orderBy('rank');

    // Apply offset and limit
    if (offset > 0) {
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

    // Resolve team references to get actual team data
    const riders: Ranking[] = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let teamData = null;

        // If team is a DocumentReference, fetch the team data
        if (data.team) {
          // Firebase Admin SDK DocumentReference has .get() method
          if (typeof data.team.get === 'function') {
            const teamDoc = await data.team.get();
            teamData = teamDoc.exists ? teamDoc.data() : null;
          } else if (data.team.path) {
            // If it's a reference with a path, fetch it manually
            const teamDoc = await db.doc(data.team.path).get();
            teamData = teamDoc.exists ? teamDoc.data() : null;
          }
        }

        // Debug logging for retired field
        if (data.retired !== undefined) {
          console.log(`[getRankings] Rider ${data.name} (${doc.id}) has retired=${data.retired}`);
        }

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
          team: teamData, // Replace reference with actual team data
        };
      })
    );

    return NextResponse.json({
      riders,
      pagination: {
        offset,
        limit,
        count: riders.length,
        totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}
