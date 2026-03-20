"use client";

import Link from "next/link";
import { Check, Clock, Edit } from "tabler-icons-react";

interface RaceTableRow {
  race: {
    round: number;
    name: string;
    subName: string;
    startDate: string;
    endDate: string;
    predictionDeadline?: { toDate: () => Date } | Date;
  };
  status: "done" | "upcoming" | "open" | "canceled";
  prediction: string | null;
  actualResult: string | null;
  points: number | null;
  cancellationReason: string | null;
  raceRank: {
    position: number;
    total: number;
  } | null;
}

interface RaceCardProps {
  row: RaceTableRow;
  isParticipant: boolean;
}

export function RaceCard({ row, isParticipant }: RaceCardProps) {
  const startDate = new Date(row.race.startDate);
  const endDate = new Date(row.race.endDate);

  const formatDeadline = (race: RaceTableRow["race"]) => {
    const dl = race.predictionDeadline;
    const deadlineSource = dl
      ? dl instanceof Date
        ? dl
        : (dl as { toDate: () => Date }).toDate()
      : new Date(race.startDate);
    return deadlineSource.toLocaleString("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = () => {
    if (row.status === "done") {
      return (
        <span className="inline-flex items-center gap-1 text-green-400 text-xs bg-green-900/30 px-2 py-1 rounded-full">
          <Check size={14} /> Afgelopen
        </span>
      );
    } else if (row.status === "canceled") {
      return (
        <span className="inline-flex items-center gap-1 text-red-300 text-xs bg-red-900/30 px-2 py-1 rounded-full">
          <Clock size={14} /> Afgelast
        </span>
      );
    } else if (row.status === "open") {
      return (
        <span className="inline-flex items-center gap-1 text-orange-400 text-xs bg-orange-900/30 px-2 py-1 rounded-full">
          <Clock size={14} /> Bezig
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-blue-400 text-xs bg-blue-900/30 px-2 py-1 rounded-full">
          <Clock size={14} /> Aankomend
        </span>
      );
    }
  };

  const cardContent = (
    <div
      className={`rounded-lg border p-4 transition-all ${
        row.status === "canceled"
          ? "bg-red-950/20 border-red-700/50"
          : "bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-sm bg-gray-700 text-white rounded-full w-8 h-8 flex-shrink-0 flex items-center justify-center tabular-nums font-bold">
            {row.race.round}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white truncate">{row.race.name}</div>
            <div className="text-xs text-gray-500 truncate">{row.race.subName}</div>
            <div className="text-xs text-gray-400 mt-1">
              {startDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} -{" "}
              {endDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
            </div>
            <div className="text-xs text-gray-300 mt-1">
              Deadline: {formatDeadline(row.race)}
            </div>
            {row.cancellationReason && (
              <div className="mt-2 inline-flex rounded-md border border-red-700/50 bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-200">
                {row.cancellationReason}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {getStatusBadge()}
          {row.status === "canceled" ? (
            <span className="text-sm font-semibold text-red-300">Telt niet mee</span>
          ) : row.points !== null && (
            <span className={`text-lg font-bold ${row.points !== 0 ? "text-red-400" : "text-gray-500"}`}>
              {row.points} pt
            </span>
          )}
        </div>
      </div>
      {row.status === "canceled" && (
        <div className="mt-3 flex items-center justify-between border-t border-red-800/40 pt-3">
          <span className="text-xs uppercase tracking-wide text-red-200/70">Status</span>
          <span className="text-sm font-semibold text-red-300">Deze race telt niet mee</span>
        </div>
      )}
      {row.raceRank && (
        <div className="mt-3 flex items-center justify-between border-t border-gray-700 pt-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Plaats die ronde</span>
          <span className="inline-flex rounded-full border border-blue-700/50 bg-blue-900/30 px-2.5 py-1 text-xs font-semibold text-blue-200">
            {row.raceRank.position}/{row.raceRank.total}
          </span>
        </div>
      )}
      {!isParticipant && !row.prediction && row.status !== "done" && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <span className="text-gray-500 text-sm">Meld je eerst aan</span>
        </div>
      )}
      {isParticipant && row.status === "upcoming" && !row.prediction && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <span className="inline-flex items-center gap-1 text-blue-400 text-sm">
            <Edit size={14} /> Voorspelling invullen
          </span>
        </div>
      )}
      {isParticipant && row.status === "open" && !row.prediction && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <span className="inline-flex items-center gap-1 text-orange-400 text-sm font-medium">
            <Edit size={14} /> Nog invullen!
          </span>
        </div>
      )}
    </div>
  );

  if (row.status === "canceled") {
    return cardContent;
  }

  return (
    <Link href={`/f1/race/${row.race.round}`} className="block">
      {cardContent}
    </Link>
  );
}
