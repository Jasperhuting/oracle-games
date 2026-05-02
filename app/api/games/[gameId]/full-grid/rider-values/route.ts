import { adminHandler, ApiError, publicHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

interface RiderValue {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  teamSlug: string;
  jerseyImage?: string;
  value: number;
  uciPoints?: number;
  teamClass?: string;
}

// GET rider values for a Full Grid game
export const GET = publicHandler('full-grid-rider-values-get', async ({ params }) => {
  const { gameId } = params;
  const db = getServerFirebase();

  // Get game details
  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    throw new ApiError('Game not found', 404);
  }

  const gameData = gameDoc.data();

  if (gameData?.gameType !== 'full-grid') {
    throw new ApiError('Game is not a Full Grid game', 400);
  }

  const config = gameData.config || {};
  const riderValues: Record<string, number> = config.riderValues || {};
  const eligibleRiders: string[] = gameData.eligibleRiders || [];
  const year = gameData.year || new Date().getFullYear();

  // If no eligible riders, return empty
  if (eligibleRiders.length === 0) {
    return {
      success: true,
      riders: [],
      riderValues: {},
      message: 'No eligible riders set. Please configure the race lineup first.',
    };
  }

  // Fetch rider details from rankings
  const ridersData: RiderValue[] = [];
  const teamCache = new Map<string, { name: string; slug: string; jerseyImageTeam: string; teamImage: string; teamClass?: string }>();

  // Batch fetch riders (Firestore limits to 30 items per 'in' query)
  const batchSize = 30;
  for (let i = 0; i < eligibleRiders.length; i += batchSize) {
    const batch = eligibleRiders.slice(i, i + batchSize);

    const ridersSnapshot = await db.collection(`rankings_2026`)
      .where('nameID', 'in', batch)
      .get();

    for (const doc of ridersSnapshot.docs) {
      const data = doc.data();
      let teamData: { name: string; slug: string; jerseyImageTeam: string; teamImage: string; teamClass?: string } = { name: '', slug: '', jerseyImageTeam: '', teamImage: '', teamClass: '' };

      // Resolve team reference
      if (data.team) {
        let teamPath: string | null = null;

        if (typeof data.team.get === 'function' && data.team.path) {
          teamPath = data.team.path;
        } else if (data.team.path) {
          teamPath = data.team.path;
        }

        if (teamPath) {
          if (teamCache.has(teamPath)) {
            teamData = teamCache.get(teamPath)!;
          } else {
            const teamDoc = await db.doc(teamPath).get();
            if (teamDoc.exists) {
              const td = teamDoc.data();
              teamData = {
                name: td?.name || '',
                slug: td?.slug || teamDoc.id,
                jerseyImageTeam: td?.jerseyImageTeam || '',
                teamImage: td?.teamImage || '',
                teamClass: td?.class || td?.teamClass || '',
              };
              teamCache.set(teamPath, teamData);
            }
          }
        }
      }

      ridersData.push({
        riderNameId: data.nameID || doc.id,
        riderName: data.name || '',
        riderTeam: teamData.name,
        teamSlug: teamData.slug,
        jerseyImage: teamData.teamImage || '',
        value: riderValues[data.nameID || doc.id] || 0,
        uciPoints: data.points || 0,
        teamClass: teamData.teamClass || undefined,
      });
    }
  }

  // Sort by team name, then by value (descending), then by name
  ridersData.sort((a, b) => {
    if (a.riderTeam !== b.riderTeam) {
      return a.riderTeam.localeCompare(b.riderTeam);
    }
    if (a.value !== b.value) {
      return b.value - a.value;
    }
    return a.riderName.localeCompare(b.riderName);
  });

  return {
    success: true,
    riders: ridersData,
    riderValues: riderValues,
    config: {
      budget: config.budget || 70,
      maxRiders: config.maxRiders || 22,
      minRiders: config.minRiders || 22,
      selectionStatus: config.selectionStatus || 'open',
      proTeamLimit: config.proTeamLimit ?? 4,
    },
  };
});

// UPDATE rider values for a Full Grid game
export const PATCH = adminHandler('full-grid-rider-values-patch', async ({ uid, request, params }) => {
  const { gameId } = params;
  const { riderValues } = await request.json() as {
    riderValues: Record<string, number>;
  };

  if (!riderValues || typeof riderValues !== 'object') {
    throw new ApiError('Rider values object is required', 400);
  }

  const db = getServerFirebase();

  // Get game details
  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    throw new ApiError('Game not found', 404);
  }

  const gameData = gameDoc.data();

  if (gameData?.gameType !== 'full-grid') {
    throw new ApiError('Game is not a Full Grid game', 400);
  }

  // Validate rider values (should be numbers >= 0)
  for (const [riderId, value] of Object.entries(riderValues)) {
    if (typeof value !== 'number' || value < 0) {
      throw new ApiError(`Invalid value for rider ${riderId}: must be a non-negative number`, 400);
    }
  }

  // Update the game config with new rider values
  const currentConfig = gameData.config || {};
  const updatedConfig = {
    ...currentConfig,
    riderValues: riderValues,
  };

  await gameDoc.ref.update({
    config: updatedConfig,
    updatedAt: Timestamp.now(),
  });

  // Log the activity
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();
  await db.collection('activityLogs').add({
    action: 'FULL_GRID_RIDER_VALUES_UPDATED',
    userId: uid,
    userEmail: adminData?.email,
    userName: adminData?.playername || adminData?.email,
    details: {
      gameId,
      gameName: gameData?.name,
      totalRidersUpdated: Object.keys(riderValues).length,
    },
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: 'Rider values updated successfully',
    totalRiders: Object.keys(riderValues).length,
  };
});
