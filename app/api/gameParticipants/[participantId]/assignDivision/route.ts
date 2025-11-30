import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// POST - Assign a participant to a division (admin only)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await context.params;
    const { adminUserId, assignedDivision } = await request.json();

    if (!adminUserId || !assignedDivision) {
      return NextResponse.json(
        { error: 'Admin user ID and assigned division are required' },
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

    // Get participant
    const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantData = participantDoc.data();
    const currentGameId = participantData?.gameId || '';
    const isPending = currentGameId.endsWith('-pending');

    // For pending participants, extract the base gameId
    const baseGameId = isPending ? currentGameId.replace(/-pending$/, '') : currentGameId;

    // Get game to verify it's a multi-division game
    const gameDoc = await db.collection('games').doc(baseGameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const divisionCount = gameData?.divisionCount || 1;

    if (divisionCount <= 1) {
      return NextResponse.json(
        { error: 'This is a single-division game, division assignment is not required' },
        { status: 400 }
      );
    }

    // Find the specific division game based on the assigned division
    // The division name is like "Division 1", we need to find the game with that division
    const gameName = gameData?.name || '';
    const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
    const targetGameName = `${baseName} - ${assignedDivision}`;

    // Find the target division game
    const divisionGamesSnapshot = await db.collection('games')
      .where('year', '==', gameData?.year)
      .where('gameType', '==', gameData?.gameType)
      .get();

    let targetGameId: string | null = null;
    divisionGamesSnapshot.forEach(doc => {
      const docData = doc.data();
      if (docData?.name === targetGameName) {
        targetGameId = doc.id;
      }
    });

    if (!targetGameId) {
      return NextResponse.json(
        { error: `Could not find division game for ${assignedDivision}` },
        { status: 404 }
      );
    }

    // Update participant with the actual division gameId and division assignment
    await participantDoc.ref.update({
      gameId: targetGameId, // Change from pending to actual division gameId
      assignedDivision: assignedDivision,
      divisionAssigned: true,
      status: 'active',
    });

    // Increment player count for the target division game
    const targetGameDoc = await db.collection('games').doc(targetGameId).get();
    if (targetGameDoc.exists) {
      const targetGameData = targetGameDoc.data();
      await targetGameDoc.ref.update({
        playerCount: (targetGameData?.playerCount || 0) + 1,
      });
    }

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'DIVISION_ASSIGNED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        participantId: participantId,
        previousGameId: currentGameId,
        newGameId: targetGameId,
        gameName: targetGameName,
        playerName: participantData?.playername,
        assignedDivision: assignedDivision,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Participant assigned to ${assignedDivision}`,
      participant: {
        id: participantId,
        assignedDivision: assignedDivision,
        divisionAssigned: true,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Error assigning division:', error);

    // Log the error to activity log
    try {
      const body = await request.json().catch(() => ({}));
      const { adminUserId } = body;

      if (adminUserId) {
        const db = getServerFirebase();
        const adminDoc = await db.collection('users').doc(adminUserId).get();
        const adminData = adminDoc.data();

        await db.collection('activityLogs').add({
          action: 'ERROR',
          userId: adminUserId,
          userEmail: adminData?.email,
          userName: adminData?.playername || adminData?.email,
          details: {
            operation: 'Assign Division',
            errorMessage: error instanceof Error ? error.message : 'Unknown error assigning division',
            errorDetails: error instanceof Error ? error.stack : undefined,
            endpoint: '/api/gameParticipants/[participantId]/assignDivision',
          },
          timestamp: new Date().toISOString(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }
    } catch (logError) {
      // Silently fail if we can't log the error
      console.error('Failed to log error to activity log:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to assign division', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a participant from a game (admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await context.params;
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

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

    // Get participant before deletion
    const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantData = participantDoc.data();
    const gameId = participantData?.gameId || '';
    const isPending = gameId.endsWith('-pending');

    // Get game data
    const baseGameId = isPending ? gameId.replace(/-pending$/, '') : gameId;
    const gameDoc = await db.collection('games').doc(baseGameId).get();

    if (gameDoc.exists && !isPending) {
      // Decrement player count for non-pending participants
      const gameData = gameDoc.data();
      await gameDoc.ref.update({
        playerCount: Math.max(0, (gameData?.playerCount || 1) - 1),
      });
    }

    // Delete participant
    await participantDoc.ref.delete();

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'PARTICIPANT_REMOVED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      targetUserId: participantData?.userId,
      targetUserName: participantData?.playername,
      targetUserEmail: participantData?.userEmail,
      details: {
        participantId: participantId,
        gameId: baseGameId,
        gameName: gameDoc.exists ? gameDoc.data()?.name : 'Unknown',
        playerName: participantData?.playername,
        assignedDivision: participantData?.assignedDivision,
        wasPending: isPending,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Participant removed successfully',
    });
  } catch (error) {
    console.error('Error removing participant:', error);

    // Log the error to activity log
    try {
      const { searchParams } = new URL(request.url);
      const adminUserId = searchParams.get('adminUserId');

      if (adminUserId) {
        const db = getServerFirebase();
        const adminDoc = await db.collection('users').doc(adminUserId).get();
        const adminData = adminDoc.data();

        await db.collection('activityLogs').add({
          action: 'ERROR',
          userId: adminUserId,
          userEmail: adminData?.email,
          userName: adminData?.playername || adminData?.email,
          details: {
            operation: 'Remove Participant',
            errorMessage: error instanceof Error ? error.message : 'Unknown error removing participant',
            errorDetails: error instanceof Error ? error.stack : undefined,
            endpoint: '/api/gameParticipants/[participantId]/assignDivision',
          },
          timestamp: new Date().toISOString(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }
    } catch (logError) {
      // Silently fail if we can't log the error
      console.error('Failed to log error to activity log:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to remove participant', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
