'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Flag } from '@/components/Flag';
import RacePointsBreakdown from '@/components/RacePointsBreakdown';
import { formatCurrencyWhole } from '@/lib/utils/formatCurrency';

// PointsEvent interface for the new format
interface PointsEvent {
  raceSlug: string;
  stage: string;
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
  calculatedAt: string;
}

interface Rider {
  id: string;
  nameId: string;
  name: string;
  team: string;
  country: string;
  rank: number;
  pointsScored: number;
  points: number;
  // NEW: totalPoints as source of truth
  totalPoints?: number;
  // NEW: pointsBreakdown array
  pointsBreakdown?: PointsEvent[];
  // LEGACY: racePoints object (for backwards compatibility)
  racePoints: Record<string, {
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
  }> | undefined;
  pricePaid: number | null;
  acquisitionType: string;
  draftRound: number | null;
  draftPick: number | null;
  stagesParticipated: number;
  jerseyImage?: string;
}

interface Participant {
  id: string;
  userId: string;
  playerName: string;
  totalPoints: number;
  ranking: number;
}

interface TeamDetails {
  riders: Rider[];
  totalPoints: number;
  riderCount: number;
}

export default function TeamDetailPage() {
  const params = useParams();
  const gameId = params?.gameId as string;
  const participantId = params?.participantId as string;

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [gameName, setGameName] = useState<string>('');
  const [gameType, setGameType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchTeamDetails() {
      if (!gameId || !participantId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch game info for the name
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (gameResponse.ok) {
          const gameData = await gameResponse.json();
          setGameName(gameData.game?.name || '');
          setGameType(gameData.game?.gameType || '');
        }

        // Fetch team details
        const response = await fetch(`/api/games/${gameId}/team/${participantId}`);
        if (!response.ok) {
          throw new Error('Failed to load team details');
        }
        const data = await response.json();

        setParticipant(data.participant);
        setTeamDetails(data.team);

        console.log(data);

      } catch (err) {
        console.error('Error loading team details:', err);
        setError('Kon teamdetails niet laden');
      } finally {
        setLoading(false);
      }
    }

    fetchTeamDetails();
  }, [gameId, participantId]);

  const toggleRider = (riderId: string) => {
    const newExpanded = new Set(expandedRiders);
    if (newExpanded.has(riderId)) {
      newExpanded.delete(riderId);
    } else {
      newExpanded.add(riderId);
    }
    setExpandedRiders(newExpanded);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error || !participant || !teamDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error || 'Team niet gevonden'}</div>
          <Link
            href={`/games/${gameId}/standings`}
            className="text-blue-600 hover:text-blue-700"
          >
            Terug naar tussenstand
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Team van {participant.playerName}
              </h1>
              <div className="flex items-center gap-4 text-gray-600">
                <span>Ranking: #{participant.ranking}</span>
                <span>Totaalpunten: {participant.totalPoints}</span>
                
                {gameName && <span>{gameName}</span>}
              </div>
            </div>
            <Link
              href={`/games/${gameId}/standings`}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Terug naar tussenstand
            </Link>
          </div>
        </div>

        {/* Team Statistics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Statistieken</h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{teamDetails.riderCount}</div>
              <div className="text-sm text-gray-600">Totaal renners</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{teamDetails.totalPoints}</div>
              <div className="text-sm text-gray-600">Team punten</div>
            </div>
          </div>
        </div>

        {/* Riders List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Selectie</h2>
          </div>
          
          {teamDetails.riders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Geen renners geselecteerd
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {teamDetails.riders.map((rider) => {
                const isExpanded = expandedRiders.has(rider.id);
                // Check if rider has points data (either new format or legacy)
                const hasPointsBreakdown = rider.pointsBreakdown && rider.pointsBreakdown.length > 0;
                const hasRacePoints = rider.racePoints && Object.keys(rider.racePoints).length > 0;
                const hasPointsData = hasPointsBreakdown || hasRacePoints;

                return (
                  <div
                    key={rider.id}
                    className="overflow-hidden"
                  >
                    {/* Rider Header */}
                    <div
                      onClick={() => hasPointsData && toggleRider(rider.id)}
                      className={`p-6 ${hasPointsData ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
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
                              {rider.pricePaid && <span>Betaald: {formatCurrencyWhole(rider.pricePaid)}</span>}
                              {gameType}
                              {gameType === 'marginal-gains' && <span>Waarde: {-(rider.pricePaid || 0) + rider.pointsScored}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {rider.totalPoints ?? rider.pointsScored ?? 0}
                            </div>
                            <div className="text-xs text-gray-500">punten</div>
                          </div>
                          {hasPointsData && (
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
                    {isExpanded && hasPointsData && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        <RacePointsBreakdown
                          pointsBreakdown={rider.pointsBreakdown}
                          racePoints={rider.racePoints}
                          riderName={rider.name}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info text */}
        {teamDetails.riders.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Klik op een renner om de gedetailleerde punten per etappe te zien
          </div>
        )}
      </div>
    </div>
  );
}
