import { getServerFirebaseF1 } from "@/lib/firebase/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type {
  PlayerStatsSnapshot,
  StatsEntitySnapshot,
  TeamDistributionRow,
} from "@/lib/stats/types";

type FirestoreTimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

type GameDocument = {
  gameType?: string;
  year?: number;
  status?: string;
  name?: string;
  config?: {
    riderValues?: Record<string, number>;
    season?: number;
  };
};

type F1ParticipantDocument = {
  userId?: string;
  gameId?: string;
  season?: number;
  displayName?: string;
  status?: "active" | "inactive";
};

type F1PredictionDocument = {
  userId?: string;
  season?: number;
  round?: number;
  raceId?: string;
  finishOrder?: string[];
  polePosition?: string | null;
  fastestLap?: string | null;
  dnf1?: string | null;
  dnf2?: string | null;
};

type F1StandingDocument = {
  userId?: string;
  season?: number;
  totalPoints?: number;
  racesParticipated?: number;
  racePoints?: Record<string, number>;
};

type F1PointsHistoryDocument = {
  breakdown?: {
    bonusCorrect?: number;
    bonusPenalty?: number;
  };
  points?: number;
};

type F1RaceDocument = {
  round?: number;
  season?: number;
  status?: "upcoming" | "open" | "done";
};

type F1DriverDocument = {
  shortName?: string;
  firstName?: string;
  lastName?: string;
};

type PlayerTeamDocument = {
  riderNameId?: string;
  userId?: string;
  riderName?: string;
  riderTeam?: string;
  pricePaid?: number;
  pointsScored?: number;
  totalPoints?: number;
  active?: boolean;
  pointsBreakdown?: Array<{
    total?: number;
    gcPoints?: number;
    stageResult?: number;
    pointsClass?: number;
    mountainsClass?: number;
    youthClass?: number;
    combativityBonus?: number;
    teamPoints?: number;
  }>;
};

type StagePickDocument = {
  userId?: string;
  playername?: string;
  riderId?: string;
  riderName?: string;
  riderTeam?: string;
  points?: number;
  greenJerseyPoints?: number;
  isPenalty?: boolean;
  penaltyReason?: string | null;
};

type BidDocument = {
  riderNameId?: string;
  riderName?: string;
  riderTeam?: string;
  userId?: string;
  playername?: string;
  amount?: number;
  bidAt?: Date | FirestoreTimestampLike | string;
  status?: string;
};

type DraftPickDocument = {
  gameId?: string;
  userId?: string;
  playername?: string;
  round?: number;
  pick?: number;
  overallPick?: number;
  riderId?: string;
  riderName?: string;
  riderTeam?: string;
  riderPreviousPoints?: number;
  riderCurrentPoints?: number;
  growth?: number;
  pickedAt?: Date | FirestoreTimestampLike | string;
};

type GameParticipantDocument = {
  userId?: string;
  playername?: string;
  userName?: string;
  totalPoints?: number;
  ranking?: number;
  joinedAt?: Date | FirestoreTimestampLike | string;
};

const DUMMY_GAME_DATA: Record<string, StatsEntitySnapshot[]> = {
  "cycling-2026": [
    {
      key: "pogacar",
      label: "Tadej Pogacar",
      team: "UAE Team Emirates",
      cost: 28,
      points: 312,
      scoringPoints: 312,
      selectionCount: 84,
      selectedByPct: 84,
      valueScore: 11.1,
      movementDelta: 18,
    },
    {
      key: "vingegaard",
      label: "Jonas Vingegaard",
      team: "Visma | Lease a Bike",
      cost: 27,
      points: 280,
      scoringPoints: 280,
      selectionCount: 76,
      selectedByPct: 76,
      valueScore: 10.4,
      movementDelta: 7,
    },
    {
      key: "philipsen",
      label: "Jasper Philipsen",
      team: "Alpecin-Deceuninck",
      cost: 20,
      points: 198,
      scoringPoints: 198,
      selectionCount: 49,
      selectedByPct: 49,
      valueScore: 9.9,
      movementDelta: 15,
    },
    {
      key: "de-lie",
      label: "Arnaud De Lie",
      team: "Lotto",
      cost: 14,
      points: 161,
      scoringPoints: 161,
      selectionCount: 22,
      selectedByPct: 22,
      valueScore: 11.5,
      movementDelta: 21,
    },
    {
      key: "pidcock",
      label: "Tom Pidcock",
      team: "Q36.5",
      cost: 16,
      points: 132,
      scoringPoints: 132,
      selectionCount: 19,
      selectedByPct: 19,
      valueScore: 8.3,
      movementDelta: -6,
    },
    {
      key: "milan",
      label: "Jonathan Milan",
      team: "Lidl-Trek",
      cost: 15,
      points: 154,
      scoringPoints: 154,
      selectionCount: 34,
      selectedByPct: 34,
      valueScore: 10.3,
      movementDelta: 12,
    },
  ],
  "f1-2026": [
    {
      key: "verstappen",
      label: "Max Verstappen",
      team: "Red Bull Racing",
      cost: 30,
      points: 289,
      scoringPoints: 289,
      selectionCount: 88,
      selectedByPct: 88,
      valueScore: 9.6,
      movementDelta: 9,
    },
    {
      key: "norris",
      label: "Lando Norris",
      team: "McLaren",
      cost: 27,
      points: 266,
      scoringPoints: 266,
      selectionCount: 63,
      selectedByPct: 63,
      valueScore: 9.9,
      movementDelta: 11,
    },
    {
      key: "leclerc",
      label: "Charles Leclerc",
      team: "Ferrari",
      cost: 25,
      points: 231,
      scoringPoints: 231,
      selectionCount: 47,
      selectedByPct: 47,
      valueScore: 9.2,
      movementDelta: -4,
    },
    {
      key: "piastri",
      label: "Oscar Piastri",
      team: "McLaren",
      cost: 24,
      points: 224,
      scoringPoints: 224,
      selectionCount: 39,
      selectedByPct: 39,
      valueScore: 9.3,
      movementDelta: 16,
    },
    {
      key: "albon",
      label: "Alex Albon",
      team: "Williams",
      cost: 12,
      points: 118,
      scoringPoints: 118,
      selectionCount: 18,
      selectedByPct: 18,
      valueScore: 9.8,
      movementDelta: 14,
    },
    {
      key: "hulkenberg",
      label: "Nico Hulkenberg",
      team: "Sauber",
      cost: 9,
      points: 81,
      scoringPoints: 81,
      selectionCount: 7,
      selectedByPct: 7,
      valueScore: 9.0,
      movementDelta: 19,
    },
  ],
};

function getDummyGameData(gameId: string): StatsEntitySnapshot[] {
  const rows = DUMMY_GAME_DATA[gameId];
  if (!rows) {
    throw new Error(`Unsupported stats game: ${gameId}`);
  }
  return rows;
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const timestampLike = value as FirestoreTimestampLike;
    if (typeof timestampLike.toDate === "function") {
      return timestampLike.toDate();
    }
    if (typeof timestampLike.seconds === "number") {
      return new Date(timestampLike.seconds * 1000);
    }
    if (typeof timestampLike._seconds === "number") {
      return new Date(timestampLike._seconds * 1000);
    }
  }

  return null;
}

function extractSeasonFromGameId(gameId: string) {
  const match = gameId.match(/(20\d{2})$/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

async function loadPrimaryGameEntities(gameId: string, gameData: GameDocument): Promise<StatsEntitySnapshot[]> {
  const db = getAdminDb();
  const [participantsSnapshot, playerTeamsSnapshot, bidsSnapshot] = await Promise.all([
    db.collection("gameParticipants").where("gameId", "==", gameId).get(),
    db.collection("playerTeams").where("gameId", "==", gameId).get(),
    db.collection("bids").where("gameId", "==", gameId).get(),
  ]);

  const participantCount = participantsSnapshot.size || 1;
  const riderValues = gameData.config?.riderValues ?? {};
  const recentWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const priorWindowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const movementByRider = new Map<string, number>();

  for (const bidDoc of bidsSnapshot.docs) {
    const bid = bidDoc.data() as BidDocument;
    const riderNameId = bid.riderNameId;
    if (!riderNameId) {
      continue;
    }

    const bidDate = toDate(bid.bidAt);
    if (!bidDate) {
      continue;
    }

    const current = movementByRider.get(riderNameId) ?? 0;
    if (bidDate >= recentWindowStart) {
      movementByRider.set(riderNameId, current + 1);
    } else if (bidDate >= priorWindowStart) {
      movementByRider.set(riderNameId, current - 1);
    }
  }

  const aggregates = new Map<
    string,
    {
      key: string;
      label: string;
      team: string;
      points: number[];
      scoringPoints: number[];
      costs: number[];
      selectionCount: number;
    }
  >();

  function getScoringPoints(team: PlayerTeamDocument) {
    if (Array.isArray(team.pointsBreakdown) && team.pointsBreakdown.length > 0) {
      return Number(
        team.pointsBreakdown
          .reduce((sum, event) => {
            const total = typeof event.total === "number" ? event.total : 0;
            const gcPoints = typeof event.gcPoints === "number" ? event.gcPoints : 0;
            return sum + Math.max(total - gcPoints, 0);
          }, 0)
          .toFixed(2)
      );
    }

    return typeof team.pointsScored === "number" ? team.pointsScored : team.totalPoints || 0;
  }

  for (const teamDoc of playerTeamsSnapshot.docs) {
    const team = teamDoc.data() as PlayerTeamDocument;
    if (team.active === false) {
      continue;
    }

    const riderNameId = team.riderNameId;
    if (!riderNameId) {
      continue;
    }

    const aggregate = aggregates.get(riderNameId) ?? {
      key: riderNameId,
      label: team.riderName || riderNameId,
      team: team.riderTeam || "Unknown team",
      points: [],
      scoringPoints: [],
      costs: [],
      selectionCount: 0,
    };

    const points = typeof team.pointsScored === "number" ? team.pointsScored : team.totalPoints || 0;
    const scoringPoints = getScoringPoints(team);
    const rawCost =
      typeof team.pricePaid === "number" ? team.pricePaid : riderValues[riderNameId] ?? 0;

    aggregate.points.push(points);
    aggregate.scoringPoints.push(scoringPoints);
    aggregate.costs.push(rawCost);
    aggregate.selectionCount += 1;
    aggregate.label = team.riderName || aggregate.label;
    aggregate.team = team.riderTeam || aggregate.team;

    aggregates.set(riderNameId, aggregate);
  }

  return Array.from(aggregates.values())
    .map((aggregate) => {
      const highestPoints = Math.max(...aggregate.points, 0);
      const highestScoringPoints = Math.max(...aggregate.scoringPoints, 0);
      const averageCost =
        aggregate.costs.length > 0
          ? aggregate.costs.reduce((sum, cost) => sum + cost, 0) / aggregate.costs.length
          : 0;
      const selectedByPct = Number(((aggregate.selectionCount / participantCount) * 100).toFixed(1));
      const normalizedCost = Number(averageCost.toFixed(2));
      const valueScore = normalizedCost > 0 ? Number((highestPoints / normalizedCost).toFixed(2)) : 0;

      return {
        key: aggregate.key,
        label: aggregate.label,
        team: aggregate.team,
        cost: normalizedCost,
        points: highestPoints,
        scoringPoints: highestScoringPoints,
        selectionCount: aggregate.selectionCount,
        selectedByPct,
        valueScore,
        movementDelta: movementByRider.get(aggregate.key) ?? 0,
      } satisfies StatsEntitySnapshot;
    })
    .sort((a, b) => b.points - a.points);
}

// Game types that use stagePicks instead of playerTeams
const STAGE_PICK_GAME_TYPES = new Set(["slipstream", "last-man-standing", "fan-flandrien"]);

async function loadStagePickEntities(gameId: string): Promise<StatsEntitySnapshot[]> {
  const db = getAdminDb();
  const [participantsSnapshot, stagePicksSnapshot] = await Promise.all([
    db.collection("gameParticipants").where("gameId", "==", gameId).get(),
    db.collection("stagePicks").where("gameId", "==", gameId).get(),
  ]);

  const participantCount = participantsSnapshot.size || 1;

  const aggregates = new Map<
    string,
    {
      key: string;
      label: string;
      team: string;
      totalPoints: number;
      selectionCount: number;
      uniquePickers: Set<string>;
    }
  >();

  for (const pickDoc of stagePicksSnapshot.docs) {
    const pick = pickDoc.data() as StagePickDocument;
    const riderId = pick.riderId;
    if (!riderId) {
      continue;
    }
    // Skip penalty rows (missed pick, DNF, etc.)
    if (pick.isPenalty === true || (pick.penaltyReason != null && pick.penaltyReason !== "")) {
      continue;
    }

    const aggregate = aggregates.get(riderId) ?? {
      key: riderId,
      label: pick.riderName || riderId,
      team: pick.riderTeam || "Unknown team",
      totalPoints: 0,
      selectionCount: 0,
      uniquePickers: new Set<string>(),
    };

    aggregate.totalPoints += typeof pick.points === "number" ? pick.points : 0;
    aggregate.selectionCount += 1;
    if (pick.userId) {
      aggregate.uniquePickers.add(pick.userId);
    }
    aggregate.label = pick.riderName || aggregate.label;
    aggregate.team = pick.riderTeam || aggregate.team;

    aggregates.set(riderId, aggregate);
  }

  return Array.from(aggregates.values())
    .map((aggregate) => {
      const selectedByPct = Number(((aggregate.uniquePickers.size / participantCount) * 100).toFixed(1));
      return {
        key: aggregate.key,
        label: aggregate.label,
        team: aggregate.team,
        cost: 0,
        points: aggregate.totalPoints,
        scoringPoints: aggregate.totalPoints,
        selectionCount: aggregate.selectionCount,
        selectedByPct,
        valueScore: 0,
        movementDelta: 0,
      } satisfies StatsEntitySnapshot;
    })
    .sort((a, b) => b.selectionCount - a.selectionCount);
}

async function loadF1SeasonFallback(gameId: string): Promise<StatsEntitySnapshot[]> {
  const season = extractSeasonFromGameId(gameId);
  const f1Db = getServerFirebaseF1();
  const [driversSnapshot, standingsSnapshot] = await Promise.all([
    f1Db.collection("drivers").where("season", "==", season).where("isActive", "==", true).get(),
    f1Db.collection("standings").where("season", "==", season).get(),
  ]);

  if (driversSnapshot.empty) {
    return getDummyGameData(gameId);
  }

  const usageMap = new Map<string, number>();

  for (const standingDoc of standingsSnapshot.docs) {
    const standing = standingDoc.data() as { racePoints?: Record<string, number> };
    for (const raceId of Object.keys(standing.racePoints ?? {})) {
      const guessKey = raceId.split("_").pop()?.toLowerCase();
      if (guessKey) {
        usageMap.set(guessKey, (usageMap.get(guessKey) ?? 0) + 1);
      }
    }
  }

  const totalUsage = Array.from(usageMap.values()).reduce((sum, count) => sum + count, 0) || 1;

  return driversSnapshot.docs.map((doc, index) => {
    const driver = doc.data() as {
      shortName?: string;
      firstName?: string;
      lastName?: string;
      teamId?: string;
      number?: number;
    };
    const shortName = driver.shortName || doc.id;
    const selectionCount = usageMap.get(shortName.toLowerCase()) ?? 0;
    const cost = Math.max(8, 30 - index * 2);
    const points = Math.max(0, 150 - index * 11);

    return {
      key: shortName,
      label: `${driver.firstName || ""} ${driver.lastName || shortName}`.trim(),
      team: driver.teamId || "F1",
      cost,
      points,
      scoringPoints: points,
      selectionCount,
      selectedByPct: Number(((selectionCount / totalUsage) * 100).toFixed(1)),
      valueScore: Number((points / cost).toFixed(2)),
      movementDelta: 0,
    } satisfies StatsEntitySnapshot;
  });
}

async function getGameDocument(gameId: string) {
  const db = getAdminDb();
  return db.collection("games").doc(gameId).get();
}

export async function getStatsGameContext(gameId: string) {
  const gameDoc = await getGameDocument(gameId);
  if (!gameDoc.exists) {
    return null;
  }

  const gameData = gameDoc.data() as GameDocument;
  return {
    id: gameDoc.id,
    gameType: gameData.gameType ?? null,
    year: gameData.year ?? extractSeasonFromGameId(gameId),
    season: gameData.config?.season ?? gameData.year ?? extractSeasonFromGameId(gameId),
    name: gameData.name ?? gameDoc.id,
  };
}

export async function loadPlayerStats(gameId: string): Promise<PlayerStatsSnapshot[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("gameParticipants").where("gameId", "==", gameId).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as GameParticipantDocument;
    const ranking = typeof data.ranking === "number" && data.ranking > 0 ? data.ranking : null;
    return {
      userId: data.userId || doc.id,
      playerName: data.playername || data.userName || data.userId || "Unknown player",
      totalPoints: typeof data.totalPoints === "number" ? data.totalPoints : 0,
      ranking,
      participations: 1,
      averageRank: ranking,
    } satisfies PlayerStatsSnapshot;
  });
}

export async function loadPlayerActivityStats(gameId: string): Promise<PlayerStatsSnapshot[]> {
  const db = getAdminDb();
  const gameDoc = await getGameDocument(gameId);

  if (!gameDoc.exists) {
    return [];
  }

  const gameData = gameDoc.data() as GameDocument;
  const targetYear = gameData.year ?? extractSeasonFromGameId(gameId);
  const gamesSnapshot = await db.collection("games").where("year", "==", targetYear).get();
  const relevantGameIds = new Set(gamesSnapshot.docs.map((doc) => doc.id));

  if (relevantGameIds.size === 0) {
    return [];
  }

  const participantsSnapshot = await db.collection("gameParticipants").get();
  const aggregates = new Map<
    string,
    {
      userId: string;
      playerName: string;
      totalPoints: number;
      participations: number;
      rankings: number[];
    }
  >();

  for (const participantDoc of participantsSnapshot.docs) {
    const data = participantDoc.data() as GameParticipantDocument & { gameId?: string };
    if (!data.gameId || !relevantGameIds.has(data.gameId) || !data.userId) {
      continue;
    }

    const aggregate = aggregates.get(data.userId) ?? {
      userId: data.userId,
      playerName: data.playername || data.userName || data.userId,
      totalPoints: 0,
      participations: 0,
      rankings: [],
    };

    aggregate.totalPoints += typeof data.totalPoints === "number" ? data.totalPoints : 0;
    aggregate.participations += 1;
    if (typeof data.ranking === "number" && data.ranking > 0) {
      aggregate.rankings.push(data.ranking);
    }
    aggregate.playerName = data.playername || data.userName || aggregate.playerName;

    aggregates.set(data.userId, aggregate);
  }

  return Array.from(aggregates.values()).map((aggregate) => ({
    userId: aggregate.userId,
    playerName: aggregate.playerName,
    totalPoints: aggregate.totalPoints,
    ranking: aggregate.rankings.length > 0 ? Math.min(...aggregate.rankings) : null,
    participations: aggregate.participations,
    averageRank:
      aggregate.rankings.length > 0
        ? Number(
            (
              aggregate.rankings.reduce((sum, ranking) => sum + ranking, 0) / aggregate.rankings.length
            ).toFixed(2)
          )
        : null,
  }));
}

export async function loadStatsEntities(gameId: string): Promise<StatsEntitySnapshot[]> {
  const gameDoc = await getGameDocument(gameId);

  if (gameDoc.exists) {
    const gameData = gameDoc.data() as GameDocument;
    const gameType = gameData.gameType;

    // Stage-pick based games store rider selections in stagePicks, not playerTeams
    if (gameType && STAGE_PICK_GAME_TYPES.has(gameType)) {
      return loadStagePickEntities(gameId);
    }

    // F1 prediction games have their own dedicated loaders; entity tools don't apply
    if (gameType === "f1-prediction") {
      return [];
    }

    return loadPrimaryGameEntities(gameId, gameData);
  }

  if (gameId.startsWith("f1-")) {
    // TODO: Replace this F1 fallback with a true F1-specific stats model once the desired
    // selection/ownership semantics are defined for the oracle-games-f1 schema.
    return loadF1SeasonFallback(gameId);
  }

  return getDummyGameData(gameId);
}

function buildF1DriverNameMap(driverDocs: Array<{ id: string; data: F1DriverDocument }>) {
  const driverNameMap = new Map<string, string>();

  for (const driverDoc of driverDocs) {
    const driver = driverDoc.data;
    const shortName = driver.shortName || driverDoc.id.split("_")[0];
    const fullName = `${driver.firstName || ""} ${driver.lastName || shortName}`.trim();
    driverNameMap.set(shortName, fullName);
  }

  return driverNameMap;
}

async function getF1SeasonForGame(gameId: string) {
  const context = await getStatsGameContext(gameId);
  return context?.season ?? extractSeasonFromGameId(gameId);
}

export async function loadF1BestPredictorRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const [participantsSnapshot, standingsSnapshot] = await Promise.all([
    f1Db.collection("participants").where("season", "==", season).where("status", "==", "active").get(),
    f1Db.collection("standings").where("season", "==", season).get(),
  ]);

  const participantMap = new Map<string, string>();
  for (const participantDoc of participantsSnapshot.docs) {
    const participant = participantDoc.data() as F1ParticipantDocument;
    if (participant.userId) {
      participantMap.set(participant.userId, participant.displayName || participant.userId);
    }
  }

  return standingsSnapshot.docs
    .map((doc) => doc.data() as F1StandingDocument)
    .filter((standing) => typeof standing.userId === "string")
    .map((standing) => {
      const totalPoints = typeof standing.totalPoints === "number" ? standing.totalPoints : 0;
      const racesParticipated =
        typeof standing.racesParticipated === "number"
          ? standing.racesParticipated
          : Object.keys(standing.racePoints ?? {}).length;

      return {
        player: participantMap.get(standing.userId!) || standing.userId!,
        totalPenaltyPoints: totalPoints,
        racesParticipated,
        averagePenaltyPerRace:
          racesParticipated > 0 ? Number((totalPoints / racesParticipated).toFixed(2)) : null,
      };
    })
    .sort((a, b) => a.totalPenaltyPoints - b.totalPenaltyPoints);
}

export async function loadF1PredictionActivityRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const [participantsSnapshot, predictionsSnapshot, racesSnapshot] = await Promise.all([
    f1Db.collection("participants").where("season", "==", season).where("status", "==", "active").get(),
    f1Db.collection("predictions").where("season", "==", season).get(),
    f1Db.collection("races").where("season", "==", season).get(),
  ]);

  const relevantRaces = racesSnapshot.docs
    .map((doc) => doc.data() as F1RaceDocument)
    .filter((race) => race.status === "done" || race.status === "open");
  const relevantRaceIds = new Set(
    racesSnapshot.docs
      .filter((doc) => {
        const race = doc.data() as F1RaceDocument;
        return race.status === "done" || race.status === "open";
      })
      .map((doc) => doc.id)
  );

  const predictionCounts = new Map<string, number>();
  for (const predictionDoc of predictionsSnapshot.docs) {
    const prediction = predictionDoc.data() as F1PredictionDocument;
    if (!prediction.userId || !prediction.raceId || !relevantRaceIds.has(prediction.raceId)) {
      continue;
    }
    predictionCounts.set(prediction.userId, (predictionCounts.get(prediction.userId) ?? 0) + 1);
  }

  const raceCount = relevantRaces.length;

  return participantsSnapshot.docs.map((doc) => {
    const participant = doc.data() as F1ParticipantDocument;
    const submittedPredictions = predictionCounts.get(participant.userId || doc.id) ?? 0;
    const missingPredictions = Math.max(raceCount - submittedPredictions, 0);

    return {
      player: participant.displayName || participant.userId || doc.id,
      submittedPredictions,
      missingPredictions,
      submissionRatePct:
        raceCount > 0 ? Number(((submittedPredictions / raceCount) * 100).toFixed(1)) : 0,
    };
  });
}

export async function loadF1BonusSpecialistRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const participantsSnapshot = await f1Db
    .collection("participants")
    .where("season", "==", season)
    .where("status", "==", "active")
    .get();

  const rows = await Promise.all(
    participantsSnapshot.docs.map(async (doc) => {
      const participant = doc.data() as F1ParticipantDocument;
      const userId = participant.userId || doc.id;
      const historySnapshot = await f1Db
        .collection("standings")
        .doc(`${userId}_${season}`)
        .collection("pointsHistory")
        .get();

      let bonusHits = 0;
      let bonusPenaltySaved = 0;
      for (const historyDoc of historySnapshot.docs) {
        const history = historyDoc.data() as F1PointsHistoryDocument;
        bonusHits +=
          typeof history.breakdown?.bonusCorrect === "number" ? history.breakdown.bonusCorrect : 0;
        bonusPenaltySaved +=
          typeof history.breakdown?.bonusPenalty === "number"
            ? Math.abs(history.breakdown.bonusPenalty)
            : 0;
      }

      return {
        player: participant.displayName || userId,
        bonusHits,
        bonusPenaltySaved,
        racesScored: historySnapshot.size,
      };
    })
  );

  return rows.sort((a, b) => b.bonusHits - a.bonusHits || b.bonusPenaltySaved - a.bonusPenaltySaved);
}

export async function loadF1PopularWinnerPickRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const [predictionsSnapshot, driversSnapshot] = await Promise.all([
    f1Db.collection("predictions").where("season", "==", season).get(),
    f1Db.collection("drivers").where("season", "==", season).get(),
  ]);

  const driverNameMap = buildF1DriverNameMap(
    driversSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as F1DriverDocument }))
  );

  const counts = new Map<string, number>();
  for (const predictionDoc of predictionsSnapshot.docs) {
    const prediction = predictionDoc.data() as F1PredictionDocument;
    const winnerPick = prediction.finishOrder?.[0];
    if (!winnerPick) {
      continue;
    }
    counts.set(winnerPick, (counts.get(winnerPick) ?? 0) + 1);
  }

  const totalWinnerPicks = Array.from(counts.values()).reduce((sum, count) => sum + count, 0) || 1;

  return Array.from(counts.entries())
    .map(([driverShortName, picks]) => ({
      driver: driverNameMap.get(driverShortName) || driverShortName,
      winnerPickCount: picks,
      winnerPickPct: Number(((picks / totalWinnerPicks) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.winnerPickCount - a.winnerPickCount);
}

// ─── Slipstream / stage-pick specific loaders ────────────────────────────────

export async function loadSlipstreamGreenJerseyRows(gameId: string) {
  const db = getAdminDb();
  const stagePicksSnapshot = await db
    .collection("stagePicks")
    .where("gameId", "==", gameId)
    .get();

  const aggregates = new Map<
    string,
    { key: string; label: string; team: string; totalGreenPoints: number; pickCount: number }
  >();

  for (const pickDoc of stagePicksSnapshot.docs) {
    const pick = pickDoc.data() as StagePickDocument;
    const riderId = pick.riderId;
    if (!riderId || pick.isPenalty === true) {
      continue;
    }

    const greenPoints =
      typeof pick.greenJerseyPoints === "number" ? pick.greenJerseyPoints : 0;

    const aggregate = aggregates.get(riderId) ?? {
      key: riderId,
      label: pick.riderName || riderId,
      team: pick.riderTeam || "Unknown team",
      totalGreenPoints: 0,
      pickCount: 0,
    };

    aggregate.totalGreenPoints += greenPoints;
    aggregate.pickCount += 1;
    aggregate.label = pick.riderName || aggregate.label;
    aggregate.team = pick.riderTeam || aggregate.team;

    aggregates.set(riderId, aggregate);
  }

  return Array.from(aggregates.values())
    .filter((a) => a.totalGreenPoints > 0)
    .map((aggregate) => ({
      rider: aggregate.label,
      team: aggregate.team,
      totalGreenJerseyPoints: aggregate.totalGreenPoints,
      pickCount: aggregate.pickCount,
      avgGreenPerPick: Number((aggregate.totalGreenPoints / aggregate.pickCount).toFixed(2)),
    }))
    .sort((a, b) => b.totalGreenJerseyPoints - a.totalGreenJerseyPoints);
}

export async function loadSlipstreamPenaltyRows(gameId: string) {
  const db = getAdminDb();
  const [participantsSnapshot, stagePicksSnapshot] = await Promise.all([
    db.collection("gameParticipants").where("gameId", "==", gameId).get(),
    db.collection("stagePicks").where("gameId", "==", gameId).get(),
  ]);

  const playerNameMap = new Map<string, string>();
  for (const doc of participantsSnapshot.docs) {
    const data = doc.data() as GameParticipantDocument;
    if (data.userId) {
      playerNameMap.set(data.userId, data.playername || data.userName || data.userId);
    }
  }

  const aggregates = new Map<
    string,
    {
      userId: string;
      playerName: string;
      totalPenalties: number;
      dnf: number;
      dns: number;
      missedPick: number;
      totalPicks: number;
    }
  >();

  for (const pickDoc of stagePicksSnapshot.docs) {
    const pick = pickDoc.data() as StagePickDocument & { userId?: string; playername?: string };
    if (!pick.userId) {
      continue;
    }

    const aggregate = aggregates.get(pick.userId) ?? {
      userId: pick.userId,
      playerName: playerNameMap.get(pick.userId) || pick.playername || pick.userId,
      totalPenalties: 0,
      dnf: 0,
      dns: 0,
      missedPick: 0,
      totalPicks: 0,
    };

    aggregate.totalPicks += 1;

    if (pick.isPenalty === true || (pick.penaltyReason != null && pick.penaltyReason !== "")) {
      aggregate.totalPenalties += 1;
      if (pick.penaltyReason === "dnf") aggregate.dnf += 1;
      else if (pick.penaltyReason === "dns") aggregate.dns += 1;
      else if (pick.penaltyReason === "missed_pick") aggregate.missedPick += 1;
    }

    aggregates.set(pick.userId, aggregate);
  }

  return Array.from(aggregates.values())
    .map((aggregate) => ({
      player: aggregate.playerName,
      totalPenalties: aggregate.totalPenalties,
      totalPicks: aggregate.totalPicks,
      penaltyRatePct:
        aggregate.totalPicks > 0
          ? Number(((aggregate.totalPenalties / aggregate.totalPicks) * 100).toFixed(1))
          : 0,
      dnf: aggregate.dnf,
      dns: aggregate.dns,
      missedPick: aggregate.missedPick,
    }))
    .sort((a, b) => b.totalPenalties - a.totalPenalties);
}

// ─── Draft game loaders (draftPicks-based) ───────────────────────────────────

export async function loadDraftPickROIRows(gameId: string) {
  const db = getAdminDb();
  const [draftPicksSnapshot, playerTeamsSnapshot] = await Promise.all([
    db.collection("draftPicks").where("gameId", "==", gameId).get(),
    db.collection("playerTeams").where("gameId", "==", gameId).get(),
  ]);

  // Build a map from riderId -> pointsScored using playerTeams
  const riderPoints = new Map<string, number>();
  for (const teamDoc of playerTeamsSnapshot.docs) {
    const team = teamDoc.data() as PlayerTeamDocument;
    if (team.riderNameId) {
      const pts =
        typeof team.pointsScored === "number" ? team.pointsScored : team.totalPoints || 0;
      // Keep the highest if multiple (shouldn't happen but be safe)
      riderPoints.set(team.riderNameId, Math.max(riderPoints.get(team.riderNameId) ?? 0, pts));
    }
  }

  // Aggregate by draft round
  const roundAggregates = new Map<
    number,
    { round: number; totalPoints: number; count: number }
  >();
  // Also keep per-pick detail for top picks stat
  const allPicks: Array<{
    rider: string;
    player: string;
    round: number;
    overallPick: number;
    points: number;
  }> = [];

  for (const pickDoc of draftPicksSnapshot.docs) {
    const pick = pickDoc.data() as DraftPickDocument;
    if (!pick.round || !pick.riderId) {
      continue;
    }

    const pts = riderPoints.get(pick.riderId) ?? 0;
    const round = pick.round;
    const overallPick = pick.overallPick || pick.pick || 0;

    const aggregate = roundAggregates.get(round) ?? { round, totalPoints: 0, count: 0 };
    aggregate.totalPoints += pts;
    aggregate.count += 1;
    roundAggregates.set(round, aggregate);

    allPicks.push({
      rider: pick.riderName || pick.riderId,
      player: pick.playername || pick.userId || "Unknown",
      round,
      overallPick,
      points: pts,
    });
  }

  return Array.from(roundAggregates.values())
    .map((aggregate) => ({
      round: aggregate.round,
      avgPoints: aggregate.count > 0 ? Number((aggregate.totalPoints / aggregate.count).toFixed(1)) : 0,
      totalPoints: aggregate.totalPoints,
      pickCount: aggregate.count,
    }))
    .sort((a, b) => a.round - b.round);
}

export async function loadRisingStarsGrowthRows(gameId: string) {
  const db = getAdminDb();
  const draftPicksSnapshot = await db
    .collection("draftPicks")
    .where("gameId", "==", gameId)
    .get();

  return draftPicksSnapshot.docs
    .map((doc) => {
      const pick = doc.data() as DraftPickDocument;
      return {
        rider: pick.riderName || pick.riderId || "Unknown",
        player: pick.playername || pick.userId || "Unknown",
        previousPoints: typeof pick.riderPreviousPoints === "number" ? pick.riderPreviousPoints : 0,
        currentPoints: typeof pick.riderCurrentPoints === "number" ? pick.riderCurrentPoints : 0,
        growth: typeof pick.growth === "number" ? pick.growth : 0,
        round: pick.round || 0,
        overallPick: pick.overallPick || pick.pick || 0,
      };
    })
    .filter((row) => row.rider !== "Unknown")
    .sort((a, b) => b.growth - a.growth);
}

// ─── Auctioneer loaders (bids + playerTeams) ─────────────────────────────────

export async function loadAuctionBudgetEfficiencyRows(gameId: string) {
  const db = getAdminDb();
  const [playerTeamsSnapshot, participantsSnapshot] = await Promise.all([
    db.collection("playerTeams").where("gameId", "==", gameId).get(),
    db.collection("gameParticipants").where("gameId", "==", gameId).get(),
  ]);

  const playerNameMap = new Map<string, string>();
  for (const doc of participantsSnapshot.docs) {
    const data = doc.data() as GameParticipantDocument;
    if (data.userId) {
      playerNameMap.set(data.userId, data.playername || data.userName || data.userId);
    }
  }

  const aggregates = new Map<
    string,
    { userId: string; playerName: string; spentBudget: number; totalPoints: number; riderCount: number }
  >();

  for (const teamDoc of playerTeamsSnapshot.docs) {
    const team = teamDoc.data() as PlayerTeamDocument;
    if (!team.userId || team.active === false) {
      continue;
    }

    const pts =
      typeof team.pointsScored === "number" ? team.pointsScored : team.totalPoints || 0;
    const cost = typeof team.pricePaid === "number" ? team.pricePaid : 0;

    const aggregate = aggregates.get(team.userId) ?? {
      userId: team.userId,
      playerName: playerNameMap.get(team.userId) || team.userId,
      spentBudget: 0,
      totalPoints: 0,
      riderCount: 0,
    };

    aggregate.spentBudget += cost;
    aggregate.totalPoints += pts;
    aggregate.riderCount += 1;

    aggregates.set(team.userId, aggregate);
  }

  return Array.from(aggregates.values())
    .filter((a) => a.spentBudget > 0)
    .map((aggregate) => ({
      player: aggregate.playerName,
      spentBudget: Math.round(aggregate.spentBudget),
      totalPoints: aggregate.totalPoints,
      riderCount: aggregate.riderCount,
      pointsPerCoin: Number((aggregate.totalPoints / aggregate.spentBudget).toFixed(2)),
    }))
    .sort((a, b) => b.pointsPerCoin - a.pointsPerCoin);
}

export async function loadAuctionMostContestedRows(gameId: string) {
  const db = getAdminDb();
  const bidsSnapshot = await db.collection("bids").where("gameId", "==", gameId).get();

  const aggregates = new Map<
    string,
    {
      key: string;
      label: string;
      team: string;
      totalBids: number;
      highestBid: number;
      uniqueBidders: Set<string>;
    }
  >();

  for (const bidDoc of bidsSnapshot.docs) {
    const bid = bidDoc.data() as BidDocument;
    const riderNameId = bid.riderNameId;
    if (!riderNameId) {
      continue;
    }

    const aggregate = aggregates.get(riderNameId) ?? {
      key: riderNameId,
      label: bid.riderName || riderNameId,
      team: bid.riderTeam || "Unknown team",
      totalBids: 0,
      highestBid: 0,
      uniqueBidders: new Set<string>(),
    };

    aggregate.totalBids += 1;
    if (typeof bid.amount === "number" && bid.amount > aggregate.highestBid) {
      aggregate.highestBid = bid.amount;
    }
    if (bid.userId) {
      aggregate.uniqueBidders.add(bid.userId);
    }
    aggregate.label = bid.riderName || aggregate.label;
    aggregate.team = bid.riderTeam || aggregate.team;

    aggregates.set(riderNameId, aggregate);
  }

  return Array.from(aggregates.values())
    .map((aggregate) => ({
      rider: aggregate.label,
      team: aggregate.team,
      totalBids: aggregate.totalBids,
      uniqueBidders: aggregate.uniqueBidders.size,
      highestBid: aggregate.highestBid,
    }))
    .sort((a, b) => b.totalBids - a.totalBids);
}

// ─── Season-level loaders (seasonPoints collection) ──────────────────────────

export async function loadSeasonTopRidersRows(gameId: string) {
  const context = await getStatsGameContext(gameId);
  const year = context?.year ?? new Date().getFullYear();
  const db = getAdminDb();

  const snapshot = await db
    .collection("seasonPoints")
    .where("year", "==", year)
    .orderBy("totalPoints", "desc")
    .limit(50)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as {
      riderName?: string;
      totalPoints?: number;
      year?: number;
    };
    return {
      rider: data.riderName || doc.id,
      totalPoints: typeof data.totalPoints === "number" ? data.totalPoints : 0,
      year: data.year || year,
    };
  });
}

// ─── Player win-rate loader (cross-game, same year + gameType) ────────────────

export async function loadPlayerWinRateRows(gameId: string) {
  const db = getAdminDb();
  const gameDoc = await getGameDocument(gameId);
  if (!gameDoc.exists) {
    return [];
  }

  const gameData = gameDoc.data() as GameDocument;
  const targetYear = gameData.year ?? extractSeasonFromGameId(gameId);
  const targetType = gameData.gameType;

  let gamesQuery = db.collection("games").where("year", "==", targetYear);
  if (targetType) {
    gamesQuery = gamesQuery.where("gameType", "==", targetType) as typeof gamesQuery;
  }
  const gamesSnapshot = await gamesQuery.get();
  const relevantGameIds = new Set(gamesSnapshot.docs.map((doc) => doc.id));

  if (relevantGameIds.size === 0) {
    return [];
  }

  const participantsSnapshot = await db.collection("gameParticipants").get();

  const aggregates = new Map<
    string,
    {
      userId: string;
      playerName: string;
      totalGames: number;
      top3Finishes: number;
      top10Finishes: number;
      rankings: number[];
    }
  >();

  for (const doc of participantsSnapshot.docs) {
    const data = doc.data() as GameParticipantDocument & { gameId?: string };
    if (!data.gameId || !relevantGameIds.has(data.gameId) || !data.userId) {
      continue;
    }
    if (typeof data.ranking !== "number" || data.ranking <= 0) {
      continue;
    }

    const aggregate = aggregates.get(data.userId) ?? {
      userId: data.userId,
      playerName: data.playername || data.userName || data.userId,
      totalGames: 0,
      top3Finishes: 0,
      top10Finishes: 0,
      rankings: [],
    };

    aggregate.totalGames += 1;
    aggregate.rankings.push(data.ranking);
    if (data.ranking <= 3) aggregate.top3Finishes += 1;
    if (data.ranking <= 10) aggregate.top10Finishes += 1;
    aggregate.playerName = data.playername || data.userName || aggregate.playerName;

    aggregates.set(data.userId, aggregate);
  }

  return Array.from(aggregates.values())
    .filter((a) => a.totalGames >= 2)
    .map((aggregate) => ({
      player: aggregate.playerName,
      totalGames: aggregate.totalGames,
      top3Finishes: aggregate.top3Finishes,
      top3Rate: Number(((aggregate.top3Finishes / aggregate.totalGames) * 100).toFixed(1)),
      top10Finishes: aggregate.top10Finishes,
      avgRanking: Number(
        (aggregate.rankings.reduce((s, r) => s + r, 0) / aggregate.rankings.length).toFixed(1)
      ),
    }))
    .sort(
      (a, b) => b.top3Finishes - a.top3Finishes || b.top3Rate - a.top3Rate
    );
}

// ─── New F1 loaders ───────────────────────────────────────────────────────────

export async function loadF1TeamPopularityRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const [predictionsSnapshot, driversSnapshot] = await Promise.all([
    f1Db.collection("predictions").where("season", "==", season).get(),
    f1Db.collection("drivers").where("season", "==", season).get(),
  ]);

  // Map driver shortName -> teamId (first part, e.g. "redbull")
  const driverTeamMap = new Map<string, string>();
  for (const doc of driversSnapshot.docs) {
    const driver = doc.data() as F1DriverDocument & { teamId?: string };
    const shortName = driver.shortName || doc.id.split("_")[0];
    if (driver.teamId) {
      driverTeamMap.set(shortName, driver.teamId.split("_")[0]);
    }
  }

  const teamCounts = new Map<string, number>();
  let total = 0;

  for (const predictionDoc of predictionsSnapshot.docs) {
    const prediction = predictionDoc.data() as F1PredictionDocument;
    const winnerPick = prediction.finishOrder?.[0];
    if (!winnerPick) {
      continue;
    }
    const teamId = driverTeamMap.get(winnerPick);
    if (!teamId) {
      continue;
    }
    teamCounts.set(teamId, (teamCounts.get(teamId) ?? 0) + 1);
    total += 1;
  }

  const denominator = total || 1;

  return Array.from(teamCounts.entries())
    .map(([team, count]) => ({
      team,
      winnerPickCount: count,
      winnerPickPct: Number(((count / denominator) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.winnerPickCount - a.winnerPickCount);
}

type F1RaceResultDocument = {
  raceId?: string;
  season?: number;
  round?: number;
  finishOrder?: string[];
};

export async function loadF1PodiumAccuracyRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const [participantsSnapshot, predictionsSnapshot, raceResultsSnapshot] = await Promise.all([
    f1Db.collection("participants").where("season", "==", season).where("status", "==", "active").get(),
    f1Db.collection("predictions").where("season", "==", season).get(),
    f1Db.collection("raceResults").where("season", "==", season).get(),
  ]);

  const participantMap = new Map<string, string>();
  for (const doc of participantsSnapshot.docs) {
    const p = doc.data() as F1ParticipantDocument;
    if (p.userId) {
      participantMap.set(p.userId, p.displayName || p.userId);
    }
  }

  // Build raceId -> actual top3
  const resultsMap = new Map<string, string[]>();
  for (const resultDoc of raceResultsSnapshot.docs) {
    const result = resultDoc.data() as F1RaceResultDocument;
    const raceId = result.raceId || resultDoc.id;
    const top3 = (result.finishOrder || []).slice(0, 3);
    if (top3.length > 0) {
      resultsMap.set(raceId, top3);
    }
  }

  if (resultsMap.size === 0) {
    return [];
  }

  const aggregates = new Map<
    string,
    {
      playerName: string;
      racesEvaluated: number;
      exactWinnerHits: number;
      podiumDriverHits: number;
    }
  >();

  for (const predictionDoc of predictionsSnapshot.docs) {
    const prediction = predictionDoc.data() as F1PredictionDocument;
    if (!prediction.userId || !prediction.raceId) {
      continue;
    }

    const actual = resultsMap.get(prediction.raceId);
    if (!actual) {
      continue;
    }

    const predictedTop3 = (prediction.finishOrder || []).slice(0, 3);
    const actualSet = new Set(actual);

    const aggregate = aggregates.get(prediction.userId) ?? {
      playerName: participantMap.get(prediction.userId) || prediction.userId,
      racesEvaluated: 0,
      exactWinnerHits: 0,
      podiumDriverHits: 0,
    };

    aggregate.racesEvaluated += 1;
    if (predictedTop3[0] === actual[0]) {
      aggregate.exactWinnerHits += 1;
    }
    for (const driver of predictedTop3) {
      if (actualSet.has(driver)) {
        aggregate.podiumDriverHits += 1;
      }
    }

    aggregates.set(prediction.userId, aggregate);
  }

  return Array.from(aggregates.values())
    .filter((a) => a.racesEvaluated > 0)
    .map((aggregate) => ({
      player: aggregate.playerName,
      racesEvaluated: aggregate.racesEvaluated,
      exactWinnerHits: aggregate.exactWinnerHits,
      winnerHitRate: Number(
        ((aggregate.exactWinnerHits / aggregate.racesEvaluated) * 100).toFixed(1)
      ),
      totalPodiumDriverHits: aggregate.podiumDriverHits,
      avgPodiumHitsPerRace: Number(
        (aggregate.podiumDriverHits / aggregate.racesEvaluated).toFixed(2)
      ),
    }))
    .sort(
      (a, b) =>
        b.totalPodiumDriverHits - a.totalPodiumDriverHits ||
        b.exactWinnerHits - a.exactWinnerHits
    );
}

export async function loadF1DriverAvgPositionRows(gameId: string) {
  const season = await getF1SeasonForGame(gameId);
  const f1Db = getServerFirebaseF1();
  const [predictionsSnapshot, driversSnapshot] = await Promise.all([
    f1Db.collection("predictions").where("season", "==", season).get(),
    f1Db.collection("drivers").where("season", "==", season).get(),
  ]);

  const driverNameMap = buildF1DriverNameMap(
    driversSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as F1DriverDocument }))
  );

  const aggregates = new Map<
    string,
    { totalPredictedPosition: number; count: number; top3Count: number }
  >();

  for (const predictionDoc of predictionsSnapshot.docs) {
    const prediction = predictionDoc.data() as F1PredictionDocument;
    const finishOrder = prediction.finishOrder || [];

    for (let pos = 0; pos < finishOrder.length; pos++) {
      const driver = finishOrder[pos];
      if (!driver) {
        continue;
      }

      const aggregate = aggregates.get(driver) ?? {
        totalPredictedPosition: 0,
        count: 0,
        top3Count: 0,
      };

      aggregate.totalPredictedPosition += pos + 1;
      aggregate.count += 1;
      if (pos < 3) {
        aggregate.top3Count += 1;
      }

      aggregates.set(driver, aggregate);
    }
  }

  return Array.from(aggregates.entries())
    .filter(([, a]) => a.count > 0)
    .map(([shortName, aggregate]) => ({
      driver: driverNameMap.get(shortName) || shortName,
      avgPredictedPosition: Number(
        (aggregate.totalPredictedPosition / aggregate.count).toFixed(1)
      ),
      predictedTop3Count: aggregate.top3Count,
      top3Rate: Number(((aggregate.top3Count / aggregate.count) * 100).toFixed(1)),
    }))
    .sort((a, b) => a.avgPredictedPosition - b.avgPredictedPosition);
}

export async function loadTeamDistribution(gameId: string): Promise<TeamDistributionRow[]> {
  const rows = await loadStatsEntities(gameId);
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.team, (totals.get(row.team) ?? 0) + row.selectionCount);
  }

  const totalCount = rows.reduce((sum, row) => sum + row.selectionCount, 0) || 1;

  return Array.from(totals.entries())
    .map(([team, picks]) => ({
      team,
      picks,
      percentage: Number(((picks / totalCount) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.picks - a.picks);
}
