'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AvatarUpload } from './AvatarUpload';

interface TopResult {
  gameName: string;
  ranking: number;
  year: number;
  division?: string;
}

interface OracleStats {
  userId: string;
  playername: string;
  gamesPlayed: number;
  averageGameScore: number;
  oracleRating: number;
  oracleRank: number;
}

interface OracleRankResponse {
  success?: boolean;
  user?: OracleStats | null;
  top?: OracleStats[];
}

interface CarriereCardProps {
  userId: string;
  playername: string;
  dateOfBirth?: string;
  avatarUrl?: string;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
  readOnly?: boolean;
}

export function CarriereCard({ userId, playername, dateOfBirth, avatarUrl, onAvatarUpdate, readOnly = false }: CarriereCardProps) {
  const [topResults, setTopResults] = useState<TopResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [oracleStats, setOracleStats] = useState<OracleStats | null>(null);
  const [oracleLoading, setOracleLoading] = useState(true);
  const [seasonStats, setSeasonStats] = useState<OracleStats | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [oracleStandingsOpen, setOracleStandingsOpen] = useState(false);
  const [oracleStandings, setOracleStandings] = useState<OracleStats[]>([]);
  const [oracleStandingsLoading, setOracleStandingsLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  // Update local state when prop changes
  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const handleAvatarUpload = async (newAvatarUrl: string) => {
    try {
      const response = await fetch('/api/updateUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          playername,
          avatarUrl: newAvatarUrl,
        }),
      });

      if (response.ok) {
        setCurrentAvatarUrl(newAvatarUrl);
        onAvatarUpdate?.(newAvatarUrl);
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
    }
  };

  // Calculate age from dateOfBirth
  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;

  useEffect(() => {
    async function fetchTopResults() {
      try {
        // Fetch user's game participations
        const response = await fetch(`/api/gameParticipants?userId=${userId}`);
        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        const participants = data.participants || [];

        // Get game details for each participation
        const results: TopResult[] = [];

        for (const participant of participants) {
          const gameId = participant.gameId.replace(/-pending$/, '');
          if (!gameId || participant.ranking === 0) continue;

          try {
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (!gameResponse.ok) continue;

            const gameData = await gameResponse.json();
            const game = gameData.game;

            // Only include finished games for top results (exclude test games)
            if (game?.status === 'finished' && participant.ranking > 0 &&
                !game.isTest && !game.name?.toLowerCase().includes('test')) {
              results.push({
                gameName: game.name,
                ranking: participant.ranking,
                year: game.year || new Date().getFullYear(),
                division: game.division,
              });
            }
          } catch {
            // Skip games that fail to load
          }
        }

        // Sort by ranking (best first) and take top 5
        results.sort((a, b) => a.ranking - b.ranking);
        setTopResults(results.slice(0, 5));
      } catch (error) {
        console.error('Error fetching top results:', error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchOracleStats() {
      try {
        const response = await fetch(`/api/oracle-rank?userId=${userId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (data?.success && data?.user) {
          setOracleStats(data.user);
        } else {
          setOracleStats(null);
        }
      } catch (error) {
        console.error('Error fetching oracle rank:', error);
      } finally {
        setOracleLoading(false);
      }
    }

    async function fetchSeasonStats() {
      try {
        const response = await fetch(`/api/oracle-rank?userId=${userId}&year=${currentYear}`);
        if (!response.ok) return;

        const data: OracleRankResponse = await response.json();
        if (data?.success && data?.user) {
          setSeasonStats(data.user);
        } else {
          setSeasonStats(null);
        }
      } catch (error) {
        console.error('Error fetching season rank:', error);
      } finally {
        setSeasonLoading(false);
      }
    }

    if (userId) {
      fetchTopResults();
      fetchOracleStats();
      fetchSeasonStats();
    }
  }, [userId, currentYear]);

  const formatRanking = (ranking: number): string => {
    if (ranking === 1) return '1e';
    if (ranking === 2) return '2e';
    if (ranking === 3) return '3e';
    return `${ranking}e`;
  };

  const formatYear = (year: number): string => {
    return `'${String(year).slice(-2)}`;
  };

  const formatOracleRating = (rating: number): string => {
    return new Intl.NumberFormat('nl-NL').format(Math.round(rating * 100000));
  };

  const pointsTooltip =
    'Punten-berekening: 1) Per spel score = (deelnemers - positie) / (deelnemers - 1). 2) Gemiddelde van je spel-scores. 3) Rating = (spellen/(spellen+5))*gemiddelde + (5/(spellen+5))*0,5. 4) Punten = rating x 100.000.';

  const openOracleStandings = async () => {
    setOracleStandingsOpen(true);
    setOracleStandingsLoading(true);
    try {
      const response = await fetch(`/api/oracle-rank?userId=${userId}&includeTop=true&topLimit=100`);
      if (!response.ok) return;
      const data: OracleRankResponse = await response.json();
      setOracleStandings(data.top || []);
    } catch (error) {
      console.error('Error fetching oracle standings:', error);
    } finally {
      setOracleStandingsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with avatar and basic info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {readOnly ? (
              <div
                className="rounded-full overflow-hidden border-2 border-gray-200 bg-gray-200 flex items-center justify-center"
                style={{ width: 100, height: 100 }}
              >
                {currentAvatarUrl ? (
                  <Image
                    src={currentAvatarUrl}
                    alt={`${playername} avatar`}
                    width={100}
                    height={100}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-1/2 h-1/2 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
            ) : (
              <AvatarUpload
                currentAvatarUrl={currentAvatarUrl}
                onUploadSuccess={handleAvatarUpload}
                size={100}
              />
            )}
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{playername}</h2>
            {age && (
              <p className="text-gray-600 mb-1">
                <span className="font-medium">Leeftijd:</span> {age} jaar
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Prestaties</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Oracle Rank */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {oracleLoading ? '...' : oracleStats?.oracleRank ? `#${oracleStats.oracleRank}` : '-'}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Oracle Rank</div>
            <div className="text-xs text-gray-500">
              {oracleLoading
                ? 'Laden...'
                : oracleStats
                  ? `Punten ${formatOracleRating(oracleStats.oracleRating)} (${oracleStats.gamesPlayed} spellen)`
                  : 'Nog geen resultaten'}
              <span className="ml-1 text-gray-400 cursor-help" title={pointsTooltip}>
                ⓘ
              </span>
            </div>
            <button
              type="button"
              onClick={openOracleStandings}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Bekijk standings
            </button>
          </div>

          {/* Season Rank */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {seasonLoading ? '...' : seasonStats?.oracleRank ? `#${seasonStats.oracleRank}` : '-'}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Season Rank</div>
            <div className="text-xs text-gray-500">
              {seasonLoading
                ? 'Laden...'
                : seasonStats
                  ? `${currentYear}: Punten ${formatOracleRating(seasonStats.oracleRating)} (${seasonStats.gamesPlayed} spellen)`
                  : `Nog geen resultaten in ${currentYear}`}
              <span className="ml-1 text-gray-400 cursor-help" title={pointsTooltip}>
                ⓘ
              </span>
            </div>
          </div>

          {/* Top Results Count */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {loading ? '...' : topResults.length}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Top Resultaten</div>
            <div className="text-xs text-gray-500">
              {loading ? 'Laden...' : topResults.length > 0 ? 'Beste prestaties' : 'Nog geen resultaten'}
            </div>
          </div>
        </div>
      </div>

      {/* Top Results Details */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Resultaten</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Laden...</div>
        ) : topResults.length > 0 ? (
          <div className="space-y-3">
            {topResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {formatRanking(result.ranking)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{result.gameName}</div>
                    {result.division && (
                      <div className="text-sm text-gray-500">{result.division}</div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {formatYear(result.year)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <div className="text-lg mb-2">🏁</div>
            <div>Nog geen resultaten</div>
            <div className="text-sm text-gray-400 mt-1">Doe mee aan spellen om je prestaties te zien</div>
          </div>
        )}
      </div>

      {/* Action Links */}
      {!readOnly && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/account/settings"
              className="group bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-200 transition-colors">
                <span className="text-xl">⚙️</span>
              </div>
              <div className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">Voorkeuren</div>
            </Link>
            <Link
              href="/account/stats"
              className="group bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-green-300 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors">
                <span className="text-xl">📊</span>
              </div>
              <div className="text-sm font-semibold text-gray-700 group-hover:text-green-600">Statistiek</div>
            </Link>
            <Link
              href="/account/history"
              className="group bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-purple-300 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-200 transition-colors">
                <span className="text-xl">📜</span>
              </div>
              <div className="text-sm font-semibold text-gray-700 group-hover:text-purple-600">Geschiedenis</div>
            </Link>
            <Link
              href="/forum"
              className="group bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-orange-300 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-200 transition-colors">
                <span className="text-xl">💬</span>
              </div>
              <div className="text-sm font-semibold text-gray-700 group-hover:text-orange-600">Forum</div>
            </Link>
          </div>
        </div>
      )}

      {oracleStandingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close standings popup"
            onClick={() => setOracleStandingsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-white border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">Oracle Standings</h4>
              <button
                type="button"
                onClick={() => setOracleStandingsOpen(false)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sluiten
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-65px)]">
              {oracleStandingsLoading ? (
                <div className="text-sm text-gray-500">Laden...</div>
              ) : oracleStandings.length === 0 ? (
                <div className="text-sm text-gray-500">Geen standings beschikbaar</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">Speler</th>
                      <th className="py-2 pr-2 text-right">
                        <span title={pointsTooltip} className="cursor-help">
                          Punten ⓘ
                        </span>
                      </th>
                      <th className="py-2 pr-2 text-right">Spellen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oracleStandings.map((entry) => (
                      <tr
                        key={entry.userId}
                        className={`border-b border-gray-100 ${entry.userId === userId ? 'bg-blue-50' : ''}`}
                      >
                        <td className="py-2 pr-2 font-semibold text-gray-900">#{entry.oracleRank}</td>
                        <td className="py-2 pr-2 text-gray-800">
                          {entry.playername || 'Onbekend'}
                          {entry.userId === userId && (
                            <span className="ml-2 text-xs text-blue-700 font-medium">(jij)</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-800">
                          <span title={pointsTooltip} className="cursor-help">
                            {formatOracleRating(entry.oracleRating)}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-600">{entry.gamesPlayed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateAge(dateOfBirth: string): number | null {
  try {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age > 0 && age < 150 ? age : null;
  } catch {
    return null;
  }
}
