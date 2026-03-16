"use client";

import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Collapsible } from "@/components/Collapsible";
import { StatsChartPreview } from "@/components/admin/stats/StatsChartPreview";
import { StatsLabTabs } from "@/components/admin/stats/StatsLabTabs";
import type { GeneratedStat, StatsAdminGameOption } from "@/lib/stats/types";

type AccessResponse = {
  ok: boolean;
  adminProfile: {
    allowedGames: string[];
  };
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

export function StatsResultsClient() {
  const { user } = useAuth();
  const [selectedGameId, setSelectedGameId] = useState("");
  const [availableGames, setAvailableGames] = useState<StatsAdminGameOption[]>([]);
  const [results, setResults] = useState<GeneratedStat[]>([]);
  const [error, setError] = useState<string | null>(null);
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
          `/api/admin/stats/results?gameId=${encodeURIComponent(selectedGameId)}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load results");
        }
        setResults(payload.results as GeneratedStat[]);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load results");
      }
    });
  }, [selectedGameId, user]);

  async function handleDeleteResult(resultId: string) {
    if (!user) {
      return;
    }

    const confirmed = window.confirm("Delete this generated result?");
    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await authorizedFetch(token, `/api/admin/stats/results/${resultId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete result");
      }

      setResults((currentResults) => currentResults.filter((result) => result.id !== resultId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete result");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <StatsLabTabs />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Stats Results</h1>
            <p className="mt-2 text-sm text-gray-600">
              Review generated stats and inspect the normalized JSON payload stored in Firestore.
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

        <div className="mt-6 space-y-4">
          {results.length === 0 && !isPending ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No generated stats found for this game.
            </div>
          ) : null}
          {results.map((result) => (
            <article key={result.id} className="rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{result.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{result.summary}</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-right text-xs text-gray-500">
                    <div>{result.chartType}</div>
                    <div>{Math.round(result.confidence * 100)}%</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteResult(result.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">Generated: {formatTimestamp(result.generatedAt)}</div>
              <div className="mt-1 text-xs text-gray-500">
                Idea: {result.sourceIdeaTitle || "-"} | Tool: {result.sourceTool || "-"}
              </div>
              <div className="mt-4">
                <StatsChartPreview chartType={result.chartType} data={result.data} />
              </div>
              <div className="mt-4">
                <Collapsible title="Raw JSON data" defaultOpen={false}>
                  <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </Collapsible>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
