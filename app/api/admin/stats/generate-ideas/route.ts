import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import {
  buildPhaseOneIdeas,
  normalizeGeneratedIdeas,
  summarizeIdeaGeneration,
} from "@/lib/stats/mappers";
import {
  generateIdeasWithOpenRouter,
  getOpenRouterModel,
  hasOpenRouterConfig,
} from "@/lib/stats/openrouter";
import { buildIdeaGenerationMessages } from "@/lib/stats/prompts";
import { generateIdeasInputSchema } from "@/lib/stats/schemas";
import { getStatsGameContext } from "@/lib/stats/adapters";
import {
  completeStatRun,
  createStatRun,
  failStatRun,
  saveIdeas,
} from "@/lib/stats/repository";

const PROMPT_VERSION = "phase2-ideas-v1";

export async function POST(request: NextRequest) {
  let runId: string | null = null;

  try {
    const body = await request.json();
    const input = generateIdeasInputSchema.parse(body);
    const { uid } = await requireAdmin(request, { gameId: input.gameId });
    const gameContext = await getStatsGameContext(input.gameId);
    const hasOpenRouter = hasOpenRouterConfig();
    const modelName = hasOpenRouter ? getOpenRouterModel() : "phase1-deterministic";

    const run = await createStatRun({
      gameId: input.gameId,
      requestedByUid: uid,
      type: "idea_generation",
      model: modelName,
      promptVersion: PROMPT_VERSION,
      selectedIdeaId: null,
      inputSummary: summarizeIdeaGeneration(input.gameId),
    });
    runId = run.id;

    const ideas = normalizeGeneratedIdeas(
      hasOpenRouter
      ? (
          await generateIdeasWithOpenRouter(
            buildIdeaGenerationMessages({
              gameId: input.gameId,
              maxIdeas: input.maxIdeas,
              gameType: gameContext?.gameType,
            })
          )
        ).ideas
      : buildPhaseOneIdeas(input.maxIdeas, gameContext?.gameType)
    );

    const savedIdeas = await saveIdeas({
      gameId: input.gameId,
      createdByUid: uid,
      ideas,
      source: hasOpenRouter ? "llm" : "template",
      status: "proposed",
    });

    await completeStatRun(run.id);

    return NextResponse.json({
      ok: true,
      runId: run.id,
      ideas: savedIdeas,
    });
  } catch (error) {
    if (runId) {
      await failStatRun(
        runId,
        error instanceof Error ? error.message : "Unknown error during idea generation"
      );
    }
    return toAdminErrorResponse(error);
  }
}
