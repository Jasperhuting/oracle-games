import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { GameResponse, ApiErrorResponse, ClientGame, UpdateGameResponse, DeleteGameResponse, UpdateGameRequest } from '@/lib/types';

// Helper to remove undefined values from object (recursively)
function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const key in obj) {
    const value = obj[key];
    if (value !== undefined) {
      // Recursively clean nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = removeUndefinedFields(value as Record<string, unknown>) as T[Extract<keyof T, string>];
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

// GET a specific game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<GameResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await params;
    const db = getServerFirebase();

    const gameDoc = await db.collection('games').doc(gameId).get();

    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const data = gameDoc.data();

    // Convert Timestamp objects in auctionPeriods to ISO strings
    let config = data?.config;
    if (config?.auctionPeriods) {
      config = {
        ...config,
        auctionPeriods: config.auctionPeriods.map((period: any) => ({
          ...period,
          startDate: period.startDate?.toDate?.()?.toISOString() || period.startDate,
          endDate: period.endDate?.toDate?.()?.toISOString() || period.endDate,
          finalizeDate: period.finalizeDate?.toDate?.()?.toISOString() || period.finalizeDate,
        })),
      };
    }

    // Remove timestamp fields before spreading to avoid conflicts
    const { createdAt, updatedAt, registrationOpenDate, registrationCloseDate, teamSelectionDeadline, raceRef, config: _config, ...restData } = data || {};

    // Helper to convert Firestore Timestamp to ISO string
    const convertTimestamp = (ts: any) => {
      if (!ts) return undefined;
      if (typeof ts === 'string') return ts;
      if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
      if (ts.toDate) return ts.toDate().toISOString();
      return ts;
    };

    return NextResponse.json({
      success: true,
      game: {
        id: gameDoc.id,
        ...restData,
        config,
        createdAt: convertTimestamp(createdAt) || createdAt,
        updatedAt: convertTimestamp(updatedAt) || updatedAt,
        registrationOpenDate: convertTimestamp(registrationOpenDate),
        registrationCloseDate: convertTimestamp(registrationCloseDate),
        teamSelectionDeadline: convertTimestamp(teamSelectionDeadline),
        raceRef: raceRef?.path || raceRef,
      } as ClientGame,
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// UPDATE a game (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<UpdateGameResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await params;
    const updates: UpdateGameRequest = await request.json();
    const { adminUserId } = updates;

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

    // Get current game data BEFORE update for comparison
    const currentGameDoc = await db.collection('games').doc(gameId).get();
    if (!currentGameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    const currentGameData = currentGameDoc.data();

    // Separate adminUserId from the actual update fields
    const { adminUserId: _adminUserId, ...gameUpdates } = updates;

    // Add updatedAt timestamp
    gameUpdates.updatedAt = new Date();

    // Convert teamSelectionDeadline to Firestore Timestamp if provided
    if (gameUpdates.teamSelectionDeadline) {
      gameUpdates.teamSelectionDeadline = Timestamp.fromDate(new Date(gameUpdates.teamSelectionDeadline));
    }

    // Remove undefined fields before updating Firestore
    const cleanedUpdates = removeUndefinedFields(gameUpdates);

    // Update game
    await db.collection('games').doc(gameId).update(cleanedUpdates);

    // Get updated game
    const updatedGame = await db.collection('games').doc(gameId).get();
    const data = updatedGame.data();

    // Build detailed change log
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key in cleanedUpdates) {
      if (key !== 'updatedAt') {
        changes[key] = {
          before: currentGameData?.[key],
          after: cleanedUpdates[key],
        };
      }
    }

    // Log the activity
    const adminData = adminDoc.data();
    const activityLogData = removeUndefinedFields({
      action: 'GAME_UPDATED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        gameId,
        gameName: data?.name,
        gameType: data?.gameType,
        gameYear: data?.year,
        updatedFields: Object.keys(cleanedUpdates).filter(k => k !== 'updatedAt'),
        changes,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });
    await db.collection('activityLogs').add(activityLogData);

    // Convert Timestamp objects in auctionPeriods to ISO strings
    let config = data?.config;
    if (config?.auctionPeriods) {
      config = {
        ...config,
        auctionPeriods: config.auctionPeriods.map((period: any) => ({
          ...period,
          startDate: period.startDate?.toDate?.()?.toISOString() || period.startDate,
          endDate: period.endDate?.toDate?.()?.toISOString() || period.endDate,
          finalizeDate: period.finalizeDate?.toDate?.()?.toISOString() || period.finalizeDate,
        })),
      };
    }

    // Remove timestamp fields before spreading to avoid conflicts
    const { createdAt: patchCreatedAt, updatedAt: patchUpdatedAt, registrationOpenDate: patchRegOpenDate, registrationCloseDate: patchRegCloseDate, teamSelectionDeadline: patchTeamDeadline, raceRef: patchRaceRef, config: _patchConfig, ...patchRestData } = data || {};

    // Helper to convert Firestore Timestamp to ISO string
    const convertTimestampPatch = (ts: any) => {
      if (!ts) return undefined;
      if (typeof ts === 'string') return ts;
      if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
      if (ts.toDate) return ts.toDate().toISOString();
      return ts;
    };

    return NextResponse.json({
      success: true,
      game: {
        id: gameId,
        ...patchRestData,
        config,
        createdAt: convertTimestampPatch(patchCreatedAt) || patchCreatedAt,
        updatedAt: convertTimestampPatch(patchUpdatedAt) || patchUpdatedAt,
        registrationOpenDate: convertTimestampPatch(patchRegOpenDate),
        registrationCloseDate: convertTimestampPatch(patchRegCloseDate),
        teamSelectionDeadline: convertTimestampPatch(patchTeamDeadline),
        raceRef: patchRaceRef?.path || patchRaceRef,
      } as ClientGame,
    });
  } catch (error) {
    console.error('Error updating game:', error);
    return NextResponse.json(
      { error: 'Failed to update game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE a game (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<DeleteGameResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await params;
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

    // Get game before deletion for logging
    const gameDoc = await db.collection('games').doc(gameId).get();
    const gameData = gameDoc.data();

    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    console.log(`[DELETE_GAME] Starting deletion of game ${gameId} and all related data`);

    // Track what we delete for logging
    const deletionStats = {
      bids: 0,
      participants: 0,
      playerTeams: 0,
      leagues: 0,
      stagePicks: 0,
      draftPicks: 0,
    };

    // 1. Delete all bids for this game
    console.log(`[DELETE_GAME] Deleting bids...`);
    const bidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .get();
    
    for (const bidDoc of bidsSnapshot.docs) {
      await bidDoc.ref.delete();
      deletionStats.bids++;
    }
    console.log(`[DELETE_GAME] Deleted ${deletionStats.bids} bids`);

    // 2. Delete all game participants
    console.log(`[DELETE_GAME] Deleting participants...`);
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    for (const participantDoc of participantsSnapshot.docs) {
      await participantDoc.ref.delete();
      deletionStats.participants++;
    }
    console.log(`[DELETE_GAME] Deleted ${deletionStats.participants} participants`);

    // Also delete pending participants for division games
    // When a division game is deleted, we need to clean up pending participants
    // that are waiting to be assigned to this specific division
    const division = gameData?.division; // e.g., "Division 1"
    if (division && gameData?.divisionCount && gameData.divisionCount > 1) {
      console.log(`[DELETE_GAME] This is a division game (${division}), checking for pending participants...`);

      // Find the base game ID by looking for related games
      const relatedGamesSnapshot = await db.collection('games')
        .where('year', '==', gameData.year)
        .where('gameType', '==', gameData.gameType)
        .where('divisionCount', '==', gameData.divisionCount)
        .get();

      // Find a game that shares the same base name (without division suffix)
      const baseName = gameData.name?.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
      let baseGameId: string | null = null;

      for (const doc of relatedGamesSnapshot.docs) {
        const docData = doc.data();
        const docBaseName = docData.name?.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
        if (docBaseName === baseName && doc.id !== gameId) {
          baseGameId = doc.id;
          break;
        }
      }

      if (baseGameId) {
        const pendingGameId = `${baseGameId}-pending`;
        console.log(`[DELETE_GAME] Checking for pending participants with gameId: ${pendingGameId}`);

        // Get all pending participants
        const pendingParticipantsSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', pendingGameId)
          .get();

        // Check if there are any remaining division games
        const remainingDivisions = relatedGamesSnapshot.docs.filter(doc => doc.id !== gameId);

        if (remainingDivisions.length === 0) {
          // No more divisions left, delete all pending participants
          console.log(`[DELETE_GAME] No divisions remaining, deleting all ${pendingParticipantsSnapshot.size} pending participants`);
          for (const pendingDoc of pendingParticipantsSnapshot.docs) {
            await pendingDoc.ref.delete();
            deletionStats.participants++;
          }
        } else {
          console.log(`[DELETE_GAME] ${remainingDivisions.length} division(s) remaining, keeping pending participants`);
        }
      }
    }

    // 3. Delete all player teams
    console.log(`[DELETE_GAME] Deleting player teams...`);
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .get();
    
    for (const teamDoc of playerTeamsSnapshot.docs) {
      await teamDoc.ref.delete();
      deletionStats.playerTeams++;
    }
    console.log(`[DELETE_GAME] Deleted ${deletionStats.playerTeams} player teams`);

    // 4. Delete all leagues for this game
    console.log(`[DELETE_GAME] Deleting leagues...`);
    const leaguesSnapshot = await db.collection('leagues')
      .where('gameId', '==', gameId)
      .get();
    
    for (const leagueDoc of leaguesSnapshot.docs) {
      await leagueDoc.ref.delete();
      deletionStats.leagues++;
    }
    console.log(`[DELETE_GAME] Deleted ${deletionStats.leagues} leagues`);

    // 5. Delete all stage picks (for Carry Me Home, Fan Flandrien, etc.)
    console.log(`[DELETE_GAME] Deleting stage picks...`);
    const stagePicksSnapshot = await db.collection('stagePicks')
      .where('gameId', '==', gameId)
      .get();
    
    for (const pickDoc of stagePicksSnapshot.docs) {
      await pickDoc.ref.delete();
      deletionStats.stagePicks++;
    }
    console.log(`[DELETE_GAME] Deleted ${deletionStats.stagePicks} stage picks`);

    // 6. Delete all draft picks (for Poisoned Cup, Rising Stars, etc.)
    console.log(`[DELETE_GAME] Deleting draft picks...`);
    const draftPicksSnapshot = await db.collection('draftPicks')
      .where('gameId', '==', gameId)
      .get();
    
    for (const draftDoc of draftPicksSnapshot.docs) {
      await draftDoc.ref.delete();
      deletionStats.draftPicks++;
    }
    console.log(`[DELETE_GAME] Deleted ${deletionStats.draftPicks} draft picks`);

    // 7. Finally, delete the game itself
    console.log(`[DELETE_GAME] Deleting game document...`);
    await db.collection('games').doc(gameId).delete();

    console.log(`[DELETE_GAME] Deletion complete:`, deletionStats);

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'GAME_DELETED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        gameId,
        gameName: gameData?.name,
        gameType: gameData?.gameType,
        deletionStats,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Game and all related data deleted successfully',
      deletionStats,
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json(
      { error: 'Failed to delete game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
