import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { adminProfileSchema } from "@/lib/stats/schemas";
import type {
  AdminProfile,
  GeneratedStat,
  StatIdea,
  StatIdeaSource,
  StatIdeaStatus,
  StatsAdminGameOption,
  StatRun,
  StatRunStatus,
  StatRunType,
} from "@/lib/stats/types";

const COLLECTIONS = {
  admins: "admins",
  statsIdeas: "statsIdeas",
  statRuns: "statRuns",
  generatedStats: "generatedStats",
} as const;

type GameDoc = {
  name?: string;
  year?: number;
  gameType?: string;
  status?: string;
};

function buildGameLabel(gameId: string, data: GameDoc) {
  const parts = [data.name || gameId];
  if (data.year) {
    parts.push(String(data.year));
  }
  if (data.gameType) {
    parts.push(data.gameType);
  }
  return parts.join(" • ");
}

async function listGamesByAlias(alias: string) {
  const db = getAdminDb();
  const f1Match = alias.match(/^f1-(20\d{2})$/);
  if (f1Match) {
    const year = Number(f1Match[1]);
    const snapshot = await db
      .collection("games")
      .where("year", "==", year)
      .where("gameType", "==", "f1-prediction")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as GameDoc),
    }));
  }

  const cyclingMatch = alias.match(/^cycling-(20\d{2})$/);
  if (cyclingMatch) {
    const year = Number(cyclingMatch[1]);
    const snapshot = await db.collection("games").where("year", "==", year).get();

    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as GameDoc),
      }))
      .filter((game) => game.gameType !== "f1-prediction");
  }

  return [];
}

export async function resolveAllowedGameOptions(allowedGames: string[]): Promise<StatsAdminGameOption[]> {
  const db = getAdminDb();
  const options = new Map<string, StatsAdminGameOption>();

  if (allowedGames.length === 0) {
    const snapshot = await db.collection("games").orderBy("createdAt", "desc").limit(250).get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data() as GameDoc;
        return {
          id: doc.id,
          label: buildGameLabel(doc.id, data),
          gameType: data.gameType,
          year: data.year,
          status: data.status,
        } satisfies StatsAdminGameOption;
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  for (const allowedGame of allowedGames) {
    const directDoc = await db.collection("games").doc(allowedGame).get();
    if (directDoc.exists) {
      const data = directDoc.data() as GameDoc;
      options.set(directDoc.id, {
        id: directDoc.id,
        label: buildGameLabel(directDoc.id, data),
        gameType: data.gameType,
        year: data.year,
        status: data.status,
      });
      continue;
    }

    const resolvedGames = await listGamesByAlias(allowedGame);
    for (const game of resolvedGames) {
      options.set(game.id, {
        id: game.id,
        label: buildGameLabel(game.id, game),
        gameType: game.gameType,
        year: game.year,
        status: game.status,
      });
    }
  }

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.admins).doc(uid).get();
  if (doc.exists) {
    const data = doc.data() ?? {};
    return adminProfileSchema.parse({
      uid: doc.id,
      email: typeof data.email === "string" ? data.email : "",
      role: data.role,
      allowedGames: Array.isArray(data.allowedGames) ? data.allowedGames : [],
      enabled: data.enabled === true,
    });
  }

  // Temporary fallback for existing legacy admins so Stats Lab can be tested
  // before dedicated admins/{uid} documents are provisioned.
  const legacyUserDoc = await db.collection("users").doc(uid).get();
  if (!legacyUserDoc.exists) {
    return null;
  }

  const legacyUser = legacyUserDoc.data() ?? {};
  if (legacyUser.userType !== "admin") {
    return null;
  }

  return adminProfileSchema.parse({
    uid,
    email: typeof legacyUser.email === "string" ? legacyUser.email : "",
    role: "owner",
    allowedGames: [],
    enabled: true,
  });
}

export async function createStatRun(input: {
  gameId: string;
  requestedByUid: string;
  type: StatRunType;
  model: string;
  promptVersion: string;
  selectedIdeaId: string | null;
  inputSummary: string | null;
}) {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.statRuns).doc();
  const now = Timestamp.now();

  const payload: StatRun = {
    id: ref.id,
    gameId: input.gameId,
    requestedByUid: input.requestedByUid,
    type: input.type,
    status: "pending",
    model: input.model,
    promptVersion: input.promptVersion,
    selectedIdeaId: input.selectedIdeaId,
    inputSummary: input.inputSummary,
    errorMessage: null,
    createdAt: now,
    finishedAt: null,
  };

  await ref.set(payload);
  return payload;
}

export async function completeStatRun(runId: string, status: Extract<StatRunStatus, "completed"> = "completed") {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.statRuns).doc(runId).set(
    {
      status,
      finishedAt: Timestamp.now(),
      errorMessage: null,
    },
    { merge: true }
  );
}

export async function failStatRun(runId: string, errorMessage: string) {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.statRuns).doc(runId).set(
    {
      status: "failed",
      finishedAt: Timestamp.now(),
      errorMessage,
    },
    { merge: true }
  );
}

export async function saveIdeas(input: {
  gameId: string;
  createdByUid: string;
  status?: StatIdeaStatus;
  source?: StatIdeaSource;
  ideas: Omit<StatIdea, "id" | "gameId" | "source" | "status" | "createdByUid" | "createdAt">[];
}) {
  const db = getAdminDb();
  const batch = db.batch();
  const now = Timestamp.now();
  const savedIdeas: StatIdea[] = [];

  for (const idea of input.ideas) {
    const ref = db.collection(COLLECTIONS.statsIdeas).doc();
    const payload: StatIdea = {
      id: ref.id,
      gameId: input.gameId,
      title: idea.title,
      description: idea.description,
      whyInteresting: idea.whyInteresting,
      chartType: idea.chartType,
      requiredTool: idea.requiredTool,
      confidence: idea.confidence,
      source: input.source ?? "template",
      status: input.status ?? "proposed",
      createdByUid: input.createdByUid,
      createdAt: now,
    };
    batch.set(ref, payload);
    savedIdeas.push(payload);
  }

  await batch.commit();
  return savedIdeas;
}

export async function listIdeas(params: {
  allowedGameIds: string[];
  gameId?: string;
  limit?: number;
}) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.statsIdeas)
    .orderBy("createdAt", "desc")
    .limit(Math.max(params.limit ?? 50, 1))
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as StatIdea)
    .filter((idea) =>
      params.gameId
        ? idea.gameId === params.gameId
        : params.allowedGameIds.includes(idea.gameId)
    );
}

export async function getIdeaById(ideaId: string) {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.statsIdeas).doc(ideaId).get();
  return doc.exists ? (doc.data() as StatIdea) : null;
}

export async function updateIdea(
  ideaId: string,
  updates: Partial<
    Pick<
      StatIdea,
      "title" | "description" | "whyInteresting" | "chartType" | "requiredTool" | "confidence" | "status"
    >
  >
) {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.statsIdeas).doc(ideaId).set(updates, { merge: true });
  return getIdeaById(ideaId);
}

export async function deleteIdea(ideaId: string) {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.statsIdeas).doc(ideaId).delete();
}

export async function saveGeneratedStat(input: Omit<GeneratedStat, "id" | "generatedAt">) {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.generatedStats).doc();
  const payload: GeneratedStat = {
    ...input,
    id: ref.id,
    generatedAt: Timestamp.now(),
  };

  await ref.set(payload);
  return payload;
}

export async function listGeneratedStats(params: {
  allowedGameIds: string[];
  gameId?: string;
  limit?: number;
}) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.generatedStats)
    .orderBy("generatedAt", "desc")
    .limit(Math.max(params.limit ?? 50, 1))
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as GeneratedStat)
    .filter((item) =>
      params.gameId
        ? item.gameId === params.gameId
        : params.allowedGameIds.includes(item.gameId)
    );
}

export async function getGeneratedStatById(resultId: string) {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.generatedStats).doc(resultId).get();
  return doc.exists ? (doc.data() as GeneratedStat) : null;
}

export async function deleteGeneratedStat(resultId: string) {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.generatedStats).doc(resultId).delete();
}
