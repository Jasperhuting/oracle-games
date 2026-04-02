import { NextRequest, NextResponse } from "next/server";
import {
  loadAllStoredTeamHistories,
  loadStoredTeamHistory,
  refreshSingleTeamHistory,
} from "@/lib/wk-2026/team-history-server";
import { orientTeamHistory, type TeamHistoryResponse } from "@/lib/wk-2026/team-history-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function emptyHistory(): TeamHistoryResponse {
  return {
    team1Form: [],
    team2Form: [],
    headToHead: [],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all");

  try {
    if (all === "1") {
      const histories = await loadAllStoredTeamHistories();
      return NextResponse.json({ histories });
    }

    const team1 = searchParams.get("team1");
    const team2 = searchParams.get("team2");

    if (!team1 || !team2) {
      return NextResponse.json({ error: "team1 and team2 are required" }, { status: 400 });
    }

    let storedHistory = await loadStoredTeamHistory(team1, team2);

    // Fallback: if the nightly cache has not run yet, build and persist this pair on demand.
    if (!storedHistory) {
      try {
        await refreshSingleTeamHistory({
          team1,
          team2,
          tags: ["manual-fallback"],
          force: true,
        });
      } catch (refreshError) {
        console.error("Error refreshing missing team history:", refreshError);
      }

      storedHistory = await loadStoredTeamHistory(team1, team2);
    }

    if (!storedHistory) {
      return NextResponse.json(emptyHistory());
    }

    return NextResponse.json(orientTeamHistory(storedHistory.data, team1, team2));
  } catch (error) {
    console.error("Error reading team history:", error);
    return NextResponse.json(
      { error: "Failed to load team history", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
