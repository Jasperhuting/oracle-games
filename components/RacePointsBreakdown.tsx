'use client';

import React from 'react';

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
  racePoints?: Record<string, RacePoints>;
  riderName: string;
}

export default function RacePointsBreakdown({ racePoints, riderName }: RacePointsBreakdownProps) {
  if (!racePoints || Object.keys(racePoints).length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Nog geen punten gescoord
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(racePoints).map(([raceSlug, raceData]) => (
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
