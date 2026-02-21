'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Flag } from '@/components/Flag';
import RacePointsBreakdown from '@/components/RacePointsBreakdown';
import { formatCurrencyWhole } from '@/lib/utils/formatCurrency';
import { Game, GameParticipant } from '@/lib/types/games';
import { getRaceNamesClient } from '@/lib/race-names';

type SortOption = 'points' | 'value' | 'roi' | 'pricePaid' | 'name';

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
  baseValue?: number;
  acquisitionType?: string;
  acquiredAt?: string;
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
  displayRanking?: number;
  riderSelectionStats?: Record<string, { selectedBy: number; totalTeams: number; percentage: number }>;
  loading: boolean;
  error: string | null;
}

export function MyTeamTab({
  game,
  participant,
  riders,
  displayRanking,
  riderSelectionStats,
  loading,
  error,
}: MyTeamTabProps) {
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('points');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [raceNames, setRaceNames] = useState<Map<string, string>>(new Map());

  const toggleRider = (riderId: string) => {
    const newExpanded = new Set(expandedRiders);
    if (newExpanded.has(riderId)) {
      newExpanded.delete(riderId);
    } else {
      newExpanded.add(riderId);
    }
    setExpandedRiders(newExpanded);
  };

  const isMarginalGains = game?.gameType === 'marginal-gains';
  const isAuctioneer = game?.gameType === 'auctioneer';
  const isSelectionGame = game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains';
  const hasAnyRacePoints = useMemo(
    () => riders.some((rider) => rider.racePoints && Object.keys(rider.racePoints).length > 0),
    [riders]
  );

  // Load race names
  useEffect(() => {
    const loadRaceNames = async () => {
      try {
        const year = game?.year || new Date().getFullYear();
        const names = await getRaceNamesClient(year);
        setRaceNames(names);
      } catch (error) {
        console.error('Error loading race names:', error);
      }
    };
    
    if (game) {
      loadRaceNames();
    }
  }, [game]);

  // Calculate team stats
  const teamStats = useMemo(() => {
    const totalPoints = riders.reduce((sum, rider) => sum + (rider.points || 0), 0);
    const totalPricePaid = riders.reduce((sum, rider) => sum + (rider.pricePaid || 0), 0);
    const totalBaseValue = riders.reduce((sum, rider) => sum + (rider.baseValue || 0), 0);
    const marginalGains = totalPoints - totalPricePaid;
    const avgRoi = totalBaseValue > 0 ? ((totalPoints - totalBaseValue) / totalBaseValue) * 100 : 0;
    const avgPriceRoi = totalPricePaid > 0 ? ((totalPoints - totalPricePaid) / totalPricePaid) * 100 : 0;
    
    return {
      totalPoints,
      totalPricePaid,
      totalBaseValue,
      marginalGains,
      avgRoi,
      avgPriceRoi,
    };
  }, [riders]);

  // Calculate ROI for a rider
  const getRiderRoi = (rider: TeamRider) => {
    const baseValue = rider.baseValue || 0;
    if (baseValue === 0) return 0;
    return ((rider.points - baseValue) / baseValue) * 100;
  };

  // Sort riders
  const sortedRiders = useMemo(() => {
    return [...riders].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'points':
          comparison = (a.points || 0) - (b.points || 0);
          break;
        case 'value':
          comparison = (a.baseValue || 0) - (b.baseValue || 0);
          break;
        case 'roi':
          comparison = getRiderRoi(a) - getRiderRoi(b);
          break;
        case 'pricePaid':
          comparison = (a.pricePaid || 0) - (b.pricePaid || 0);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [riders, sortBy, sortDirection]);

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
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
      <div className={`grid grid-cols-1 gap-4 mb-6 ${isMarginalGains ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Totaal Punten</div>
          <div className="text-2xl font-bold text-primary">
            {teamStats.totalPoints}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Ranking</div>
          <div className="text-2xl font-bold text-gray-900">
            #{displayRanking || participant?.ranking || '-'}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Aantal Renners</div>
          <div className="text-2xl font-bold text-gray-900">
            {riders.length}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Totaal Betaald</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrencyWhole(teamStats.totalPricePaid)}
          </div>
        </div>
        {isMarginalGains && (
          <div className={`p-4 rounded-lg border ${teamStats.marginalGains >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`text-sm ${teamStats.marginalGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>Marginal Gains</div>
            <div className={`text-2xl font-bold ${teamStats.marginalGains >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {teamStats.marginalGains >= 0 ? '+' : ''}{teamStats.marginalGains}
            </div>
            <div className={`text-xs ${teamStats.marginalGains >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ROI: {teamStats.avgPriceRoi >= 0 ? '+' : ''}{Math.round(teamStats.avgPriceRoi)}%
            </div>
          </div>
        )}
      </div>

      {/* Sort Controls */}
      {riders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-500 self-center mr-2">Sorteer op:</span>
          {[
            { key: 'points' as SortOption, label: 'Punten' },
            { key: 'value' as SortOption, label: 'Waarde' },
            { key: 'roi' as SortOption, label: 'ROI' },
            { key: 'pricePaid' as SortOption, label: 'Betaald' },
            { key: 'name' as SortOption, label: 'Naam' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === key
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
              {sortBy === key && (
                <span className="ml-1">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Riders List */}
      <div className="space-y-3">
        {riders.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            Je hebt nog geen renners in je team
          </div>
        ) : (
          sortedRiders.map((rider) => {
            const isExpanded = expandedRiders.has(rider.id);
            const hasRacePoints = rider.racePoints && Object.keys(rider.racePoints).length > 0;
            const riderRoi = getRiderRoi(rider);
            const roiColorClass = riderRoi > 0 ? 'text-green-600' : riderRoi < 0 ? 'text-red-600' : 'text-gray-600';
            const riderPopularity = riderSelectionStats?.[rider.nameId] || riderSelectionStats?.[rider.id];

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
                      
                        <Image
                          src={`${rider.jerseyImage ? `https://www.procyclingstats.com/${rider.jerseyImage}` : '/jersey-transparent.png'}`}
                          alt={rider.team}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-contain"
                          unoptimized
                        />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {rider.name}
                          <Flag countryCode={rider.country} />
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                          <span>{rider.team}</span>
                          {rider.rank > 0 && <span>UCI #{rider.rank}</span>}
                          {rider.baseValue !== undefined && rider.baseValue > 0 && (
                            <span>Waarde: {rider.baseValue}</span>
                          )}
                          {rider.pricePaid !== undefined && rider.pricePaid > 0 && !isSelectionGame && (
                            <span>Betaald: {formatCurrencyWhole(rider.pricePaid)}</span>
                          )}
                          {rider.acquisitionType && rider.acquisitionType !== 'auction' && (
                            <span className="text-gray-400 italic">
                              {rider.acquisitionType === 'draft' ? 'Draft' : 
                               rider.acquisitionType === 'selection' ? 'Selectie' : 
                               rider.acquisitionType}
                            </span>
                          )}
                          {riderPopularity && !isAuctioneer && (
                            <span className="text-blue-600">
                              Gekozen door {riderPopularity.percentage}% ({riderPopularity.selectedBy}/{riderPopularity.totalTeams})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* ROI Badge */}
                      {rider.baseValue !== undefined && rider.baseValue > 0 && (
                        <div className={`text-right hidden sm:block`}>
                          <div className={`text-lg font-semibold ${roiColorClass}`}>
                            {riderRoi >= 0 ? '+' : ''}{Math.round(riderRoi)}%
                          </div>
                          <div className="text-xs text-gray-400">ROI</div>
                        </div>
                      )}
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
  );
}
