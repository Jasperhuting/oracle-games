import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import { createManualIdeaInputSchema, statsListFilterSchema } from "@/lib/stats/schemas";
import { listIdeas, saveIdeas } from "@/lib/stats/repository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const input = statsListFilterSchema.parse({
      gameId: searchParams.get("gameId") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    const { adminProfile } = await requireAdmin(request, input.gameId ? { gameId: input.gameId } : undefined);
    const ideas = await listIdeas({
      allowedGameIds: adminProfile.allowedGames,
      gameId: input.gameId,
      limit: input.limit,
    });

    return NextResponse.json({
      ok: true,
      ideas,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createManualIdeaInputSchema.parse(body);
    const { uid } = await requireAdmin(request, { gameId: input.gameId });

    const [savedIdea] = await saveIdeas({
      gameId: input.gameId,
      createdByUid: uid,
      source: "manual",
      status: "proposed",
      ideas: [
        {
          title: input.title,
          description: input.description,
          whyInteresting: input.whyInteresting,
          chartType: input.chartType,
          requiredTool: input.requiredTool,
          confidence: input.confidence,
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      idea: savedIdea,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
