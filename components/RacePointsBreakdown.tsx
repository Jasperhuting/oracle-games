'use client';

import React from 'react';
import type { PointsEvent } from '@/lib/types/games';

// LEGACY interfaces (kept for backwards compatibility)
interface StagePoints {
  stageResult?: number;
  gcPoints?: number;
  pointsClass?: number;
  mountainsClass?: number;
  youthClass?: number;
  mountainPoints?: number;
  sprintPoints?: number;
  combativityBonus?: number;
  teamPoints?: number;
  total: number;
}

interface RacePoints {
  totalPoints: number;
  stagePoints: Record<string, StagePoints>;
}

interface RacePointsBreakdownProps {
  // NEW: pointsBreakdown array (preferred)
  pointsBreakdown?: PointsEvent[];
  // LEGACY: racePoints object (fallback)
  racePoints?: Record<string, RacePoints>;
  riderName: string;
  // NEW: race names mapping
  raceNames?: Map<string, string>;
}

/**
 * Component to display points breakdown for a rider.
 *
 * Supports both new pointsBreakdown array format and legacy racePoints format.
 * Will use pointsBreakdown if available, otherwise falls back to racePoints.
 */
export default function RacePointsBreakdown({
  pointsBreakdown,
  racePoints,
  riderName,
  raceNames
}: RacePointsBreakdownProps) {
  // Use new format if available and has data
  const useNewFormat = pointsBreakdown && pointsBreakdown.length > 0;

  // Check if we have any data to display
  const hasData = useNewFormat || (racePoints && Object.keys(racePoints).length > 0);

  if (!hasData) {
    return (
      <div className="text-sm text-gray-500 italic">
        Nog geen punten gescoord
      </div>
    );
  }

  // NEW FORMAT: Render from pointsBreakdown array
  if (useNewFormat) {
    // Group events by race
    const eventsByRace = pointsBreakdown.reduce((acc, event) => {
      const raceSlug = event.raceSlug;
      if (!acc[raceSlug]) {
        acc[raceSlug] = [];
      }
      acc[raceSlug].push(event);
      return acc;
    }, {} as Record<string, PointsEvent[]>);

    return (
      <div className="space-y-4">
        {Object.entries(eventsByRace).map(([raceSlug, events]) => {
          // Calculate race total from events
          const raceTotal = events.reduce((sum, e) => sum + (e.total || 0), 0);

          // Sort events by stage
          const sortedEvents = [...events].sort((a, b) => {
            const stageA = a.stage === 'result' ? 0 : parseInt(a.stage) || 999;
            const stageB = b.stage === 'result' ? 0 : parseInt(b.stage) || 999;
            return stageA - stageB;
          });

          return (
            <div key={raceSlug} className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-lg text-gray-900">
                    {raceNames?.get(raceSlug) || raceSlug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-medium">Totaal</span>
                    <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                      {raceTotal} <span className="text-sm font-normal">pts</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {sortedEvents.sort((a, b) => a.stage.localeCompare(b.stage)).map((event, index) => (
                  <div key={`${event.raceSlug}-${event.stage}-${index}`} className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {event.stage === 'result' ? 'Uitslag' : `Etappe ${event.stage}`}
                          </span>
                          {event.stagePosition && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {event.stagePosition}e
                            </span>
                          )}
                          {event.gcPosition && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              GC {event.gcPosition}e
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {event.stageResult && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">🏁</span>
                              <span className="font-medium">Etappe uitslag ({event.stagePosition}e):</span>
                              <span className="font-bold text-green-600">{event.stageResult} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.gcPoints && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">👑</span>
                              <span className="font-medium">Algemeen klassement ({event.gcPosition}e):</span>
                              <span className="font-bold text-green-600">{event.gcPoints} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.pointsClass && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">🟢</span>
                              <span className="font-medium">Puntenklassement:</span>
                              <span className="font-bold text-green-600">{event.pointsClass} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.mountainsClass && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">⛰️</span>
                              <span className="font-medium">Bergklassement:</span>
                              <span className="font-bold text-green-600">{event.mountainsClass} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.youthClass && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">👶</span>
                              <span className="font-medium">Jongerenklassement:</span>
                              <span className="font-bold text-green-600">{event.youthClass} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.mountainPoints && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">🏔️</span>
                              <span className="font-medium">Bergpunten:</span>
                              <span className="font-bold text-green-600">{event.mountainPoints} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.sprintPoints && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">⚡</span>
                              <span className="font-medium">Sprintpunten:</span>
                              <span className="font-bold text-green-600">{event.sprintPoints} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.combativityBonus && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">💪</span>
                              <span className="font-medium">Strijdlust bonus:</span>
                              <span className="font-bold text-green-600">{event.combativityBonus} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                          {event.teamPoints && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-lg">👥</span>
                              <span className="font-medium">Ploegenklassement:</span>
                              <span className="font-bold text-green-600">{event.teamPoints} <span className="text-xs font-normal">pts</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                          {event.total} <span className="text-sm font-normal">pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // LEGACY FORMAT: Render from racePoints object
  return (
    <div className="space-y-4">
      {Object.entries(racePoints!).map(([raceSlug, raceData]) => (
        <div key={raceSlug} className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-lg text-gray-900">
                {raceNames?.get(raceSlug) || raceSlug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">Totaal</span>
                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  {raceData.totalPoints} <span className="text-sm font-normal">pts</span>
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-3">
            {Object.entries(raceData.stagePoints)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([stage, points]) => (
                <div key={stage} className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Etappe {stage}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {points.stageResult && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">🏁</span>
                            <span className="font-medium">Etappe uitslag:</span>
                            <span className="font-bold text-green-600">{points.stageResult} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.gcPoints && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">👑</span>
                            <span className="font-medium">Algemeen klassement:</span>
                            <span className="font-bold text-green-600">{points.gcPoints} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.pointsClass && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">🟢</span>
                            <span className="font-medium">Puntenklassement:</span>
                            <span className="font-bold text-green-600">{points.pointsClass} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.mountainsClass && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">⛰️</span>
                            <span className="font-medium">Bergklassement:</span>
                            <span className="font-bold text-green-600">{points.mountainsClass} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.youthClass && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">👶</span>
                            <span className="font-medium">Jongerenklassement:</span>
                            <span className="font-bold text-green-600">{points.youthClass} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.mountainPoints && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">🏔️</span>
                            <span className="font-medium">Bergpunten:</span>
                            <span className="font-bold text-green-600">{points.mountainPoints} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.sprintPoints && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">⚡</span>
                            <span className="font-medium">Sprintpunten:</span>
                            <span className="font-bold text-green-600">{points.sprintPoints} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.combativityBonus && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">💪</span>
                            <span className="font-medium">Strijdlust bonus:</span>
                            <span className="font-bold text-green-600">{points.combativityBonus} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                        {points.teamPoints && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-lg">👥</span>
                            <span className="font-medium">Ploegenklassement:</span>
                            <span className="font-bold text-green-600">{points.teamPoints} <span className="text-xs font-normal">pts</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                        {points.total} <span className="text-sm font-normal">pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
