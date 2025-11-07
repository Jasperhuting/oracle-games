import { getRidersRanked } from '@/lib/scraper/getRidersRanked';
import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { toSlug } from '@/lib/firebase/utils';


export async function POST(request: NextRequest) {
    const { year, offset } = await request.json();

    const result = await getRidersRanked({ offset: Number(offset), year: Number(year) });
    const db = getServerFirebase();

    try {
      for (const rider of result.riders) {
        const team = rider.team;
        const teamSlug = toSlug(team);

        let teamRef;

        // Only create/reference team if team data exists
        if (team && teamSlug) {
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
              name: team,
              slug: teamSlug,
            });
            teamRef = newTeamRef;
          }
        }

        // Create ranking entry with the team reference
        const docId = toSlug(rider.nameID);

        await db.collection(`rankings_${year}`).doc(docId).set({
          rank: rider.rank,
          name: rider.fullName,
          points: rider.points,
          nameID: rider.nameID,
          country: rider.country,
          ...(teamRef && { team: teamRef }),
        });
      }
    } catch (error) {
      console.error('Error creating rankings:', error);
      return Response.json({ error: 'Failed to create rankings' }, { status: 500 });
    }

    return Response.json({ result });
}
