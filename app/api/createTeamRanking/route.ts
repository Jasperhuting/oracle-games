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

        const teamId = toSlug(team.name);

        await db.collection('teams').doc(teamId).update({
          name: team.name,
          class: team.class,
          country: team.country,
          points: team.points,
          slug: team.name,
        });
      }
    } catch (error) {
      console.error('Error creating rankings:', error);
      return Response.json({ error: 'Failed to create rankings' }, { status: 500 });
    }

    return Response.json({ result });
}