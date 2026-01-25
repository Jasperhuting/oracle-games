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
  riderName
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
            <div key={raceSlug} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-lg">
                  {raceSlug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h4>
                <span className="text-xl font-bold text-blue-600">
                  {raceTotal} pts
                </span>
              </div>

              <div className="space-y-2">
                {sortedEvents.map((event, index) => (
                  <div key={`${event.raceSlug}-${event.stage}-${index}`} className="border-l-2 border-gray-300 pl-3 py-1">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="font-medium text-gray-700">
                          {event.stage === 'result' ? 'Uitslag' : `Etappe ${event.stage}`}
                        </span>
                        <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                          {event.stageResult && (
                            <div>• Etappe uitslag: {event.stageResult} pts</div>
                          )}
                          {event.gcPoints && (
                            <div>• Algemeen klassement: {event.gcPoints} pts</div>
                          )}
                          {event.pointsClass && (
                            <div>• Puntenklassement: {event.pointsClass} pts</div>
                          )}
                          {event.mountainsClass && (
                            <div>• Bergklassement: {event.mountainsClass} pts</div>
                          )}
                          {event.youthClass && (
                            <div>• Jongerenklassement: {event.youthClass} pts</div>
                          )}
                          {event.mountainPoints && (
                            <div>• Bergpunten: {event.mountainPoints} pts</div>
                          )}
                          {event.sprintPoints && (
                            <div>• Sprintpunten: {event.sprintPoints} pts</div>
                          )}
                          {event.combativityBonus && (
                            <div>• Strijdlust bonus: {event.combativityBonus} pts</div>
                          )}
                          {event.teamPoints && (
                            <div>• Ploegenklassement: {event.teamPoints} pts</div>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-green-600 ml-4">
                        {event.total} pts
                      </span>
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
        <div key={raceSlug} className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-lg">
              {raceSlug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h4>
            <span className="text-xl font-bold text-blue-600">
              {raceData.totalPoints} pts
            </span>
          </div>

          <div className="space-y-2">
            {Object.entries(raceData.stagePoints)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([stage, points]) => (
                <div key={stage} className="border-l-2 border-gray-300 pl-3 py-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="font-medium text-gray-700">Etappe {stage}</span>
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {points.stageResult && (
                          <div>• Etappe uitslag: {points.stageResult} pts</div>
                        )}
                        {points.gcPoints && (
                          <div>• Algemeen klassement: {points.gcPoints} pts</div>
                        )}
                        {points.pointsClass && (
                          <div>• Puntenklassement: {points.pointsClass} pts</div>
                        )}
                        {points.mountainsClass && (
                          <div>• Bergklassement: {points.mountainsClass} pts</div>
                        )}
                        {points.youthClass && (
                          <div>• Jongerenklassement: {points.youthClass} pts</div>
                        )}
                        {points.mountainPoints && (
                          <div>• Bergpunten: {points.mountainPoints} pts</div>
                        )}
                        {points.sprintPoints && (
                          <div>• Sprintpunten: {points.sprintPoints} pts</div>
                        )}
                        {points.combativityBonus && (
                          <div>• Strijdlust bonus: {points.combativityBonus} pts</div>
                        )}
                        {points.teamPoints && (
                          <div>• Ploegenklassement: {points.teamPoints} pts</div>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-green-600 ml-4">
                      {points.total} pts
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
