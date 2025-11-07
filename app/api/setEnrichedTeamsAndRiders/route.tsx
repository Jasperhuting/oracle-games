import type { NextRequest } from "next/server";
import { enrichTeamsAndRiders } from "@/lib/scraper/enrichTeamsAndRiders";
import { getServerFirebase } from "@/lib/firebase/server";
import { toSlug } from "@/lib/firebase/utils";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const team = searchParams.get('team');

    if (!year || !team) {
        return Response.json({ error: 'Missing year or team parameter' }, { status: 400 });
    }

    const result = await enrichTeamsAndRiders({ year: Number(year), team });

    const db = getServerFirebase();

    // Build update object, excluding undefined values
    const updateData: Record<string, any> = {};
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

    if (Object.keys(result.riders).length > 0) {
        for (const rider of result.riders) {

            console.log('rider', rider)

            await db.collection(`rankings_${year}`).doc(rider.name).update({
                jerseyImage: rider.jerseyImage,
            });
        }
    }

    // Only update if there's data to update
    if (Object.keys(updateData).length > 0) {
        await db.collection('teams').doc(team).update(updateData);
    }

    // try {
    //   for (const team of result.teams) {

    //     const teamId = toSlug(team.name);

    //     await db.collection('teams').doc(teamId).set({
    //       name: team.name,
    //       class: team.class,
    //       country: team.country,
    //       points: team.points,
    //       slug: toSlug(team.name),
    //     });
    //   }
    // } catch (error) {
    //   console.error('Error creating rankings:', error);
    //   return Response.json({ error: 'Failed to create rankings' }, { status: 500 });
    // }

    return Response.json({ result });
}