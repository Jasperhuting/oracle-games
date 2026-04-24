import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

const GAME_TYPE_LABELS: Record<string, string> = {
  'auctioneer': 'Auctioneer',
  'slipstream': 'Slipstream',
  'last-man-standing': 'Last Man Standing',
  'poisoned-cup': 'Poisoned Cup',
  'nations-cup': 'Nations Cup',
  'rising-stars': 'Rising Stars',
  'country-roads': 'Country Roads',
  'worldtour-manager': 'WorldTour Manager',
  'fan-flandrien': 'Fan Flandrien',
  'full-grid': 'Full Grid',
  'marginal-gains': 'Marginal Gains',
  'f1-prediction': 'F1 Prediction',
};

function extractRaceName(gameName: string, gameType: string): string {
  const label = GAME_TYPE_LABELS[gameType] || gameType;
  let name = gameName;
  if (name.startsWith(label + ' - ')) {
    name = name.slice(label.length + 3);
  }
  name = name.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
  return name || gameName;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const db = getServerFirebase();

  // 1. Fetch all game participants for this user
  const participantsSnap = await db.collection('gameParticipants')
    .where('userId', '==', userId)
    .get();

  // 2. Map gameId → user's { totalPoints, ranking }
  // Skip -pending entries; keep the entry with highest totalPoints per game
  const userByGame = new Map<string, { totalPoints: number; storedRanking: number }>();
  for (const doc of participantsSnap.docs) {
    const data = doc.data();
    const rawGameId: string = data.gameId ?? '';
    if (!rawGameId || rawGameId.endsWith('-pending')) continue;
    const gameId = rawGameId.replace(/-pending$/, '');
    const totalPoints = Number(data.totalPoints) || 0;
    const storedRanking = Number(data.ranking) || 0;
    const existing = userByGame.get(gameId);
    if (!existing || totalPoints > existing.totalPoints) {
      userByGame.set(gameId, { totalPoints, storedRanking });
    }
  }

  const gameIds = [...userByGame.keys()];
  if (gameIds.length === 0) {
    return NextResponse.json({ results: [], totalCount: 0 });
  }

  // 3. Batch-fetch game documents
  const gameRefs = gameIds.map(id => db.collection('games').doc(id));
  const gameDocs = await db.getAll(...gameRefs);

  // 4. Filter to finished non-test games
  type GameEntry = { id: string; name: string; gameType: string; year: number };
  const finishedGames: GameEntry[] = [];
  for (const doc of gameDocs) {
    if (!doc.exists) continue;
    const d = doc.data()!;
    if (
      d.status === 'finished' &&
      !d.isTest &&
      !d.name?.toLowerCase().includes('test')
    ) {
      finishedGames.push({
        id: doc.id,
        name: d.name ?? '',
        gameType: d.gameType ?? '',
        year: Number(d.year) || new Date().getFullYear(),
      });
    }
  }

  if (finishedGames.length === 0) {
    return NextResponse.json({ results: [], totalCount: 0 });
  }

  // 5. Determine ranking per finished game
  const rawResults: Array<{ gameName: string; raceName: string; gameType: string; ranking: number; year: number }> = [];

  await Promise.all(finishedGames.map(async (game) => {
    const userEntry = userByGame.get(game.id);
    if (!userEntry) return;

    // Use stored ranking when available
    if (userEntry.storedRanking > 0) {
      rawResults.push({
        gameName: game.name,
        raceName: extractRaceName(game.name, game.gameType),
        gameType: game.gameType,
        ranking: userEntry.storedRanking,
        year: game.year,
      });
      return;
    }

    // Fallback: compute ranking from all participants' totalPoints
    try {
      const allSnap = await db.collection('gameParticipants')
        .where('gameId', '==', game.id)
        .where('status', '==', 'active')
        .get();

      if (allSnap.empty) return;

      const userPoints = userEntry.totalPoints;

      // Only include if user has any points (otherwise not a meaningful result)
      if (userPoints <= 0) return;

      // Count participants with strictly more points → rank = count + 1
      const betterCount = allSnap.docs.filter(
        d => (Number(d.data().totalPoints) || 0) > userPoints
      ).length;
      const ranking = betterCount + 1;

      rawResults.push({
        gameName: game.name,
        raceName: extractRaceName(game.name, game.gameType),
        gameType: game.gameType,
        ranking,
        year: game.year,
      });
    } catch {
      // Skip if we can't determine ranking
    }
  }));

  // 6. Sort by ranking ascending
  rawResults.sort((a, b) => a.ranking - b.ranking);

  // 7. Cluster by ranking + gameType
  const clusterMap = new Map<string, { ranking: number; gameType: string; raceNames: string[] }>();
  for (const result of rawResults) {
    const key = `${result.ranking}-${result.gameType}`;
    if (!clusterMap.has(key)) {
      clusterMap.set(key, { ranking: result.ranking, gameType: result.gameType, raceNames: [] });
    }
    clusterMap.get(key)!.raceNames.push(result.raceName);
  }

  const clustered = Array.from(clusterMap.values())
    .sort((a, b) => a.ranking - b.ranking)
    .slice(0, 10);

  return NextResponse.json({
    results: clustered,
    totalCount: rawResults.length,
  });
}
