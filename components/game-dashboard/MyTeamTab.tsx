'use client';

import { useState } from 'react';
import { Flag } from '@/components/Flag';
import RacePointsBreakdown from '@/components/RacePointsBreakdown';
import { formatCurrencyWhole } from '@/lib/utils/formatCurrency';
import { Game, GameParticipant } from '@/lib/types/games';

interface TeamRider {
  id: string;
  nameId: string;
  name: string;
  team: string;
  country: string;
  rank: number;
  points: number;
  jerseyImage?: string;
  pricePaid?: number;
  acquisitionType?: string;
  racePoints?: Record<string, {
    totalPoints: number;
    stagePoints: Record<string, {
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
    }>;
  }>;
}

interface MyTeamTabProps {
  game: Game | null;
  participant: GameParticipant | null;
  riders: TeamRider[];
  loading: boolean;
  error: string | null;
}

export function MyTeamTab({ game, participant, riders, loading, error }: MyTeamTabProps) {
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());

  const toggleRider = (riderId: string) => {
    const newExpanded = new Set(expandedRiders);
    if (newExpanded.has(riderId)) {
      newExpanded.delete(riderId);
    } else {
      newExpanded.add(riderId);
    }
    setExpandedRiders(newExpanded);
  };

  const getTotalPoints = () => {
    return riders.reduce((sum, rider) => sum + (rider.points || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Totaal Punten</div>
          <div className="text-2xl font-bold text-primary">
            {getTotalPoints()}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Ranking</div>
          <div className="text-2xl font-bold text-gray-900">
            #{participant?.ranking || '-'}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Aantal Renners</div>
          <div className="text-2xl font-bold text-gray-900">
            {riders.length}
          </div>
        </div>
      </div>

      {/* Riders List */}
      <div className="space-y-4">
        {riders.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            Je hebt nog geen renners in je team
          </div>
        ) : (
          riders.map((rider) => {
            const isExpanded = expandedRiders.has(rider.id);
            const hasRacePoints = rider.racePoints && Object.keys(rider.racePoints).length > 0;

            return (
              <div
                key={rider.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Rider Header */}
                <div
                  onClick={() => hasRacePoints && toggleRider(rider.id)}
                  className={`p-4 ${hasRacePoints ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {rider.jerseyImage && (
                        <img
                          src={rider.jerseyImage}
                          alt={rider.team}
                          className="w-10 h-10 object-contain"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {rider.name}
                          <Flag countryCode={rider.country} />
                        </h3>
                        <div className="flex gap-4 text-sm text-gray-600 mt-1">
                          <span>{rider.team}</span>
                          {rider.rank > 0 && <span>UCI #{rider.rank}</span>}
                          {rider.pricePaid && <span>Betaald: {formatCurrencyWhole(rider.pricePaid)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {rider.points}
                        </div>
                        <div className="text-xs text-gray-500">punten</div>
                      </div>
                      {hasRacePoints && (
                        <div className="text-gray-400">
                          <svg
                            className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Race Points Breakdown (Expanded) */}
                {isExpanded && hasRacePoints && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <RacePointsBreakdown
                      racePoints={rider.racePoints}
                      riderName={rider.name}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info text */}
      {riders.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Klik op een renner om de gedetailleerde punten per etappe te zien
        </div>
      )}
    </div>
  );
}
