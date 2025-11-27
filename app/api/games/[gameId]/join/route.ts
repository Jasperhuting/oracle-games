import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { GameParticipant } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
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

    const userData = userDoc.data();

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    // Check if game is accepting registrations
    if (gameData?.status !== 'registration' && gameData?.status !== 'draft') {
      return NextResponse.json(
        { error: 'Game is not accepting registrations' },
        { status: 400 }
      );
    }

    // For multi-division games, check if user has joined ANY division of this game
    const divisionCount = gameData?.divisionCount || 1;
    const isMultiDivision = divisionCount > 1;

    if (isMultiDivision) {
      // Get the base name (remove " - Division X" suffix)
      const gameName = gameData?.name || '';
      const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();

      // Find all games with the same base name
      const relatedGamesSnapshot = await db.collection('games')
        .where('year', '==', gameData?.year)
        .where('gameType', '==', gameData?.gameType)
        .get();

      const relatedGameIds: string[] = [];
      relatedGamesSnapshot.forEach(doc => {
        const docData = doc.data();
        const docBaseName = (docData?.name || '').replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
        if (docBaseName === baseName) {
          relatedGameIds.push(doc.id);
        }
      });

      // Check if user has already joined any related division
      // For multi-division, we need to check both actual gameIds and pending gameIds
      const pendingGameIds = relatedGameIds.map(id => `${id}-pending`);
      const allGameIdsToCheck = [...relatedGameIds, ...pendingGameIds];

      if (allGameIdsToCheck.length > 0) {
        // Check in batches if more than 10 (Firestore 'in' limit)
        const batchSize = 10;
        for (let i = 0; i < allGameIdsToCheck.length; i += batchSize) {
          const batch = allGameIdsToCheck.slice(i, i + batchSize);
          const existingParticipantInGroup = await db.collection('gameParticipants')
            .where('gameId', 'in', batch)
            .where('userId', '==', userId)
            .limit(1)
            .get();

          if (!existingParticipantInGroup.empty) {
            return NextResponse.json(
              { error: 'You have already joined this game. Please wait for division assignment.' },
              { status: 409 }
            );
          }
        }
      }
    } else {
      // For single-division games, just check this specific game
      const existingParticipant = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!existingParticipant.empty) {
        return NextResponse.json(
          { error: 'User is already a participant in this game' },
          { status: 409 }
        );
      }
    }

    // Check if game is full
    if (gameData?.maxPlayers && gameData?.playerCount >= gameData?.maxPlayers) {
      return NextResponse.json(
        { error: 'Game is full' },
        { status: 400 }
      );
    }

    // Create participant
    const now = new Date();

    // For multi-division games, create a temporary participant entry
    // The admin will later assign them to a specific division
    const participant: GameParticipant = {
      gameId: isMultiDivision ? `${gameId}-pending` : gameId, // Use temporary gameId for multi-division
      userId,
      playername: userData?.playername || userData?.email,
      joinedAt: now,
      status: 'active',
      budget: gameData?.config?.budget || 0,
      spentBudget: 0,
      teamName: undefined,
      rosterSize: 0,
      rosterComplete: false,
      totalPoints: 0,
      ranking: 0,
      leagueIds: [],
      divisionAssigned: !isMultiDivision, // false for multi-division, true for single
    };

    // Store metadata for multi-division games
    if (isMultiDivision) {
      // Store the base game information for admin assignment
      const gameName = gameData?.name || '';
      const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
      participant.pendingGameBaseName = baseName;
      participant.pendingGameType = gameData?.gameType;
      participant.pendingGameYear = gameData?.year;
      participant.pendingGameId = gameId; // Store which division they tried to join (for reference)
    } else {
      participant.assignedDivision = gameData?.division || 'Main';
    }

    const participantRef = await db.collection('gameParticipants').add(participant);

    // For multi-division: don't increment player count yet (admin will do that on assignment)
    // For single-division: increment player count normally
    if (!isMultiDivision) {
      await db.collection('games').doc(gameId).update({
        playerCount: (gameData?.playerCount || 0) + 1,
      });
    }

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'GAME_JOINED',
      userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        participantId: participantRef.id,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      participantId: participantRef.id,
      participant: {
        id: participantRef.id,
        ...participant,
        joinedAt: (participant.joinedAt as Date).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error joining game:', error);
    return NextResponse.json(
      { error: 'Failed to join game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Leave a game
export async function DELETE(
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

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    // Check if game allows leaving (e.g., not started yet)
    if (gameData?.status === 'active' || gameData?.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot leave a game that has already started or completed' },
        { status: 400 }
      );
    }

    // Find participant - check both normal gameId and pending gameId
    let participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    // If not found, try with pending gameId
    if (participantSnapshot.empty) {
      participantSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', `${gameId}-pending`)
        .where('userId', '==', userId)
        .limit(1)
        .get();
    }

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: 'User is not a participant in this game' },
        { status: 404 }
      );
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();
    const isPendingParticipant = participantData?.gameId?.endsWith('-pending');

    // Delete participant
    await participantDoc.ref.delete();

    // Only decrement player count if it's not a pending participant
    // (pending participants don't increment the count)
    if (!isPendingParticipant) {
      await db.collection('games').doc(gameId).update({
        playerCount: Math.max(0, (gameData?.playerCount || 1) - 1),
      });
    }

    // Log the activity
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'GAME_LEFT',
      userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        participantId: participantDoc.id,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully left the game',
    });
  } catch (error) {
    console.error('Error leaving game:', error);
    return NextResponse.json(
      { error: 'Failed to leave game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
