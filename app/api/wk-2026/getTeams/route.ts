
import { getServerFirebaseFootball } from "@/lib/firebase/server";

export const runtime = "nodejs";

interface Team {
  id: string;
  [key: string]: unknown;
}

function dedupeTeamsById(teams: Team[]) {
  const uniqueTeams = new Map<string, Team>();

  teams.forEach((team) => {
    if (!team.id) {
      return;
    }

    uniqueTeams.set(team.id, team);
  });

  return Array.from(uniqueTeams.values());
}

export async function GET() {
  try {
    const db = getServerFirebaseFootball();
    const snapshot = await db.collection('contenders').get();

    const teams = dedupeTeamsById(snapshot.docs.map((doc): Team => ({
      ...doc.data(),
      id: doc.id,
    })));

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

      return Response.json({ teams: dedupeTeamsById(Object.values(teamsFromPoules)) });
    }

    return Response.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
