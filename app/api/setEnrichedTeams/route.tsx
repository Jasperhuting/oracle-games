import type { NextRequest } from "next/server";
import { enrichTeams } from "@/lib/scraper/enrichTeams";
import { getServerFirebase } from "@/lib/firebase/server";
import { EnrichedRider } from "@/lib/scraper";


export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const team = searchParams.get('team');

    if (!year || !team) {
        return Response.json({ error: 'Missing year or team parameter' }, { status: 400 });
    }
    try {
        const result = await enrichTeams({ year: Number(year), team });

        const db = getServerFirebase();

        // Build update object, excluding undefined values
        const updateData: Record<string, unknown> = {};
        if (result.jerseyImageTeam !== undefined) {
            updateData.teamImage = result.jerseyImageTeam;
        }
        if (result.riders !== undefined) {
            updateData.riders = result.riders;
        }
        if (result.pcsRank !== undefined) {
            updateData.pcsRank = result.pcsRank;
        }
        if (result.uciRank !== undefined) {
            updateData.uciRank = result.uciRank;
        }
        if (result.points !== undefined) {
            updateData.points = result.points;
        }
        if (result.country !== undefined) {
            updateData.country = result.country;
        }
        if (result.name !== undefined) {
            updateData.name = result.name;
        }
        if (result.class !== undefined) {
            updateData.class = result.class;
        }

        // Only update if there's data to update
        if (Object.keys(updateData).length > 0) {
            await db.collection('teams').doc(team).update(updateData);
        }

        return Response.json({ result });
    } catch (error: any) {
        console.error('Error in setEnrichedTeams route for team', team, error);

        const message = error?.message || 'Failed to enrich team';
        return Response.json({ error: message, team, year: Number(year) }, { status: 500 });
    }
}