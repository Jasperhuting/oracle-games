'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { AvatarUpload } from './AvatarUpload';

interface TopResult {
  gameName: string;
  raceName: string;
  gameType: string;
  ranking: number;
  year: number;
  division?: string;
}

interface ClusteredResult {
  ranking: number;
  gameType: string;
  raceNames: string[];
}

const GAME_TYPE_LABELS: Record<string, string> = {
  'auctioneer': 'Auctioneer',
  'slipstream': 'Slipstream',
  'last-man-standing': 'Last Man Standing',
  'poisoned-cup': 'Poisoned Cup',
  'nations-cup': 'Nations Cup',
  'rising-stars': 'Rising Stars',
  'country-roads': 'Country Roads',
  'worldtour-manager': 'WorldTour Manager',
  'fan-flandrien': 'Fan Flandrien',
  'full-grid': 'Full Grid',
  'marginal-gains': 'Marginal Gains',
  'f1-prediction': 'F1 Prediction',
};

function extractRaceName(gameName: string, gameType: string): string {
  const label = GAME_TYPE_LABELS[gameType] || gameType;
  let name = gameName;
  if (name.startsWith(label + ' - ')) {
    name = name.slice(label.length + 3);
  }
  name = name.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
  return name || gameName;
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
  const { t } = useTranslation();
  const [clusteredResults, setClusteredResults] = useState<ClusteredResult[]>([]);
  const [totalResultCount, setTotalResultCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [oracleStats, setOracleStats] = useState<OracleStats | null>(null);
  const [oracleLoading, setOracleLoading] = useState(true);
  const [seasonStats, setSeasonStats] = useState<OracleStats | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [oracleStandingsOpen, setOracleStandingsOpen] = useState(false);
  const [oracleStandings, setOracleStandings] = useState<OracleStats[]>([]);
  const [oracleStandingsLoading, setOracleStandingsLoading] = useState(false);
  const [seasonStandingsOpen, setSeasonStandingsOpen] = useState(false);
  const [seasonStandings, setSeasonStandings] = useState<OracleStats[]>([]);
  const [seasonStandingsLoading, setSeasonStandingsLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const handleAvatarUpload = async (newAvatarUrl: string) => {
    try {
      const response = await fetch('/api/updateUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, playername, avatarUrl: newAvatarUrl }),
      });
      if (response.ok) {
        setCurrentAvatarUrl(newAvatarUrl);
        onAvatarUpdate?.(newAvatarUrl);
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
    }
  };

  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;

  useEffect(() => {
    async function fetchTopResults() {
      try {
        const [participantsResponse, f1RankResponse] = await Promise.all([
          fetch(`/api/gameParticipants?userId=${userId}`),
          fetch(`/api/f1/user-rank?userId=${userId}`),
        ]);

        if (!participantsResponse.ok) { setLoading(false); return; }

        const data = await participantsResponse.json();
        const participants = data.participants || [];
        const allResults: TopResult[] = [];

        for (const participant of participants) {
          const gameId = participant.gameId.replace(/-pending$/, '');
          if (!gameId || participant.ranking === 0) continue;
          try {
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (!gameResponse.ok) continue;
            const gameData = await gameResponse.json();
            const game = gameData.game;
            if (game?.status === 'finished' && participant.ranking > 0 &&
                !game.isTest && !game.name?.toLowerCase().includes('test')) {
              const gameType: string = game.gameType || '';
              allResults.push({
                gameName: game.name,
                raceName: extractRaceName(game.name, gameType),
                gameType,
                ranking: participant.ranking,
                year: game.year || new Date().getFullYear(),
                division: game.division,
              });
            }
          } catch { /* skip */ }
        }

        if (f1RankResponse.ok) {
          const f1Data = await f1RankResponse.json();
          for (const entry of f1Data.results || []) {
            allResults.push({
              gameName: `F1 Prediction ${entry.season}`,
              raceName: String(entry.season),
              gameType: 'f1-prediction',
              ranking: entry.rank,
              year: entry.season,
            });
          }
        }

        allResults.sort((a, b) => a.ranking - b.ranking);

        // Cluster by ranking + gameType
        const clusterMap = new Map<string, ClusteredResult>();
        for (const result of allResults) {
          const key = `${result.ranking}-${result.gameType}`;
          if (!clusterMap.has(key)) {
            clusterMap.set(key, { ranking: result.ranking, gameType: result.gameType, raceNames: [] });
          }
          clusterMap.get(key)!.raceNames.push(result.raceName);
        }

        const clustered = Array.from(clusterMap.values())
          .sort((a, b) => a.ranking - b.ranking)
          .slice(0, 10);

        setTotalResultCount(allResults.length);
        setClusteredResults(clustered);
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
        setOracleStats(data?.success && data?.user ? data.user : null);
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
        setSeasonStats(data?.success && data?.user ? data.user : null);
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

  const formatOracleRating = (rating: number): string =>
    new Intl.NumberFormat('nl-NL').format(Math.round(rating * 100000));

  const pointsTooltip = t('carriere.pointsTooltip');

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

  const openSeasonStandings = async () => {
    setSeasonStandingsOpen(true);
    setSeasonStandingsLoading(true);
    try {
      const response = await fetch(`/api/oracle-rank?userId=${userId}&includeTop=true&topLimit=100&year=${currentYear}`);
      if (!response.ok) return;
      const data: OracleRankResponse = await response.json();
      setSeasonStandings(data.top || []);
    } catch (error) {
      console.error('Error fetching season standings:', error);
    } finally {
      setSeasonStandingsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-light to-white p-6">
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0 relative">
            {readOnly ? (
              <div className="w-[100px] h-[100px] rounded-full overflow-hidden border-2 border-gray-200 bg-gray-200 flex items-center justify-center">
                {currentAvatarUrl ? (
                  <Image
                    src={currentAvatarUrl}
                    alt={`${playername} avatar`}
                    width={100}
                    height={100}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-1/2 h-1/2 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
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

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{playername}</h2>
            {age && (
              <p className="text-gray-600 mb-1">
                <span className="font-medium">{t('carriere.age')}:</span> {t('carriere.ageYears', { age })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('carriere.performances')}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Oracle Rank */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-primary mb-1">
              {oracleLoading ? '...' : oracleStats?.oracleRank ? `#${oracleStats.oracleRank}` : '-'}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">{t('carriere.oracleRankLabel')}</div>
            <div className="text-xs text-gray-500">
              {oracleLoading
                ? t('global.loading')
                : oracleStats
                  ? t('carriere.oraclePoints', { points: formatOracleRating(oracleStats.oracleRating), games: oracleStats.gamesPlayed })
                  : t('carriere.noResults')}
              <span className="ml-1 text-gray-400 cursor-help" title={pointsTooltip}>ⓘ</span>
            </div>
            <button
              type="button"
              onClick={openOracleStandings}
              className="mt-2 text-xs text-primary hover:text-primary-hover underline"
            >
              {t('carriere.viewStandings')}
            </button>
          </div>

          {/* Season Rank */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-primary mb-1">
              {seasonLoading ? '...' : seasonStats?.oracleRank ? `#${seasonStats.oracleRank}` : '-'}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">{t('carriere.seasonRankLabel')}</div>
            <div className="text-xs text-gray-500">
              {seasonLoading
                ? t('global.loading')
                : seasonStats
                  ? t('carriere.seasonPoints', { year: currentYear, points: formatOracleRating(seasonStats.oracleRating), games: seasonStats.gamesPlayed })
                  : t('carriere.noResultsInYear', { year: currentYear })}
              <span className="ml-1 text-gray-400 cursor-help" title={pointsTooltip}>ⓘ</span>
            </div>
            <button
              type="button"
              onClick={openSeasonStandings}
              className="mt-2 text-xs text-primary hover:text-primary-hover underline"
            >
              {t('carriere.viewStandings')}
            </button>
          </div>

          {/* Top Results count */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-primary mb-1">
              {loading ? '...' : totalResultCount}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">{t('carriere.topResultsLabel')}</div>
            <div className="text-xs text-gray-500">
              {loading
                ? t('global.loading')
                : totalResultCount > 0
                  ? t('carriere.bestPerformances')
                  : t('carriere.noResults')}
            </div>
          </div>
        </div>
      </div>

      {/* Top Results list */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('carriere.topResultsHeading')}</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">{t('global.loading')}</div>
        ) : clusteredResults.length > 0 ? (
          <div className="space-y-3">
            {clusteredResults.map((result, index) => {
              const gameTypeLabel = GAME_TYPE_LABELS[result.gameType] || result.gameType;
              const rankBadgeClass = result.ranking === 1
                ? 'bg-yellow-100 text-yellow-700'
                : result.ranking === 2
                  ? 'bg-gray-100 text-gray-600'
                  : result.ranking === 3
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-primary-light text-primary';
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${rankBadgeClass}`}>
                    {formatRanking(result.ranking)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {result.raceNames.join(', ')}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{gameTypeLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <div className="text-lg mb-2">🏁</div>
            <div>{t('carriere.noResults')}</div>
            <div className="text-sm text-gray-400 mt-1">{t('carriere.noResultsDescription')}</div>
          </div>
        )}
      </div>

      {/* Action links */}
      {!readOnly && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { href: '/account/settings', emoji: '⚙️', label: t('account.settingsTitle') },
              { href: '/account/stats',    emoji: '📊', label: t('carriere.statsLink') },
              { href: '/account/history',  emoji: '📜', label: t('carriere.historyLink') },
              { href: '/forum',            emoji: '💬', label: t('header.menu.forum') },
            ].map(({ href, emoji, label }) => (
              <Link
                key={href}
                href={href}
                className="group bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-primary hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                  <span className="text-xl">{emoji}</span>
                </div>
                <div className="text-sm font-semibold text-gray-700 group-hover:text-primary">{label}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Season Standings modal */}
      {seasonStandingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('global.close')}
            onClick={() => setSeasonStandingsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-white border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">{t('carriere.seasonRankLabel')} {currentYear}</h4>
              <button
                type="button"
                onClick={() => setSeasonStandingsOpen(false)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {t('global.close')}
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-65px)]">
              {seasonStandingsLoading ? (
                <div className="text-sm text-gray-500">{t('global.loading')}</div>
              ) : seasonStandings.length === 0 ? (
                <div className="text-sm text-gray-500">{t('carriere.noStandings')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">{t('carriere.playerColumn')}</th>
                      <th className="py-2 pr-2 text-right">
                        <span title={pointsTooltip} className="cursor-help">
                          {t('global.points')} ⓘ
                        </span>
                      </th>
                      <th className="py-2 pr-2 text-right">{t('global.games')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonStandings.map((entry) => (
                      <tr
                        key={entry.userId}
                        className={`border-b border-gray-100 ${entry.userId === userId ? 'bg-blue-50' : ''}`}
                      >
                        <td className="py-2 pr-2 font-semibold text-gray-900">#{entry.oracleRank}</td>
                        <td className="py-2 pr-2 text-gray-800">
                          {entry.playername || t('global.unknown')}
                          {entry.userId === userId && (
                            <span className="ml-2 text-xs text-blue-700 font-medium">{t('carriere.you')}</span>
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

      {/* Oracle Standings modal */}
      {oracleStandingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('global.close')}
            onClick={() => setOracleStandingsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-white border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">{t('carriere.standingsTitle')}</h4>
              <button
                type="button"
                onClick={() => setOracleStandingsOpen(false)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {t('global.close')}
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-65px)]">
              {oracleStandingsLoading ? (
                <div className="text-sm text-gray-500">{t('global.loading')}</div>
              ) : oracleStandings.length === 0 ? (
                <div className="text-sm text-gray-500">{t('carriere.noStandings')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">{t('carriere.playerColumn')}</th>
                      <th className="py-2 pr-2 text-right">
                        <span title={pointsTooltip} className="cursor-help">
                          {t('global.points')} ⓘ
                        </span>
                      </th>
                      <th className="py-2 pr-2 text-right">{t('global.games')}</th>
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
                          {entry.playername || t('global.unknown')}
                          {entry.userId === userId && (
                            <span className="ml-2 text-xs text-blue-700 font-medium">{t('carriere.you')}</span>
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
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age > 0 && age < 150 ? age : null;
  } catch {
    return null;
  }
}
