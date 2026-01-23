import { getServerFirebase } from "@/lib/firebase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ApiErrorResponse, PlayerTeam, PlayerTeamResponse } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse<PlayerTeamResponse | ApiErrorResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const db = getServerFirebase();

    // Get paginated results
    let query = db.collection(`playerTeams`).orderBy('pointsScored', 'desc');

    // Apply offset and limit
    if (offset > 0) {
      query = query.offset(offset);
    }
    query = query.limit(limit);

    const snapshot = await query.get();

    // Get total count (only if offset is 0 to avoid extra reads)
    let totalCount = null;
    if (offset === 0) {
      const countSnapshot = await db.collection(`playerTeams`).count().get();
      totalCount = countSnapshot.data().count;
    }

    // Resolve team references to get actual team data
    const ridersWithTeamData: PlayerTeam[] = await Promise.all(
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

        return {
          id: doc.id,
          gameId: data.gameId,
          userId: data.userId,
          riderNameId: data.riderNameId,
          acquiredAt: data.acquiredAt,
          acquisitionType: data.acquisitionType,
          pricePaid: data.pricePaid,
          draftRound: data.draftRound,
          draftPick: data.draftPick,
          riderName: data.riderName,
          riderTeam: data.riderTeam,
          riderCountry: data.riderCountry,
          jerseyImage: data.jerseyImage,
          riderValue: data.riderValue,
          pointsScored: data.pointsScored,
          stagesParticipated: data.stagesParticipated,
          racePoints: data.racePoints,
          team: teamData, // Replace reference with actual team data
        };
      })
    );

    // Filter duplicates based on riderNameId, keeping only the first occurrence
    const uniqueRidersMap = new Map<string, PlayerTeam>();
    ridersWithTeamData.forEach(rider => {
      if (rider.riderNameId && !uniqueRidersMap.has(rider.riderNameId)) {
        uniqueRidersMap.set(rider.riderNameId, rider);
      }
    });
    
    const riders = Array.from(uniqueRidersMap.values());

    console.log('uniqueRidersMap', uniqueRidersMap)

    const response = NextResponse.json({
      riders,
      pagination: {
        offset,
        limit,
        count: riders.length,
        totalCount
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
