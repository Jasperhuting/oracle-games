import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, ClientGame } from '@/lib/types/games';
import { serializeGame } from '@/lib/utils/serializeGame';
import type { CreateGameRequest, CreateGameResponse, CreateMultipleGamesResponse, ApiErrorResponse } from '@/lib/types';
import { createGameSchema, validateRequest } from '@/lib/validation';

// Helper to remove undefined values from object
function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateGameResponse | CreateMultipleGamesResponse | ApiErrorResponse>> {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(createGameSchema, body);
    if (!validation.success) {
      return validation.error;
    }
    
    const gameData = validation.data;
    const { adminUserId } = gameData;

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

    // Validate required fields
    if (!gameData.name || !gameData.gameType || !gameData.year) {
      return NextResponse.json(
        { error: 'Name, gameType, and year are required' },
        { status: 400 }
      );
    }

    // For non-season games, raceSlug is required
    if (gameData.raceType !== 'season' && !gameData.raceSlug) {
      return NextResponse.json(
        { error: 'raceSlug is required for non-season games' },
        { status: 400 }
      );
    }

    // Get race reference if raceSlug is provided
    let raceRefPath: string | undefined;
    if (gameData.raceSlug) {
      const raceDocRef = db.collection('races').doc(gameData.raceSlug);
      const raceDoc = await raceDocRef.get();

      if (!raceDoc.exists) {
        return NextResponse.json(
          { error: 'Race not found' },
          { status: 404 }
        );
      }

      raceRefPath = raceDocRef.path;
    }

    // Create game document(s)
    const now = new Date();
    const divisionCount = gameData.divisionCount || 1;
    const createdGames: { id: string; game: ClientGame }[] = [];

    // If divisionCount > 1, create separate game documents for each division
    if (divisionCount > 1) {
      for (let i = 1; i <= divisionCount; i++) {
        const divisionName = gameData.division
          ? `${gameData.division} ${i}`
          : `Division ${i}`;

        const game: Omit<Game, 'id'> = {
          name: `${gameData.name} - ${divisionName}`,
          gameType: gameData.gameType,
          ...(raceRefPath && { raceRef: raceRefPath }), // Only include raceRef if it exists
          raceType: gameData.raceType || 'grand-tour',
          year: gameData.year,
          createdBy: adminUserId,
          createdAt: now,
          updatedAt: now,
          status: gameData.status || 'draft',
          registrationOpenDate: gameData.registrationOpenDate ? new Date(gameData.registrationOpenDate) : undefined,
          registrationCloseDate: gameData.registrationCloseDate ? new Date(gameData.registrationCloseDate) : undefined,
          division: divisionName,
          divisionLevel: i,
          divisionCount: divisionCount, // Store total number of divisions
          playerCount: 0,
          maxPlayers: gameData.maxPlayers,
          minPlayers: gameData.minPlayers,
          eligibleTeams: gameData.eligibleTeams || [],
          eligibleRiders: gameData.eligibleRiders || [],
          bidding: gameData.bidding,
          config: gameData.config,
        };

        // Remove undefined fields before saving to Firestore
        const cleanedGame = removeUndefinedFields(game);

        // Add game to Firestore
        const gameRef = await db.collection('games').add(cleanedGame);
        createdGames.push({ id: gameRef.id, game: serializeGame(game, gameRef.id) });

        // Log the activity
        const adminData = adminDoc.data();
        await db.collection('activityLogs').add({
          action: 'GAME_CREATED',
          userId: adminUserId,
          userEmail: adminData?.email,
          userName: adminData?.playername || adminData?.email,
          details: removeUndefinedFields({
            gameId: gameRef.id,
            gameName: game.name,
            gameType: game.gameType,
            year: game.year,
            raceSlug: gameData.raceSlug,
            division: divisionName,
            divisionLevel: i,
          }),
          timestamp: Timestamp.now(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }

      return NextResponse.json({
        success: true,
        gamesCreated: createdGames.length,
        games: createdGames,
        message: `Successfully created ${createdGames.length} division games`,
      });
    } else {
      // Single division game - original behavior
      const game: Omit<Game, 'id'> = {
        name: gameData.name,
        gameType: gameData.gameType,
        ...(raceRefPath && { raceRef: raceRefPath }), // Only include raceRef if it exists
        raceType: gameData.raceType || 'grand-tour',
        year: gameData.year,
        createdBy: adminUserId,
        createdAt: now,
        updatedAt: now,
        status: gameData.status || 'draft',
        registrationOpenDate: gameData.registrationOpenDate ? new Date(gameData.registrationOpenDate) : undefined,
        registrationCloseDate: gameData.registrationCloseDate ? new Date(gameData.registrationCloseDate) : undefined,
        division: gameData.division,
        divisionLevel: gameData.divisionLevel,
        divisionCount: 1,
        playerCount: 0,
        maxPlayers: gameData.maxPlayers,
        minPlayers: gameData.minPlayers,
        eligibleTeams: gameData.eligibleTeams || [],
        eligibleRiders: gameData.eligibleRiders || [],
        bidding: gameData.bidding,
        config: gameData.config,
      };

      // Remove undefined fields before saving to Firestore
      const cleanedGame = removeUndefinedFields(game);

      // Add game to Firestore
      const gameRef = await db.collection('games').add(cleanedGame);

      // Log the activity
      const adminData = adminDoc.data();
      await db.collection('activityLogs').add({
        action: 'GAME_CREATED',
        userId: adminUserId,
        userEmail: adminData?.email,
        userName: adminData?.playername || adminData?.email,
        details: removeUndefinedFields({
          gameId: gameRef.id,
          gameName: game.name,
          gameType: game.gameType,
          year: game.year,
          raceSlug: gameData.raceSlug,
        }),
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      return NextResponse.json({
        success: true,
        gameId: gameRef.id,
        game: serializeGame(game, gameRef.id),
      });
    }
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json(
      { error: 'Failed to create game', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
