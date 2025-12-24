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
}

export async function POST(req: NextRequest) {
  try {
    const riderData: AddRiderRequest = await req.json();

    // Validate required fields
    const requiredFields = ['name', 'firstName', 'lastName', 'nameID', 'country', 'points', 'rank'];
    const missingFields = requiredFields.filter(field => !riderData[field as keyof AddRiderRequest]);

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
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${riderData.name} to rankings_${year}`,
      docId,
    });

  } catch (error) {
    console.error('Error adding rider to ranking:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add rider to ranking' },
      { status: 500 }
    );
  }
}
