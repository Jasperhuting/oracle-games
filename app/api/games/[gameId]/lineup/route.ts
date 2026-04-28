import { adminHandler, ApiError, publicHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Team } from '@/lib/scraper';

async function bumpCacheVersion(db: ReturnType<typeof getServerFirebase>) {
  const configRef = db.collection('config').doc('cache');
  const configDoc = await configRef.get();
  const currentVersion = configDoc.exists ? (configDoc.data()?.version || 1) : 1;
  await configRef.set({
    version: currentVersion + 1,
    updatedAt: Timestamp.now()
  }, { merge: true });
}

// GET race lineup (teams and riders) for a game
export const GET = publicHandler('lineup-get', async ({ params }) => {
  const { gameId } = params;
  const db = getServerFirebase();

  // Get game details
  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    throw new ApiError('Game not found', 404);
  }

  const gameData = gameDoc.data();
  const raceRefRaw = gameData?.raceRef;
  const raceType = gameData?.raceType;
  const year = gameData?.year;

  if (!year) {
    throw new ApiError('Game year not found', 400);
  }

  let raceSlug: string | null = null;
  const gameType = gameData?.gameType;

  // Normalize raceRef: may be stored as string path or DocumentReference
  const raceRef = raceRefRaw
    ? (typeof raceRefRaw === 'string' ? db.doc(raceRefRaw) : raceRefRaw)
    : null;

  // For season games or full-grid games without a race reference, we don't need a raceSlug
  // Full Grid games work like season games - they use eligibleRiders/eligibleTeams from the game document
  if (raceType !== 'season' && gameType !== 'full-grid' && !raceRef) {
    throw new ApiError('Game does not have a race reference', 400);
  }

  // Get race document to find the slug (only if raceRef exists and not a full-grid game)
  // Full-grid games use eligibleRiders/eligibleTeams from the game document, not from a race
  if (raceRef && gameType !== 'full-grid') {
    const raceDoc = await raceRef.get();
    if (!raceDoc.exists) {
      throw new ApiError('Race not found', 404);
    }

    const raceData = raceDoc.data();
    raceSlug = raceData?.slug;

    if (!raceSlug) {
      throw new ApiError('Race slug not found', 400);
    }
  }

  // Fetch ALL available teams from teams collection
  const allTeamsSnapshot = await db.collection('teams').orderBy('points', 'desc').get();
  const teamsByName = new Map<string, { id: string; name: string; shortName: string; country: string; class: string; jerseyImage: string; pcsRank: number; uciRank: number; points: number }>();
  for (const doc of allTeamsSnapshot.docs) {
    const data = doc.data();
    const name = data.name || '';
    if (!name) continue;
    // Keep first occurrence (highest points due to orderBy desc), but prefer entries with class data
    const existing = teamsByName.get(name);
    if (!existing || (!existing.class && data.class)) {
      teamsByName.set(name, {
        id: doc.id,
        name,
        shortName: name,
        country: data.country || '',
        class: data.class || '',
        jerseyImage: data.teamImage || '',
        pcsRank: data.pcsRank || 0,
        uciRank: data.rank || 0,
        points: data.points || existing?.points || 0,
      });
    }
  }
  const allTeams = Array.from(teamsByName.values());

  // Fetch available riders from rankings_{year} (limit to top 1000 to avoid quota issues)
  // Fallback to rankings_2026 if the specified year doesn't exist
  let rankingsCollection = `rankings_${year}`;

  // Check if we should use 2026 data for 2025 games (temporary fix for missing 2025 data)
  if (year === 2025) {
    rankingsCollection = 'rankings_2026';
  }

  const allRidersSnapshot = await db.collection(rankingsCollection)
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
          teamImage: teamData?.teamImage || '',
        };
      })
  );

  // Fetch CURRENT riders in the race lineup
  const currentRiderIds = new Set<string>();
  const currentTeamIds = new Set<string>();

  if (raceType === 'season' || gameType === 'full-grid') {
    // For season games and full-grid games, load from eligibleRiders and eligibleTeams in the game document
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

  return {
    success: true,
    teams: allTeams,
    riders: allRiders,
    currentRiderIds: Array.from(currentRiderIds),
    currentTeamIds: Array.from(currentTeamIds),
    eligibleTeams: gameData?.eligibleTeams || [],
    eligibleRiders: gameData?.eligibleRiders || [],
  };
});

// UPDATE race lineup for a game
export const PATCH = adminHandler('lineup-patch', async ({ uid, request, params }) => {
  const { gameId } = params;
  const { riderIds, teamIds } = await request.json() as {
    riderIds?: string[];
    teamIds?: string[];
  };

  const db = getServerFirebase();

  // Get game details to find the race
  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    throw new ApiError('Game not found', 404);
  }

  const gameData = gameDoc.data();
  const raceRefRaw = gameData?.raceRef;
  const raceType = gameData?.raceType;
  const year = gameData?.year;

  if (!year) {
    throw new ApiError('Game year not found', 400);
  }

  let raceSlug: string | null = null;
  const gameType = gameData?.gameType;

  // Normalize raceRef: may be stored as string path or DocumentReference
  const raceRef = raceRefRaw
    ? (typeof raceRefRaw === 'string' ? db.doc(raceRefRaw) : raceRefRaw)
    : null;

  // For season games and full-grid games, we don't need a race reference
  if (raceType === 'season' || gameType === 'full-grid') {
    // For multi-division season games, update ALL divisions
    const divisionCount = gameData?.divisionCount || 1;
    const isMultiDivision = divisionCount > 1;

    const updatedGameIds: string[] = [];

    if (isMultiDivision) {
      // Get the base name (remove " - Division X" suffix)
      const gameName = gameData?.name || '';
      const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();

      // Find all games with the same base name, year, and type
      // For full-grid games, we query by gameType instead of raceType
      const relatedGamesSnapshot = await db.collection('games')
        .where('year', '==', gameData?.year)
        .where('gameType', '==', gameData?.gameType)
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

    await bumpCacheVersion(db);

    // Log the activity
    const adminDoc = await db.collection('users').doc(uid).get();
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: gameType === 'full-grid' ? 'FULL_GRID_LINEUP_UPDATED' : 'SEASON_LINEUP_UPDATED',
      userId: uid,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        gameId,
        gameType: gameType || 'season',
        totalRiders: riderIds?.length || 0,
        totalTeams: teamIds?.length || 0,
        gamesUpdated: updatedGameIds.length,
        updatedGameIds: updatedGameIds,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return {
      success: true,
      message: `Season game lineup updated successfully for ${updatedGameIds.length} division(s)`,
      totalRiders: riderIds?.length || 0,
      totalTeams: teamIds?.length || 0,
      gamesUpdated: updatedGameIds.length,
      updatedGameIds: updatedGameIds,
    };
  }

  // For non-season games, require a race reference
  if (!raceRef) {
    throw new ApiError('Game does not have a valid race reference', 400);
  }

  const raceDoc = await raceRef.get();
  if (!raceDoc.exists) {
    throw new ApiError('Race not found', 404);
  }

  raceSlug = raceDoc.data()?.slug;
  if (!raceSlug) {
    throw new ApiError('Race slug not found', 400);
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
    // Fetch rider from rankings_{year} (with fallback to 2026 for 2025 games)
    let rankingsCollection = `rankings_${year}`;
    if (year === 2025) {
      rankingsCollection = 'rankings_2026';
    }

    const riderDoc = await db.collection(rankingsCollection).doc(riderId).get();
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

  await bumpCacheVersion(db);

  // Log the activity
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();
  await db.collection('activityLogs').add({
    action: 'RACE_LINEUP_UPDATED',
    userId: uid,
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
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: `Race lineup updated successfully for ${updatedGameIds.length} game(s)`,
    ridersAdded: ridersToAdd.length,
    ridersRemoved: ridersToRemove.length,
    gamesUpdated: updatedGameIds.length,
    updatedGameIds: updatedGameIds,
  };
});
