import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import { statsListFilterSchema } from "@/lib/stats/schemas";
import { listGeneratedStats } from "@/lib/stats/repository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const input = statsListFilterSchema.parse({
      gameId: searchParams.get("gameId") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    const { adminProfile } = await requireAdmin(request, input.gameId ? { gameId: input.gameId } : undefined);
    const results = await listGeneratedStats({
      allowedGameIds: adminProfile.allowedGames,
      gameId: input.gameId,
      limit: input.limit,
    });

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
