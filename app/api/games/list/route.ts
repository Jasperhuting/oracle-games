import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseF1 } from '@/lib/firebase/server';
import type { GamesListResponse, ApiErrorResponse, ClientGame } from '@/lib/types';
import { unstable_cache } from 'next/cache';

export const GAMES_LIST_CACHE_TAG = 'games-list';

type GamesListResult = {
  games: ClientGame[];
  count: number;
};

const convertTimestamp = (ts: unknown): string | undefined => {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (typeof ts === 'object' && ts !== null) {
    if ('_seconds' in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toISOString();
    if ('toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toISOString();
    }
  }
  return String(ts);
};

const fetchGamesList = unstable_cache(
  async (
    year: string | null,
    status: string | null,
    gameType: string | null,
    limit: number,
  ): Promise<GamesListResult> => {
    const db = getServerFirebase();

    // Fetch all games and filter in memory while indexes are building
    // This is a temporary workaround until composite indexes are ready
    const query = db.collection('games').orderBy('createdAt', 'desc').limit(limit * 3);

    const snapshot = await query.get();

    let games = snapshot.docs.map(doc => {
      const data = doc.data();
      const { createdAt, updatedAt, registrationOpenDate, registrationCloseDate, teamSelectionDeadline, raceRef, ...restData } = data;

      return {
        id: doc.id,
        ...restData,
        createdAt: convertTimestamp(createdAt) || createdAt,
        updatedAt: convertTimestamp(updatedAt) || updatedAt,
        registrationOpenDate: convertTimestamp(registrationOpenDate),
        registrationCloseDate: convertTimestamp(registrationCloseDate),
        teamSelectionDeadline: convertTimestamp(teamSelectionDeadline),
        raceRef: (raceRef as { path?: string })?.path || raceRef,
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

    games = games.slice(0, limit);

    // For F1 games, update playerCount from F1 database
    const f1Games = games.filter(g => g.gameType === 'f1-prediction');
    if (f1Games.length > 0) {
      try {
        const f1Db = getServerFirebaseF1();
        const f1Season = f1Games[0]?.year || 2026;

        const f1ParticipantsSnapshot = await f1Db
          .collection('participants')
          .where('season', '==', f1Season)
          .where('status', '==', 'active')
          .get();

        const f1ParticipantCount = f1ParticipantsSnapshot.size;

        games = games.map(game =>
          game.gameType === 'f1-prediction' ? { ...game, playerCount: f1ParticipantCount } : game
        );
      } catch (f1Error) {
        console.error('Error fetching F1 participants for games list:', f1Error);
      }
    }

    // Detect divisions for games with multiple divisions
    const gameGroups = new Map<string, typeof games>();
    for (const game of games) {
      const key = `${game.name}-${game.gameType}-${game.year}`;
      if (!gameGroups.has(key)) gameGroups.set(key, []);
      gameGroups.get(key)!.push(game);
    }

    const gamesWithDivisions = games.map(game => {
      const key = `${game.name}-${game.gameType}-${game.year}`;
      const relatedGames = gameGroups.get(key) || [];

      if (relatedGames.length > 1) {
        const divisions = relatedGames
          .map((g, index) => g.division ?? `Division ${index + 1}`)
          .filter(Boolean) as string[];

        return { ...game, divisions: divisions.length > 0 ? divisions : undefined };
      }

      return game;
    });

    return { games: gamesWithDivisions, count: gamesWithDivisions.length };
  },
  ['games-list'],
  { tags: [GAMES_LIST_CACHE_TAG], revalidate: 60 },
);

export async function GET(request: NextRequest): Promise<NextResponse<GamesListResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const gameType = searchParams.get('gameType');
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await fetchGamesList(year, status, gameType, limit);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
