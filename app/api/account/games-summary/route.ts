import { userHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';

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
          playerTeamSnap,
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

          // User's playerTeam for ranking + points
          db
            .collection('playerTeams')
            .where('gameId', '==', gameId)
            .where('userId', '==', uid)
            .limit(1)
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

        const playerTeamData = playerTeamSnap.empty
          ? null
          : playerTeamSnap.docs[0].data();

        let ranking: number;
        let totalPoints: number;

        if (game.gameType === 'slipstream') {
          // Slipstream rankings live in gameParticipants.slipstreamData, not playerTeams
          const participantDoc = participantsSnap.docs.find(d => d.data().gameId === gameId);
          const slipstreamData = participantDoc?.data()?.slipstreamData;
          ranking = slipstreamData?.yellowJerseyRanking ?? 0;
          totalPoints = slipstreamData?.totalGreenJerseyPoints ?? 0;
        } else {
          ranking = playerTeamData?.ranking ?? 0;
          totalPoints = playerTeamData?.totalPoints ?? 0;
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

  return { games };
});
