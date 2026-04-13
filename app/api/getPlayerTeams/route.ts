import { getServerFirebase } from "@/lib/firebase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ApiErrorResponse, PlayerTeam, PlayerTeamResponse } from "@/lib/types";
import { FieldPath } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";

export const PLAYER_TEAMS_CACHE_TAG = "player-teams";

type PlayerTeamsCursor = {
  pointsScored: number;
  id: string;
};

function getTeamPath(teamRef: unknown): string | null {
  if (!teamRef || typeof teamRef !== "object") return null;
  if ("path" in teamRef && typeof teamRef.path === "string") {
    return teamRef.path;
  }
  return null;
}

function encodeCursor(cursor: PlayerTeamsCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(rawCursor: string): PlayerTeamsCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(rawCursor, "base64url").toString("utf8"),
    ) as Partial<PlayerTeamsCursor>;
    if (
      typeof parsed.pointsScored !== "number" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }
    return { pointsScored: parsed.pointsScored, id: parsed.id };
  } catch {
    return null;
  }
}

type PlayerTeamsPageResult = {
  uniqueRiders: PlayerTeam[];
  riders: PlayerTeam[];
  pagination: {
    offset: number;
    limit: number;
    count: number;
    totalCount: number | null;
    nextCursor: string | null;
  };
};

async function fetchPlayerTeamsPageUncached(
  cursorStr: string | null,
  limit: number,
  offset: number,
): Promise<PlayerTeamsPageResult> {
  const db = getServerFirebase();
  const cursor = cursorStr ? decodeCursor(cursorStr) : null;

  let query = db
    .collection("playerTeams")
    .orderBy("pointsScored", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (cursor) {
    query = query.startAfter(cursor.pointsScored, cursor.id);
  } else if (offset > 0) {
    query = query.offset(offset);
  }
  query = query.limit(limit);

  const snapshot = await query.get();

  let totalCount: number | null = null;
  if (!cursorStr && offset === 0) {
    const countSnapshot = await db.collection("playerTeams").count().get();
    totalCount = countSnapshot.data().count;
  }

  const teamPaths = Array.from(
    new Set(
      snapshot.docs
        .map((doc) => getTeamPath(doc.data().team))
        .filter((path): path is string => Boolean(path)),
    ),
  );
  const teamSnapshots =
    teamPaths.length > 0
      ? await db.getAll(...teamPaths.map((path) => db.doc(path)))
      : [];
  const teamsByPath = new Map<string, Record<string, unknown> | null>();
  teamSnapshots.forEach((teamDoc) => {
    teamsByPath.set(
      teamDoc.ref.path,
      teamDoc.exists ? (teamDoc.data() as Record<string, unknown>) : null,
    );
  });

  const ridersWithTeamData: PlayerTeam[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    const teamPath = getTeamPath(data.team);
    const teamData = teamPath ? (teamsByPath.get(teamPath) ?? null) : null;
    const riderPoints = data.pointsScored ?? 0;

    return {
      id: doc.id,
      gameId: data.gameId,
      userId: data.userId,
      riderNameId: data.riderNameId,
      acquiredAt: data.acquiredAt,
      acquisitionType: data.acquisitionType,
      pricePaid: data.pricePaid,
      draftRound: data.draftRound,
      draftPick: data.draftPick,
      riderName: data.riderName,
      riderTeam: data.riderTeam,
      riderCountry: data.riderCountry,
      jerseyImage: data.jerseyImage,
      riderValue: data.riderValue,
      pointsScored: riderPoints,
      pointsBreakdown: data.pointsBreakdown || [],
      team: teamData,
    };
  });

  const uniqueRidersMap = new Map<string, PlayerTeam>();
  ridersWithTeamData.forEach((rider) => {
    if (rider.riderNameId && !uniqueRidersMap.has(rider.riderNameId)) {
      uniqueRidersMap.set(rider.riderNameId, rider);
    }
  });
  const riders = Array.from(uniqueRidersMap.values());

  const lastDoc =
    snapshot.docs.length === limit
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;
  const nextCursor = lastDoc
    ? encodeCursor({
        pointsScored: lastDoc.get("pointsScored") ?? 0,
        id: lastDoc.id,
      })
    : null;

  return {
    uniqueRiders: riders,
    riders: ridersWithTeamData,
    pagination: {
      offset: cursor ? 0 : offset,
      limit,
      count: riders.length,
      totalCount,
      nextCursor,
    },
  };
}

const fetchPlayerTeamsPageCached = unstable_cache(
  async (
    cursorStr: string | null,
    limit: number,
    offset: number,
  ): Promise<PlayerTeamsPageResult> =>
    fetchPlayerTeamsPageUncached(cursorStr, limit, offset),
  ["player-teams-page"],
  { tags: [PLAYER_TEAMS_CACHE_TAG], revalidate: 86400 },
);

export async function GET(
  request: NextRequest,
): Promise<NextResponse<PlayerTeamResponse | ApiErrorResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");
  const cursorStr = searchParams.get("cursor");

  try {
    const shouldBypassCache = limit > 500;
    const data = shouldBypassCache
      ? await fetchPlayerTeamsPageUncached(cursorStr, limit, offset)
      : await fetchPlayerTeamsPageCached(cursorStr, limit, offset);
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    if (shouldBypassCache) {
      response.headers.set("X-PlayerTeams-Cache", "bypass");
    }
    return response;
  } catch (error) {
    console.error("Error fetching player teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch player teams" },
      { status: 500 },
    );
  }
}
