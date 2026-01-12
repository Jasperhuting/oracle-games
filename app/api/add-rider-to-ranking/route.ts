import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { toSlug } from '@/lib/firebase/utils';

export interface AddRiderRequest {
  name: string;
  firstName: string;
  lastName: string;
  nameID: string;
  country: string;
  team: string;
  points: number;
  rank: number;
  year?: number;
  age?: string; // Date string in YYYY-MM-DD format
}

export async function POST(req: NextRequest) {
  try {
    const riderData: AddRiderRequest = await req.json();

    // Validate required fields
    const requiredFields = ['name', 'firstName', 'lastName', 'nameID', 'country', 'points', 'rank'];
    const missingFields = requiredFields.filter(field => {
      const value = riderData[field as keyof AddRiderRequest];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    const year = riderData.year || 2026;

    let teamRef;

    // Only create/reference team if team data exists
    if (riderData.team) {
      const teamSlug = riderData.team;

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
          name: riderData.team,
          slug: teamSlug,
        }, { merge: true });
        teamRef = newTeamRef;
      }
    }

    // Create ranking entry with the team reference
    const docId = toSlug(riderData.nameID);

    await db.collection(`rankings_${year}`).doc(docId).set({
      country: riderData.country,
      name: riderData.name,
      nameID: riderData.nameID,
      points: riderData.points,
      rank: riderData.rank,
      firstName: riderData.firstName,
      lastName: riderData.lastName,
      ...(teamRef && { team: teamRef }),
      ...(riderData.age && { age: riderData.age }),
    }, { merge: true });

    // Add rider to all seasonal games for this year
    const seasonalGamesSnapshot = await db.collection('games')
      .where('raceType', '==', 'season')
      .where('year', '==', year)
      .get();

    let addedToGamesCount = 0;
    for (const gameDoc of seasonalGamesSnapshot.docs) {
      const gameData = gameDoc.data();

      // Only add to games that already have an eligibleRiders array
      // Games without eligibleRiders show all riders by default
      // Adding to an empty/undefined array would restrict the game to only this rider!
      if (!gameData.eligibleRiders || !Array.isArray(gameData.eligibleRiders) || gameData.eligibleRiders.length === 0) {
        continue;
      }

      const eligibleRiders = gameData.eligibleRiders;

      // Only add if not already in the list
      if (!eligibleRiders.includes(riderData.nameID)) {
        await gameDoc.ref.update({
          eligibleRiders: [...eligibleRiders, riderData.nameID],
        });
        addedToGamesCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${riderData.name} to rankings_${year} and ${addedToGamesCount} seasonal game(s)`,
      docId,
      addedToGames: addedToGamesCount,
      cacheInvalidated: true, // Signal to client to increment cache version
    });

  } catch (error) {
    console.error('Error adding rider to ranking:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add rider to ranking' },
      { status: 500 }
    );
  }
}
