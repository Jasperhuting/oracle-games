import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { GamesListResponse, ApiErrorResponse, ClientGame } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<GamesListResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const gameType = searchParams.get('gameType');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getServerFirebase();

    // Fetch all games and filter in memory while indexes are building
    // This is a temporary workaround until composite indexes are ready
    const query = db.collection('games').orderBy('createdAt', 'desc').limit(limit * 3);

    const snapshot = await query.get();

    let games = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        registrationOpenDate: data.registrationOpenDate?.toDate?.()?.toISOString(),
        registrationCloseDate: data.registrationCloseDate?.toDate?.()?.toISOString(),
        raceRef: data.raceRef?.path || data.raceRef,
      } as ClientGame;
    });

    // Apply filters in memory
    if (year) {
      games = games.filter(g => g.year === parseInt(year));
    }

    if (status) {
      games = games.filter(g => g.status === status);
    }

    if (gameType) {
      games = games.filter(g => g.gameType === gameType);
    }

    // Limit results
    games = games.slice(0, limit);

    // Detect divisions for games with multiple divisions
    // Group games by exact name match
    const gameGroups = new Map<string, typeof games>();

    for (const game of games) {
      const key = `${game.name}-${game.gameType}-${game.year}`;

      if (!gameGroups.has(key)) {
        gameGroups.set(key, []);
      }
      gameGroups.get(key)!.push(game);
    }

    // Add divisions array to games that have multiple instances (divisions)
    const gamesWithDivisions = games.map(game => {
      const key = `${game.name}-${game.gameType}-${game.year}`;
      const relatedGames = gameGroups.get(key) || [];

      // If there are multiple games with the same name, gameType, and year, they are divisions
      if (relatedGames.length > 1) {
        // Extract division names from the game data or create them based on the division field
        const divisions = relatedGames
          .map((g, index) => {
            // If game has division field, use it
            if (g.division) {
              return g.division;
            }
            // Otherwise, create division names like "Division 1", "Division 2", etc.
            return `Division ${index + 1}`;
          })
          .filter(Boolean) as string[];

        return {
          ...game,
          divisions: divisions.length > 0 ? divisions : undefined,
        };
      }

      return game;
    });

    return NextResponse.json({
      success: true,
      games: gamesWithDivisions,
      count: gamesWithDivisions.length,
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
