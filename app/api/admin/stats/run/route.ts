import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import {
  buildGeneratedStatDraft,
  resolveIdeaTool,
  summarizeToolOutput,
} from "@/lib/stats/mappers";
import {
  generateStatWithOpenRouter,
  getOpenRouterModel,
  hasOpenRouterConfig,
} from "@/lib/stats/openrouter";
import { buildStatExplanationMessages } from "@/lib/stats/prompts";
import { runStatInputSchema } from "@/lib/stats/schemas";
import {
  completeStatRun,
  createStatRun,
  failStatRun,
  getIdeaById,
  saveGeneratedStat,
} from "@/lib/stats/repository";
import { runStatsTool } from "@/lib/stats/tools";
import type { GeneratedStatRow } from "@/lib/stats/types";

const PROMPT_VERSION = "phase2-stat-run-v1";

export async function POST(request: NextRequest) {
  let runId: string | null = null;

  try {
    const body = await request.json();
    const input = runStatInputSchema.parse(body);
    const { uid } = await requireAdmin(request, { gameId: input.gameId });
    const hasOpenRouter = hasOpenRouterConfig();
    const modelName = hasOpenRouter ? getOpenRouterModel() : "phase1-deterministic";

    const idea = await getIdeaById(input.ideaId);
    if (!idea || idea.gameId !== input.gameId) {
      return NextResponse.json(
        { error: "Idea not found for this game", code: "idea_not_found" },
        { status: 404 }
      );
    }

    const effectiveTool = resolveIdeaTool({
      title: idea.title,
      description: idea.description,
      whyInteresting: idea.whyInteresting,
      requiredTool: idea.requiredTool,
    });

    const run = await createStatRun({
      gameId: input.gameId,
      requestedByUid: uid,
      type: "stat_run",
      model: modelName,
      promptVersion: PROMPT_VERSION,
      selectedIdeaId: idea.id,
      inputSummary: `Stat run for idea ${idea.id} using ${effectiveTool}.`,
    });
    runId = run.id;

    const toolRows = (await runStatsTool(
      effectiveTool,
      input.gameId,
      input.limit
    )) as GeneratedStatRow[];

    const generated = hasOpenRouter
      ? await generateStatWithOpenRouter(
          buildStatExplanationMessages({
            gameId: input.gameId,
            idea,
            toolRows,
          })
        )
      : buildGeneratedStatDraft({
          title: idea.title,
          chartType: idea.chartType,
          rows: toolRows,
          source: idea.source,
        });

    const savedStat = await saveGeneratedStat({
      gameId: input.gameId,
      ideaId: idea.id,
      runId: run.id,
      sourceIdeaTitle: idea.title,
      sourceTool: effectiveTool,
      title: generated.title,
      summary: `${generated.summary} ${summarizeToolOutput(effectiveTool, toolRows)}`,
      chartType: generated.chartType,
      data: generated.data,
      confidence: generated.confidence,
      generatedByModel: modelName,
    });

    await completeStatRun(run.id);

    return NextResponse.json({
      ok: true,
      runId: run.id,
      result: savedStat,
    });
  } catch (error) {
    if (runId) {
      await failStatRun(runId, error instanceof Error ? error.message : "Unknown stat run error");
    }
    return toAdminErrorResponse(error);
  }
}
