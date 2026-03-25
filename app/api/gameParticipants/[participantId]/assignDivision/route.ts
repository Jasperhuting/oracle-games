import { adminHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// POST - Assign a participant to a division (admin only)
export const POST = adminHandler('assign-division-post', async ({ uid, request, params }) => {
  const { participantId } = params;
  const { assignedDivision } = await request.json();

  // Allow assignedDivision to be null/empty for "unassign" action
  if (!assignedDivision) {
    throw new ApiError('Assigned division is required (use "unassigned" to remove division)', 400);
  }

  const db = getServerFirebase();

  // Get participant
  const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
  if (!participantDoc.exists) {
    throw new ApiError('Participant not found', 404);
  }

  const participantData = participantDoc.data();
  const currentGameId = participantData?.gameId || '';
  const isPending = currentGameId.endsWith('-pending');

  // For pending participants, extract the base gameId
  const baseGameId = isPending ? currentGameId.replace(/-pending$/, '') : currentGameId;

  // Get game to verify it's a multi-division game
  const gameDoc = await db.collection('games').doc(baseGameId).get();
  if (!gameDoc.exists) {
    throw new ApiError('Game not found', 404);
  }

  const gameData = gameDoc.data();
  const divisionCount = gameData?.divisionCount || 1;

  if (divisionCount <= 1) {
    throw new ApiError('This is a single-division game, division assignment is not required', 400);
  }

  // Fetch admin doc for activity log
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();

  // Handle "unassigned" - move participant back to pending
  if (assignedDivision.toLowerCase() === 'unassigned') {
    const pendingGameId = `${baseGameId}-pending`;

    // Decrement player count from current division if assigned
    if (!isPending && participantData?.divisionAssigned) {
      const currentGameDoc = await db.collection('games').doc(currentGameId).get();
      if (currentGameDoc.exists) {
        const currentGameData = currentGameDoc.data();
        await currentGameDoc.ref.update({
          playerCount: Math.max(0, (currentGameData?.playerCount || 1) - 1),
        });
      }
    }

    // Update participant to pending state
    await participantDoc.ref.update({
      gameId: pendingGameId,
      assignedDivision: null,
      divisionAssigned: false,
      status: 'active',
    });

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'DIVISION_UNASSIGNED',
      userId: uid,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        participantId: participantId,
        previousGameId: currentGameId,
        newGameId: pendingGameId,
        playerName: participantData?.playername,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return {
      success: true,
      message: 'Participant unassigned from division',
      participant: {
        id: participantId,
        assignedDivision: null,
        divisionAssigned: false,
        status: 'active',
      },
    };
  }

  // Find the specific division game based on the assigned division
  // The division name is like "Division 1", we need to find the game with that division
  const gameName = gameData?.name || '';

  // Extract base name by removing division suffix
  // Examples: "Game Name - Division 1" -> "Game Name"
  //           "Game Name - Season (test) - Division 1" -> "Game Name - Season (test)"
  const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
  const targetGameName = `${baseName} - ${assignedDivision}`;

  // Find the target division game
  // Try multiple strategies to find the game:
  // 1. Exact name match
  // 2. Match by division field (more reliable for multi-division games)
  // 3. Extract division from name if division field is empty
  // Use a broader search to handle edge cases
  const divisionGamesSnapshot = await db.collection('games').get();

  let targetGameId: string | null = null;
  const availableGames: { name: string; division?: string; divisionCount?: number }[] = [];

  divisionGamesSnapshot.forEach(doc => {
    const docData = doc.data();
    const docName = docData?.name || '';
    availableGames.push({
      name: docName,
      division: docData?.division,
      divisionCount: docData?.divisionCount,
    });

    // Strategy 1: Exact name match
    if (docName === targetGameName) {
      targetGameId = doc.id;
    }

    // Strategy 2: Match by division field (fallback)
    // Check if the game has the same base name pattern and matching division field
    if (!targetGameId && docData?.division === assignedDivision && docData?.divisionCount === divisionCount) {
      const docBaseName = docName.replace(/\s*-\s*.*Division\s+\d+\s*$/i, '').trim();
      if (docBaseName === baseName) {
        targetGameId = doc.id;
      }
    }

    // Strategy 3: Extract division from name if division field is empty
    // For games where division field is empty but name contains "Division X"
    if (!targetGameId && (!docData?.division || docData.division.trim() === '')) {
      const docBaseName = docName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
      const match = docName.match(/Division\s+(\d+)/i);
      if (match && docBaseName === baseName) {
        const extractedDivision = `Division ${match[1]}`;
        if (extractedDivision === assignedDivision) {
          targetGameId = doc.id;
        }
      }
    }
  });

  if (!targetGameId) {
    console.error('Division game search failed:', {
      targetGameName,
      baseName,
      assignedDivision,
      availableGames,
      year: gameData?.year,
      gameType: gameData?.gameType,
    });

    throw new ApiError(`Could not find division game for ${assignedDivision}`, 404);
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
  await db.collection('activityLogs').add({
    action: 'DIVISION_ASSIGNED',
    userId: uid,
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
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: `Participant assigned to ${assignedDivision}`,
    participant: {
      id: participantId,
      assignedDivision: assignedDivision,
      divisionAssigned: true,
      status: 'active',
    },
  };
});

// DELETE - Remove a participant from a game (admin only)
export const DELETE = adminHandler('assign-division-delete', async ({ uid, request, params }) => {
  const { participantId } = params;

  const db = getServerFirebase();

  // Get participant before deletion
  const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
  if (!participantDoc.exists) {
    throw new ApiError('Participant not found', 404);
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
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();
  await db.collection('activityLogs').add({
    action: 'PARTICIPANT_REMOVED',
    userId: uid,
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
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: 'Participant removed successfully',
  };
});
