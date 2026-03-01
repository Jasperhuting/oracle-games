import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseF1 } from '@/lib/firebase/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { calculateRankings } from '@/lib/utils/slipstreamCalculation';

export const dynamic = 'force-dynamic';

type OracleUserStats = {
  userId: string;
  playername: string;
  gamesPlayed: number;
  averageGameScore: number;
  oracleRating: number;
  oraclePoints: number;
  oracleRank: number;
};

const SMOOTHING_GAMES = 5;
const BASELINE_SCORE = 0.5;
const ORACLE_POINTS_SCALE = 100000;

function computeGameScore(rank: number, participantCount: number): number {
  if (participantCount <= 1) {
    return rank === 1 ? 1 : 0;
  }

  const score = (participantCount - rank) / (participantCount - 1);
  return Math.max(0, Math.min(1, score));
}

function addUserScore(
  userScores: Map<string, { playername: string; scores: number[] }>,
  userId: string,
  playername: string,
  score: number
) {
  const current = userScores.get(userId) || {
    playername: playername || '',
    scores: [],
  };

  if (!current.playername && playername) {
    current.playername = playername;
  }

  current.scores.push(score);
  userScores.set(userId, current);
}

function toPositiveNumber(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const includeTop = searchParams.get('includeTop') === 'true';
    const topLimit = Math.min(Number(searchParams.get('topLimit') || 10), 100);
    const yearParam = searchParams.get('year');
    const yearFilter = yearParam ? Number(yearParam) : null;

    const db = getServerFirebase();
    const f1Db = getServerFirebaseF1();

    const gamesSnapshot = await db.collection('games').get();

    const relevantGames = new Map<string, DocumentData>();

    gamesSnapshot.docs
      .filter((doc) => {
        const game = doc.data();
        const gameName = String(game?.name || '').toLowerCase();
        const status = String(game?.status || '').toLowerCase();
        const gameYear = Number(game?.year);
        const matchesYear = yearFilter ? Number.isFinite(gameYear) && gameYear === yearFilter : true;
        return !game?.isTest && !gameName.includes('test') && status !== 'cancelled' && matchesYear;
      })
      .forEach((doc) => {
        relevantGames.set(doc.id, doc.data());
      });

    if (relevantGames.size === 0) {
      return NextResponse.json({
        success: true,
        totalRankedUsers: 0,
        user: requestedUserId
          ? {
              userId: requestedUserId,
              playername: '',
              gamesPlayed: 0,
              averageGameScore: 0,
              oracleRating: 0,
              oracleRank: null,
            }
          : undefined,
        top: [],
      });
    }

    const participantsByGame = new Map<string, DocumentData[]>();
    const participantsSnapshot = await db
      .collection('gameParticipants')
      .where('status', '==', 'active')
      .get();

    for (const doc of participantsSnapshot.docs) {
      const participant = { id: doc.id, ...doc.data() };
      const rawGameId = String(participant.gameId || '');
      if (!rawGameId) continue;
      const gameId = rawGameId.replace(/-pending$/, '');
      const game = relevantGames.get(gameId);
      if (!game) continue;
      if (String(game.gameType || '') === 'f1-prediction') continue;

      const existing = participantsByGame.get(gameId) || [];
      existing.push(participant);
      participantsByGame.set(gameId, existing);
    }

    const userScores = new Map<string, { playername: string; scores: number[] }>();

    // Main database games (cycling + others except F1)
    for (const [gameId, gameParticipants] of participantsByGame.entries()) {
      const game = relevantGames.get(gameId);
      if (!game) continue;

      const eligibleParticipants = gameParticipants.filter((participant) => {
        const userId = String(participant.userId || '');
        return Boolean(userId);
      });

      const participantCount = eligibleParticipants.length;
      if (participantCount === 0) continue;

      const gameType = String(game.gameType || '');
      let derivedRanks: number[] | null = null;

      if (gameType === 'slipstream') {
        derivedRanks = calculateRankings(
          eligibleParticipants,
          (participant) => Number(participant?.slipstreamData?.totalTimeLostSeconds || 0),
          true
        );
      } else {
        const hasTotalPoints = eligibleParticipants.some((participant) =>
          Number.isFinite(Number(participant.totalPoints))
        );

        if (hasTotalPoints) {
          derivedRanks = calculateRankings(
            eligibleParticipants,
            (participant) => Number(participant.totalPoints || 0),
            false
          );
        }
      }

      for (let i = 0; i < eligibleParticipants.length; i++) {
        const participant = eligibleParticipants[i];
        const userId = String(participant.userId || '');
        if (!userId) continue;

        const rank = derivedRanks?.[i] ?? toPositiveNumber(participant.ranking);
        if (!rank) continue;

        const gameScore = computeGameScore(rank, participantCount);
        const playername = String(participant.playername || participant.userName || '');
        addUserScore(userScores, userId, playername, gameScore);
      }
    }

    // F1 database (season standings)
    const f1ParticipantsSnapshot = await f1Db
      .collection('participants')
      .where('status', '==', 'active')
      .get();

    const f1ParticipantsBySeason = new Map<number, Map<string, { userId: string; displayName: string }>>();

    for (const doc of f1ParticipantsSnapshot.docs) {
      const participant = doc.data();
      const season = Number(participant.season);
      const userId = String(participant.userId || '');
      if (!Number.isFinite(season) || !userId) continue;
      if (yearFilter && season !== yearFilter) continue;

      if (!f1ParticipantsBySeason.has(season)) {
        f1ParticipantsBySeason.set(season, new Map());
      }
      f1ParticipantsBySeason.get(season)!.set(userId, {
        userId,
        displayName: String(participant.displayName || ''),
      });
    }

    for (const [season, participantsMap] of f1ParticipantsBySeason.entries()) {
      const standingsSnapshot = await f1Db
        .collection('standings')
        .where('season', '==', season)
        .get();

      const seasonStandings = standingsSnapshot.docs
        .map((doc) => doc.data())
        .filter((standing) => {
          const userId = String(standing.userId || '');
          return participantsMap.has(userId) && Number.isFinite(Number(standing.totalPoints));
        });

      if (seasonStandings.length === 0) continue;

      const ranks = calculateRankings(
        seasonStandings,
        (standing) => Number(standing.totalPoints || 0),
        true
      );

      const participantCount = seasonStandings.length;
      for (let i = 0; i < seasonStandings.length; i++) {
        const standing = seasonStandings[i];
        const userId = String(standing.userId || '');
        if (!userId) continue;

        const rank = ranks[i];
        const gameScore = computeGameScore(rank, participantCount);
        const fallbackName = participantsMap.get(userId)?.displayName || '';
        const playername = String(standing.visibleName || fallbackName);
        addUserScore(userScores, userId, playername, gameScore);
      }
    }

    const sortedUsers: OracleUserStats[] = Array.from(userScores.entries())
      .map(([userId, data]) => {
        const gamesPlayed = data.scores.length;
        const averageGameScore =
          gamesPlayed > 0
            ? data.scores.reduce((sum, score) => sum + score, 0) / gamesPlayed
            : 0;

        const oracleRating =
          (gamesPlayed / (gamesPlayed + SMOOTHING_GAMES)) * averageGameScore +
          (SMOOTHING_GAMES / (gamesPlayed + SMOOTHING_GAMES)) * BASELINE_SCORE;

        return {
          userId,
          playername: data.playername,
          gamesPlayed,
          averageGameScore,
          oracleRating,
          oraclePoints: Math.round(oracleRating * ORACLE_POINTS_SCALE),
          oracleRank: 0,
        };
      })
      .sort((a, b) => {
        if (b.oraclePoints !== a.oraclePoints) {
          return b.oraclePoints - a.oraclePoints;
        }
        if (b.oracleRating !== a.oracleRating) {
          return b.oracleRating - a.oracleRating;
        }
        if (b.averageGameScore !== a.averageGameScore) {
          return b.averageGameScore - a.averageGameScore;
        }
        if (b.gamesPlayed !== a.gamesPlayed) {
          return b.gamesPlayed - a.gamesPlayed;
        }
        return a.userId.localeCompare(b.userId);
      });

    const rankedUsers: OracleUserStats[] = [];
    let previousPoints: number | null = null;
    let currentRank = 1;

    for (let i = 0; i < sortedUsers.length; i++) {
      const user = sortedUsers[i];
      if (i === 0) {
        currentRank = 1;
      } else if (previousPoints !== null && user.oraclePoints !== previousPoints) {
        currentRank = i + 1;
      }

      rankedUsers.push({
        ...user,
        oracleRank: currentRank,
      });
      previousPoints = user.oraclePoints;
    }

    const requestedUser = requestedUserId
      ? rankedUsers.find((user) => user.userId === requestedUserId) || null
      : undefined;

    return NextResponse.json({
      success: true,
      totalRankedUsers: rankedUsers.length,
      user: requestedUser,
      top: includeTop ? rankedUsers.slice(0, topLimit) : [],
    });
  } catch (error) {
    console.error('Error calculating oracle rank:', error);
    return NextResponse.json(
      { error: 'Failed to calculate Oracle rank', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
