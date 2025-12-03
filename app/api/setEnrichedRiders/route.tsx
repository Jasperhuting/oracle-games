import type { NextRequest } from "next/server";
import { enrichRidersPuppeteer } from "@/lib/scraper/enrichRidersPuppeteer";
import { getServerFirebase } from "@/lib/firebase/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const team = searchParams.get('team');

    if (!year || !team) {
        return Response.json({ error: 'Missing year or team parameter' }, { status: 400 });
    }

    const result = await enrichRidersPuppeteer({ year: Number(year), team });

    const db = getServerFirebase();

    if (result?.riders && Object.keys(result.riders).length > 0) {
        for (const rider of result.riders) {
            await db.collection(`rankings_${year}`).doc(rider.name).set({
                jerseyImage: rider.jerseyImage,
                age: rider.age,
            }, { merge: true });
        }
    }


    return Response.json({ result });
}