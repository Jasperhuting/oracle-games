import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// GET player's team for a game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get user's team for this game
    const teamSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    const riders = teamSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nameId: data.riderNameId,
        name: data.riderName,
        team: data.riderTeam,
        country: data.riderCountry,
        rank: data.riderRank || 0,
        points: data.pointsScored || 0,
        jerseyImage: data.jerseyImage,
        pricePaid: data.pricePaid,
        acquisitionType: data.acquisitionType,
        draftRound: data.draftRound,
        draftPick: data.draftPick,
        racePoints: data.racePoints || null,
      };
    });

    return NextResponse.json({
      success: true,
      riders,
      count: riders.length,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Save/Update player's team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { userId, participantId, riders } = await request.json();

    if (!userId || !participantId) {
      return NextResponse.json(
        { error: 'User ID and participant ID are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(riders)) {
      return NextResponse.json(
        { error: 'Riders must be an array' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify participant exists and belongs to user
    const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantData = participantDoc.data();
    if (participantData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - participant does not belong to user' },
        { status: 403 }
      );
    }

    if (participantData?.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Participant does not belong to this game' },
        { status: 400 }
      );
    }

    // Get game config to validate roster size and budget
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const config = gameData?.config || {};

    // Validate roster size
    if (config.maxRiders && riders.length > config.maxRiders) {
      return NextResponse.json(
        { error: `Team exceeds maximum of ${config.maxRiders} riders` },
        { status: 400 }
      );
    }

    if (config.minRiders && riders.length < config.minRiders) {
      return NextResponse.json(
        { error: `Team needs at least ${config.minRiders} riders` },
        { status: 400 }
      );
    }

    // Get current team to determine what to add/remove
    const currentTeamSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    const currentRiderIds = new Set(
      currentTeamSnapshot.docs.map(doc => doc.data().riderNameId)
    );
    const newRiderIds = new Set(riders.map(r => r.nameId));

    // Determine riders to add and remove
    const ridersToAdd = riders.filter(r => !currentRiderIds.has(r.nameId));
    const ridersToRemove = Array.from(currentRiderIds).filter(id => !newRiderIds.has(id));

    const now = new Date();

    // Remove riders no longer in team
    for (const riderId of ridersToRemove) {
      const docsToRemove = currentTeamSnapshot.docs.filter(
        doc => doc.data().riderNameId === riderId
      );
      for (const doc of docsToRemove) {
        await doc.ref.update({ active: false });
      }
    }

    // Add new riders
    for (const rider of ridersToAdd) {
      await db.collection('playerTeams').add({
        gameId,
        userId,
        riderNameId: rider.nameId,
        riderName: rider.name,
        riderTeam: rider.team || '',
        riderCountry: rider.country || '',
        riderRank: rider.rank || 0,
        jerseyImage: rider.jerseyImage || null,
        acquiredAt: now,
        acquisitionType: 'selection',
        pricePaid: rider.pricePaid || null,
        active: true,
        benched: false,
        pointsScored: 0,
        stagesParticipated: 0,
      });
    }

    // Update participant roster info
    const rosterComplete = config.minRiders ? riders.length >= config.minRiders : riders.length > 0;
    await db.collection('gameParticipants').doc(participantId).update({
      rosterSize: riders.length,
      rosterComplete,
    });

    // Log the activity
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'TEAM_UPDATED',
      userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        ridersAdded: ridersToAdd.length,
        ridersRemoved: ridersToRemove.length,
        totalRiders: riders.length,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Team saved successfully',
      ridersAdded: ridersToAdd.length,
      ridersRemoved: ridersToRemove.length,
      totalRiders: riders.length,
      rosterComplete,
    });
  } catch (error) {
    console.error('Error saving team:', error);
    return NextResponse.json(
      { error: 'Failed to save team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
