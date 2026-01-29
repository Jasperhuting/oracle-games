'use client';

import { useState } from 'react';
import { Flag } from '@/components/Flag';
import { Tooltip } from 'react-tooltip';
import { useTranslation } from 'react-i18next';
import { Game } from '@/lib/types/games';
import { Selector } from '@/components/Selector';

interface Rider {
  riderId: string;
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  baseValue: number;
  pricePaid: number;
  pointsScored: number;
  percentageDiff: number;
  bidAt?: string;
  acquiredAt?: string;
  owners?: Array<{ playername: string; userId: string; pricePaid: number; bidAt?: string }>;
}

interface Team {
  participantId: string;
  playername: string;
  userId: string;
  ranking: number;
  totalRiders: number;
  totalBaseValue: number;
  totalSpent: number;
  totalPoints: number;
  totalPercentageDiff: number;
  riders: Rider[];
}

interface AllTeamsTabProps {
  game: Game | null;
  teams: Team[];
  currentUserId?: string;
  loading: boolean;
  error: string | null;
}

interface PlayerSelectorProps {
  teams: Team[];
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  excludeUserId?: string;
  placeholder?: string;
}

function PlayerSelector({
  teams,
  selectedUserId,
  onSelect,
  excludeUserId,
  placeholder = 'Selecteer een speler...',
}: PlayerSelectorProps) {
  const filteredTeams = teams.filter(t => !excludeUserId || t.userId !== excludeUserId);
  const selectedTeam = selectedUserId ? teams.find(t => t.userId === selectedUserId) : null;

  return (
    <Selector<Team>
      items={filteredTeams}
      selectedItems={selectedTeam ? [selectedTeam] : []}
      setSelectedItems={(items) => onSelect(items.length > 0 ? items[0].userId : null)}
      multiSelect={false}
      multiSelectShowSelected={false}
      placeholder={placeholder}
      searchFilter={(team, search) =>
        team.playername.toLowerCase().includes(search.toLowerCase())
      }
      isEqual={(a, b) => a.userId === b.userId}
      renderItem={(team) => (
        <span className="text-sm">
          <span className="text-gray-500 font-medium">#{team.ranking}</span> {team.playername}
        </span>
      )}
      renderSelectedItem={(team) => (
        <span className="text-sm">#{team.ranking} {team.playername}</span>
      )}
      getItemLabel={(team) => `#${team.ranking} - ${team.playername}`}
      sortKey={(team) => String(team.ranking).padStart(4, '0')}
      initialResultsLimit={100}
    />
  );
}

export function AllTeamsTab({ game, teams, currentUserId, loading, error }: AllTeamsTabProps) {
  const { t } = useTranslation();
  
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'ranking' | 'points' | 'value' | 'percentage'>('ranking');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'players' | 'cycling-teams' | 'all' | 'compare'>('players');
  const [groupByCyclingTeam, setGroupByCyclingTeam] = useState(false);
  const [allViewSortBy, setAllViewSortBy] = useState<'points' | 'value' | 'owners' | 'team'>('points');
  const [allViewSortDirection, setAllViewSortDirection] = useState<'asc' | 'desc'>('desc');
  const [compareUserId, setCompareUserId] = useState<string | null>(null);
  const [allViewSearch, setAllViewSearch] = useState('');

  const toggleTeam = (participantId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(participantId)) {
      newExpanded.delete(participantId);
    } else {
      newExpanded.add(participantId);
    }
    setExpandedTeams(newExpanded);
  };

  // Group riders by cycling team
  const cyclingTeamsMap = new Map<string, Map<string, any>>();
  teams?.forEach(team => {
    if (!team) return;
    team.riders?.forEach(rider => {
      if (!rider) return;
      const cyclingTeam = rider.riderTeam || 'Onbekend';
      if (!cyclingTeamsMap.has(cyclingTeam)) {
        cyclingTeamsMap.set(cyclingTeam, new Map());
      }
      const ridersMap = cyclingTeamsMap.get(cyclingTeam)!;
      const riderKey = rider.riderNameId || rider.riderName;

      if (ridersMap.has(riderKey)) {
        const existingRider = ridersMap.get(riderKey)!;
        existingRider.owners.push({
          playername: team.playername || 'Unknown',
          userId: team.userId || '',
          pricePaid: rider.pricePaid,
          bidAt: rider.bidAt,
        });
      } else {
        ridersMap.set(riderKey, {
          ...rider,
          owners: [{
            playername: team.playername || 'Unknown',
            userId: team.userId || '',
            pricePaid: rider.pricePaid,
            bidAt: rider.bidAt,
          }],
        });
      }
    });
  });

  const cyclingTeams = Array.from(cyclingTeamsMap.entries())
    .map(([teamName, ridersMap]) => {
      const riders = Array.from(ridersMap.values());
      const totalOwnerCount = riders.reduce((sum, r) => sum + r.owners.length, 0);
      const totalBaseValue = riders.reduce((sum, r) => sum + r.baseValue * r.owners.length, 0);
      const totalPricePaid = riders.reduce((sum, r) =>
        sum + r.owners.reduce((ownerSum: number, o: any) => ownerSum + o.pricePaid, 0), 0);
      const totalPercentageDiff = totalBaseValue > 0
        ? Math.round(((totalPricePaid - totalBaseValue) / totalBaseValue) * 100)
        : 0;

      return {
        teamName,
        riders,
        totalRiders: totalOwnerCount,
        uniqueRiders: riders.length,
        totalBaseValue,
        totalPricePaid,
        totalPercentageDiff,
      };
    })
    .sort((a, b) => b.totalRiders - a.totalRiders);

  // All riders flattened
  const allRidersList = cyclingTeams
    .flatMap(team => team.riders)
    .filter((rider: any) => {
      if (!allViewSearch.trim()) return true;
      const searchLower = allViewSearch.toLowerCase().trim();
      const riderName = (rider.riderName || '').toLowerCase();
      const riderTeam = (rider.riderTeam || '').toLowerCase();
      return riderName.includes(searchLower) || riderTeam.includes(searchLower);
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      switch (allViewSortBy) {
        case 'points':
          comparison = a.pointsScored - b.pointsScored;
          break;
        case 'value':
          comparison = a.baseValue - b.baseValue;
          break;
        case 'owners':
          comparison = (a.owners?.length || 1) - (b.owners?.length || 1);
          break;
        case 'team':
          comparison = (a.riderTeam || '').localeCompare(b.riderTeam || '');
          break;
      }
      const primaryResult = allViewSortDirection === 'desc' ? -comparison : comparison;
      if (primaryResult === 0) {
        return b.pointsScored - a.pointsScored;
      }
      return primaryResult;
    });

  const sortedTeams = [...(teams || [])].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'ranking':
        comparison = a.ranking - b.ranking;
        break;
      case 'points':
        comparison = a.totalPoints - b.totalPoints;
        break;
      case 'value':
        comparison = a.totalBaseValue - b.totalBaseValue;
        break;
      case 'percentage':
        if (game?.gameType === 'marginal-gains') {
          const aPricePaid = a.totalSpent ?? 0;
          const aPointsScored = (a.riders ?? []).reduce((sum, rider) => sum + (rider?.pointsScored || 0), 0);
          const aMarginalGainsValue = aPointsScored - aPricePaid;
          const aMarginalGainsPercentage = aPricePaid > 0 ? (aMarginalGainsValue / aPricePaid) * 100 : null;

          const bPricePaid = b.totalSpent ?? 0;
          const bPointsScored = (b.riders ?? []).reduce((sum, rider) => sum + (rider?.pointsScored || 0), 0);
          const bMarginalGainsValue = bPointsScored - bPricePaid;
          const bMarginalGainsPercentage = bPricePaid > 0 ? (bMarginalGainsValue / bPricePaid) * 100 : null;

          if (aMarginalGainsPercentage === null && bMarginalGainsPercentage === null) return 0;
          if (aMarginalGainsPercentage === null) return 1;
          if (bMarginalGainsPercentage === null) return -1;

          const pctComparison = aMarginalGainsPercentage - bMarginalGainsPercentage;
          return sortDirection === 'asc' ? pctComparison : -pctComparison;
        }

        comparison = a.totalPercentageDiff - b.totalPercentageDiff;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

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
      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setViewMode('players');
            setGroupByCyclingTeam(false);
          }}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'players'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Per Speler
        </button>
        <button
          onClick={() => setViewMode('cycling-teams')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'cycling-teams'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Per Wielerteam
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Alles
        </button>
        <button
          onClick={() => setViewMode('compare')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'compare'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Vergelijken
        </button>
      </div>

      {/* Sort Controls - only show for players view */}
      {viewMode === 'players' && (
        <div className="space-y-4 mb-4">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setSortBy('ranking')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortBy === 'ranking'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Ranking
            </button>
            <button
              onClick={() => setSortBy('points')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortBy === 'points'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Punten
            </button>
            <button
              onClick={() => setSortBy('value')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortBy === 'value'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Totale Waarde
            </button>
            <button
              onClick={() => setSortBy('percentage')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortBy === 'percentage'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Verschil %
            </button>

            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="ml-2 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2"
              title={sortDirection === 'asc' ? t('global.ascending') : t('global.descending')}
            >
              {sortDirection === 'asc' ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  {t('global.ascending')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  {t('global.descending')}
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="groupByCyclingTeam"
              checked={groupByCyclingTeam}
              onChange={(e) => setGroupByCyclingTeam(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="groupByCyclingTeam" className="text-sm text-gray-700 cursor-pointer">
              Groepeer renners per wielerteam
            </label>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Totaal Teams</div>
          <div className="text-2xl font-bold text-gray-900">
            {teams?.length || 0}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Totaal Renners</div>
          <div className="text-2xl font-bold text-gray-900">
            {teams?.reduce((sum, t) => sum + (t?.totalRiders || 0), 0) || 0}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Totaal Uitgegeven</div>
          <div className="text-2xl font-bold text-gray-900">
            €{(teams?.reduce((sum, t) => sum + (t?.totalSpent || 0), 0) || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Teams List - Per Speler */}
      {viewMode === 'players' && (
        <div className="space-y-4">
          {sortedTeams.map((team) => {
            const isExpanded = expandedTeams.has(team.participantId);
            const pricePaid = team.totalSpent ?? 0;
            const pointsScored = team.riders.reduce((sum, rider) => sum + (rider?.pointsScored || 0), 0);
            const marginalGainsValue = pointsScored - pricePaid;
            const marginalGainsPercentage = pricePaid > 0 ? (marginalGainsValue / pricePaid) * 100 : null;
            const marginalGainsPercentageClass =
              marginalGainsPercentage === null
                ? 'text-gray-600'
                : marginalGainsPercentage > 0
                  ? 'text-green-600'
                  : marginalGainsPercentage < 0
                    ? 'text-red-600'
                    : 'text-gray-600';

            return (
              <div
                key={team.participantId}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  onClick={() => toggleTeam(team.participantId)}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-gray-400">
                        #{team.ranking}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {team.playername}
                        </h3>
                        <div className="flex gap-4 text-sm text-gray-600 mt-1">
                          <span>{team.totalRiders} renners</span>
                          <span>Waarde: {team.totalBaseValue.toLocaleString()}</span>
                          <span>Betaald: €{team.totalSpent.toLocaleString()}</span>
                          <span className={`font-medium ${game?.gameType === 'marginal-gains' ? marginalGainsPercentageClass : team.totalPercentageDiff > 0
                              ? 'text-red-600'
                              : team.totalPercentageDiff < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}>
                            Verschil: 
                            {game?.gameType === 'marginal-gains' ? `${Math.round(marginalGainsPercentage || 0)}%` : `${team.totalPercentageDiff > 0 ? '+' : ''}${team.totalPercentageDiff}%`}
                          </span>
                          <span className="font-medium text-blue-600">
                            {team.totalPoints} punten
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-gray-500">
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
                    </div>
                  </div>
                </div>

                {isExpanded && team.riders.length > 0 && (
                  <div className="border-t border-gray-200">
                    {!groupByCyclingTeam ? (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renner</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Land</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Waarde</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prijs</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bieddatum</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Verschil</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Punten</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {team.riders.map((rider) => (
                            <tr key={rider.riderId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{rider.riderName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{rider.riderTeam}</td>
                              <td className="px-4 py-3 text-sm text-gray-600"><Flag countryCode={rider.riderCountry} /></td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.baseValue}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{rider.pricePaid}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {rider.bidAt ? new Date(rider.bidAt).toLocaleDateString('nl-NL', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                }) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {(() => {
                                  const isMarginalGains = game?.gameType === 'marginal-gains';
                                  const displayPercentage = isMarginalGains
                                    ? (rider.baseValue > 0 ? Math.round(((rider.pointsScored - rider.baseValue) / rider.baseValue) * 100) : 0)
                                    : rider.percentageDiff;
                                  const colorClass = isMarginalGains
                                    ? (displayPercentage > 0 ? 'text-green-600' : displayPercentage < 0 ? 'text-red-600' : 'text-gray-600')
                                    : (displayPercentage > 0 ? 'text-red-600' : displayPercentage < 0 ? 'text-green-600' : 'text-gray-600');
                                  return (
                                    <span className={`font-medium ${colorClass}`}>
                                      {displayPercentage > 0 ? '+' : ''}{displayPercentage}%
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {(() => {
                          const cyclingTeamGroups = new Map<string, Rider[]>();
                          team.riders.forEach(rider => {
                            const cyclingTeam = rider.riderTeam || 'Onbekend';
                            if (!cyclingTeamGroups.has(cyclingTeam)) {
                              cyclingTeamGroups.set(cyclingTeam, []);
                            }
                            cyclingTeamGroups.get(cyclingTeam)!.push(rider);
                          });

                          const sortedCyclingTeams = Array.from(cyclingTeamGroups.entries())
                            .sort((a, b) => b[1].length - a[1].length);

                          return sortedCyclingTeams.map(([cyclingTeam, riders]) => {
                            const teamTotalBaseValue = riders.reduce((sum, r) => sum + r.baseValue, 0);
                            const teamTotalPricePaid = riders.reduce((sum, r) => sum + r.pricePaid, 0);
                            const teamTotalDiff = teamTotalPricePaid - teamTotalBaseValue;
                            const teamPercentageDiff = teamTotalBaseValue > 0
                              ? Math.round((teamTotalDiff / teamTotalBaseValue) * 100)
                              : 0;

                            return (
                              <div key={cyclingTeam} className="bg-gray-50">
                                <div className="px-4 py-3 bg-gray-100">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold text-gray-900">{cyclingTeam}</div>
                                    <div className="flex gap-4 text-sm text-gray-600">
                                      <span>{riders.length} renners</span>
                                      <span>Waarde: {teamTotalBaseValue.toLocaleString()}</span>
                                      <span>Betaald: €{teamTotalPricePaid.toLocaleString()}</span>
                                      <span className={`font-medium ${
                                        teamPercentageDiff > 0 ? 'text-red-600' : teamPercentageDiff < 0 ? 'text-green-600' : 'text-gray-600'
                                      }`}>
                                        {teamPercentageDiff > 0 ? '+' : ''}{teamPercentageDiff}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <table className="w-full">
                                  <tbody className="divide-y divide-gray-200">
                                    {riders.map((rider) => (
                                      <tr key={rider.riderId} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{rider.riderName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600"><Flag countryCode={rider.riderCountry} /></td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.baseValue}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{rider.pricePaid}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {isExpanded && team.riders.length === 0 && (
                  <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                    Nog geen renners gekozen
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Teams List - Per Wielerteam */}
      {viewMode === 'cycling-teams' && (
        <div className="space-y-4">
          {cyclingTeams.map((team) => {
            const isExpanded = expandedTeams.has(team.teamName);

            return (
              <div
                key={team.teamName}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  onClick={() => toggleTeam(team.teamName)}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{team.teamName}</h3>
                      <div className="flex gap-4 text-sm text-gray-600 mt-1">
                        <span>
                          {team.uniqueRiders} renners
                          {team.totalRiders !== team.uniqueRiders && (
                            <span className="text-gray-400"> ({team.totalRiders}x gekozen)</span>
                          )}
                        </span>
                        <span>Waarde: {team.totalBaseValue.toLocaleString()}</span>
                        <span>Betaald: €{team.totalPricePaid.toLocaleString()}</span>
                        <span className={`font-medium ${
                          team.totalPercentageDiff > 0 ? 'text-red-600' : team.totalPercentageDiff < 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          Verschil: {team.totalPercentageDiff > 0 ? '+' : ''}{team.totalPercentageDiff}%
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-500">
                      <svg
                        className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && team.riders.length > 0 && (
                  <div className="border-t border-gray-200">
                    <Tooltip
                      id="owner-tooltip"
                      className="!opacity-100 !z-50 !max-w-xs"
                      clickable={true}
                      delayHide={300}
                      render={({ content }) => {
                        const owners = content?.split('|||') || [];
                        return (
                          <div className="max-h-48 overflow-y-auto">
                            {owners.map((ownerData, idx) => {
                              const [playername, ownerId] = ownerData.split('::');
                              const isCurrentUser = ownerId === currentUserId;
                              return (
                                <div key={idx} className="py-0.5">
                                  {isCurrentUser && <span className="text-yellow-400 mr-1">★</span>}
                                  {playername}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renner</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eigenaar(s)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Land</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Waarde</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Punten</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[...team.riders].sort((a: any, b: any) => {
                          if (b.pointsScored !== a.pointsScored) {
                            return b.pointsScored - a.pointsScored;
                          }
                          return b.baseValue - a.baseValue;
                        }).map((rider: any) => {
                          const ownerCount = rider.owners?.length || 1;
                          const sortedOwners = [...(rider.owners || [])].sort((a: any, b: any) => {
                            if (a.userId === currentUserId) return -1;
                            if (b.userId === currentUserId) return 1;
                            return 0;
                          });
                          const firstOwner = sortedOwners[0] || { playername: 'Unknown', userId: '' };
                          const currentUserIsOwner = sortedOwners.some((o: any) => o.userId === currentUserId);
                          const allOwnersData = sortedOwners.slice(1).map((o: any) => `${o.playername}::${o.userId}`).join('|||') || '';

                          return (
                            <tr key={rider.riderId || rider.riderNameId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                {currentUserIsOwner && <span className="text-yellow-500 mr-1">★</span>}
                                {rider.riderName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  {ownerCount === 1 ? (
                                    <span>{firstOwner.playername}</span>
                                  ) : (
                                    <span
                                      className="cursor-help border-b border-dashed border-gray-400"
                                      data-tooltip-id="owner-tooltip"
                                      data-tooltip-content={allOwnersData}
                                    >
                                      {firstOwner.playername} <span className="text-blue-600 font-medium">+{ownerCount - 1}</span>
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-400">
                                    ({teams.length > 0 ? Math.round((ownerCount / teams.length) * 100) : 0}%)
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600"><Flag countryCode={rider.riderCountry} /></td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.baseValue}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All Riders View */}
      {viewMode === 'all' && (
        <>
          <div className="flex gap-2 items-center mb-4">
            <span className="text-sm text-gray-600">Sorteer op:</span>
            <button
              onClick={() => setAllViewSortBy('points')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                allViewSortBy === 'points' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Punten
            </button>
            <button
              onClick={() => setAllViewSortBy('value')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                allViewSortBy === 'value' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Waarde
            </button>
            <button
              onClick={() => setAllViewSortBy('owners')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                allViewSortBy === 'owners' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Eigenaar(s)
            </button>
            <button
              onClick={() => setAllViewSortBy('team')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                allViewSortBy === 'team' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Team
            </button>
            <button
              onClick={() => setAllViewSortDirection(allViewSortDirection === 'asc' ? 'desc' : 'asc')}
              className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              {allViewSortDirection === 'asc' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Oplopend
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  Aflopend
                </>
              )}
            </button>
            <input
              type="text"
              placeholder="Filter op renner of team..."
              value={allViewSearch}
              onChange={(e) => setAllViewSearch(e.target.value)}
              className="ml-4 px-3 py-1.5 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {allViewSearch && (
              <button
                onClick={() => setAllViewSearch('')}
                className="px-2 py-1.5 text-gray-400 hover:text-gray-600"
                title="Wis zoekterm"
              >
                ✕
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <Tooltip
              id="owner-tooltip-all"
              className="!opacity-100 !z-50 !max-w-xs"
              clickable={true}
              delayHide={300}
              render={({ content }) => {
                const owners = content?.split('|||') || [];
                return (
                  <div className="max-h-48 overflow-y-auto">
                    {owners.map((ownerData, idx) => {
                      const [playername, ownerId] = ownerData.split('::');
                      const isCurrentUser = ownerId === currentUserId;
                      return (
                        <div key={idx} className="py-0.5">
                          {isCurrentUser && <span className="text-yellow-400 mr-1">★</span>}
                          {playername}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eigenaar(s)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Land</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Waarde</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Punten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allRidersList.map((rider: any) => {
                  const ownerCount = rider.owners?.length || 1;
                  const sortedOwners = [...(rider.owners || [])].sort((a: any, b: any) => {
                    if (a.userId === currentUserId) return -1;
                    if (b.userId === currentUserId) return 1;
                    return 0;
                  });
                  const firstOwner = sortedOwners[0] || { playername: 'Unknown', userId: '' };
                  const currentUserIsOwner = sortedOwners.some((o: any) => o.userId === currentUserId);
                  const allOwnersData = sortedOwners.slice(1).map((o: any) => `${o.playername}::${o.userId}`).join('|||') || '';

                  return (
                    <tr key={rider.riderId || rider.riderNameId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {currentUserIsOwner && <span className="text-yellow-500 mr-1">★</span>}
                        {rider.riderName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rider.riderTeam}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          {ownerCount === 1 ? (
                            <span>{firstOwner.playername}</span>
                          ) : (
                            <span
                              className="cursor-help border-b border-dashed border-gray-400"
                              data-tooltip-id="owner-tooltip-all"
                              data-tooltip-content={allOwnersData}
                            >
                              {firstOwner.playername} <span className="text-blue-600 font-medium">+{ownerCount - 1}</span>
                            </span>
                          )}
                          <span className="text-xs text-green-600">
                            ({teams.length > 0 ? Math.round((ownerCount / teams.length) * 100) : 0}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600"><Flag countryCode={rider.riderCountry} /></td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.baseValue}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Compare View */}
      {viewMode === 'compare' && (
        <>
          <div className="flex gap-4 items-center mb-4">
            <span className="text-sm text-gray-600">Vergelijk met:</span>
            <PlayerSelector
              teams={teams}
              selectedUserId={compareUserId}
              onSelect={setCompareUserId}
              excludeUserId={currentUserId}
              placeholder="Selecteer een speler..."
            />
          </div>

          {compareUserId ? (() => {
            const myTeam = teams.find(t => t.userId === currentUserId);
            const theirTeam = teams.find(t => t.userId === compareUserId);

            if (!myTeam || !theirTeam) {
              return (
                <div className="text-center py-12 text-gray-500">
                  Team niet gevonden
                </div>
              );
            }

            const theirRiderIds = new Set(theirTeam.riders.map(r => r.riderNameId || r.riderName));

            const allRidersMap = new Map<string, any>();

            myTeam.riders.forEach(r => {
              const key = r.riderNameId || r.riderName;
              allRidersMap.set(key, { ...r, inMyTeam: true, inTheirTeam: theirRiderIds.has(key) });
            });

            theirTeam.riders.forEach(r => {
              const key = r.riderNameId || r.riderName;
              if (allRidersMap.has(key)) {
                allRidersMap.get(key)!.inTheirTeam = true;
              } else {
                allRidersMap.set(key, { ...r, inMyTeam: false, inTheirTeam: true });
              }
            });

            const compareRiders = Array.from(allRidersMap.values()).sort((a, b) => b.pointsScored - a.pointsScored);

            const myPointsScored = myTeam.riders.reduce((sum, r) => sum + r.pointsScored, 0);
            const theirPointsScored = theirTeam.riders.reduce((sum, r) => sum + r.pointsScored, 0);
            const sharedRiders = compareRiders.filter(r => r.inMyTeam && r.inTheirTeam);
            const onlyMine = compareRiders.filter(r => r.inMyTeam && !r.inTheirTeam);
            const onlyTheirs = compareRiders.filter(r => !r.inMyTeam && r.inTheirTeam);

            const isMarginalGains = game?.gameType === 'marginal-gains';
            const myPricePaid = myTeam.totalSpent ?? 0;
            const theirPricePaid = theirTeam.totalSpent ?? 0;
            const myMarginalGains = myPointsScored - myPricePaid;
            const theirMarginalGains = theirPointsScored - theirPricePaid;

            const myDisplayTotal = isMarginalGains ? myMarginalGains : myPointsScored;
            const theirDisplayTotal = isMarginalGains ? theirMarginalGains : theirPointsScored;
            const myTotalClass = isMarginalGains
              ? myMarginalGains >= 0 ? 'text-green-700' : 'text-red-700'
              : 'text-blue-900';
            const theirTotalClass = isMarginalGains
              ? theirMarginalGains >= 0 ? 'text-green-700' : 'text-red-700'
              : 'text-purple-900';

            return (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-sm text-blue-600">Jij <span className="font-medium">#{myTeam.ranking}</span></div>
                    <div className={`text-2xl font-bold ${myTotalClass}`}>
                      {isMarginalGains && myDisplayTotal > 0 ? '+' : ''}{myDisplayTotal} punten
                    </div>
                    <div className="text-xs text-blue-500">
                      {myTeam.riders.length} renners
                      {isMarginalGains && <span className="ml-2">({myPointsScored} pts - €{myPricePaid})</span>}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
                    <div className="text-sm text-gray-600">Gedeelde renners</div>
                    <div className="text-2xl font-bold text-gray-900">{sharedRiders.length}</div>
                    <div className="text-xs text-gray-500">
                      Alleen jij: {onlyMine.length} | Alleen {theirTeam.playername}: {onlyTheirs.length}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="text-sm text-purple-600">{theirTeam.playername} <span className="font-medium">#{theirTeam.ranking}</span></div>
                    <div className={`text-2xl font-bold ${theirTotalClass}`}>
                      {isMarginalGains && theirDisplayTotal > 0 ? '+' : ''}{theirDisplayTotal} punten
                    </div>
                    <div className="text-xs text-purple-500">
                      {theirTeam.riders.length} renners
                      {isMarginalGains && <span className="ml-2">({theirPointsScored} pts - €{theirPricePaid})</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renner</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-blue-500 uppercase tracking-wider">Jij</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-purple-500 uppercase tracking-wider">{theirTeam.playername}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Waarde</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Verschil</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Punten</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {compareRiders.map((rider: any) => (
                        <tr
                          key={rider.riderId || rider.riderNameId}
                          className={`hover:bg-gray-50 ${
                            rider.inMyTeam && rider.inTheirTeam
                              ? 'bg-gray-50'
                              : rider.inMyTeam
                              ? 'bg-blue-50/30'
                              : 'bg-purple-50/30'
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{rider.riderName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{rider.riderTeam}</td>
                          <td className="px-4 py-3 text-center">
                            {rider.inMyTeam ? (
                              <span className="text-blue-600 text-lg">✓</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {rider.inTheirTeam ? (
                              <span className="text-purple-600 text-lg">✓</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.baseValue}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {(() => {
                              const displayPercentage = isMarginalGains
                                ? (rider.baseValue > 0 ? Math.round(((rider.pointsScored - rider.baseValue) / rider.baseValue) * 100) : 0)
                                : rider.percentageDiff;
                              const colorClass = isMarginalGains
                                ? (displayPercentage > 0 ? 'text-green-600' : displayPercentage < 0 ? 'text-red-600' : 'text-gray-600')
                                : (displayPercentage > 0 ? 'text-red-600' : displayPercentage < 0 ? 'text-green-600' : 'text-gray-600');
                              return (
                                <span className={`font-medium ${colorClass}`}>
                                  {displayPercentage > 0 ? '+' : ''}{displayPercentage}%
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })() : (
            <div className="text-center py-12 text-gray-500">
              Selecteer een speler om mee te vergelijken
            </div>
          )}
        </>
      )}
    </div>
  );
}
