import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = searchParams.get('year');
  const race = searchParams.get('race');
  
  try {
    const db = getServerFirebase();
    
    // Try with orderBy first, fall back to unordered if it fails (missing index)
    let snapshot;
    try {
      snapshot = await db.collection(`${race}_${year}`).orderBy('rider.points', 'desc').get();
    } catch (orderError) {
      console.warn('OrderBy failed (likely missing index), fetching unordered:', orderError);
      snapshot = await db.collection(`${race}_${year}`).get();
    }
    
    // Fetch riders with team data resolved
    const riders = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      // Fetch team data if it's a reference
      let teamData = data.rider.team;
      if (teamData && typeof teamData.get === 'function') {
        const teamDoc = await teamData.get();
        teamData = teamDoc.exists ? teamDoc.data() : null;
      }
      
      return {
        id: doc.id,
        ...data.rider,
        team: teamData,
        dnf: data.dnf,
        dns: data.dns,
      };
    }));

    // Sort by points in memory if we couldn't order in the query
    riders.sort((a, b) => (b.points || 0) - (a.points || 0));

    return Response.json({ riders });
  } catch (error) {
    console.error('Error fetching riders:', error);
    return Response.json({ error: 'Failed to fetch riders', details: String(error) }, { status: 500 });
  }
}
