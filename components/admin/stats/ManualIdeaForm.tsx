"use client";

import { useState } from "react";
import type { ChartType, StatIdea, StatsToolName } from "@/lib/stats/types";

const CHART_TYPES: ChartType[] = ["bar", "line", "table", "pie", "scatter"];
const TOOL_NAMES: StatsToolName[] = [
  "getTopScorers",
  "getMostSelected",
  "getBestValuePicks",
  "getBiggestMovers",
  "getTeamDistribution",
  "getTopPlayersByPoints",
  "getMostActivePlayers",
  "getBestAverageRankPlayers",
  "getF1BestPredictors",
  "getF1MostActivePredictors",
  "getF1BonusSpecialists",
  "getF1PopularWinnerPicks",
  "getF1MissedPredictionRisk",
];

interface ManualIdeaFormProps {
  gameId: string;
  onCreateIdea: (input: {
    gameId: string;
    title: string;
    description: string;
    whyInteresting: string;
    chartType: ChartType;
    requiredTool: StatsToolName;
    confidence: number;
  }) => Promise<StatIdea>;
}

export function ManualIdeaForm({ gameId, onCreateIdea }: ManualIdeaFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [whyInteresting, setWhyInteresting] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [requiredTool, setRequiredTool] = useState<StatsToolName>("getTopScorers");
  const [confidence, setConfidence] = useState("0.8");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onCreateIdea({
        gameId,
        title,
        description,
        whyInteresting,
        chartType,
        requiredTool,
        confidence: Number(confidence),
      });

      setTitle("");
      setDescription("");
      setWhyInteresting("");
      setChartType("bar");
      setRequiredTool("getTopScorers");
      setConfidence("0.8");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save idea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Add manual idea</h2>
        <p className="mt-1 text-sm text-gray-600">
          Save your own stat idea directly, without generating suggestions first.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-gray-800">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-gray-800">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-gray-800">Why interesting</span>
          <textarea
            value={whyInteresting}
            onChange={(event) => setWhyInteresting(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-800">Chart type</span>
          <select
            value={chartType}
            onChange={(event) => setChartType(event.target.value as ChartType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {CHART_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-800">Required tool</span>
          <select
            value={requiredTool}
            onChange={(event) => setRequiredTool(event.target.value as StatsToolName)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {TOOL_NAMES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-800">Confidence</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save manual idea
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </form>
  );
}
