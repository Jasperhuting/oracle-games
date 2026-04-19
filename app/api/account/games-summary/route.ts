import { userHandler } from '@/lib/api/handler';
import { getServerFirebase, getServerFirebaseF1 } from '@/lib/firebase/server';

const cyclingTypes = [
  'auctioneer',
  'slipstream',
  'last-man-standing',
  'poisoned-cup',
  'nations-cup',
  'rising-stars',
  'country-roads',
  'worldtour-manager',
  'fan-flandrien',
  'full-grid',
  'marginal-gains',
];

const f1Types = ['f1-prediction'];

function getSportType(gameType: string): 'cycling' | 'f1' | 'other' {
  if (cyclingTypes.includes(gameType)) return 'cycling';
  if (f1Types.includes(gameType)) return 'f1';
  return 'other';
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    '_seconds' in value
  ) {
    const seconds = Number((value as { _seconds?: number })._seconds || 0);
    const nanos = Number(
      (value as { _nanoseconds?: number })._nanoseconds || 0,
    );
    return new Date(seconds * 1000 + nanos / 1000000).toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

export const GET = userHandler('account-games-summary', async ({ uid }) => {
  const db = getServerFirebase();

  // Step 1: Fetch user's active game participants
  const participantsSnap = await db
    .collection('gameParticipants')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();

  // Collect unique game IDs (strip -pending suffix)
  const gameIdSet = new Set<string>();
  participantsSnap.docs.forEach((doc) => {
    const gameId: string = doc.data().gameId ?? '';
    if (!gameId || gameId.endsWith('-pending')) return;
    gameIdSet.add(gameId);
  });

  const gameIds = [...gameIdSet];

  if (gameIds.length === 0) {
    return { games: [] };
  }

  // Step 2: For each gameId, fetch data in parallel
  const results = await Promise.all(
    gameIds.map(async (gameId) => {
      try {
        const [
          gameDoc,
          countSnap,
          scoreUpdateSnap,
        ] = await Promise.all([
          // Game document
          db.collection('games').doc(gameId).get(),

          // Active participant count
          db
            .collection('gameParticipants')
            .where('gameId', '==', gameId)
            .where('status', '==', 'active')
            .count()
            .get(),

          // Last score update
          db
            .collection('scoreUpdates')
            .where('gamesAffected', 'array-contains', gameId)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get(),
        ]);

        if (!gameDoc.exists) return null;

        const game = gameDoc.data()!;

        // Filter: only show active/bidding/registration games
        if (!['registration', 'bidding', 'active'].includes(game.status)) {
          return null;
        }

        // Skip test games
        if (game.isTest === true || game.name?.toLowerCase().includes('test')) {
          return null;
        }

        const totalParticipants = countSnap.data().count;

        // Ranking and points live in gameParticipants for all game types
        const participantDoc = participantsSnap.docs.find(d => d.data().gameId === gameId);
        const participantData = participantDoc?.data();

        let ranking: number;
        let totalPoints: number;

        if (game.gameType === 'slipstream') {
          const slipstreamData = participantData?.slipstreamData;
          totalPoints = slipstreamData?.totalGreenJerseyPoints ?? 0;

          // Compute yellow jersey ranking from all participants' totalTimeLostSeconds
          // (yellowJerseyRanking in the doc is never written back, so derive it dynamically)
          const userTimeLost: number = slipstreamData?.totalTimeLostSeconds ?? 0;
          const allParticipantsSnap = await db
            .collection('gameParticipants')
            .where('gameId', '==', gameId)
            .where('status', '==', 'active')
            .get();
          const timeLostValues = allParticipantsSnap.docs.map(
            d => (d.data().slipstreamData?.totalTimeLostSeconds as number) ?? 0
          );
          // Rank = number of participants with strictly less time lost + 1 (handles ties correctly)
          ranking = timeLostValues.filter(t => t < userTimeLost).length + 1;
        } else {
          totalPoints = participantData?.totalPoints ?? 0;

          // Dynamically calculate ranking from all participants' totalPoints
          // to stay in sync with the game standings page
          const allParticipantsSnap = await db
            .collection('gameParticipants')
            .where('gameId', '==', gameId)
            .where('status', '==', 'active')
            .get();
          const allPoints = allParticipantsSnap.docs.map(
            d => (d.data().totalPoints as number) ?? 0
          );
          // Rank = number of participants with strictly more points + 1 (handles ties correctly)
          ranking = allPoints.filter(p => p > totalPoints).length + 1;
        }

        const lastScoreUpdate: string | null = scoreUpdateSnap.empty
          ? null
          : toIsoDate(scoreUpdateSnap.docs[0].data().createdAt);

        const gameName: string = game.division
          ? `${game.name} - ${game.division}`
          : (game.name ?? gameId);

        return {
          gameId,
          gameName,
          gameType: game.gameType ?? '',
          sportType: getSportType(game.gameType ?? ''),
          ranking,
          totalParticipants,
          totalPoints,
          status: game.status,
          lastScoreUpdate,
        };
      } catch {
        return null;
      }
    }),
  );

  const games = results.filter(
    (g): g is NonNullable<typeof g> => g !== null,
  );

  // F1 enrichment — queries the separate oracle-games-f1 database
  try {
    const f1Db = getServerFirebaseF1();
    const season = 2026;

    const [participantSnap, allStandingsSnap, f1GamesSnap] = await Promise.all([
      // Is this user an F1 participant this season? (equality filters only — no index needed)
      f1Db.collection('participants').where('userId', '==', uid).where('season', '==', season).limit(1).get(),
      // All standings for season
      f1Db.collection('standings').where('season', '==', season).get(),
      // F1 games — filter in memory to avoid inequality index requirement
      db.collection('games').where('gameType', '==', 'f1-prediction').limit(10).get(),
    ]);

    const isActiveParticipant = !participantSnap.empty &&
      participantSnap.docs[0].data().status === 'active';

    if (isActiveParticipant) {
      const f1Game = f1GamesSnap.docs.find(d => {
        const g = d.data();
        return g.status !== 'finished' && g.isTest !== true && !g.name?.toLowerCase().includes('test');
      });

      if (f1Game) {
        const nonF1Games = games.filter(game => game.gameType !== 'f1-prediction');
        const allStandings = allStandingsSnap.docs.map(d => d.data() as { userId: string; totalPoints?: number });

        // Sort descending to find rank
        allStandings.sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));
        const rankIndex = allStandings.findIndex(s => s.userId === uid);
        const userStanding = rankIndex >= 0 ? allStandings[rankIndex] : null;
        const ranking = rankIndex >= 0 ? rankIndex + 1 : 0;

        nonF1Games.push({
          gameId: f1Game.id,
          gameName: f1Game.data().name ?? 'F1 Prediction',
          gameType: 'f1-prediction',
          sportType: 'f1',
          ranking,
          totalParticipants: allStandings.length,
          totalPoints: userStanding?.totalPoints ?? 0,
          status: f1Game.data().status,
          lastScoreUpdate: null,
        });

        games.length = 0;
        games.push(...nonF1Games);
      }
    }
  } catch (err) {
    console.error('[GAMES_SUMMARY] F1 enrichment failed:', err);
    // Ignore F1 enrichment failures so the regular games still show
  }

  return { games };
});
