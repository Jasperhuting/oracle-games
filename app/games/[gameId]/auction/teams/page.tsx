'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Flag } from '@/components/Flag';
import { AuctionTeamsRider as Rider, AuctionTeam as Team } from '@/lib/types/pages';

export default function TeamsOverviewPage() {
  const params = useParams();
  const { user } = useAuth();
  const gameId = params?.gameId as string;

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'ranking' | 'points' | 'value' | 'percentage'>('ranking');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'players' | 'cycling-teams'>('players');
  const [groupByCyclingTeam, setGroupByCyclingTeam] = useState(false);

  useEffect(() => {
    async function checkAdminAndLoadTeams() {
      if (!user) return;

      try {

        // Load teams
        const teamsResponse = await fetch(`/api/games/${gameId}/teams-overview`);
        if (!teamsResponse.ok) {
          throw new Error('Failed to load teams');
        }

        const data = await teamsResponse.json();
        setTeams(data.teams || []);
      } catch (err) {
        console.error('Error loading teams:', err);
        setError('Er is een fout opgetreden bij het laden van de teams');
      } finally {
        setLoading(false);
      }
    }

    checkAdminAndLoadTeams();
  }, [user, gameId]);

  const toggleTeam = (participantId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(participantId)) {
      newExpanded.delete(participantId);
    } else {
      newExpanded.add(participantId);
    }
    setExpandedTeams(newExpanded);
  };

  // Group riders by cycling team with null checks
  const cyclingTeamsMap = new Map<string, any[]>();
  teams?.forEach(team => {
    if (!team) return; // Skip if team is undefined
    team.riders?.forEach(rider => {
      if (!rider) return; // Skip if rider is undefined
      const cyclingTeam = rider.riderTeam || 'Onbekend';
      if (!cyclingTeamsMap.has(cyclingTeam)) {
        cyclingTeamsMap.set(cyclingTeam, []);
      }
      cyclingTeamsMap.get(cyclingTeam)?.push({
        ...rider,
        playername: team.playername || 'Unknown',
        userId: team.userId || '',
      });
    });
  });

  const cyclingTeams = Array.from(cyclingTeamsMap.entries())
    .map(([teamName, riders]) => {
      const totalBaseValue = riders.reduce((sum, r) => sum + r.baseValue, 0);
      const totalPricePaid = riders.reduce((sum, r) => sum + r.pricePaid, 0);
      const totalPercentageDiff = totalBaseValue > 0
        ? Math.round(((totalPricePaid - totalBaseValue) / totalBaseValue) * 100)
        : 0;

      return {
        teamName,
        riders,
        totalRiders: riders.length,
        totalBaseValue,
        totalPricePaid,
        totalPercentageDiff,
      };
    })
    .sort((a, b) => b.totalRiders - a.totalRiders);

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
        comparison = a.totalPercentageDiff - b.totalPercentageDiff;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (loading) {
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
            href={`/games/${gameId}/auction`}
            className="text-blue-600 hover:text-blue-700"
          >
            Terug naar auction
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Teams
              </h1>
              <p className="text-gray-600">
                Alle gekozen teams in één overzicht
              </p>
            </div>
            <Link
              href={`/games/${gameId}/auction`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Terug naar Auction
            </Link>
          </div>

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
          </div>

          {/* Sort Controls - only show for players view */}
          {viewMode === 'players' && (
            <div className="space-y-4">
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

                {/* Sort Direction Toggle */}
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="ml-2 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  title={sortDirection === 'asc' ? 'Oplopend' : 'Aflopend'}
                >
                  {sortDirection === 'asc' ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      </svg>
                      Oplopend
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                      </svg>
                      Aflopend
                    </>
                  )}
                </button>
              </div>

              {/* Group by Cycling Team Toggle */}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Totaal Teams</div>
              <div className="text-2xl font-bold text-gray-900">
                {teams?.length || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Totaal Renners</div>
              <div className="text-2xl font-bold text-gray-900">
                {teams?.reduce((sum, t) => sum + (t?.totalRiders || 0), 0) || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Totaal Uitgegeven</div>
              <div className="text-2xl font-bold text-gray-900">
                €{(teams?.reduce((sum, t) => sum + (t?.totalSpent || 0), 0) || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Complete Teams</div>
              <div className="text-2xl font-bold text-gray-900">
                {teams?.filter(t => t?.rosterComplete).length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Teams List - Per Speler */}
        {viewMode === 'players' && (
          <div className="space-y-4">
            {sortedTeams.map((team) => {
            const isExpanded = expandedTeams.has(team.participantId);

            return (
              <div
                key={team.participantId}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Team Header */}
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
                          <span>Betaald: {team.totalSpent.toLocaleString()}</span>
                          <span className={`font-medium ${
                            team.totalPercentageDiff > 0
                              ? 'text-red-600'
                              : team.totalPercentageDiff < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}>
                            Verschil: {team.totalPercentageDiff > 0 ? '+' : ''}{team.totalPercentageDiff}%
                          </span>
                          <span>€{team.remainingBudget.toLocaleString()} over</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {team.rosterComplete && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          Compleet
                        </span>
                      )}
                      <div className="text-gray-500">
                        <svg
                          className={`w-6 h-6 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
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

                {/* Team Riders (Expanded) */}
                {isExpanded && team.riders.length > 0 && (
                  <div className="border-t border-gray-200">
                    {!groupByCyclingTeam ? (
                      // Normal flat list view
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Renner
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Team
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Land
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Waarde
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Prijs
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Verschil
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Punten
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {team.riders.map((rider) => (
                            <tr
                              key={rider.riderId}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                {rider.riderName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {rider.riderTeam}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <Flag countryCode={rider.riderCountry} />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {rider.baseValue}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                {rider.pricePaid}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                <span className={`font-medium ${
                                  rider.percentageDiff > 0
                                    ? 'text-red-600'
                                    : rider.percentageDiff < 0
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                                }`}>
                                  {rider.percentageDiff > 0 ? '+' : ''}{rider.percentageDiff}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {rider.pointsScored}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      // Grouped by cycling team view
                      <div className="divide-y divide-gray-200">
                        {(() => {
                          // Group riders by cycling team
                          const cyclingTeamGroups = new Map<string, Rider[]>();
                          team.riders.forEach(rider => {
                            const cyclingTeam = rider.riderTeam || 'Onbekend';
                            if (!cyclingTeamGroups.has(cyclingTeam)) {
                              cyclingTeamGroups.set(cyclingTeam, []);
                            }
                            cyclingTeamGroups.get(cyclingTeam)!.push(rider);
                          });

                          // Sort cycling teams by number of riders (descending)
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
                                {/* Cycling Team Header */}
                                <div className="px-4 py-3 bg-gray-100">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold text-gray-900">
                                      {cyclingTeam}
                                    </div>
                                    <div className="flex gap-4 text-sm text-gray-600">
                                      <span>{riders.length} renners</span>
                                      <span>Waarde: {teamTotalBaseValue.toLocaleString()}</span>
                                      <span>Betaald: {teamTotalPricePaid.toLocaleString()}</span>
                                      <span className={`font-medium ${
                                        teamPercentageDiff > 0
                                          ? 'text-red-600'
                                          : teamPercentageDiff < 0
                                          ? 'text-green-600'
                                          : 'text-gray-600'
                                      }`}>
                                        {teamPercentageDiff > 0 ? '+' : ''}{teamPercentageDiff}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {/* Cycling Team Riders */}
                                <table className="w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Renner
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Land
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Waarde
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Prijs
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Verschil
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Punten
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {riders.map((rider) => (
                                      <tr
                                        key={rider.riderId}
                                        className="hover:bg-gray-50"
                                      >
                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                          {rider.riderName}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                          {rider.riderCountry}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                          {rider.baseValue}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                          {rider.pricePaid}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right">
                                          <span className={`font-medium ${
                                            rider.percentageDiff > 0
                                              ? 'text-red-600'
                                              : rider.percentageDiff < 0
                                              ? 'text-green-600'
                                              : 'text-gray-600'
                                          }`}>
                                            {rider.percentageDiff > 0 ? '+' : ''}{rider.percentageDiff}%
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                          {rider.pointsScored}
                                        </td>
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
                  {/* Team Header */}
                  <div
                    onClick={() => toggleTeam(team.teamName)}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {team.teamName}
                        </h3>
                        <div className="flex gap-4 text-sm text-gray-600 mt-1">
                          <span>{team.totalRiders} renners</span>
                          <span>Waarde: {team.totalBaseValue.toLocaleString()}</span>
                          <span>Betaald: {team.totalPricePaid.toLocaleString()}</span>
                          <span className={`font-medium ${
                            team.totalPercentageDiff > 0
                              ? 'text-red-600'
                              : team.totalPercentageDiff < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}>
                            Verschil: {team.totalPercentageDiff > 0 ? '+' : ''}{team.totalPercentageDiff}%
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-500">
                        <svg
                          className={`w-6 h-6 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
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

                  {/* Riders (Expanded) */}
                  {isExpanded && team.riders.length > 0 && (
                    <div className="border-t border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Renner
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Eigenaar
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Land
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Waarde
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Prijs
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Verschil
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Punten
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {team.riders.map((rider: any) => (
                            <tr
                              key={rider.riderId}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                {rider.riderName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {rider.playername}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {rider.riderCountry}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {rider.baseValue}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                {rider.pricePaid}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                <span className={`font-medium ${
                                  rider.percentageDiff > 0
                                    ? 'text-red-600'
                                    : rider.percentageDiff < 0
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                                }`}>
                                  {rider.percentageDiff > 0 ? '+' : ''}{rider.percentageDiff}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {rider.pointsScored}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {teams.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nog geen teams gevonden
          </div>
        )}
      </div>
    </div>
  );
}
