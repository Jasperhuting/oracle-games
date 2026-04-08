
import { getServerFirebaseFootball } from "@/lib/firebase/server";

export const runtime = "nodejs";

interface Team {
  id: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    const db = getServerFirebaseFootball();
    const snapshot = await db.collection('contenders').get();

    const teams = snapshot.docs.map((doc): Team => ({
      id: doc.id,
      ...doc.data()
    }));

    // If contenders is empty, reconstruct teams from saved poules data
    if (teams.length === 0) {
      const poulesSnapshot = await db.collection('poules').get();
      const teamsFromPoules: Record<string, Team> = {};

      poulesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.teams) {
          Object.entries(data.teams as Record<string, Record<string, unknown>>).forEach(([teamId, teamData]) => {
            if (!teamsFromPoules[teamId]) {
              teamsFromPoules[teamId] = {
                id: teamId,
                ...teamData,
              };
            }
          });
        }
      });

      return Response.json({ teams: Object.values(teamsFromPoules) });
    }

    return Response.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
