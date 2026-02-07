import { NextRequest, NextResponse } from 'next/server';

type PublicStanding = {
  playername?: string;
  totalPoints?: number;
  ranking?: number;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const limit = parseInt(searchParams.get('limit') || '200');

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const teamsResponse = await fetch(`${origin}/api/games/${gameId}/teams-overview`, {
      cache: 'no-store',
    });
    if (!teamsResponse.ok) {
      throw new Error('Failed to load teams overview');
    }
    const teamsData = await teamsResponse.json();
    const teams = Array.isArray(teamsData?.teams) ? teamsData.teams : [];

    const standingsRaw: PublicStanding[] = teams.map((team: any) => ({
      playername: team.playername,
      totalPoints: team.totalPoints ?? 0,
      ranking: 0,
    })).slice(0, limit);

    standingsRaw.sort((a, b) => {
      if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0)) {
        return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
      }
      return (a.playername || '').localeCompare(b.playername || '');
    });

    let currentRank = 1;
    let previousPoints: number | null = null;
    const standings = standingsRaw.map((entry, index) => {
      if (previousPoints === null || entry.totalPoints !== previousPoints) {
        currentRank = index + 1;
        previousPoints = entry.totalPoints ?? 0;
      }
      return { ...entry, ranking: currentRank };
    });

    const response = NextResponse.json({
      gameName: teamsData?.gameName || teamsData?.name || 'Game',
      count: standings.length,
      standings,
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    console.error('Error fetching public standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch standings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
