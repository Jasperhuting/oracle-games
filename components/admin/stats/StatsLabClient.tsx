"use client";

import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authorizedFetch } from '@/lib/auth/token-service';
import { Collapsible } from "@/components/Collapsible";
import { StatsChartPreview } from "@/components/admin/stats/StatsChartPreview";
import { ManualIdeaForm } from "@/components/admin/stats/ManualIdeaForm";
import { StatsLabTabs } from "@/components/admin/stats/StatsLabTabs";
import type {
  AdminProfile,
  ChartType,
  GeneratedStat,
  StatIdea,
  StatsAdminGameOption,
  StatsToolName,
} from "@/lib/stats/types";

type AccessResponse = {
  ok: boolean;
  adminProfile: AdminProfile;
  availableGames: StatsAdminGameOption[];
};


export function StatsLabClient() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [availableGames, setAvailableGames] = useState<StatsAdminGameOption[]>([]);
  const [ideas, setIdeas] = useState<StatIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [lastResult, setLastResult] = useState<GeneratedStat | null>(null);
  const [showManualIdeaForm, setShowManualIdeaForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!user) {
        return;
      }

      try {
        const response = await authorizedFetch("/api/admin/stats/access", {
          method: "GET",
        });
        const payload = (await response.json()) as AccessResponse;
        if (!cancelled) {
          setAccess(payload);
          setAvailableGames(payload.availableGames ?? []);
          setSelectedGameId(payload.availableGames?.[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load admin access");
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleGenerateIdeas() {
    if (!user || !selectedGameId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await authorizedFetch("/api/admin/stats/generate-ideas", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: selectedGameId,
            maxIdeas: 10,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to generate ideas");
        }
        setIdeas(payload.ideas as StatIdea[]);
        setSelectedIdeaId((payload.ideas?.[0]?.id as string | undefined) ?? "");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to generate ideas");
      }
    });
  }

  async function handleRunIdea() {
    if (!user || !selectedGameId || !selectedIdeaId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await authorizedFetch("/api/admin/stats/run", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: selectedGameId,
            ideaId: selectedIdeaId,
            limit: 8,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to run idea");
        }
        setLastResult(payload.result as GeneratedStat);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to run idea");
      }
    });
  }

  async function handleCreateManualIdea(input: {
    gameId: string;
    title: string;
    description: string;
    whyInteresting: string;
    chartType: ChartType;
    requiredTool: StatsToolName;
    confidence: number;
  }) {
    if (!user) {
      throw new Error("Authentication required");
    }

    const response = await authorizedFetch("/api/admin/stats/ideas", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to save idea");
    }

    const createdIdea = payload.idea as StatIdea;
    setIdeas((currentIdeas) => [createdIdea, ...currentIdeas]);
    setSelectedIdeaId(createdIdea.id);
    return createdIdea;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <StatsLabTabs />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Oracle Games Stats Lab</h1>
            <p className="mt-2 text-sm text-gray-600">
              Internal admin workspace for controlled stat ideation and read-only analyses.
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <div>Role: {access?.adminProfile.role ?? "-"}</div>
            <div>Allowed games: {availableGames.map((game) => game.label).join(", ") || "-"}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-800">Selected game</span>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedGameId}
              onChange={(event) => setSelectedGameId(event.target.value)}
            >
              {availableGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateIdeas}
              disabled={!selectedGameId || isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate idea suggestions
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-gray-200 p-4">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Idea suggestions</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Select an idea first, then run it from this panel.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunIdea}
                disabled={!selectedIdeaId || isPending}
                className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run selected idea
              </button>
            </div>
            {selectedIdea ? (
              <div className="mt-4 rounded-xl border border-primary/20 bg-[#eef9f7] p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-primary">Selected idea</div>
                <div className="mt-2 text-sm font-semibold text-gray-900">{selectedIdea.title}</div>
                <div className="mt-1 text-sm text-gray-600">{selectedIdea.description}</div>
                <div className="mt-3 text-xs text-gray-500">
                  Tool: {selectedIdea.requiredTool} | Chart: {selectedIdea.chartType} | Confidence:{" "}
                  {Math.round(selectedIdea.confidence * 100)}%
                </div>
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {ideas.length === 0 ? (
                <p className="text-sm text-gray-500">No ideas generated yet.</p>
              ) : (
                ideas.map((idea) => (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => setSelectedIdeaId(idea.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedIdeaId === idea.id
                        ? "border-primary bg-[#eef9f7]"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{idea.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{idea.description}</div>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                        {idea.chartType}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      Tool: {idea.requiredTool} | Confidence: {Math.round(idea.confidence * 100)}%
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <h2 className="text-base font-semibold text-gray-900">Latest result</h2>
            {!lastResult ? (
              <p className="mt-4 text-sm text-gray-500">Run an idea to inspect the latest generated stat.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{lastResult.title}</div>
                  <p className="mt-1 text-sm text-gray-600">{lastResult.summary}</p>
                </div>
                <div className="text-xs text-gray-500">
                  Chart: {lastResult.chartType} | Confidence: {Math.round(lastResult.confidence * 100)}%
                </div>
                <div className="text-xs text-gray-500">
                  Idea: {lastResult.sourceIdeaTitle || "-"} | Tool: {lastResult.sourceTool || "-"}
                </div>
                <StatsChartPreview chartType={lastResult.chartType} data={lastResult.data} />
                <Collapsible title="Raw JSON data" defaultOpen={false}>
                  <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
                    {JSON.stringify(lastResult.data, null, 2)}
                  </pre>
                </Collapsible>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => setShowManualIdeaForm((current) => !current)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
          >
            {showManualIdeaForm ? "Hide manual idea form" : "Add manual idea"}
          </button>
          {showManualIdeaForm ? (
            <div className="mt-4">
              <ManualIdeaForm gameId={selectedGameId} onCreateIdea={handleCreateManualIdea} />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
