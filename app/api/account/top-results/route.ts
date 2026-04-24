import { getServerFirebase } from '@/lib/firebase/server';
import { publicHandler, ApiError } from '@/lib/api/handler';

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

// Convert a slug like "tour-de-france" to "Tour de France"
function slugToDisplayName(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Build raceSlug → display name from game config countingRaces
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRaceNameMap(config: any): Record<string, string> {
  const map: Record<string, string> = {};
  const races = config?.countingRaces ?? [];
  for (const race of races) {
    if (typeof race === 'string') {
      // e.g. "tour-de-france_2025"
      const slug = race.split('_')[0];
      if (slug && !map[slug]) map[slug] = slugToDisplayName(slug);
    } else if (race?.raceSlug && race?.raceName) {
      map[race.raceSlug] = race.raceName;
    } else if (race?.raceId) {
      const slug = race.raceSlug ?? race.raceId.split('_')[0];
      if (slug) map[slug] = race.raceName ?? slugToDisplayName(slug);
    }
  }
  return map;
}

const SLIPSTREAM_GAME_TYPES = new Set(['slipstream', 'last-man-standing', 'country-roads']);

type RawResult = { raceName: string; gameType: string; ranking: number };

export const GET = publicHandler('account-top-results', async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) throw new ApiError('userId required', 400);

  const db = getServerFirebase();

  // ── 1. Get all game IDs the user has joined ─────────────────────────────
  const participantsSnap = await db.collection('gameParticipants')
    .where('userId', '==', userId)
    .get();

  const gameIdSet = new Set<string>();
  for (const doc of participantsSnap.docs) {
    const raw: string = doc.data().gameId ?? '';
    if (!raw || raw.endsWith('-pending')) continue;
    gameIdSet.add(raw);
  }

  if (gameIdSet.size === 0) return { results: [], totalCount: 0 };

  // ── 2. Batch-fetch game documents ───────────────────────────────────────
  const gameIds = [...gameIdSet];
  const gameRefs = gameIds.map(id => db.collection('games').doc(id));
  const gameDocs = await db.getAll(...gameRefs);

  type GameMeta = { id: string; name: string; gameType: string; year: number; config: Record<string, unknown> };
  const activegames: GameMeta[] = [];

  for (const doc of gameDocs) {
    if (!doc.exists) continue;
    const d = doc.data()!;
    // Skip test games and games not yet started
    if (d.isTest || d.name?.toLowerCase().includes('test')) continue;
    if (d.status === 'draft' || d.status === 'registration') continue;
    activegames.push({
      id: doc.id,
      name: d.name ?? '',
      gameType: d.gameType ?? '',
      year: Number(d.year) || new Date().getFullYear(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: (d.config ?? {}) as Record<string, any>,
    });
  }

  if (activegames.length === 0) return { results: [], totalCount: 0 };

  // ── 3. Per game: compute per-race rankings ──────────────────────────────
  const rawResults: RawResult[] = [];

  await Promise.all(activegames.map(async (game) => {
    const raceNameMap = buildRaceNameMap(game.config);

    try {
      if (SLIPSTREAM_GAME_TYPES.has(game.gameType)) {
        // ── Slipstream: use stagePicks ──────────────────────────────────
        // Fetch ALL picks for this game in one query, then group in memory
        const allPicksSnap = await db.collection('stagePicks')
          .where('gameId', '==', game.id)
          .get();

        if (allPicksSnap.empty) return;

        // Build { userId → { raceSlug → greenJerseyPoints } }
        const playerRacePoints = new Map<string, Map<string, number>>();
        for (const doc of allPicksSnap.docs) {
          const d = doc.data();
          if (d.isPenalty) continue;
          const uid: string = d.userId ?? '';
          const raceSlug: string = d.raceSlug ?? '';
          if (!uid || !raceSlug) continue;
          const pts = Number(d.greenJerseyPoints) || 0;
          if (!playerRacePoints.has(uid)) playerRacePoints.set(uid, new Map());
          const prev = playerRacePoints.get(uid)!.get(raceSlug) ?? 0;
          playerRacePoints.get(uid)!.set(raceSlug, prev + pts);
        }

        const userRacePoints = playerRacePoints.get(userId);
        if (!userRacePoints) return;

        // Compute ranking per race
        for (const [raceSlug, userPts] of userRacePoints.entries()) {
          if (userPts <= 0) continue;
          const betterCount = [...playerRacePoints.values()]
            .filter(m => (m.get(raceSlug) ?? 0) > userPts)
            .length;
          const raceName = raceNameMap[raceSlug] ?? slugToDisplayName(raceSlug);
          rawResults.push({
            raceName: `${raceName} ${game.year}`,
            gameType: game.gameType,
            ranking: betterCount + 1,
          });
        }

      } else {
        // ── Other game types: use playerTeams.pointsBreakdown ───────────
        // Fetch ALL playerTeams for this game in one query
        const allTeamsSnap = await db.collection('playerTeams')
          .where('gameId', '==', game.id)
          .get();

        if (allTeamsSnap.empty) return;

        // Build { userId → { raceSlug → points } }
        const playerRacePoints = new Map<string, Map<string, number>>();

        for (const doc of allTeamsSnap.docs) {
          const d = doc.data();
          const uid: string = d.userId ?? '';
          if (!uid) continue;
          if (!playerRacePoints.has(uid)) playerRacePoints.set(uid, new Map());
          const playerMap = playerRacePoints.get(uid)!;

          // New format: pointsBreakdown array
          const breakdown: Array<Record<string, unknown>> = d.pointsBreakdown ?? [];
          for (const event of breakdown) {
            const raceSlug = String(event.raceSlug ?? '');
            if (!raceSlug) continue;
            const pts = Number(event.total) || 0;
            playerMap.set(raceSlug, (playerMap.get(raceSlug) ?? 0) + pts);
          }

          // Legacy format: racePoints object
          const racePoints = d.racePoints;
          if (racePoints && typeof racePoints === 'object' && !Array.isArray(racePoints)) {
            for (const [slug, data] of Object.entries(racePoints as Record<string, unknown>)) {
              if (!slug) continue;
              const legacy = data as Record<string, unknown>;
              const pts = Number(legacy?.totalPoints ?? legacy?.points ?? 0);
              if (pts > 0) playerMap.set(slug, (playerMap.get(slug) ?? 0) + pts);
            }
          }
        }

        const userRacePoints = playerRacePoints.get(userId);
        if (!userRacePoints) return;

        // Compute ranking per race
        for (const [raceSlug, userPts] of userRacePoints.entries()) {
          if (userPts <= 0) continue;
          const betterCount = [...playerRacePoints.values()]
            .filter(m => (m.get(raceSlug) ?? 0) > userPts)
            .length;
          const raceName = raceNameMap[raceSlug] ?? slugToDisplayName(raceSlug);
          rawResults.push({
            raceName: `${raceName} ${game.year}`,
            gameType: game.gameType,
            ranking: betterCount + 1,
          });
        }
      }
    } catch {
      // Skip game on error
    }
  }));

  // ── 4. Also include finished games (stored ranking) ─────────────────────
  // (covers the case when complete games ARE marked as finished)
  for (const doc of participantsSnap.docs) {
    const d = doc.data();
    const rawId: string = d.gameId ?? '';
    if (!rawId || rawId.endsWith('-pending')) continue;
    const storedRanking = Number(d.ranking) || 0;
    if (storedRanking <= 0) continue;

    const game = activegames.find(g => g.id === rawId);
    if (!game) continue; // already filtered (test/draft) or not fetched

    // Only add from finished games (active games are handled via races above)
    const gameDoc = gameDocs.find(doc => doc.id === rawId);
    if (!gameDoc?.exists || gameDoc.data()?.status !== 'finished') continue;

    const raceNameMap = buildRaceNameMap(game.config);
    const firstRaceName = Object.values(raceNameMap)[0] ?? game.name;
    rawResults.push({
      raceName: `${firstRaceName} ${game.year}`,
      gameType: game.gameType,
      ranking: storedRanking,
    });
  }

  // ── 5. Sort by ranking, cluster, return top 10 ─────────────────────────
  rawResults.sort((a, b) => a.ranking - b.ranking);

  const clusterMap = new Map<string, { ranking: number; gameType: string; raceNames: string[] }>();
  for (const r of rawResults) {
    const key = `${r.ranking}-${r.gameType}`;
    if (!clusterMap.has(key)) {
      clusterMap.set(key, { ranking: r.ranking, gameType: r.gameType, raceNames: [] });
    }
    // Avoid duplicate race names in the same cluster
    const cluster = clusterMap.get(key)!;
    if (!cluster.raceNames.includes(r.raceName)) {
      cluster.raceNames.push(r.raceName);
    }
  }

  const clustered = [...clusterMap.values()]
    .sort((a, b) => a.ranking - b.ranking)
    .slice(0, 10);

  return { results: clustered, totalCount: rawResults.length };
});
