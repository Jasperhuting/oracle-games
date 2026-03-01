'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Flag } from '@/components/Flag';
import RacePointsBreakdown from '@/components/RacePointsBreakdown';
import { useTranslation } from 'react-i18next';
import { Game, GameParticipant } from '@/lib/types/games';
import { formatCurrencyWhole } from '@/lib/utils/formatCurrency';
import { getRaceNamesClient } from '@/lib/race-names';
import { fetchTeamWithCache } from '@/lib/utils/teamCache';

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

export default function TeamResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const gameId = params?.gameId as string;
  const { t } = useTranslation();

  const [game, setGame] = useState<Game | null>(null);
  const [participant, setParticipant] = useState<GameParticipant | null>(null);
  const [riders, setRiders] = useState<TeamRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());
  const [raceNames, setRaceNames] = useState<Map<string, string>>(new Map());
  const hasAnyRacePoints = useMemo(
    () => riders.some((rider) => rider.racePoints && Object.keys(rider.racePoints).length > 0),
    [riders]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    async function loadTeamResults() {
      try {
        // Load game details
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (!gameResponse.ok) {
          throw new Error('Kon game niet laden');
        }
        const gameData = await gameResponse.json();
        setGame(gameData.game);

        // Load participant data
        const participantResponse = await fetch(`/api/gameParticipants?userId=${user!.uid}&gameId=${gameId}`);
        if (!participantResponse.ok) {
          throw new Error('Kon deelname niet laden');
        }
        const participantData = await participantResponse.json();

        if (participantData.participants.length === 0) {
          throw new Error('Je doet niet mee aan deze game');
        }
        setParticipant(participantData.participants[0]);

        // Load team with race points (IndexedDB cached)
        const { data: teamData } = await fetchTeamWithCache(gameId, user!.uid, {
          maxAgeMs: 2 * 60 * 1000,
        });

        // Sort riders by points (highest first)
        const sortedRiders = (teamData.riders || []).sort((a: TeamRider, b: TeamRider) => b.points - a.points);
        setRiders(sortedRiders);
      } catch (err) {
        console.error('Error loading team results:', err);
        setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    loadTeamResults();
  }, [user, authLoading, gameId, router]);

  // Load race names
  useEffect(() => {
    const loadRaceNames = async () => {
      try {
        if (game) {
          const year = game.year || new Date().getFullYear();
          const names = await getRaceNamesClient(year);
          setRaceNames(names);
        }
      } catch (error) {
        console.error('Error loading race names:', error);
      }
    };
    
    loadRaceNames();
  }, [game]);

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link
            href="/games"
            className="text-blue-600 hover:text-blue-700"
          >
            Terug naar games
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
                Jouw Team Resultaten
              </h1>
              {game && (
                <p className="text-gray-600">
                  {game.name}
                </p>
              )}
            </div>
            <Link
              href="/games"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Terug naar Games
            </Link>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Totaal Punten</div>
              <div className="text-2xl font-bold text-primary">
                {getTotalPoints()}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Ranking</div>
              <div className="text-2xl font-bold text-gray-900">
                #{participant?.ranking || '-'}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Aantal Renners</div>
              <div className="text-2xl font-bold text-gray-900">
                {riders.length}
              </div>
            </div>
          </div>
        </div>

        {/* Riders List */}
        <div className="space-y-4">
          {riders.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
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
                        raceNames={raceNames}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Info text */}
        {riders.length > 0 && hasAnyRacePoints && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Klik op een renner om de gedetailleerde punten per etappe te zien
          </div>
        )}
      </div>
    </div>
  );
}
