import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { toSlug } from '@/lib/firebase/utils';
import { getRidersRankedPuppeteerNewYear } from '@/lib/scraper/getRidersRankedPuppeteer_newyear';


export async function POST(request: NextRequest) {
    try {
        const { offset } = await request.json();
        console.log(`Creating rankings for year 2026, offset ${offset}`);

        const result = await getRidersRankedPuppeteerNewYear({ offset: Number(offset) });
        const db = getServerFirebase();

        if (!result || !result.riders || result.riders.length === 0) {
            console.log('No riders found for this offset');
            return Response.json({ message: 'No riders found', result: { riders: [] } }, { status: 200 });
        }

        for (const rider of result.riders) {
            const teamSlug = rider?.team;
            let teamRef;

            // Only create/reference team if team data exists
            if (teamSlug) {
                // Check if team exists by querying for the slug
                const existingTeam = await db.collection('teams')
                    .where('slug', '==', teamSlug)
                    .limit(1)
                    .get();

                if (!existingTeam.empty) {
                    // Team exists, use its reference
                    teamRef = existingTeam.docs[0].ref;
                } else {
                    // Team doesn't exist, create it
                    const newTeamRef = db.collection('teams').doc(teamSlug);
                    await newTeamRef.set({
                        name: rider.team,
                        slug: teamSlug,
                    }, { merge: true });
                    teamRef = newTeamRef;
                }
            }

            // Create ranking entry with the team reference
            const docId = toSlug(rider.nameID);

            await db.collection(`rankings_2026`).doc(docId).set({
                country: rider.country,
                name: rider.name,
                nameID: rider.nameID,
                firstName: rider.firstName,
                lastName: rider.lastName,
                ...(teamRef && { team: teamRef }),
            }, { merge: true });
        }

        console.log(`Successfully created ${result.riders.length} rankings for offset ${offset}`);
        return Response.json({ result });

    } catch (error) {
        console.error('Error creating rankings:', error);
        return Response.json({ error: 'Failed to create rankings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
