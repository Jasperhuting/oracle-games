import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const {
      userId,
      riderNameId,
      acquisitionType,
      pricePaid,
      riderName,
      riderTeam,
      riderCountry,
      jerseyImage,
      riderValue,
    } = await request.json();

    if (!userId || !riderNameId || !acquisitionType) {
      return NextResponse.json(
        { error: 'userId, riderNameId, and acquisitionType are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    // Get participant data
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: 'User is not a participant in this game' },
        { status: 400 }
      );
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();

    // Check if rider is eligible
    if (gameData?.eligibleRiders && gameData.eligibleRiders.length > 0) {
      if (!gameData.eligibleRiders.includes(riderNameId)) {
        return NextResponse.json(
          { error: 'Rider is not eligible for this game' },
          { status: 400 }
        );
      }
    }

    // Check if user already has this rider
    const existingRider = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('riderNameId', '==', riderNameId)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (!existingRider.empty) {
      return NextResponse.json(
        { error: 'Rider is already in your team' },
        { status: 409 }
      );
    }

    // Check roster size limit
    const maxRiders = gameData?.config?.maxRiders || gameData?.config?.teamSize || 999;
    const currentRosterSize = participantData?.rosterSize || 0;

    if (currentRosterSize >= maxRiders) {
      return NextResponse.json(
        { error: 'Team is full' },
        { status: 400 }
      );
    }

    // Check budget if applicable
    if (acquisitionType === 'auction' || acquisitionType === 'selection') {
      const availableBudget = (participantData?.budget || 0) - (participantData?.spentBudget || 0);
      const price = pricePaid || 0;

      if (price > availableBudget) {
        return NextResponse.json(
          { error: 'Insufficient budget' },
          { status: 400 }
        );
      }
    }

    // Create player team entry
    const now = Timestamp.now();
    const playerTeam = {
      gameId,
      userId,
      riderNameId,
      acquiredAt: now,
      acquisitionType,
      pricePaid: pricePaid || 0,
      riderName: riderName || '',
      riderTeam: riderTeam || '',
      riderCountry: riderCountry || '',
      jerseyImage: jerseyImage || null,
      riderValue: riderValue || null,
      active: true,
      benched: false,
      pointsScored: 0,
      stagesParticipated: 0,
      usedInStages: [],
    };

    const teamRef = await db.collection('playerTeams').add(playerTeam);

    // Update participant
    const newRosterSize = currentRosterSize + 1;
    const newSpentBudget = (participantData?.spentBudget || 0) + (pricePaid || 0);
    const rosterComplete = newRosterSize >= maxRiders;

    await participantDoc.ref.update({
      rosterSize: newRosterSize,
      spentBudget: newSpentBudget,
      rosterComplete,
    });

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'RIDER_ADDED_TO_TEAM',
      userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        teamId: teamRef.id,
        riderNameId,
        riderName,
        acquisitionType,
        pricePaid: pricePaid || 0,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      teamId: teamRef.id,
      playerTeam: {
        id: teamRef.id,
        ...playerTeam,
        acquiredAt: playerTeam.acquiredAt.toDate().toISOString(),
      },
      participant: {
        rosterSize: newRosterSize,
        spentBudget: newSpentBudget,
        rosterComplete,
      },
    });
  } catch (error) {
    console.error('Error adding rider to team:', error);
    return NextResponse.json(
      { error: 'Failed to add rider to team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
