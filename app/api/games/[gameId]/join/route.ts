import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseF1 } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { GameParticipant, ClientGameParticipant } from '@/lib/types';
import type { JoinGameRequest, JoinGameResponse, LeaveGameResponse, ApiErrorResponse } from '@/lib/types';
import { joinGameSchema, validateRequest } from '@/lib/validation';
import { jsonWithCacheVersion } from '@/lib/utils/apiCacheHeaders';
import { F1_COLLECTIONS, createParticipantDocId } from '@/app/f1/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<JoinGameResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await params;
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(joinGameSchema, body);
    if (!validation.success) {
      return validation.error;
    }
    
    const { userId } = validation.data;

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
    // For worldtour-manager and marginal-gains, also allow joining during 'bidding' status
    const allowedStatuses = ['registration', 'draft', 'active'];
    if (gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains') {
      allowedStatuses.push('bidding');
    }

    if (!allowedStatuses.includes(gameData?.status)) {
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
    let currentPlayerCount = gameData?.playerCount || 0;
    const maxPlayers = gameData?.maxPlayers;
    
    // For multi-division games, count pending participants across all divisions
    if (isMultiDivision && maxPlayers) {
      // Get the base name for counting total participants
      const gameName = gameData?.name || '';
      const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
      
      // Count all pending participants for this game (across all divisions)
      const pendingParticipantsSnapshot = await db.collection('gameParticipants')
        .where('pendingGameBaseName', '==', baseName)
        .where('pendingGameYear', '==', gameData?.year)
        .where('pendingGameType', '==', gameData?.gameType)
        .get();
      
      currentPlayerCount = pendingParticipantsSnapshot.size;
      console.log(`[JOIN_GAME] Multi-division game ${baseName}: ${currentPlayerCount} pending participants, max ${maxPlayers}`);
    }
    
    if (maxPlayers && currentPlayerCount >= maxPlayers) {
      console.log(`[JOIN_GAME] Game ${gameId} is full: ${currentPlayerCount}/${maxPlayers}`);
      return NextResponse.json(
        { error: `Game is full (${currentPlayerCount}/${maxPlayers} players)` },
        { status: 400 }
      );
    }
    
    console.log(`[JOIN_GAME] Game ${gameId} has space: ${currentPlayerCount}/${maxPlayers || 'unlimited'} players`);

    // Create participant
    const now = Timestamp.now();

    // Build participant object - compute multi-division fields upfront
    const gameName = gameData?.name || '';
    const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
    
    const participant = {
      gameId: isMultiDivision ? `${gameId}-pending` : gameId, // Use temporary gameId for multi-division
      userId,
      playername: userData?.playername || userData?.email,
      userEmail: userData?.email,
      joinedAt: now,
      status: 'active',
      budget: gameData?.config?.budget || 0,
      spentBudget: 0,
      rosterSize: 0,
      rosterComplete: false,
      totalPoints: 0,
      ranking: 0,
      leagueIds: [],
      divisionAssigned: !isMultiDivision, // false for multi-division, true for single
      // Multi-division fields (only set if isMultiDivision)
      ...(isMultiDivision ? {
        pendingGameBaseName: baseName,
        pendingGameType: gameData?.gameType,
        pendingGameYear: gameData?.year,
        pendingGameId: gameId,
      } : {
        assignedDivision: gameData?.division || 'Main',
      }),
    };

    const participantRef = await db.collection('gameParticipants').add(participant);

    // For multi-division: don't increment player count yet (admin will do that on assignment)
    // For single-division: increment player count normally
    if (!isMultiDivision) {
      await db.collection('games').doc(gameId).update({
        playerCount: (gameData?.playerCount || 0) + 1,
      });
    }

    // For F1-prediction games, also create a participant in the F1 database
    if (gameData?.gameType === 'f1-prediction') {
      try {
        const f1Db = getServerFirebaseF1();
        const season = gameData?.year || new Date().getFullYear();
        const f1ParticipantDocId = createParticipantDocId(userId, season);

        // Check if participant already exists in F1 database
        const existingF1Participant = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(f1ParticipantDocId).get();

        if (!existingF1Participant.exists) {
          // Create F1 participant
          await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(f1ParticipantDocId).set({
            userId,
            gameId,
            season,
            displayName: userData?.playername || userData?.name || 'Anonymous',
            joinedAt: now,
            status: 'active',
          });
          console.log(`[JOIN_GAME] Created F1 participant ${f1ParticipantDocId} for user ${userId}`);
        } else {
          console.log(`[JOIN_GAME] F1 participant ${f1ParticipantDocId} already exists for user ${userId}`);
        }
      } catch (f1Error) {
        // Log but don't fail the game join if F1 participant creation fails
        console.error('[JOIN_GAME] Error creating F1 participant:', f1Error);
      }
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
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return jsonWithCacheVersion({
      success: true,
      participantId: participantRef.id,
      participant: {
        id: participantRef.id,
        ...participant,
        joinedAt: participant.joinedAt.toDate().toISOString(),
      } as ClientGameParticipant,
    });
  } catch (error) {
    console.error('Error joining game:', error);

    // Log the error to activity log
    try {
      const { gameId } = await params;
      const body = await request.json().catch(() => ({}));
      const { userId } = body;

      if (userId) {
        const db = getServerFirebase();
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        await db.collection('activityLogs').add({
          action: 'ERROR',
          userId,
          userEmail: userData?.email,
          userName: userData?.playername || userData?.email,
          details: {
            operation: 'Join Game',
            errorMessage: error instanceof Error ? error.message : 'Unknown error joining game',
            errorDetails: error instanceof Error ? error.stack : undefined,
            gameId,
            endpoint: `/api/games/${gameId}/join`,
          },
          timestamp: Timestamp.now(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }
    } catch (logError) {
      // Silently fail if we can't log the error
      console.error('Failed to log error to activity log:', logError);
    }

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
): Promise<NextResponse<LeaveGameResponse | ApiErrorResponse>> {
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
    // For worldtour-manager and marginal-gains, also allow leaving during 'bidding' status
    const canLeaveDuringBidding = gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains';
    const blockedStatuses = canLeaveDuringBidding
      ? ['active', 'completed', 'finished']
      : ['active', 'completed', 'finished', 'bidding'];

    if (blockedStatuses.includes(gameData?.status)) {
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

    console.log(`[LEAVE_GAME] User ${userId} leaving game ${gameId}`);

    // Track what we delete for logging
    const deletionStats = {
      bids: 0,
      playerTeams: 0,
    };

    // 1. Delete all bids from this user for this game
    console.log(`[LEAVE_GAME] Deleting bids...`);
    const bidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();
    
    for (const bidDoc of bidsSnapshot.docs) {
      await bidDoc.ref.delete();
      deletionStats.bids++;
    }
    console.log(`[LEAVE_GAME] Deleted ${deletionStats.bids} bids`);

    // 2. Delete all player teams from this user for this game
    console.log(`[LEAVE_GAME] Deleting player teams...`);
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();
    
    for (const teamDoc of playerTeamsSnapshot.docs) {
      await teamDoc.ref.delete();
      deletionStats.playerTeams++;
    }
    console.log(`[LEAVE_GAME] Deleted ${deletionStats.playerTeams} player teams`);

    // 3. Delete participant
    console.log(`[LEAVE_GAME] Deleting participant...`);
    await participantDoc.ref.delete();

    // Only decrement player count if it's not a pending participant
    // (pending participants don't increment the count)
    if (!isPendingParticipant) {
      await db.collection('games').doc(gameId).update({
        playerCount: Math.max(0, (gameData?.playerCount || 1) - 1),
      });
    }

    // For F1-prediction games, also delete the participant from the F1 database
    if (gameData?.gameType === 'f1-prediction') {
      try {
        const f1Db = getServerFirebaseF1();
        const season = gameData?.year || new Date().getFullYear();
        const f1ParticipantDocId = createParticipantDocId(userId, season);

        const f1ParticipantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(f1ParticipantDocId).get();
        if (f1ParticipantDoc.exists) {
          await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(f1ParticipantDocId).delete();
          console.log(`[LEAVE_GAME] Deleted F1 participant ${f1ParticipantDocId} for user ${userId}`);
        }
      } catch (f1Error) {
        // Log but don't fail the game leave if F1 participant deletion fails
        console.error('[LEAVE_GAME] Error deleting F1 participant:', f1Error);
      }
    }

    console.log(`[LEAVE_GAME] User ${userId} successfully left game ${gameId}:`, deletionStats);

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
        deletionStats,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully left the game and removed all related data',
      deletionStats,
    });
  } catch (error) {
    console.error('Error leaving game:', error);

    // Log the error to activity log
    try {
      const { gameId } = await params;
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');

      if (userId) {
        const db = getServerFirebase();
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        await db.collection('activityLogs').add({
          action: 'ERROR',
          userId,
          userEmail: userData?.email,
          userName: userData?.playername || userData?.email,
          details: {
            operation: 'Leave Game',
            errorMessage: error instanceof Error ? error.message : 'Unknown error leaving game',
            errorDetails: error instanceof Error ? error.stack : undefined,
            gameId,
            endpoint: `/api/games/${gameId}/join`,
          },
          timestamp: Timestamp.now(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }
    } catch (logError) {
      // Silently fail if we can't log the error
      console.error('Failed to log error to activity log:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to leave game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
