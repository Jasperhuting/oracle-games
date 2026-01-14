'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@/components/AuthGuard';

interface StageDetails {
  stage: string;
  finishPosition: number | null;
  stageResult: number;
  gcPoints: number;
  pointsClass: number;
  mountainsClass: number;
  youthClass: number;
  total: number;
}

interface RaceSummary {
  raceSlug: string;
  raceName: string;
  totalPoints: number;
  stagesCount: number;
  bestFinishPosition: number | null;
  stages: StageDetails[];
}

interface SeasonPointsRider {
  id: string;
  rank: number;
  riderNameId: string;
  riderName: string;
  totalPoints: number;
  racesCount: number;
  races: RaceSummary[];
  updatedAt: string | null;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  nextOffset: number | null;
}

export default function SeasonLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const year = params?.year as string;
  const { t } = useTranslation();

  const [riders, setRiders] = useState<SeasonPointsRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState(year);

  const loadSeasonPoints = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/season-points?year=${selectedYear}&limit=50&offset=${offset}`);
      if (!response.ok) {
        throw new Error('Kon seizoenspunten niet laden');
      }

      const data = await response.json();

      if (append) {
        setRiders(prev => [...prev, ...data.riders]);
      } else {
        setRiders(data.riders);
      }
      setPagination(data.pagination);
      setTotal(data.total);
    } catch (err) {
      console.error('Error loading season points:', err);
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear) {
      loadSeasonPoints(0, false);
    }
  }, [selectedYear, loadSeasonPoints]);

  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    router.push(`/rankings/season/${newYear}`);
  };

  const loadMore = () => {
    if (pagination?.nextOffset) {
      loadSeasonPoints(pagination.nextOffset, true);
    }
  };

  const toggleRider = (riderId: string) => {
    const newExpanded = new Set(expandedRiders);
    if (newExpanded.has(riderId)) {
      newExpanded.delete(riderId);
    } else {
      newExpanded.add(riderId);
    }
    setExpandedRiders(newExpanded);
  };

  const formatRaceName = (raceSlug: string) => {
    return raceSlug
      .replace(/_\d{4}$/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Generate year options (current year and a few years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Seizoen Punten {selectedYear}
                </h1>
                <p className="text-gray-600">
                  Overzicht van alle renners en hun gescoorde punten dit seizoen
                </p>
              </div>
              <Link
                href="/games"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Terug naar Games
              </Link>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Seizoen:</label>
              <div className="flex gap-2">
                {yearOptions.map(y => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(y.toString())}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      selectedYear === y.toString()
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">Totaal Renners</div>
                <div className="text-2xl font-bold text-gray-900">{total}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">Geladen</div>
                <div className="text-2xl font-bold text-gray-900">{riders.length}</div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="text-gray-600">Laden...</div>
            </div>
          ) : riders.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Geen seizoenspunten gevonden voor {selectedYear}</p>
              <p className="text-sm text-gray-500 mt-2">
                Punten worden toegevoegd wanneer etappe-uitslagen worden verwerkt.
              </p>
            </div>
          ) : (
            <>
              {/* Leaderboard Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Renner
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Races
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Punten
                      </th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {riders.map((rider) => {
                      const isExpanded = expandedRiders.has(rider.id);

                      return (
                        <>
                          <tr
                            key={rider.id}
                            onClick={() => rider.racesCount > 0 && toggleRider(rider.id)}
                            className={`${rider.racesCount > 0 ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                          >
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                rider.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                                rider.rank === 2 ? 'bg-gray-200 text-gray-800' :
                                rider.rank === 3 ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {rider.rank}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-medium text-gray-900">{rider.riderName}</div>
                              <div className="text-sm text-gray-500">{rider.riderNameId}</div>
                            </td>
                            <td className="px-4 py-4 text-right text-gray-600">
                              {rider.racesCount}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-xl font-bold text-primary">{rider.totalPoints}</span>
                            </td>
                            <td className="px-4 py-4 text-gray-400">
                              {rider.racesCount > 0 && (
                                <svg
                                  className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                              )}
                            </td>
                          </tr>
                          {/* Expanded Race Details */}
                          {isExpanded && (
                            <tr key={`${rider.id}-expanded`}>
                              <td colSpan={5} className="px-4 py-4 bg-gray-50">
                                <div className="pl-8">
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Punten per race:</h4>
                                  <div className="space-y-2">
                                    {rider.races
                                      .sort((a, b) => b.totalPoints - a.totalPoints)
                                      .map((race) => (
                                        <div
                                          key={race.raceSlug}
                                          className="bg-white rounded border border-gray-200 overflow-hidden"
                                        >
                                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                                            <div className="flex items-center gap-3">
                                              <span className="font-medium text-gray-900">
                                                {race.raceName || formatRaceName(race.raceSlug)}
                                              </span>
                                              {race.bestFinishPosition && (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                  race.bestFinishPosition === 1 ? 'bg-yellow-100 text-yellow-800' :
                                                  race.bestFinishPosition === 2 ? 'bg-gray-200 text-gray-800' :
                                                  race.bestFinishPosition === 3 ? 'bg-orange-100 text-orange-800' :
                                                  race.bestFinishPosition <= 10 ? 'bg-green-100 text-green-800' :
                                                  'bg-blue-100 text-blue-800'
                                                }`}>
                                                  #{race.bestFinishPosition}
                                                </span>
                                              )}
                                            </div>
                                            <span className="font-bold text-primary">
                                              {race.totalPoints} pts
                                            </span>
                                          </div>
                                          {/* Stage breakdown for multi-stage races or single-day with details */}
                                          {race.stages.length > 0 && (
                                            <div className="px-3 py-2 text-sm">
                                              {race.stages.length === 1 && race.stages[0].stage === 'result' ? (
                                                // Single-day race - show inline breakdown
                                                <div className="flex items-center gap-4 text-gray-600">
                                                  {race.stages[0].finishPosition && (
                                                    <span>Positie: <strong>#{race.stages[0].finishPosition}</strong></span>
                                                  )}
                                                  {race.stages[0].stageResult > 0 && (
                                                    <span>Uitslag: {race.stages[0].stageResult} pts</span>
                                                  )}
                                                  {race.stages[0].gcPoints > 0 && (
                                                    <span>GC: {race.stages[0].gcPoints} pts</span>
                                                  )}
                                                </div>
                                              ) : (
                                                // Multi-stage race - show stages count
                                                <span className="text-gray-500">
                                                  {race.stagesCount} etappe{race.stagesCount !== 1 ? 's' : ''} met punten
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Load More Button */}
              {pagination?.nextOffset && (
                <div className="mt-6 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Laden...' : `Meer laden (${total - riders.length} over)`}
                  </button>
                </div>
              )}

              {/* Info text */}
              <div className="mt-6 text-center text-sm text-gray-500">
                Klik op een renner om de punten per race te zien
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
