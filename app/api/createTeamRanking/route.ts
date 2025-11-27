import { getTeamsRanked } from "@/lib/scraper/getTeamsRanked";
import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";
import { toSlug } from "@/lib/firebase/utils";

export async function POST(request: NextRequest) {
    const { year } = await request.json();

    const result = await getTeamsRanked({ year: Number(year) });
    const db = getServerFirebase();

    try {
      for (const team of result.teams) {

        let teamId = toSlug(team.nameID);

        if (teamId === 'q365-pro-cycing-team-2025') {
          teamId = 'q365-pro-cycling-team-2025'
        }

        let teamSlug = team.nameID;

        if (teamSlug === 'q365-pro-cycing-team-2025') {
          teamSlug = 'q365-pro-cycling-team-2025'
        }

        await db.collection('teams').doc(teamId).set({
          name: team.name,
          class: team.class,
          country: team.country,
          points: team.points,
          slug: teamSlug,
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error creating rankings:', error);
      return Response.json({ error: 'Failed to create rankings' }, { status: 500 });
    }

    return Response.json({ result });
}