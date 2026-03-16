"use client";

import type { ChartType, GeneratedStatRow } from "@/lib/stats/types";

interface StatsChartPreviewProps {
  chartType: ChartType;
  data: GeneratedStatRow[];
}

type NormalizedPoint = {
  label: string;
  value: number;
  raw: GeneratedStatRow;
};

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pickLabelAndValue(row: GeneratedStatRow, index: number): NormalizedPoint | null {
  const entries = Object.entries(row);
  const numericEntry = entries.find(([, value]) => typeof value === "number");
  if (!numericEntry) {
    return null;
  }

  const labelEntry = entries.find(
    ([key, value]) => typeof value === "string" && key !== numericEntry[0]
  );

  return {
    label: String(labelEntry?.[1] ?? `Row ${index + 1}`),
    value: numericEntry[1] as number,
    raw: row,
  };
}

function normalizeData(data: GeneratedStatRow[]) {
  return data
    .map((row, index) => pickLabelAndValue(row, index))
    .filter((row): row is NormalizedPoint => row !== null);
}

function StatsBarChart({ points }: { points: NormalizedPoint[] }) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="space-y-3">
      {points.map((point) => (
        <div key={`${point.label}-${point.value}`} className="grid grid-cols-[140px_1fr_56px] items-center gap-3">
          <div className="truncate text-xs font-medium text-gray-700">{point.label}</div>
          <div className="h-8 rounded-full bg-gray-100">
            <div
              className="flex h-full items-center rounded-full bg-primary px-3 text-xs font-medium text-white"
              style={{ width: `${Math.max((point.value / maxValue) * 100, 8)}%` }}
            >
              {formatValue(point.value)}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">{formatValue(point.value)}</div>
        </div>
      ))}
    </div>
  );
}

function StatsLineChart({ points }: { points: NormalizedPoint[] }) {
  const width = 520;
  const height = 220;
  const padding = 20;
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.value / maxValue) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <path d={path} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
        {coordinates.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="#0f766e" />
            <text x={point.x} y={height - 4} textAnchor="middle" className="fill-gray-500 text-[10px]">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StatsPieChart({ points }: { points: NormalizedPoint[] }) {
  const total = points.reduce((sum, point) => sum + point.value, 0) || 1;
  const colors = ["#0f766e", "#14b8a6", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];
  let currentAngle = -Math.PI / 2;

  const slices = points.map((point, index) => {
    const angle = (point.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = 100 + 80 * Math.cos(startAngle);
    const y1 = 100 + 80 * Math.sin(startAngle);
    const x2 = 100 + 80 * Math.cos(endAngle);
    const y2 = 100 + 80 * Math.sin(endAngle);
    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const d = [
      `M 100 100`,
      `L ${x1} ${y1}`,
      `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    return {
      ...point,
      d,
      color: colors[index % colors.length],
      percentage: (point.value / total) * 100,
    };
  });

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
      <svg viewBox="0 0 200 200" className="mx-auto h-56 w-56">
        {slices.map((slice) => (
          <path key={`${slice.label}-${slice.value}`} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div className="space-y-2">
        {slices.map((slice) => (
          <div key={`${slice.label}-${slice.value}`} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="text-gray-700">{slice.label}</span>
            </div>
            <div className="text-gray-500">
              {formatValue(slice.value)} ({slice.percentage.toFixed(1)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsTable({ data }: { data: GeneratedStatRow[] }) {
  const columns = Array.from(new Set(data.flatMap((row) => Object.keys(row))));

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-medium text-gray-600">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 text-gray-700">
                  {String(row[column] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsChartPreview({ chartType, data }: StatsChartPreviewProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        No chart preview available because the result contains no rows.
      </div>
    );
  }

  const points = normalizeData(data);
  const canRenderNumericChart = points.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-[#fcfffe] p-4">
      <div className="mb-4 text-sm font-medium text-gray-800">Chart preview</div>

      {chartType === "table" ? <StatsTable data={data} /> : null}
      {chartType === "bar" && canRenderNumericChart ? <StatsBarChart points={points} /> : null}
      {chartType === "line" && canRenderNumericChart ? <StatsLineChart points={points} /> : null}
      {chartType === "pie" && canRenderNumericChart ? <StatsPieChart points={points} /> : null}
      {chartType === "scatter" && canRenderNumericChart ? <StatsBarChart points={points} /> : null}

      {chartType !== "table" && !canRenderNumericChart ? <StatsTable data={data} /> : null}
    </div>
  );
}
