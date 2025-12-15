import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Team } from '@/lib/scraper';

// GET race lineup (teams and riders) for a game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const db = getServerFirebase();

    // Get game details
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const raceRef = gameData?.raceRef;
    const raceType = gameData?.raceType;
    const year = gameData?.year;

    if (!year) {
      return NextResponse.json(
        { error: 'Game year not found' },
        { status: 400 }
      );
    }

    let raceSlug: string | null = null;

    // For season games without a race reference, we don't need a raceSlug
    if (raceType !== 'season' && !raceRef) {
      return NextResponse.json(
        { error: 'Game does not have a race reference' },
        { status: 400 }
      );
    }

    // Get race document to find the slug (only if raceRef exists)
    if (raceRef) {
      const raceDoc = await raceRef.get();
      if (!raceDoc.exists) {
        return NextResponse.json(
          { error: 'Race not found' },
          { status: 404 }
        );
      }

      const raceData = raceDoc.data();
      raceSlug = raceData?.slug;

      if (!raceSlug) {
        return NextResponse.json(
          { error: 'Race slug not found' },
          { status: 400 }
        );
      }
    }

    // Fetch ALL available teams from teams collection
    const allTeamsSnapshot = await db.collection('teams').orderBy('points', 'desc').get();
    const allTeams = allTeamsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      shortName: doc.data().name || '',
      country: doc.data().country || '',
      class: doc.data().class || '',
      jerseyImage: doc.data().teamImage || '',
      pcsRank: doc.data().pcsRank || 0,
      uciRank: doc.data().rank || 0,
      points: doc.data().points || 0,
    }));

    // Fetch available riders from rankings_{year} (limit to top 1000 to avoid quota issues)
    const allRidersSnapshot = await db.collection(`rankings_${year}`)
      .orderBy('rank')
      .limit(3000)
      .get();

    // Cache team data to avoid duplicate reads
    const teamCache = new Map<string, any>(); // eslint-disable-line

    const allRiders = await Promise.all(
      allRidersSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Exclude riders where retired is explicitly true
          return data.retired !== true;
        })
        .map(async (doc) => {
          const data = doc.data();
          let teamData = null;

          if (data.team) {
            let teamPath: string | null = null;

            if (typeof data.team.get === 'function' && data.team.path) {
              teamPath = data.team.path;
            } else if (data.team.path) {
              teamPath = data.team.path;
            }

            if (teamPath) {
              // Check cache first
              if (teamCache.has(teamPath)) {
                teamData = teamCache.get(teamPath);
              } else {
                // Fetch and cache
                const teamDoc = await db.doc(teamPath).get();
                teamData = teamDoc.exists ? teamDoc.data() : null;
                teamCache.set(teamPath, teamData);
              }
            }
          }

          return {
            id: data.nameID || doc.id,
            name: data.name,
            firstName: data.firstName,
            lastName: data.lastName,
            country: data.country,
            rank: data.rank,
            points: data.points,
            team: teamData?.name || '',
            teamId: teamData?.slug || teamData?.id || '',
          };
        })
    );

    // Fetch CURRENT riders in the race lineup
    const currentRiderIds = new Set<string>();
    const currentTeamIds = new Set<string>();

    if (raceType === 'season') {
      // For season games, load from eligibleRiders and eligibleTeams in the game document
      const eligibleRiders = gameData?.eligibleRiders || [];
      const eligibleTeams = gameData?.eligibleTeams || [];

      eligibleRiders.forEach((riderId: string) => {
        currentRiderIds.add(riderId);
      });

      eligibleTeams.forEach((teamId: string) => {
        currentTeamIds.add(teamId);
      });
    } else if (raceSlug) {
      // For race games, load from the race collection
      const raceRidersSnapshot = await db.collection(raceSlug).get();

      raceRidersSnapshot.forEach((doc) => {
        const docData = doc.data();
        const riderData = docData.rider;

        if (riderData) {
          currentRiderIds.add(riderData.nameID || doc.id);

          if (riderData.team?.path) {
            const teamId = riderData.team.path.split('/').pop();
            if (teamId) currentTeamIds.add(teamId);
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      teams: allTeams,
      riders: allRiders,
      currentRiderIds: Array.from(currentRiderIds),
      currentTeamIds: Array.from(currentTeamIds),
      eligibleTeams: gameData?.eligibleTeams || [],
      eligibleRiders: gameData?.eligibleRiders || [],
    });
  } catch (error) {
    console.error('Error fetching race lineup:', error);
    return NextResponse.json(
      { error: 'Failed to fetch race lineup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// UPDATE race lineup for a game
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { adminUserId, riderIds, teamIds } = await request.json() as {
      adminUserId: string;
      riderIds?: string[];
      teamIds?: string[];
    };

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get game details to find the race
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const raceRef = gameData?.raceRef;
    const raceType = gameData?.raceType;
    const year = gameData?.year;

    if (!year) {
      return NextResponse.json(
        { error: 'Game year not found' },
        { status: 400 }
      );
    }

    let raceSlug: string | null = null;

    // For season games, we don't need a race reference
    if (raceType === 'season') {
      // For multi-division season games, update ALL divisions
      const divisionCount = gameData?.divisionCount || 1;
      const isMultiDivision = divisionCount > 1;

      const updatedGameIds: string[] = [];

      if (isMultiDivision) {
        // Get the base name (remove " - Division X" suffix)
        const gameName = gameData?.name || '';
        const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();

        // Find all games with the same base name, year, and type
        const relatedGamesSnapshot = await db.collection('games')
          .where('year', '==', gameData?.year)
          .where('gameType', '==', gameData?.gameType)
          .where('raceType', '==', 'season')
          .get();

        // Filter to only games with matching base name
        const batch = db.batch();
        relatedGamesSnapshot.forEach((doc) => {
          const docData = doc.data();
          const docBaseName = (docData?.name || '').replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
          if (docBaseName === baseName) {
            batch.update(doc.ref, {
              eligibleTeams: teamIds || [],
              eligibleRiders: riderIds || [],
              updatedAt: new Date(),
            });
            updatedGameIds.push(doc.id);
          }
        });

        await batch.commit();
      } else {
        // Single division: just update this game
        await gameDoc.ref.update({
          eligibleTeams: teamIds || [],
          eligibleRiders: riderIds || [],
          updatedAt: new Date(),
        });
        updatedGameIds.push(gameId);
      }

      // Log the activity
      const adminData = adminDoc.data();
      await db.collection('activityLogs').add({
        action: 'SEASON_LINEUP_UPDATED',
        userId: adminUserId,
        userEmail: adminData?.email,
        userName: adminData?.playername || adminData?.email,
        details: {
          gameId,
          gameType: 'season',
          totalRiders: riderIds?.length || 0,
          totalTeams: teamIds?.length || 0,
          gamesUpdated: updatedGameIds.length,
          updatedGameIds: updatedGameIds,
        },
        timestamp: new Date().toISOString(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      return NextResponse.json({
        success: true,
        message: `Season game lineup updated successfully for ${updatedGameIds.length} division(s)`,
        totalRiders: riderIds?.length || 0,
        totalTeams: teamIds?.length || 0,
        gamesUpdated: updatedGameIds.length,
        updatedGameIds: updatedGameIds,
      });
    }

    // For non-season games, require a race reference
    if (!raceRef) {
      return NextResponse.json(
        { error: 'Game does not have a valid race reference' },
        { status: 400 }
      );
    }

    const raceDoc = await raceRef.get();
    if (!raceDoc.exists) {
      return NextResponse.json(
        { error: 'Race not found' },
        { status: 404 }
      );
    }

    raceSlug = raceDoc.data()?.slug;
    if (!raceSlug) {
      return NextResponse.json(
        { error: 'Race slug not found' },
        { status: 400 }
      );
    }

    // Get current riders in the race
    const currentRidersSnapshot = await db.collection(raceSlug).get();
    const currentRiderIds = new Set<string>();
    const riderDocIds = new Map<string, string>(); // nameID -> docId

    currentRidersSnapshot.forEach((doc) => {
      const riderData = doc.data().rider;
      if (riderData) {
        const riderId = riderData.nameID || doc.id;
        currentRiderIds.add(riderId);
        riderDocIds.set(riderId, doc.id);
      }
    });

    const selectedRiderIds = new Set(riderIds || []);

    // Determine riders to add and remove
    const ridersToAdd = Array.from(selectedRiderIds).filter(id => !currentRiderIds.has(id));
    const ridersToRemove = Array.from(currentRiderIds).filter(id => !selectedRiderIds.has(id));

    // Remove riders
    for (const riderId of ridersToRemove) {
      const docId = riderDocIds.get(riderId);
      if (docId) {
        await db.collection(raceSlug).doc(docId).delete();
      }
    }

    // Add new riders
    for (const riderId of ridersToAdd) {
      // Fetch rider from rankings_{year}
      const riderDoc = await db.collection(`rankings_${year}`).doc(riderId).get();
      if (riderDoc.exists) {
        const riderData = riderDoc.data();
        await db.collection(raceSlug).doc(riderId).set({
          rider: riderData,
        });
      }
    }

    // Find ALL games that share the same race reference
    const allGamesSnapshot = await db.collection('games')
      .where('raceRef', '==', raceRef)
      .get();

    const updatedGameIds: string[] = [];

    // Update eligibleTeams and eligibleRiders for all games sharing this race
    const batch = db.batch();
    allGamesSnapshot.forEach((doc) => {
      batch.update(doc.ref, {
        eligibleTeams: teamIds || [],
        eligibleRiders: riderIds || [],
        updatedAt: new Date(),
      });
      updatedGameIds.push(doc.id);
    });

    await batch.commit();

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACE_LINEUP_UPDATED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        gameId,
        raceSlug,
        ridersAdded: ridersToAdd.length,
        ridersRemoved: ridersToRemove.length,
        totalRiders: riderIds?.length || 0,
        gamesUpdated: updatedGameIds.length,
        updatedGameIds: updatedGameIds,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Race lineup updated successfully for ${updatedGameIds.length} game(s)`,
      ridersAdded: ridersToAdd.length,
      ridersRemoved: ridersToRemove.length,
      gamesUpdated: updatedGameIds.length,
      updatedGameIds: updatedGameIds,
    });
  } catch (error) {
    console.error('Error updating race lineup:', error);
    return NextResponse.json(
      { error: 'Failed to update race lineup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
