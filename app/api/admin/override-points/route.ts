import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendAdminNotification } from '@/lib/email/admin-notifications';

export interface OverrideRequest {
  gameId: string;
  participantUserId: string;
  riderNameId: string;
  overrideType: 'add' | 'subtract' | 'set';
  pointsValue: number;
  reason: string;
  adminUserId: string;
}

export interface OverrideResult {
  success: boolean;
  previousValue: number;
  newValue: number;
  delta: number;
  overrideId: string;
  error?: string;
}

// GET /api/admin/override-points - Get override history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const gameId = searchParams.get('gameId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Build query
    let query = db.collection('pointsOverrides').orderBy('createdAt', 'desc').limit(limit);

    if (gameId) {
      query = db
        .collection('pointsOverrides')
        .where('gameId', '==', gameId)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();

    const overrides = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ overrides });
  } catch (error) {
    console.error('Error fetching override history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch override history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/override-points - Create a points override
export async function POST(request: NextRequest) {
  try {
    const body: OverrideRequest = await request.json();
    const {
      gameId,
      participantUserId,
      riderNameId,
      overrideType,
      pointsValue,
      reason,
      adminUserId,
    } = body;

    // Validate required fields
    if (!gameId || !participantUserId || !riderNameId || !overrideType || pointsValue === undefined || !reason || !adminUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['add', 'subtract', 'set'].includes(overrideType)) {
      return NextResponse.json(
        { error: 'Invalid override type. Must be add, subtract, or set' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(adminUserId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Find the playerTeam document
    const playerTeamsQuery = await db
      .collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', participantUserId)
      .where('riderNameId', '==', riderNameId)
      .limit(1)
      .get();

    if (playerTeamsQuery.empty) {
      return NextResponse.json(
        { error: 'Player team not found for the specified game, user, and rider' },
        { status: 404 }
      );
    }

    const playerTeamDoc = playerTeamsQuery.docs[0];
    const playerTeamData = playerTeamDoc.data();
    const previousValue = playerTeamData.pointsScored || 0;

    // Calculate new value
    let newValue: number;
    switch (overrideType) {
      case 'add':
        newValue = previousValue + pointsValue;
        break;
      case 'subtract':
        newValue = previousValue - pointsValue;
        break;
      case 'set':
        newValue = pointsValue;
        break;
      default:
        newValue = previousValue;
    }

    const delta = newValue - previousValue;

    // Update playerTeam
    await playerTeamDoc.ref.update({
      pointsScored: newValue,
      _lastOverrideAt: new Date().toISOString(),
      _lastOverrideBy: adminUserId,
    });

    // Update gameParticipants total
    const participantsQuery = await db
      .collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', participantUserId)
      .limit(1)
      .get();

    if (!participantsQuery.empty) {
      const participantDoc = participantsQuery.docs[0];
      const participantData = participantDoc.data();
      const currentTotal = participantData.totalPoints || 0;
      const newTotal = currentTotal + delta;

      await participantDoc.ref.update({
        totalPoints: newTotal,
        _lastOverrideAt: new Date().toISOString(),
      });
    }

    // Create override audit record
    const overrideRecord = {
      gameId,
      participantUserId,
      riderNameId,
      riderName: playerTeamData.riderName || riderNameId,
      overrideType,
      pointsValue,
      previousValue,
      newValue,
      delta,
      reason,
      createdBy: adminUserId,
      createdAt: new Date().toISOString(),
      reversed: false,
    };

    const overrideRef = await db.collection('pointsOverrides').add(overrideRecord);

    // Send notification
    await sendAdminNotification('points_override', {
      gameId,
      userId: adminUserId,
      details: {
        participantUserId,
        riderNameId,
        overrideType,
        pointsValue,
        previousValue,
        newValue,
        reason,
      },
    });

    // Log activity
    await db.collection('activityLogs').add({
      type: 'points_override',
      adminUserId,
      gameId,
      participantUserId,
      riderNameId,
      overrideType,
      previousValue,
      newValue,
      reason,
      timestamp: new Date().toISOString(),
    });

    const result: OverrideResult = {
      success: true,
      previousValue,
      newValue,
      delta,
      overrideId: overrideRef.id,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating points override:', error);
    return NextResponse.json(
      { error: 'Failed to create points override', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/override-points - Reverse an override
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const overrideId = searchParams.get('overrideId');
    const userId = searchParams.get('userId');
    const reason = searchParams.get('reason') || 'Override reversed';

    if (!overrideId || !userId) {
      return NextResponse.json(
        { error: 'Override ID and User ID are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get the override record
    const overrideDoc = await db.collection('pointsOverrides').doc(overrideId).get();
    if (!overrideDoc.exists) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    const overrideData = overrideDoc.data();
    if (!overrideData) {
      return NextResponse.json(
        { error: 'Override data is empty' },
        { status: 404 }
      );
    }

    if (overrideData.reversed) {
      return NextResponse.json(
        { error: 'Override has already been reversed' },
        { status: 400 }
      );
    }

    const { gameId, participantUserId, riderNameId, delta } = overrideData;

    // Reverse the playerTeam points
    const playerTeamsQuery = await db
      .collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', participantUserId)
      .where('riderNameId', '==', riderNameId)
      .limit(1)
      .get();

    if (!playerTeamsQuery.empty) {
      const playerTeamDoc = playerTeamsQuery.docs[0];
      const currentPoints = playerTeamDoc.data().pointsScored || 0;
      await playerTeamDoc.ref.update({
        pointsScored: currentPoints - delta,
        _lastOverrideAt: new Date().toISOString(),
        _lastOverrideBy: userId,
      });
    }

    // Reverse the gameParticipants total
    const participantsQuery = await db
      .collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', participantUserId)
      .limit(1)
      .get();

    if (!participantsQuery.empty) {
      const participantDoc = participantsQuery.docs[0];
      const currentTotal = participantDoc.data().totalPoints || 0;
      await participantDoc.ref.update({
        totalPoints: currentTotal - delta,
        _lastOverrideAt: new Date().toISOString(),
      });
    }

    // Mark override as reversed
    await overrideDoc.ref.update({
      reversed: true,
      reversedAt: new Date().toISOString(),
      reversedBy: userId,
      reversalReason: reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Override reversed successfully',
    });
  } catch (error) {
    console.error('Error reversing override:', error);
    return NextResponse.json(
      { error: 'Failed to reverse override', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
