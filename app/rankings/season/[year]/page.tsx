'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@/components/AuthGuard';
import { usePlayerTeams } from '@/contexts/PlayerTeamsContext';

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

  const { riders: rankingsRiders, loading: rankingsLoading, total: totalRiders } = usePlayerTeams();


  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Seizoen Punten 2026
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
            {/* <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Seizoen:</label>
              <div className="flex gap-2">
                {yearOptions.map(y => (
                  <button
                    key={y}
                    disabled={y !== currentYear}
                    onClick={() => handleYearChange(y.toString())}
                    className={`px-4 py-2 rounded-lg transition-colors ${y !== currentYear ? 'bg-gray-100! cursor-not-allowed' : 'cursor-pointer'} ${
                      selectedYear === y.toString()
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div> */}

            {/* Stats Summary */}
            <div className="flex w-full gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1">
                <div className="text-sm text-gray-600">Totaal Renners</div>
                <div className="text-2xl font-bold text-gray-900">{totalRiders}</div>
              </div>
            </div>
          </div>

          {/* Error */}
          {/* {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )} */}

          {/* Loading */}
          {rankingsLoading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="text-gray-600">Laden...</div>
            </div>
          ) : rankingsRiders.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Geen seizoenspunten gevonden voor 2026</p>
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Punten
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rankingsRiders.map((rider, index) => {                      
                      return (
                        <tr
                          key={`${rider.riderNameId}_${rider.id || 'no-id'}`}                            
                          className={`transition-colors`}
                        >
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              (index + 1) === 1 ? 'bg-yellow-100 text-yellow-800' :
                              (index + 1) === 2 ? 'bg-gray-200 text-gray-800' :
                              (index + 1) === 3 ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{rider.riderName}</div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="font-medium text-gray-900">{rider.pointsScored}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
