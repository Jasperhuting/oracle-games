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
  riderId?: string;
  riderName?: string;
  riderTeam?: string;
  points?: number;
  isPenalty?: boolean;
  penaltyReason?: string | null;
};

type BidDocument = {
  riderNameId?: string;
  bidAt?: Date | FirestoreTimestampLike | string;
  status?: string;
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
