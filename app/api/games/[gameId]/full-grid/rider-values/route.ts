import { NextRequest, NextResponse } from 'next/server';
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

    if (gameData?.gameType !== 'full-grid') {
      return NextResponse.json(
        { error: 'Game is not a Full Grid game' },
        { status: 400 }
      );
    }

    const config = gameData.config || {};
    const riderValues: Record<string, number> = config.riderValues || {};
    const eligibleRiders: string[] = gameData.eligibleRiders || [];
    const year = gameData.year || new Date().getFullYear();

    // If no eligible riders, return empty
    if (eligibleRiders.length === 0) {
      return NextResponse.json({
        success: true,
        riders: [],
        riderValues: {},
        message: 'No eligible riders set. Please configure the race lineup first.',
      });
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
        let teamData = { name: '', slug: '', jerseyImageTeam: '', teamImage: '', teamClass: '' };

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

    return NextResponse.json({
      success: true,
      riders: ridersData,
      riderValues: riderValues,
      config: {
        budget: config.budget || 70,
        maxRiders: config.maxRiders || 22,
        selectionStatus: config.selectionStatus || 'open',
      },
    });
  } catch (error) {
    console.error('Error fetching rider values:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rider values', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// UPDATE rider values for a Full Grid game
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { adminUserId, riderValues } = await request.json() as {
      adminUserId: string;
      riderValues: Record<string, number>;
    };

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    if (!riderValues || typeof riderValues !== 'object') {
      return NextResponse.json(
        { error: 'Rider values object is required' },
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

    // Get game details
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    if (gameData?.gameType !== 'full-grid') {
      return NextResponse.json(
        { error: 'Game is not a Full Grid game' },
        { status: 400 }
      );
    }

    // Validate rider values (should be numbers >= 0)
    for (const [riderId, value] of Object.entries(riderValues)) {
      if (typeof value !== 'number' || value < 0) {
        return NextResponse.json(
          { error: `Invalid value for rider ${riderId}: must be a non-negative number` },
          { status: 400 }
        );
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
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'FULL_GRID_RIDER_VALUES_UPDATED',
      userId: adminUserId,
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

    return NextResponse.json({
      success: true,
      message: 'Rider values updated successfully',
      totalRiders: Object.keys(riderValues).length,
    });
  } catch (error) {
    console.error('Error updating rider values:', error);
    return NextResponse.json(
      { error: 'Failed to update rider values', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
