import { NextRequest, NextResponse } from "next/server";
import { refreshAllWkTeamHistories } from "@/lib/wk-2026/team-history-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  const hasValidBearer = !!expectedAuth && authHeader === expectedAuth;
  const hasValidVercelCronHeader = vercelCronHeader === "1";

  if (!hasValidBearer && !hasValidVercelCronHeader) {
    console.error("[WK-TEAM-HISTORY-CRON] Unauthorized access");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const summary = await refreshAllWkTeamHistories({ force });
    return NextResponse.json({
      success: true,
      force,
      ...summary,
    });
  } catch (error) {
    console.error("[WK-TEAM-HISTORY-CRON] Failed to refresh team histories:", error);
    return NextResponse.json(
      { error: "Failed to refresh team histories", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
