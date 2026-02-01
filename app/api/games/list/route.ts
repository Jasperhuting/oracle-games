import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseF1 } from '@/lib/firebase/server';
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
      // Remove timestamp fields before spreading to avoid conflicts
      const { createdAt, updatedAt, registrationOpenDate, registrationCloseDate, teamSelectionDeadline, raceRef, ...restData } = data;

      // Helper to convert Firestore Timestamp to ISO string
      const convertTimestamp = (ts: any) => {
        if (!ts) return undefined;
        if (typeof ts === 'string') return ts;
        if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
        if (ts.toDate) return ts.toDate().toISOString();
        return ts;
      };

      return {
        id: doc.id,
        ...restData,
        createdAt: convertTimestamp(createdAt) || createdAt,
        updatedAt: convertTimestamp(updatedAt) || updatedAt,
        registrationOpenDate: convertTimestamp(registrationOpenDate),
        registrationCloseDate: convertTimestamp(registrationCloseDate),
        teamSelectionDeadline: convertTimestamp(teamSelectionDeadline),
        raceRef: raceRef?.path || raceRef,
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

    // For F1 games, update playerCount from F1 database
    const f1Games = games.filter(g => g.gameType === 'f1-prediction');
    if (f1Games.length > 0) {
      try {
        const f1Db = getServerFirebaseF1();
        const f1Season = f1Games[0]?.year || 2026;
        
        // Get F1 participants count
        const f1ParticipantsSnapshot = await f1Db
          .collection('participants')
          .where('season', '==', f1Season)
          .where('status', '==', 'active')
          .get();
        
        const f1ParticipantCount = f1ParticipantsSnapshot.size;
        
        // Update playerCount for all F1 games
        games = games.map(game => {
          if (game.gameType === 'f1-prediction') {
            return {
              ...game,
              playerCount: f1ParticipantCount,
            };
          }
          return game;
        });
        
        console.log(`Updated F1 games playerCount to ${f1ParticipantCount} (from F1 database)`);
      } catch (f1Error) {
        console.error('Error fetching F1 participants for games list:', f1Error);
        // Continue with default playerCount if F1 fetch fails
      }
    }

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
