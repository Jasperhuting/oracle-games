'use client';

import { useState } from 'react';
import { Trophy } from 'tabler-icons-react';

interface StandingEntry {
  userId: string;
  playername: string;
  ranking: number;
  value: number;
  valueFormatted: string;
  gapToLeader: number;
  gapToLeaderFormatted: string;
  picksCount: number;
  missedPicksCount: number;
}

interface SlipstreamStandingsProps {
  yellowJersey: StandingEntry[];
  greenJersey: StandingEntry[];
  racesCompleted: number;
  totalRaces: number;
  currentUserId?: string;
}

type JerseyType = 'yellow' | 'green';

export function SlipstreamStandings({
  yellowJersey,
  greenJersey,
  racesCompleted,
  totalRaces,
  currentUserId
}: SlipstreamStandingsProps) {
  const [activeJersey, setActiveJersey] = useState<JerseyType>('yellow');

  const standings = activeJersey === 'yellow' ? yellowJersey : greenJersey;

  const getRankingBadge = (ranking: number) => {
    if (ranking === 1) return '🥇';
    if (ranking === 2) return '🥈';
    if (ranking === 3) return '🥉';
    return `${ranking}.`;
  };

  const getJerseyEmoji = (jersey: JerseyType) => {
    return jersey === 'yellow' ? '🟡' : '🟢';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Standings
          </h2>
          <span className="text-sm text-gray-500">
            {racesCompleted}/{totalRaces} races
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveJersey('yellow')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeJersey === 'yellow'
                ? 'bg-yellow-400 text-yellow-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🟡 Yellow Jersey
          </button>
          <button
            onClick={() => setActiveJersey('green')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeJersey === 'green'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🟢 Green Jersey
          </button>
        </div>
      </div>

      <div className="p-2">
        <div className="text-xs text-gray-500 px-3 py-2 border-b border-gray-100 grid grid-cols-12 gap-2">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Player</div>
          <div className="col-span-3 text-right">
            {activeJersey === 'yellow' ? 'Time Lost' : 'Points'}
          </div>
          <div className="col-span-3 text-right">Gap</div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {standings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No standings yet
            </div>
          ) : (
            standings.map((entry, index) => {
              const isCurrentUser = entry.userId === currentUserId;
              
              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-12 gap-2 px-3 py-2 items-center ${
                    index % 2 === 0 ? 'bg-gray-50' : ''
                  } ${isCurrentUser ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                >
                  <div className="col-span-1 font-medium">
                    {getRankingBadge(entry.ranking)}
                  </div>
                  <div className="col-span-5">
                    <div className="font-medium text-gray-900 truncate">
                      {entry.playername}
                      {isCurrentUser && (
                        <span className="ml-1 text-xs text-blue-600">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {entry.picksCount} picks
                      {entry.missedPicksCount > 0 && (
                        <span className="text-red-500 ml-1">
                          ({entry.missedPicksCount} missed)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 text-right font-mono text-sm">
                    {entry.valueFormatted}
                  </div>
                  <div className="col-span-3 text-right text-sm text-gray-500">
                    {entry.gapToLeaderFormatted}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        {activeJersey === 'yellow' ? (
          <p>🟡 Yellow Jersey: Lowest cumulative time lost wins</p>
        ) : (
          <p>🟢 Green Jersey: Highest points from top-10 finishes wins</p>
        )}
      </div>
    </div>
  );
}

export function YellowJerseyStandings({
  standings,
  racesCompleted,
  totalRaces,
  currentUserId
}: {
  standings: StandingEntry[];
  racesCompleted: number;
  totalRaces: number;
  currentUserId?: string;
}) {
  return (
    <SlipstreamStandings
      yellowJersey={standings}
      greenJersey={[]}
      racesCompleted={racesCompleted}
      totalRaces={totalRaces}
      currentUserId={currentUserId}
    />
  );
}

export function GreenJerseyStandings({
  standings,
  racesCompleted,
  totalRaces,
  currentUserId
}: {
  standings: StandingEntry[];
  racesCompleted: number;
  totalRaces: number;
  currentUserId?: string;
}) {
  return (
    <SlipstreamStandings
      yellowJersey={[]}
      greenJersey={standings}
      racesCompleted={racesCompleted}
      totalRaces={totalRaces}
      currentUserId={currentUserId}
    />
  );
}
