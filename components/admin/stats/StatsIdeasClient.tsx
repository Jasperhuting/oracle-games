"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ManualIdeaForm } from "@/components/admin/stats/ManualIdeaForm";
import { StatsLabTabs } from "@/components/admin/stats/StatsLabTabs";
import type {
  ChartType,
  StatIdea,
  StatIdeaStatus,
  StatsAdminGameOption,
  StatsToolName,
} from "@/lib/stats/types";

type AccessResponse = {
  ok: boolean;
  adminProfile: AdminProfile;
  availableGames: StatsAdminGameOption[];
};

function formatTimestamp(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString("nl-NL");
  }

  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString("nl-NL");
  }

  return "-";
}

async function authorizedFetch(userToken: string, input: RequestInfo, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${userToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

export function StatsIdeasClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedGameId, setSelectedGameId] = useState("");
  const [availableGames, setAvailableGames] = useState<StatsAdminGameOption[]>([]);
  const [ideas, setIdeas] = useState<StatIdea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    whyInteresting: string;
    chartType: ChartType;
    requiredTool: StatsToolName;
    confidence: string;
    status: StatIdeaStatus;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!user) {
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await authorizedFetch(token, "/api/admin/stats/access");
        const payload = (await response.json()) as AccessResponse;
        if (!cancelled) {
          setAvailableGames(payload.availableGames ?? []);
          setSelectedGameId(payload.availableGames?.[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load access");
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedGameId) {
      return;
    }

    startTransition(async () => {
      try {
        const token = await user.getIdToken();
        const response = await authorizedFetch(
          token,
          `/api/admin/stats/ideas?gameId=${encodeURIComponent(selectedGameId)}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load ideas");
        }
        setIdeas(payload.ideas as StatIdea[]);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load ideas");
      }
    });
  }, [selectedGameId, user]);

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

    const token = await user.getIdToken();
    const response = await authorizedFetch(token, "/api/admin/stats/ideas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to save idea");
    }

    const createdIdea = payload.idea as StatIdea;
    setIdeas((currentIdeas) => [createdIdea, ...currentIdeas]);
    return createdIdea;
  }

  function beginEdit(idea: StatIdea) {
    setEditingIdeaId(idea.id);
    setEditDraft({
      title: idea.title,
      description: idea.description,
      whyInteresting: idea.whyInteresting,
      chartType: idea.chartType,
      requiredTool: idea.requiredTool,
      confidence: String(idea.confidence),
      status: idea.status,
    });
  }

  async function handleSaveIdea(ideaId: string) {
    if (!user || !editDraft) {
      return;
    }

    const token = await user.getIdToken();
    const response = await authorizedFetch(token, `/api/admin/stats/ideas/${ideaId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...editDraft,
        confidence: Number(editDraft.confidence),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to save idea");
    }

    const updatedIdea = payload.idea as StatIdea;
    setIdeas((currentIdeas) => currentIdeas.map((idea) => (idea.id === ideaId ? updatedIdea : idea)));
    setEditingIdeaId(null);
    setEditDraft(null);
  }

  async function handleDeleteIdea(ideaId: string) {
    if (!user) {
      return;
    }

    const confirmed = window.confirm("Delete this idea?");
    if (!confirmed) {
      return;
    }

    const token = await user.getIdToken();
    const response = await authorizedFetch(token, `/api/admin/stats/ideas/${ideaId}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to delete idea");
    }

    setIdeas((currentIdeas) => currentIdeas.filter((idea) => idea.id !== ideaId));
    if (editingIdeaId === ideaId) {
      setEditingIdeaId(null);
      setEditDraft(null);
    }
  }

  async function handleRunIdea(idea: StatIdea) {
    if (!user) {
      return;
    }

    const token = await user.getIdToken();
    const response = await authorizedFetch(token, "/api/admin/stats/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: idea.gameId,
        ideaId: idea.id,
        limit: 8,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to run idea");
    }

    router.push("/admin/stats-results");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <StatsLabTabs />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Stats Ideas</h1>
            <p className="mt-2 text-sm text-gray-600">
              Saved stat ideas across allowed games, stored separately from live game data.
            </p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-800">Filter by game</span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
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
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <ManualIdeaForm gameId={selectedGameId} onCreateIdea={handleCreateManualIdea} />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 pr-4 font-medium">Title</th>
                <th className="pb-3 pr-4 font-medium">Description</th>
                <th className="pb-3 pr-4 font-medium">Chart</th>
                <th className="pb-3 pr-4 font-medium">Confidence</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Created</th>
                <th className="pb-3 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ideas.length === 0 && !isPending ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No ideas found for this game.
                  </td>
                </tr>
              ) : null}
              {ideas.map((idea) => (
                <tr key={idea.id} className="align-top">
                  <td className="py-4 pr-4 font-medium text-gray-900">
                    {editingIdeaId === idea.id && editDraft ? (
                      <input
                        value={editDraft.title}
                        onChange={(event) =>
                          setEditDraft((current) => (current ? { ...current, title: event.target.value } : current))
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      idea.title
                    )}
                  </td>
                  <td className="py-4 pr-4 text-gray-600">
                    {editingIdeaId === idea.id && editDraft ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDraft.description}
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current ? { ...current, description: event.target.value } : current
                            )
                          }
                          className="min-h-20 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <textarea
                          value={editDraft.whyInteresting}
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current ? { ...current, whyInteresting: event.target.value } : current
                            )
                          }
                          className="min-h-20 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <div>{idea.description}</div>
                        <div className="mt-1 text-xs text-gray-500">{idea.whyInteresting}</div>
                      </>
                    )}
                  </td>
                  <td className="py-4 pr-4 text-gray-600">
                    {editingIdeaId === idea.id && editDraft ? (
                      <select
                        value={editDraft.chartType}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current ? { ...current, chartType: event.target.value as ChartType } : current
                          )
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="bar">bar</option>
                        <option value="line">line</option>
                        <option value="table">table</option>
                        <option value="pie">pie</option>
                        <option value="scatter">scatter</option>
                      </select>
                    ) : (
                      idea.chartType
                    )}
                  </td>
                  <td className="py-4 pr-4 text-gray-600">
                    {editingIdeaId === idea.id && editDraft ? (
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={editDraft.confidence}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current ? { ...current, confidence: event.target.value } : current
                          )
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      `${Math.round(idea.confidence * 100)}%`
                    )}
                  </td>
                  <td className="py-4 pr-4 text-gray-600">
                    {editingIdeaId === idea.id && editDraft ? (
                      <select
                        value={editDraft.status}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current ? { ...current, status: event.target.value as StatIdeaStatus } : current
                          )
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="proposed">proposed</option>
                        <option value="accepted">accepted</option>
                        <option value="rejected">rejected</option>
                      </select>
                    ) : (
                      idea.status
                    )}
                  </td>
                  <td className="py-4 pr-4 text-gray-600">{formatTimestamp(idea.createdAt)}</td>
                  <td className="py-4 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            try {
                              await handleRunIdea(idea);
                            } catch (requestError) {
                              setError(
                                requestError instanceof Error ? requestError.message : "Failed to run idea"
                              );
                            }
                          });
                        }}
                        className="rounded border border-primary px-3 py-1 text-xs font-medium text-primary"
                      >
                        Run
                      </button>
                      {editingIdeaId === idea.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              startTransition(async () => {
                                try {
                                  await handleSaveIdea(idea.id);
                                } catch (requestError) {
                                  setError(
                                    requestError instanceof Error ? requestError.message : "Failed to save idea"
                                  );
                                }
                              });
                            }}
                            className="rounded bg-primary px-3 py-1 text-xs font-medium text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIdeaId(null);
                              setEditDraft(null);
                            }}
                            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEdit(idea)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            try {
                              await handleDeleteIdea(idea.id);
                            } catch (requestError) {
                              setError(
                                requestError instanceof Error ? requestError.message : "Failed to delete idea"
                              );
                            }
                          });
                        }}
                        className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                    {editingIdeaId === idea.id && editDraft ? (
                      <div className="mt-2">
                        <select
                          value={editDraft.requiredTool}
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current
                                ? { ...current, requiredTool: event.target.value as StatsToolName }
                                : current
                            )
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          <option value="getTopScorers">getTopScorers</option>
                          <option value="getMostSelected">getMostSelected</option>
                          <option value="getBestValuePicks">getBestValuePicks</option>
                          <option value="getBiggestMovers">getBiggestMovers</option>
                          <option value="getTeamDistribution">getTeamDistribution</option>
                          <option value="getTopPlayersByPoints">getTopPlayersByPoints</option>
                          <option value="getMostActivePlayers">getMostActivePlayers</option>
                          <option value="getBestAverageRankPlayers">getBestAverageRankPlayers</option>
                          <option value="getF1BestPredictors">getF1BestPredictors</option>
                          <option value="getF1MostActivePredictors">getF1MostActivePredictors</option>
                          <option value="getF1BonusSpecialists">getF1BonusSpecialists</option>
                          <option value="getF1PopularWinnerPicks">getF1PopularWinnerPicks</option>
                          <option value="getF1MissedPredictionRisk">getF1MissedPredictionRisk</option>
                        </select>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
