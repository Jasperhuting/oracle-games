import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
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

    return NextResponse.json({
      success: true,
      game: {
        id: gameDoc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
        registrationOpenDate: data?.registrationOpenDate?.toDate?.()?.toISOString(),
        registrationCloseDate: data?.registrationCloseDate?.toDate?.()?.toISOString(),
        raceRef: data?.raceRef?.path || data?.raceRef,
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
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });
    await db.collection('activityLogs').add(activityLogData);

    return NextResponse.json({
      success: true,
      game: {
        id: gameId,
        ...data,
        createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
        registrationOpenDate: data?.registrationOpenDate?.toDate?.()?.toISOString(),
        registrationCloseDate: data?.registrationCloseDate?.toDate?.()?.toISOString(),
        raceRef: data?.raceRef?.path || data?.raceRef,
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
      timestamp: new Date().toISOString(),
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
