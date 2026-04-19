'use client';

import { useState, useMemo, useEffect } from 'react';
import { Flag } from '@/components/Flag';
import { Tooltip } from 'react-tooltip';
import { useTranslation } from 'react-i18next';
import { Game, PointsEvent } from '@/lib/types/games';
import { Selector } from '@/components/Selector';
import { getRaceNamesClient } from '@/lib/race-names';

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
  pointsBreakdown?: PointsEvent[];
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
  const isAuctionMaster = game?.gameType === 'auctioneer';
  const isFullGrid = game?.gameType === 'full-grid';
  const isWorldTourManager = game?.gameType === 'worldtour-manager';
  const isMarginalGainsGame = game?.gameType === 'marginal-gains';
  const isSingleOwnerGame = isFullGrid || isAuctionMaster;

  const [raceNames, setRaceNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!game) return;
    getRaceNamesClient(game.year || new Date().getFullYear()).then(setRaceNames).catch(() => {});
  }, [game]);

  const getStageLabel = (raceSlug: string, stage: string, includeRace = true) => {
    const stageLabel = stage === 'result' ? 'Einduitslag' : `Etappe ${stage}`;
    if (!includeRace) return stageLabel;
    const raceName = raceNames.get(raceSlug) || raceSlug.replace(/_\d{4}$/, '').replace(/-/g, ' ');
    return `${raceName} - ${stageLabel}`;
  };

  const getRiderRoi = (rider: Rider) => {
    if (isFullGrid) {
      const pricePaid = rider.pricePaid || 0;
      if (pricePaid <= 0) return null;
      return rider.pointsScored / pricePaid;
    }
    const roiBasis = isAuctionMaster ? (rider.pricePaid || 0) : (rider.baseValue || 0);
    if (roiBasis <= 0) {
      return null;
    }
    return ((rider.pointsScored - roiBasis) / roiBasis) * 100;
  };

  const formatRoi = (roi: number | null) => {
    if (roi === null) return null;
    if (isFullGrid) return `${Math.round(roi)}x`;
    return `${roi > 0 ? '+' : ''}${Math.round(roi)}%`;
  };
  
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'ranking' | 'points' | 'value' | 'percentage'>('ranking');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'players' | 'all' | 'compare' | 'stageWins' | 'daguitslag'>('players');
  const [selectedDagStage, setSelectedDagStage] = useState<string | null>(null);
  const [groupByCyclingTeam, setGroupByCyclingTeam] = useState(false);
  const [allViewSortBy, setAllViewSortBy] = useState<'points' | 'value' | 'roi' | 'owners' | 'team'>('points');
  const [allViewSortDirection, setAllViewSortDirection] = useState<'asc' | 'desc'>('desc');
  const [compareUserId, setCompareUserId] = useState<string | null>(null);
  const [compareUserIdLeft, setCompareUserIdLeft] = useState<string | null>(null);
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
  const teamsForStats = isWorldTourManager ? (teams || []).filter(t => t.riders && t.riders.length > 0) : (teams || []);
  teamsForStats.forEach(team => {
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
          comparison = (isFullGrid || isAuctionMaster) ? a.pricePaid - b.pricePaid : a.baseValue - b.baseValue;
          break;
        case 'roi': {
          const aRoi = getRiderRoi(a) ?? -Infinity;
          const bRoi = getRiderRoi(b) ?? -Infinity;
          comparison = aRoi - bRoi;
          break;
        }
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

  // Stage wins ranking: riders with stagePosition === 1 in pointsBreakdown
  const stageWinsData = useMemo(() => {
    return cyclingTeams
      .flatMap(team => team.riders)
      .map((rider: any) => {
        const wins = (rider.pointsBreakdown as PointsEvent[] | undefined)?.filter(e => e.stagePosition === 1) || [];
        return { ...rider, stageWins: wins };
      })
      .filter((rider: any) => rider.stageWins.length > 0)
      .sort((a: any, b: any) => b.stageWins.length - a.stageWins.length || b.pointsScored - a.pointsScored);
  }, [cyclingTeams]);

  // Available stages for daguitslag selector
  const availableDagStages = useMemo(() => {
    const stages = new Map<string, { raceSlug: string; stage: string }>();
    cyclingTeams.flatMap(team => team.riders).forEach((rider: any) => {
      (rider.pointsBreakdown as PointsEvent[] | undefined)?.forEach(e => {
        const key = `${e.raceSlug}::${e.stage}`;
        if (!stages.has(key)) stages.set(key, { raceSlug: e.raceSlug, stage: e.stage });
      });
    });
    return Array.from(stages.values()).sort((a, b) => {
      if (a.raceSlug !== b.raceSlug) return a.raceSlug.localeCompare(b.raceSlug);
      return (parseInt(b.stage) || 0) - (parseInt(a.stage) || 0);
    });
  }, [cyclingTeams]);

  const effectiveDagStage = selectedDagStage || (availableDagStages[0] ? `${availableDagStages[0].raceSlug}::${availableDagStages[0].stage}` : null);

  const dagUitslagData = useMemo(() => {
    if (!effectiveDagStage) return [];
    const [raceSlug, stage] = effectiveDagStage.split('::');
    return cyclingTeams
      .flatMap(team => team.riders)
      .map((rider: any) => {
        const event = (rider.pointsBreakdown as PointsEvent[] | undefined)?.find(
          e => e.raceSlug === raceSlug && e.stage === stage
        );
        return event ? { ...rider, stageEvent: event as PointsEvent } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const aPos = a.stageEvent.stagePosition ?? 9999;
        const bPos = b.stageEvent.stagePosition ?? 9999;
        if (aPos !== bPos) return aPos - bPos;
        return b.stageEvent.total - a.stageEvent.total;
      });
  }, [effectiveDagStage, cyclingTeams]);

  // For WorldTour Manager, hide participants with no riders (incomplete/empty teams)
  const filteredTeams = isWorldTourManager
    ? (teams || []).filter(t => t.riders && t.riders.length > 0)
    : (teams || []);

  const sortedTeams = [...filteredTeams].sort((a, b) => {
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
      <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Weergave
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setViewMode('players');
              setGroupByCyclingTeam(false);
            }}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'players'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-blue-200'
            }`}
          >
            Deelnemers
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-blue-200'
            }`}
          >
            Renners
          </button>
          <button
            onClick={() => setViewMode('compare')}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'compare'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-blue-200'
            }`}
          >
            Head-to-head
          </button>
          {isSingleOwnerGame && (
          <button
            onClick={() => setViewMode('stageWins')}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'stageWins'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-blue-200'
            }`}
          >
            Etappezeges
          </button>
          )}
          {isSingleOwnerGame && (
          <button
            onClick={() => setViewMode('daguitslag')}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'daguitslag'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-blue-200'
            }`}
          >
            Daguitslag
          </button>
          )}
        </div>
      </div>

      {/* Sort Controls - only show for players view */}
      {viewMode === 'players' && (
        <div className="mb-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Sorteer deelnemers
          </div>
          <div className="overflow-x-auto">
            <div className="flex w-max min-w-full gap-2 items-center pb-1">
            <button
              onClick={() => setSortBy('ranking')}
              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                sortBy === 'ranking'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Ranking
            </button>
            {!isWorldTourManager && !isMarginalGainsGame && !isAuctionMaster && (
            <button
              onClick={() => setSortBy('points')}
              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                sortBy === 'points'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Punten
            </button>
            )}
            {!isFullGrid && !isWorldTourManager && !isMarginalGainsGame && (
            <button
              onClick={() => setSortBy('value')}
              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                sortBy === 'value'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Totale Waarde
            </button>
            )}
            {!isFullGrid && !isWorldTourManager && !isAuctionMaster && (
            <button
              onClick={() => setSortBy('percentage')}
              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                sortBy === 'percentage'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Verschil %
            </button>
            )}

            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="ml-2 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-2"
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
          </div>

          {!isWorldTourManager && !isSingleOwnerGame && (
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
          )}
        </div>
      )}


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
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                          {!isFullGrid && !isWorldTourManager && !isAuctionMaster && !isMarginalGainsGame && (
                            <span>{team.totalRiders} renners</span>
                          )}
                          {!isFullGrid && !isWorldTourManager && !isAuctionMaster && !isMarginalGainsGame && (
                            <span>Waarde: {team.totalBaseValue.toLocaleString()}</span>
                          )}
                          {!isFullGrid && !isWorldTourManager && !isAuctionMaster && (
                            <span>Betaald: €{team.totalSpent.toLocaleString()}</span>
                          )}
                          {isAuctionMaster && (
                            <span>Betaald: €{team.totalSpent.toLocaleString()}</span>
                          )}
                          {!isFullGrid && !isWorldTourManager && !isAuctionMaster && (
                          <span className={`font-medium ${isMarginalGainsGame ? marginalGainsPercentageClass : team.totalPercentageDiff > 0
                              ? 'text-red-600'
                              : team.totalPercentageDiff < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}>
                            Verschil:
                            {isMarginalGainsGame ? `${Math.round(marginalGainsPercentage || 0)}%` : `${team.totalPercentageDiff > 0 ? '+' : ''}${team.totalPercentageDiff}%`}
                          </span>
                          )}
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
                            {!isFullGrid && !isWorldTourManager && !isAuctionMaster && !isMarginalGainsGame && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Waarde</th>}
                            {!isFullGrid && !isWorldTourManager && !isAuctionMaster && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prijs</th>}
                            {(isFullGrid || isAuctionMaster) && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Betaald</th>}
                            {(isFullGrid || isAuctionMaster) && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rendement</th>}
                            {!isFullGrid && !isWorldTourManager && !isAuctionMaster && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Verschil</th>}
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Punten</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {team.riders.map((rider) => (
                            <tr key={rider.riderId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{rider.riderName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{rider.riderTeam}</td>
                              <td className="px-4 py-3 text-sm text-gray-600"><Flag countryCode={rider.riderCountry} /></td>
                              {!isFullGrid && !isWorldTourManager && !isAuctionMaster && !isMarginalGainsGame && <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.baseValue}</td>}
                              {!isFullGrid && !isWorldTourManager && !isAuctionMaster && <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{rider.pricePaid}</td>}
                              {(isFullGrid || isAuctionMaster) && <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{rider.pricePaid}</td>}
                              {(isFullGrid || isAuctionMaster) && (
                                <td className="px-4 py-3 text-sm text-right">
                                  {(() => {
                                    const roi = getRiderRoi(rider);
                                    if (roi === null) return <span className="text-gray-400">-</span>;
                                    if (isFullGrid) {
                                      const roiClass = roi > 1 ? 'text-green-600' : roi < 1 ? 'text-red-600' : 'text-gray-600';
                                      return <span className={`font-medium ${roiClass}`}>{Math.round(roi)}x</span>;
                                    }
                                    const roiClass = roi > 0 ? 'text-green-600' : roi < 0 ? 'text-red-600' : 'text-gray-600';
                                    return <span className={`font-medium ${roiClass}`}>{roi > 0 ? '+' : ''}{Math.round(roi)}%</span>;
                                  })()}
                                </td>
                              )}
                              {!isFullGrid && !isWorldTourManager && !isAuctionMaster && (
                              <td className="px-4 py-3 text-sm text-right">
                                {(() => {
                                  const displayPercentage = isMarginalGainsGame
                                    ? (rider.baseValue > 0 ? Math.round(((rider.pointsScored - rider.baseValue) / rider.baseValue) * 100) : 0)
                                    : rider.percentageDiff;
                                  const colorClass = isMarginalGainsGame
                                    ? (displayPercentage > 0 ? 'text-green-600' : displayPercentage < 0 ? 'text-red-600' : 'text-gray-600')
                                    : (displayPercentage > 0 ? 'text-red-600' : displayPercentage < 0 ? 'text-green-600' : 'text-gray-600');
                                  return (
                                    <span className={`font-medium ${colorClass}`}>
                                      {displayPercentage > 0 ? '+' : ''}{displayPercentage}%
                                    </span>
                                  );
                                })()}
                              </td>
                              )}
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
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
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

      {/* All Riders View */}
      {viewMode === 'all' && (
        <>
          <div className="overflow-x-auto mb-4">
            <div className="flex w-max min-w-full gap-2 items-center pb-1">
            <span className="text-sm text-gray-600">Sorteer op:</span>
            <button
              onClick={() => setAllViewSortBy('points')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                allViewSortBy === 'points' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Punten
            </button>
            {!isWorldTourManager && (
            <button
              onClick={() => setAllViewSortBy('value')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                allViewSortBy === 'value' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {(isFullGrid || isAuctionMaster) ? 'Betaald' : 'Waarde'}
            </button>
            )}
            {!isWorldTourManager && (
            <button
              onClick={() => setAllViewSortBy('roi')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                allViewSortBy === 'roi' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              ROI
            </button>
            )}
            {!isSingleOwnerGame && (
            <button
              onClick={() => setAllViewSortBy('owners')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                allViewSortBy === 'owners' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Keren gekozen
            </button>
            )}
            <button
              onClick={() => setAllViewSortBy('team')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                allViewSortBy === 'team' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Team
            </button>
            <button
              onClick={() => setAllViewSortDirection(allViewSortDirection === 'asc' ? 'desc' : 'asc')}
              className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-1"
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
                  {!isSingleOwnerGame && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aantal keer gekozen</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Land</th>
                  {!isWorldTourManager && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{(isFullGrid || isAuctionMaster) ? 'Betaald' : 'Waarde'}</th>}
                  {!isWorldTourManager && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROI</th>}
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
                  const allOwnersData = sortedOwners.map((o: any) => `${o.playername}::${o.userId}`).join('|||') || '';

                  return (
                    <tr key={rider.riderId || rider.riderNameId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {currentUserIsOwner && <span className="text-yellow-500 mr-1">★</span>}
                        {rider.riderName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rider.riderTeam}</td>
                      {!isSingleOwnerGame && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span
                            className="cursor-help border-b border-dashed border-gray-400"
                            data-tooltip-id="owner-tooltip-all"
                            data-tooltip-content={allOwnersData}
                          >
                            {ownerCount}x
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-600"><Flag countryCode={rider.riderCountry} /></td>
                      {!isWorldTourManager && <td className="px-4 py-3 text-sm text-gray-600 text-right">{(isFullGrid || isAuctionMaster) ? rider.pricePaid : rider.baseValue}</td>}
                      {!isWorldTourManager && (
                        <td className="px-4 py-3 text-sm text-right">
                          {(() => {
                            const roi = getRiderRoi(rider);
                            if (roi === null) {
                              return <span className="text-gray-400">-</span>;
                            }
                            const roiFormatted = formatRoi(roi);
                            const roiClass = isFullGrid
                              ? (roi > 1 ? 'text-green-600' : roi < 1 ? 'text-red-600' : 'text-gray-600')
                              : (roi > 0 ? 'text-green-600' : roi < 0 ? 'text-red-600' : 'text-gray-600');
                            return <span className={`font-medium ${roiClass}`}>{roiFormatted}</span>;
                          })()}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Daguitslag View */}
      {viewMode === 'daguitslag' && (
        <div>
          {availableDagStages.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Nog geen etapperesultaten beschikbaar
            </div>
          ) : (
            <>
              {/* Stage selector */}
              <div className="overflow-x-auto mb-4">
                <div className="flex w-max min-w-full gap-2 pb-1">
                  {availableDagStages.map(s => {
                    const key = `${s.raceSlug}::${s.stage}`;
                    const isActive = effectiveDagStage === key;
                    const label = getStageLabel(s.raceSlug, s.stage);
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDagStage(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                          isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {effectiveDagStage && (
                <div className="mb-2 text-sm font-medium text-gray-700">
                  {getStageLabel(effectiveDagStage.split('::')[0], effectiveDagStage.split('::')[1])}
                </div>
              )}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {dagUitslagData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">Geen resultaten voor deze etappe</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renner</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Team</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Etappe</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">KM/Sprint</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Ploeg</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Totaal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(dagUitslagData as any[]).map((rider, index) => {
                        const e: PointsEvent = rider.stageEvent;
                        const isCurrentUserRider = rider.owners?.some((o: any) => o.userId === currentUserId);
                        const pos = e.stagePosition;
                        return (
                          <tr key={rider.riderId || rider.riderNameId || index} className={`hover:bg-gray-50 ${isCurrentUserRider ? 'bg-yellow-50/40' : ''}`}>
                            <td className="px-4 py-3 text-sm text-gray-500 font-medium">
                              {pos ? `#${pos}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {isCurrentUserRider && <span className="text-yellow-500 mr-1">★</span>}
                              {rider.riderName}
                              <span className="ml-2"><Flag countryCode={rider.riderCountry} /></span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{rider.riderTeam}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              {(e.stageResult ?? 0) > 0
                                ? <span className="font-medium text-blue-700">+{e.stageResult}</span>
                                : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-right hidden md:table-cell">
                              {((e.mountainsClass ?? 0) + (e.pointsClass ?? 0) + (e.mountainPoints ?? 0) + (e.sprintPoints ?? 0)) > 0
                                ? <span className="text-green-700">+{(e.mountainsClass ?? 0) + (e.pointsClass ?? 0) + (e.mountainPoints ?? 0) + (e.sprintPoints ?? 0)}</span>
                                : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-right hidden md:table-cell">
                              {(e.teamPoints ?? 0) > 0
                                ? <span className="text-purple-700">+{e.teamPoints}</span>
                                : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-primary">{e.total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stage Wins View */}
      {viewMode === 'stageWins' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {stageWinsData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nog geen etappezeges geregistreerd
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Zeges</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etappes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stageWinsData.map((rider: any, index: number) => {
                  const isCurrentUserRider = rider.owners?.some((o: any) => o.userId === currentUserId);
                  const stageLabels = rider.stageWins.map((e: PointsEvent) => getStageLabel(e.raceSlug, e.stage));
                  return (
                    <tr key={rider.riderId || rider.riderNameId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500 font-medium">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {isCurrentUserRider && <span className="text-yellow-500 mr-1">★</span>}
                        {rider.riderName}
                        <span className="ml-2"><Flag countryCode={rider.riderCountry} /></span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rider.riderTeam}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm">
                          {rider.stageWins.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {stageLabels.join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Compare View */}
      {viewMode === 'compare' && (
        <>
          <div className="flex flex-wrap gap-4 items-center mb-4">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-blue-600">Links:</span>
              <PlayerSelector
                teams={teams}
                selectedUserId={compareUserIdLeft}
                onSelect={setCompareUserIdLeft}
                excludeUserId={compareUserId || undefined}
                placeholder="Jij (standaard)..."
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-purple-600">Rechts:</span>
              <PlayerSelector
                teams={teams}
                selectedUserId={compareUserId}
                onSelect={setCompareUserId}
                excludeUserId={compareUserIdLeft || currentUserId}
                placeholder="Selecteer een speler..."
              />
            </div>
          </div>

          {compareUserId ? (() => {
            const leftUserId = compareUserIdLeft || currentUserId;
            const myTeam = teams.find(t => t.userId === leftUserId);
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
                <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-sm text-blue-600">{myTeam.playername} <span className="font-medium">#{myTeam.ranking}</span></div>
                    <div className={`text-2xl font-bold ${myTotalClass}`}>
                      {isMarginalGains && myDisplayTotal > 0 ? '+' : ''}{myDisplayTotal} punten
                    </div>
                    <div className="text-xs text-blue-500">
                      {myTeam.riders.length} renners
                      {isMarginalGains && <span className="ml-2">({myPointsScored} pts - €{myPricePaid})</span>}
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
                        <th className="px-4 py-3 text-right text-xs font-medium text-blue-500 uppercase tracking-wider">{myTeam.playername}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-500 uppercase tracking-wider">{theirTeam.playername}</th>
                        {!isWorldTourManager && !isFullGrid && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{isAuctionMaster ? 'Betaald' : 'Waarde'}</th>}
                        {!isWorldTourManager && !isFullGrid && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{isAuctionMaster ? 'Rendement' : 'Verschil'}</th>}
                        {!isFullGrid && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Punten</th>}
                        {isFullGrid && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Voordeel</th>}
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
                          <td className="px-4 py-3 text-right">
                            {rider.inMyTeam ? (
                              isFullGrid
                                ? <span className="text-blue-700 font-medium text-sm">{rider.pointsScored}</span>
                                : <span className="text-blue-600 text-lg">✓</span>
                            ) : (
                              <span className="text-gray-300 text-sm">{isFullGrid ? '-' : '-'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {rider.inTheirTeam ? (
                              isFullGrid
                                ? <span className="text-purple-700 font-medium text-sm">{rider.pointsScored}</span>
                                : <span className="text-purple-600 text-lg">✓</span>
                            ) : (
                              <span className="text-gray-300 text-sm">{isFullGrid ? '-' : '-'}</span>
                            )}
                          </td>
                          {!isWorldTourManager && !isFullGrid && <td className="px-4 py-3 text-sm text-gray-600 text-right">{isAuctionMaster ? rider.pricePaid : rider.baseValue}</td>}
                          {!isWorldTourManager && !isFullGrid && <td className="px-4 py-3 text-sm text-right">
                            {(() => {
                              if (isAuctionMaster) {
                                const roi = getRiderRoi(rider);
                                if (roi === null) return <span className="text-gray-400">-</span>;
                                const roiClass = roi > 0 ? 'text-green-600' : roi < 0 ? 'text-red-600' : 'text-gray-600';
                                return <span className={`font-medium ${roiClass}`}>{roi > 0 ? '+' : ''}{Math.round(roi)}%</span>;
                              }
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
                          </td>}
                          {!isFullGrid && <td className="px-4 py-3 text-sm text-gray-600 text-right">{rider.pointsScored}</td>}
                          {isFullGrid && (() => {
                            const myPts = rider.inMyTeam ? rider.pointsScored : 0;
                            const theirPts = rider.inTheirTeam ? rider.pointsScored : 0;
                            const diff = myPts - theirPts;
                            if (diff === 0) return <td className="px-4 py-3 text-sm text-gray-400 text-right">-</td>;
                            const cls = diff > 0 ? 'text-blue-600' : 'text-purple-600';
                            return <td className={`px-4 py-3 text-sm font-medium text-right ${cls}`}>{diff > 0 ? '+' : ''}{diff}</td>;
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })() : (
            <div className="text-center py-12 text-gray-500">
              Selecteer een speler rechts om te vergelijken
            </div>
          )}
        </>
      )}
    </div>
  );
}
